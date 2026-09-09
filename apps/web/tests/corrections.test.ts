import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {acknowledgeReport,correctReport,createReport,getReport,reportsFor,saveDraft,submitReport} from '../lib/serverStore';
import {applyCommand,listIssues} from '../lib/issueStore';
import {database} from '../lib/storage';
import {deliveryStatus} from '../lib/status';
import type {Issue,Observation,Report} from '../lib/types';

const engineer:Principal = {id:'entra:engineer' as never,oid:'engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const manager:Principal = {id:'entra:manager' as never,oid:'manager',name:'Tom',email:'t@example.test',role:'Manager'};

const photo = {id:'11111111-1111-4111-8111-111111111111',dataUrl:'/api/media/11111111-1111-4111-8111-111111111111',caption:'Tray cover',capturedAt:new Date().toISOString()};
const defect:Observation = {id:'obs-defect',type:'defect',location:'L1 riser',whatHappened:'Cable tray cover damaged',actionNeeded:'Replace cover',owner:'C&AJ Marshall',photos:[photo]};
const progress:Observation = {id:'obs-progress',type:'update',location:'L3 riser',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]};

async function sent(report:Report):Promise<Report> {
  const saved = saveDraft(report.id,{...report,observations:[defect,progress]},report.version);
  assert.equal(saved.ok,true);
  const outcome = await submitReport(report.id,{name:engineer.name},(saved as {ok:true;value:Report}).value.version);
  assert.equal(outcome.ok,true);
  return (outcome as {ok:true;value:Report}).value;
}

// One store per file: the connection is a module singleton that is not reopened after close.
test('corrections, acknowledgement and the draft allowlist marry the engineer side to the office',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-corrections-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    await t.test('a correction links the copied defects to the issues the original raised, so sending it adds a sighting instead of a duplicate',async () => {
      const original = await sent(createReport('proj-011lme',engineer.name,engineer));
      const raised = listIssues('proj-011lme');
      assert.equal(raised.length,1);
      assert.equal(raised[0]!.raisedByObservation,'obs-defect');

      const correction = correctReport(original.id,'Wrong level recorded');
      assert.equal(correction.ok,true);
      const draft = (correction as {ok:true;value:Report}).value;
      assert.equal(draft.state,'draft');
      assert.equal(draft.revision,2);
      assert.equal(draft.corrects,original.id);
      assert.equal(draft.observations.find(o => o.id === 'obs-defect')?.linkedIssueId,raised[0]!.id);
      assert.equal(draft.observations.find(o => o.id === 'obs-progress')?.linkedIssueId,undefined);
      assert.equal(draft.observations[0]!.photos[0]!.dataUrl,photo.dataUrl,'photographs are kept, not re-uploaded');

      const again = correctReport(original.id,'Second attempt');
      assert.equal(again.ok && again.value.id,draft.id,'one correction per original');

      const resent = await submitReport(draft.id,{name:engineer.name},draft.version);
      assert.equal(resent.ok,true);
      const after = listIssues('proj-011lme');
      assert.equal(after.length,1,'no second issue for the same defect');
      assert.match(after[0]!.events.at(-1)!.note,/^Corrected in 011LME-SPR-001 rev 2:/);
      assert.equal(getReport(original.id)?.state,'submitted','the original is untouched');
    });

    await t.test('an issue raised with an owner can be reassigned and given a target date without a state change',() => {
      const issue = listIssues('proj-011lme')[0]!;
      assert.equal(issue.work,'assigned','raised with an owner named on site');
      const moved = applyCommand(issue.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'',owner:'Northbank',targetDate:'2026-09-30'});
      assert.equal(moved.ok,true,moved.ok ? '' : moved.reason);
      const after = moved as {ok:true;value:Issue};
      assert.equal(after.value.work,'assigned');
      assert.equal(after.value.owner,'Northbank');
      assert.equal(after.value.targetDate,'2026-09-30');
      assert.equal(after.value.events.at(-1)!.kind,'assigned');
      const closed = applyCommand(issue.id,{kind:'submit_closure',actor:engineer.name,actorId:engineer.id,note:'done'});
      assert.equal(closed.ok,true);
      const refused = applyCommand(issue.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'',owner:'Anyone'});
      assert.equal(refused.ok,false,'awaiting verification is not reassigned; it is reopened first');
    });

    await t.test('acknowledgement is a fact of its own, recorded once against a submitted report',async () => {
      const draft = createReport('proj-014lme',engineer.name,engineer);
      assert.equal(acknowledgeReport(draft.id,manager,'').ok,false,'a draft cannot be acknowledged');
      const report = await sent(draft);
      const first = acknowledgeReport(report.id,manager,'Seen, chasing Marshall');
      assert.equal(first.ok,true);
      const at = (first as {ok:true;value:Report}).value.acknowledged?.at;
      assert.equal((first as {ok:true;value:Report}).value.acknowledged?.byId,manager.id);
      const second = acknowledgeReport(report.id,{...manager,name:'Someone else'},'');
      assert.equal((second as {ok:true;value:Report}).value.acknowledged?.at,at,'the first acknowledgement stands');
      assert.equal(getReport(report.id)?.delivery,'pending','acknowledging sends nothing');
    });

    await t.test('the office sees section counts and the trade on another engineer\'s draft, never its contents',() => {
      const draft = createReport('proj-009lcp',engineer.name,engineer);
      saveDraft(draft.id,{...draft,observations:[defect,{...progress,whatHappened:'PRIVATE'}]},draft.version);
      const summary = reportsFor(manager,'proj-009lcp').items[0]!;
      assert.equal(summary.observationCount,2);
      assert.equal(summary.authorTrade,'Electrical');
      assert.equal('observations' in summary,false);
      assert.equal(JSON.stringify(summary).includes('PRIVATE'),false);
      assert.equal(summary.kindCounts,undefined,'per-kind counts are contents until the report is sent');
      const own = reportsFor(engineer,'proj-009lcp').items[0]!;
      assert.deepEqual(own.kindCounts,{update:1,defect:1,instruction:0,access:0});
    });
  } finally { database().close(); rmSync(root,{recursive:true,force:true}); }
});

test('the email is a notification to the project manager, stated quietly when it has not gone',() => {
  const line = deliveryStatus({state:'submitted',delivery:'outbox'} as Report);
  assert.equal(line?.tone,'draft');
  assert.match(line!.label,/not notified/i);
  assert.equal(deliveryStatus({state:'submitted',delivery:'failed'} as Report)?.tone,'alert','a processing failure still shouts');
});
