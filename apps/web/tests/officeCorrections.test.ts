import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {createReport,saveDraft,submitReport} from '../lib/serverStore';
import {applyCommand,getIssue,listIssues} from '../lib/issueStore';
import {applyVariationCommand,getVariation,listVariations} from '../lib/variationStore';
import {applyCorrection,listCorrections,OUR_CONTRACT_OWNER,readCorrectionInput,type CorrectionInput} from '../lib/corrections';
import {canCorrectReport,canIssueCommand} from '../lib/auth/access';
import {database} from '../lib/storage';
import type {Issue,Observation,Report,Variation} from '../lib/types';

const engineer:Principal = {id:'entra:engineer' as never,oid:'engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const manager:Principal = {id:'entra:manager' as never,oid:'manager',name:'Tom',email:'t@example.test',role:'Manager'};
const office = {name:manager.name,id:manager.id as string};
const ok = <T,>(o:{ok:true;value:T}|{ok:false;reason:string;status?:number}):T => { assert.equal(o.ok,true,o.ok ? '' : o.reason); return (o as {ok:true;value:T}).value; };
const refused = (o:{ok:boolean;status?:number;reason?:string},status:number,message?:string) => { assert.equal(o.ok,false,message); assert.equal(o.status,status,`${message ?? ''} ${o.reason ?? ''}`); };

const photo = {id:'33333333-3333-4333-8333-333333333333',dataUrl:'/api/media/33333333-3333-4333-8333-333333333333',caption:'Riser',capturedAt:new Date().toISOString()};
const obs = (id:string,type:Observation['type'],whatHappened:string,owner = ''):Observation => ({id,type,location:'L2 riser',whatHappened,actionNeeded:type === 'defect' ? 'Make good' : '',owner,photos:[photo]});

async function sent(observations:Observation[]):Promise<Report> {
  const report = createReport('proj-011lme',engineer.name,engineer);
  const saved = ok(saveDraft(report.id,{...report,observations},report.version));
  return ok(await submitReport(report.id,{name:engineer.name},saved.version));
}

// One store per file: the connection is a module singleton that is not reopened after close.
test('the office corrects what an engineer reported, recorded against the report and the engineer',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-office-corrections-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    const first = await sent([obs('obs-d1','defect','Fire stopping missing at riser'),obs('obs-v1','instruction','Extra socket in the comms room')]);
    const second = await sent([
      obs('obs-d2','defect','Fire stopping missing at riser, again'),
      obs('obs-d3','defect','Cable tray not earthed','Main contractor'),
      obs('obs-v2','instruction','Extra socket in the comms room'),
      obs('obs-v3','instruction','Relocate the isolator'),
      obs('obs-p','update','Containment complete'),
    ]);
    const issueFor = (report:Report,observation:string):Issue => listIssues('proj-011lme').find(i => i.raisedByReport === report.id && i.raisedByObservation === observation)!;
    const variationFor = (report:Report,observation:string):Variation => listVariations('proj-011lme').find(v => v.raisedByReport === report.id && v.raisedByObservation === observation)!;
    const base = (fields:Partial<CorrectionInput>):CorrectionInput => ({reportId:second.id,observationId:'obs-d2',action:'note',targetType:'issue',note:'',...fields});

    await t.test('an office note on an issue changes nothing but the history, and is an office act',() => {
      const issue = issueFor(first,'obs-d1');
      refused(applyCommand(issue.id,{kind:'note',actor:manager.name,actorId:manager.id,note:'  '}),422,'a note needs words');
      refused(applyCommand(issue.id,{kind:'note',actor:manager.name,actorId:manager.id,note:'x'.repeat(4001)}),422,'and at most 4,000 characters');
      const noted = ok(applyCommand(issue.id,{kind:'note',actor:manager.name,actorId:manager.id,note:'Chased the fire stopping sub'}));
      assert.equal(noted.events.at(-1)?.kind,'note');
      assert.equal(noted.events.at(-1)?.actorId,manager.id);
      assert.equal(noted.work,issue.work);
      assert.equal(noted.confirmation,issue.confirmation);
      assert.equal(canIssueCommand(manager,'note'),true);
      assert.equal(canIssueCommand(engineer,'note'),false);
      assert.equal(canCorrectReport(manager),true);
      assert.equal(canCorrectReport(engineer),false);
    });

    await t.test('the request body is checked for shape before anything else',() => {
      assert.equal(readCorrectionInput(null).ok,false);
      assert.equal(readCorrectionInput({reportId:'r',observationId:'o',action:'delete',targetType:'issue',note:''}).ok,false);
      assert.equal(readCorrectionInput({reportId:'r',observationId:'o',action:'note',targetType:'issue',targetId:7,note:''}).ok,false);
      assert.deepEqual(ok(readCorrectionInput({reportId:'r',observationId:'o',action:'note',targetType:'observation',note:'Hi'})),{reportId:'r',observationId:'o',action:'note',targetType:'observation',note:'Hi'});
    });

    await t.test('within contract on an issue hands it to Leodis, keeping the target date',() => {
      const issue = issueFor(second,'obs-d3');
      ok(applyCommand(issue.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'',targetDate:'2026-10-01'}));
      const result = ok(applyCorrection(base({observationId:'obs-d3',action:'within_contract',targetId:issue.id,note:'Earthing is in our package'}),office));
      assert.equal(result.issue?.owner,OUR_CONTRACT_OWNER);
      assert.equal(result.issue?.targetDate,'2026-10-01');
      assert.equal(result.issue?.work,'assigned');
      const event = result.issue!.events.at(-1)!;
      assert.equal(event.kind,'assigned');
      assert.match(event.note,/Earthing is in our package/);
      assert.equal(event.sourceReportId,second.id);
      assert.equal(event.correctionId,result.correction.id);
      assert.equal(result.correction.title,'Responsibility changed');
      assert.equal(result.correction.detail,`From Main contractor to ${OUR_CONTRACT_OWNER}.`);
      assert.equal(result.correction.engineerId,engineer.id);
      assert.equal(result.correction.engineer,engineer.name);
      assert.equal(result.correction.actorId,manager.id);
      assert.equal(result.correction.targetId,issue.id);
    });

    await t.test('a record from another section, or a report that does not exist, is refused',() => {
      refused(applyCorrection(base({observationId:'obs-d2',action:'within_contract',targetId:issueFor(second,'obs-d3').id}),office),422,'the target must come from this section');
      refused(applyCorrection(base({reportId:'rep-missing'}),office),404);
      refused(applyCorrection(base({observationId:'obs-missing',targetId:issueFor(second,'obs-d2').id,note:'x'}),office),404);
      refused(applyCorrection(base({targetId:'iss-missing',note:'x'}),office),404);
      refused(applyCorrection(base({observationId:'obs-p',targetType:'observation',action:'within_contract'}),office),422,'a progress section can only take a note');
    });

    await t.test('already raised withdraws the duplicate issue and adds a sighting to the original, in one step',() => {
      const target = issueFor(second,'obs-d2'), related = issueFor(first,'obs-d1');
      refused(applyCorrection(base({action:'already_raised',targetId:target.id,relatedId:target.id}),office),422,'not a duplicate of itself');
      refused(applyCorrection(base({action:'already_raised',targetId:target.id,relatedId:'iss-missing'}),office),404);
      assert.equal(getIssue(target.id)?.confirmation,target.confirmation,'a refused correction leaves the target untouched');

      const result = ok(applyCorrection(base({action:'already_raised',targetId:target.id,relatedId:related.id,note:'Same riser'}),office));
      assert.equal(result.issue?.confirmation,'withdrawn');
      assert.equal(result.issue?.duplicateOf,related.id);
      assert.equal(result.issue?.events.at(-1)?.note,`Already raised as ${related.reference}. Same riser`);
      assert.equal(result.issue?.events.at(-1)?.correctionId,result.correction.id);
      const sighting = (result.related as Issue).events.at(-1)!;
      assert.equal(sighting.kind,'note');
      assert.match(sighting.note,new RegExp(`^Seen again in ${second.reference} \\(\\d{1,2} [A-Z][a-z]{2} \\d{4}\\) as ${target.reference}\\.$`));
      assert.equal(sighting.sourceReportId,second.id);
      assert.equal(getIssue(related.id)?.events.at(-1)?.correctionId,result.correction.id,'stored, not just returned');
      assert.equal(result.correction.title,'Marked as already raised');
      assert.equal(result.correction.detail,`Linked to ${related.reference} instead of a new issue.`);
      assert.equal(result.correction.relatedId,related.id);

      refused(applyCorrection(base({action:'already_raised',targetId:target.id,relatedId:related.id}),office),409,'already withdrawn');
      refused(applyCorrection(base({action:'within_contract',targetId:target.id}),office),409,'a withdrawn issue cannot change hands');
    });

    await t.test('within contract on a variation takes it out of the money; only while awaiting instruction',() => {
      const v = variationFor(second,'obs-v2');
      ok(applyVariationCommand(v.id,{kind:'price',actor:manager.name,actorId:manager.id,note:'',costing:{quotedValue:500}}));
      const result = ok(applyCorrection(base({observationId:'obs-v2',targetType:'variation',action:'within_contract',targetId:v.id,note:''}),office));
      assert.equal(result.variation?.instruction,'within_contract');
      assert.equal(result.variation?.events.at(-1)?.kind,'within_contract');
      assert.equal(result.variation?.events.at(-1)?.sourceReportId,second.id);
      assert.equal(result.correction.title,'Reclassified as within contract');
      assert.equal(result.correction.detail,'Not chargeable. Was £500.00.');
      refused(applyCorrection(base({observationId:'obs-v2',targetType:'variation',action:'within_contract',targetId:v.id}),office),409);
    });

    await t.test('already raised declines the duplicate variation and notes the original',() => {
      const target = variationFor(second,'obs-v3'), related = variationFor(first,'obs-v1');
      const result = ok(applyCorrection(base({observationId:'obs-v3',targetType:'variation',action:'already_raised',targetId:target.id,relatedId:related.id,note:''}),office));
      assert.equal(result.variation?.instruction,'declined');
      assert.equal(result.variation?.duplicateOf,related.id);
      assert.equal(result.variation?.events.at(-1)?.note,`Already raised as ${related.reference}.`);
      assert.match(getVariation(related.id)!.events.at(-1)!.note,/^Seen again in /);
      assert.equal(result.correction.detail,`Linked to ${related.reference} instead of a new variation.`);
    });

    await t.test('a note on a progress section is a correction on its own, and needs words',() => {
      refused(applyCorrection(base({observationId:'obs-p',targetType:'observation',note:' '}),office),422);
      const before = JSON.stringify([listIssues('proj-011lme'),listVariations('proj-011lme')]);
      const result = ok(applyCorrection(base({observationId:'obs-p',targetType:'observation',note:'Photograph the containment next time'}),office));
      assert.equal(result.correction.title,'Note added');
      assert.equal(result.correction.detail,'');
      assert.equal(result.correction.targetId,undefined);
      assert.equal(result.issue,undefined);
      assert.equal(JSON.stringify([listIssues('proj-011lme'),listVariations('proj-011lme')]),before,'no record is touched');
    });

    await t.test('corrections are listed against the report and the engineer, newest last',() => {
      const forReport = listCorrections({reportId:second.id});
      assert.deepEqual(forReport.map(c => c.title).sort(),['Marked as already raised','Marked as already raised','Note added','Reclassified as within contract','Responsibility changed']);
      assert.ok(forReport.every((c,i) => i === 0 || forReport[i - 1]!.at <= c.at),'oldest first, newest last');
      assert.equal(listCorrections({reportId:first.id}).length,0);
      assert.equal(listCorrections({engineerId:engineer.id}).length,5);
      assert.equal(listCorrections({engineerId:'entra:someone-else'}).length,0);
    });
  } finally { database().close(); rmSync(root,{recursive:true,force:true}); }
});
