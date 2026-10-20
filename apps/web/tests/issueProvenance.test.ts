import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {correctReport,createReport,getReport,reviewSubmission,saveDraft,submitReport} from '../lib/serverStore';
import {applyCommand,getIssue,listIssues} from '../lib/issueStore';
import {eventProvenance} from '../lib/issueProvenance';
import {database,getRecord,putRecord} from '../lib/storage';
import type {Issue,IssueEvent,Observation,Report} from '../lib/types';

const photo = {id:'11111111-1111-4111-8111-111111111111',dataUrl:'/api/media/11111111-1111-4111-8111-111111111111',caption:'Tray cover',capturedAt:'2026-10-20T09:00:00Z'};
const engineer:Principal = {id:'entra:engineer' as never,oid:'engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const manager:Principal = {id:'entra:manager' as never,oid:'manager',name:'Tom',email:'t@example.test',role:'Manager'};
const defect:Observation = {id:'obs-defect',type:'defect',location:'L1 riser',whatHappened:'Cable tray cover damaged',actionNeeded:'Replace cover',owner:'',photos:[photo]};
const added:Observation = {id:'obs-added',type:'access',location:'L2 plant room',whatHappened:'Plant room locked',actionNeeded:'Key from site office',owner:'',photos:[photo]};

const value = <T,>(outcome:{ok:boolean}):T => { assert.equal(outcome.ok,true,(outcome as {reason?:string}).reason); return (outcome as unknown as {value:T}).value; };
async function send(report:Report,observations:Observation[]):Promise<Report> {
  const saved = value<Report>(saveDraft(report.id,{...report,observations},report.version));
  return value<Report>(await submitReport(report.id,{name:engineer.name},saved.version));
}

// One store per file: the connection is a module singleton that is not reopened after close.
test('corrections are new revisions and issue changes name the revision that made them',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-provenance-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    const original = await send(createReport('proj-011lme',engineer.name,engineer),[defect]);
    const snapshot = structuredClone(getRecord<Report>('snapshots',original.id));
    const sentRecord = structuredClone(getReport(original.id));
    let correction:Report;

    await t.test('the issue raised at sending records the report, revision and update',() => {
      const issue = listIssues('proj-011lme')[0]!;
      assert.deepEqual(issue.events[0]!.source,{reportId:original.id,reference:original.reference,revision:1,observationId:'obs-defect'});
    });

    await t.test('a correction is a new revision with its own ID; the sent snapshot is unchanged',async () => {
      assert.ok(snapshot,'sending keeps a snapshot');
      correction = value<Report>(correctReport(original.id,'Wrong level recorded'));
      assert.notEqual(correction.id,original.id);
      assert.equal(correction.revision,original.revision + 1);
      assert.equal(correction.reference,original.reference,'same document, next revision');
      assert.deepEqual(getRecord('snapshots',original.id),snapshot,'opening a correction leaves the snapshot alone');

      const moved = {...defect,location:'L2 riser',linkedIssueId:correction.observations[0]!.linkedIssueId!};
      correction = await send(correction,[moved,added]);
      assert.equal(correction.revision,2);
      assert.deepEqual(getRecord('snapshots',original.id),snapshot,'sending the correction leaves the original snapshot alone');
      assert.deepEqual(getReport(original.id),sentRecord,'and the original report record');
      assert.equal(getRecord<Report>('snapshots',correction.id)?.revision,2,'the correction has a snapshot of its own');
    });

    await t.test('a corrected update adds a sighting that names the correcting revision',() => {
      const issue = listIssues('proj-011lme').find(i => i.raisedByReport === original.id)!;
      const sighting = issue.events.at(-1)!;
      assert.equal(sighting.kind,'progress');
      assert.deepEqual(sighting.source,{reportId:correction.id,reference:original.reference,revision:2,observationId:'obs-defect',corrects:original.id});
      assert.deepEqual(eventProvenance(issue,sighting,issue.events.length - 1),{reportId:correction.id,label:`From ${original.reference} rev 2, which corrects rev 1`});
    });

    await t.test('an issue first raised by a correction points at that revision',() => {
      const issues = listIssues('proj-011lme');
      assert.equal(issues.length,2,'the corrected defect is not raised twice');
      const raised = issues.find(i => i.raisedByObservation === 'obs-added')!;
      assert.equal(raised.raisedByReport,correction.id);
      assert.deepEqual(raised.events[0]!.source,{reportId:correction.id,reference:original.reference,revision:2,observationId:'obs-added',corrects:original.id});
    });

    await t.test('a review decision names the reviewed revision; changes on the issue itself name none',() => {
      putRecord('reports',{...getReport(correction.id)!,review:'pending'});
      value(reviewSubmission(correction.id,'approve',manager.name,'',manager.id));
      const raised = listIssues('proj-011lme').find(i => i.raisedByReport === correction.id)!;
      const decision = raised.events.at(-1)!;
      assert.equal(decision.kind,'confirmation');
      assert.deepEqual(decision.source,{reportId:correction.id,reference:original.reference,revision:2,corrects:original.id});
      assert.equal(eventProvenance(raised,decision,1)?.label,`Review of ${original.reference} rev 2`);

      const assigned = value<Issue>(applyCommand(raised.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'',owner:'Northbank'}));
      assert.equal(assigned.events.at(-1)!.source,undefined);
      assert.equal(eventProvenance(assigned,assigned.events.at(-1)!,assigned.events.length - 1),null);
      assert.equal(getIssue(raised.id)?.events.length,assigned.events.length);
    });

    await t.test('returning a report records the revision on the dispute',async () => {
      const report = await send(createReport('proj-014lme',engineer.name,engineer),[defect]);
      putRecord('reports',{...getReport(report.id)!,review:'pending'});
      value(reviewSubmission(report.id,'return',manager.name,'Wrong riser',manager.id));
      const issue = listIssues('proj-014lme').find(i => i.raisedByReport === report.id)!;
      assert.equal(issue.confirmation,'disputed');
      assert.deepEqual(issue.events.at(-1)!.source,{reportId:report.id,reference:report.reference,revision:1});
    });
  } finally { database().close(); rmSync(root,{recursive:true,force:true}); }
});

test('history written before revisions were recorded still links where it can',() => {
  const ev = (kind:IssueEvent['kind']):IssueEvent => ({kind,at:'2026-09-01T09:00:00Z',actor:'Morgan',note:'',photos:[]});
  assert.deepEqual(eventProvenance({source:'report',raisedByReport:'rep-old'},ev('raised'),0),{reportId:'rep-old',label:'From the report that raised it'});
  assert.equal(eventProvenance({raisedByReport:'rep-old'},ev('raised'),0)?.reportId,'rep-old','older issues have no source field');
  assert.equal(eventProvenance({source:'individual',raisedByReport:''},ev('raised'),0),null,'an individual defect has no report');
  assert.equal(eventProvenance({source:'report',raisedByReport:'rep-old'},ev('progress'),1),null,'an old sighting is not guessed');
  const sourced = {...ev('progress'),source:{reportId:'rep-2',reference:'011LME-SPR-004',revision:1,observationId:'obs-1'}};
  assert.deepEqual(eventProvenance({source:'report',raisedByReport:'rep-old'},sourced,2),{reportId:'rep-2',label:'From 011LME-SPR-004 rev 1'});
});
