import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {correctReport,createReport,saveDraft,submitReport} from '../lib/serverStore';
import {applyVariationCommand,listVariations} from '../lib/variationStore';
import {canVariationCommand} from '../lib/auth/access';
import {database} from '../lib/storage';
import {estimatedMargin,expectedCost,marginPct,readCosting,suggestedQuote} from '../lib/variations';
import type {Observation,Report,Variation} from '../lib/types';

const engineer:Principal = {id:'entra:engineer' as never,oid:'engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const manager:Principal = {id:'entra:manager' as never,oid:'manager',name:'Tom',email:'t@example.test',role:'Manager'};
const photo = {id:'22222222-2222-4222-8222-222222222222',dataUrl:'/api/media/22222222-2222-4222-8222-222222222222',caption:'Plantroom wall',capturedAt:new Date().toISOString()};
const variation:Observation = {id:'obs-vo',type:'instruction',location:'L1 plantroom',whatHappened:'Additional socket outlets for the BMS panel',actionNeeded:'',owner:'',photos:[photo]};
const progress:Observation = {id:'obs-progress',type:'update',location:'L3 riser',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]};
const ok = <T,>(o:{ok:true;value:T}|{ok:false;reason:string;status?:number}):T => { assert.equal(o.ok,true,o.ok ? '' : o.reason); return (o as {ok:true;value:T}).value; };

async function sent(report:Report,observations:Observation[]):Promise<Report> {
  const saved = ok(saveDraft(report.id,{...report,observations},report.version));
  return ok(await submitReport(report.id,{name:engineer.name},saved.version));
}

// One store per file: the connection is a module singleton that is not reopened after close.
test('variations are raised at submission and worked by the office in step with the Variation Register',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-variations-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    let raised:Variation;
    await t.test('a "Variation required" update raises one pending variation with the visit evidence, numbered per project',async () => {
      const report = await sent(createReport('proj-011lme',engineer.name,engineer),[variation,progress]);
      const all = listVariations('proj-011lme');
      assert.equal(all.length,1);
      raised = all[0]!;
      assert.equal(raised.reference,'011LME-VO-001');
      assert.equal(raised.instruction,'pending');
      assert.equal(raised.trade,'Electrical','defaults to the engineer\'s trade');
      assert.equal(raised.reason,undefined,'the office chooses the reason');
      assert.equal(raised.workDone,false);
      assert.equal(raised.raisedByReport,report.id);
      assert.equal(raised.raisedByObservation,'obs-vo');
      assert.equal(raised.raisedById,engineer.id);
      assert.equal(raised.events[0]?.kind,'raised');
      assert.equal(raised.events[0]?.photos.length,1,'the photographs travel with it');
      assert.equal(listVariations('proj-014lme').length,0);
    });

    await t.test('a correction of the report adds a note to the variation instead of raising it again',async () => {
      const original = listVariations('proj-011lme')[0]!.raisedByReport!;
      const draft = ok(correctReport(original,'Wrong level recorded'));
      await sent(draft,draft.observations);
      const all = listVariations('proj-011lme');
      assert.equal(all.length,1,'no second variation for the same update');
      assert.match(all[0]!.events.at(-1)!.note,/^Corrected in 011LME-SPR-001 rev 2:/);
    });

    await t.test('the arithmetic is the register\'s: labour × rate + parts + plant, margin against quote until instructed',() => {
      const c = ok(readCosting({labourHours:'12',labourRate:'45',partsCost:'640',plantSubcontract:'60',upliftPct:'25',quotedValue:'1860'}));
      assert.equal(expectedCost(c),1240);
      assert.equal(suggestedQuote(c),1550);
      assert.equal(estimatedMargin({...c,instruction:'pending'}),620);
      assert.ok(Math.abs(marginPct({...c,instruction:'pending'})! - 1/3) < 1e-9);
      assert.equal(expectedCost({}),undefined,'nothing costed is not £0');
      assert.equal(estimatedMargin({quotedValue:100,instruction:'pending'}),undefined,'a quote with no cost has no margin');
      assert.equal(readCosting({labourHours:'-1'}).ok,false);
      assert.equal(readCosting({quotedValue:'abc'}).ok,false);
      assert.deepEqual(ok(readCosting({labourHours:'',quotedValue:'£1,860.00'})),{quotedValue:1860},'blank is not known; currency formatting is tolerated');
    });

    await t.test('price, instruct, decline and reopen follow the instruction state and record who did what',() => {
      const id = raised.id;
      const priced = ok(applyVariationCommand(id,{kind:'price',actor:manager.name,actorId:manager.id,note:'',costing:{labourHours:12,labourRate:45,partsCost:640,plantSubcontract:60,upliftPct:25,quotedValue:1860}}));
      assert.equal(priced.quotedValue,1860);
      assert.equal(priced.events.at(-1)?.kind,'priced');
      assert.match(priced.events.at(-1)!.note,/Quoted £1,860\.00/);
      assert.equal(priced.events.at(-1)?.actorId,manager.id);

      assert.equal(applyVariationCommand(id,{kind:'decline',actor:manager.name,note:''}).ok,false,'declining needs a reason');
      assert.equal(applyVariationCommand(id,{kind:'instruct',actor:manager.name,note:'',instruction:{by:'G. Marshall',on:'2026-09-08'}}).ok,false,'an instruction needs a reference');
      assert.equal(applyVariationCommand(id,{kind:'instruct',actor:manager.name,note:'',instruction:{reference:'CVI-014',by:'G. Marshall',on:'yesterday'}}).ok,false,'and a real date');

      const instructed = ok(applyVariationCommand(id,{kind:'instruct',actor:manager.name,actorId:manager.id,note:'',instruction:{reference:'CVI-014',by:'G. Marshall',on:'2026-09-08',signedInstruction:'https://leodisdevelopments.sharepoint.com/sites/Operations/signed.pdf'}}));
      assert.equal(instructed.instruction,'instructed');
      assert.equal(instructed.instructedValue,1860,'defaults to the quote');
      assert.equal(instructed.instructionReference,'CVI-014');
      assert.equal(instructed.signedInstruction,'https://leodisdevelopments.sharepoint.com/sites/Operations/signed.pdf');
      assert.equal(estimatedMargin(instructed),620);
      assert.equal(applyVariationCommand(id,{kind:'price',actor:manager.name,note:'',costing:{quotedValue:2000}}).ok,false,'an instructed value is fixed');
      assert.equal(applyVariationCommand(id,{kind:'decline',actor:manager.name,note:'Changed mind'}).ok,false,'already instructed');
      assert.equal(applyVariationCommand(id,{kind:'reopen',actor:manager.name,note:''}).ok,false,'reopening needs a reason');

      const reopened = ok(applyVariationCommand(id,{kind:'reopen',actor:manager.name,actorId:manager.id,note:'Client withdrew the CVI'}));
      assert.equal(reopened.instruction,'pending');
      assert.equal(reopened.instructionReference,'CVI-014','the recorded instruction stays in the history');
      const declined = ok(applyVariationCommand(id,{kind:'decline',actor:manager.name,actorId:manager.id,note:'Client will not pay for it'}));
      assert.equal(declined.instruction,'declined');
      assert.equal(declined.events.at(-1)?.kind,'declined');
      assert.equal(declined.events.length,raised.events.length + 5,'every act is an event; nothing is overwritten silently');
    });

    await t.test('details are the office\'s to correct, within the register\'s choices; work done without an instruction is a fact of its own',() => {
      const id = raised.id;
      assert.equal(applyVariationCommand(id,{kind:'details',actor:manager.name,note:'',details:{trade:'Plumbing'}}).ok,false);
      assert.equal(applyVariationCommand(id,{kind:'details',actor:manager.name,note:'',details:{reason:'Because'}}).ok,false);
      const updated = ok(applyVariationCommand(id,{kind:'details',actor:manager.name,actorId:manager.id,note:'',details:{trade:'Multi',reason:'Design change',workDone:true,location:'L1 plantroom, east wall'}}));
      assert.equal(updated.trade,'Multi');
      assert.equal(updated.reason,'Design change');
      assert.equal(updated.workDone,true);
      assert.equal(updated.location,'L1 plantroom, east wall');
      assert.equal(updated.description,variation.whatHappened,'untouched fields stay');
      assert.match(updated.events.at(-1)!.note,/work already carried out/);
      assert.equal(applyVariationCommand(id,{kind:'note',actor:engineer.name,actorId:engineer.id,note:''}).ok,false);
      assert.equal(ok(applyVariationCommand(id,{kind:'note',actor:engineer.name,actorId:engineer.id,note:'Site manager gave the go-ahead verbally on Tuesday'})).events.at(-1)?.kind,'note');
    });

    await t.test('what the engineer records on the card reaches the issue and the variation the office works',async () => {
      const report = await sent(createReport('proj-009lcp',engineer.name,engineer),[
        {id:'obs-d',type:'defect',location:'Welfare block roof',whatHappened:'Flashing lifted at the AHU curb',actionNeeded:'Re-seal',owner:'',photos:[photo],affectedTrade:'Other / non-Leodis'},
        {id:'obs-v',type:'instruction',location:'Welfare block plantroom',whatHappened:'Extra isolator for the new pump',actionNeeded:'',owner:'',photos:[],variationReason:'Site condition',workDone:true,askedBy:'R. Ellison',roughSize:'half-day',partsEstimate:85},
      ]);
      const {listIssues} = await import('../lib/issueStore');
      const issue = listIssues('proj-009lcp')[0]!;
      assert.equal(issue.affectedTrade,'Other / non-Leodis','the trade named on site, not the reporter’s');
      assert.equal(issue.reporterTrade,'Electrical');
      const v = listVariations('proj-009lcp')[0]!;
      assert.equal(v.raisedByReport,report.id);
      assert.equal(v.reason,'Site condition');
      assert.equal(v.workDone,true);
      assert.equal(v.askedBy,'R. Ellison');
      assert.equal(v.labourHours,4,'half a day starts the office at four hours');
      assert.equal(v.partsCost,85);
      assert.match(v.events[0]!.note,/already carried out on a say-so · asked for on site by R\. Ellison · about half a day · parts about £85/);
    });

    await t.test('engineers may add a note; pricing, instructing, declining, reopening and editing are office acts',() => {
      assert.equal(canVariationCommand(engineer,'note'),true);
      for (const kind of ['details','price','instruct','decline','reopen']) {
        assert.equal(canVariationCommand(engineer,kind),false,kind);
        assert.equal(canVariationCommand(manager,kind),true,kind);
      }
      assert.equal(canVariationCommand(manager,'delete'),false);
    });
  } finally { database().close(); rmSync(root,{recursive:true,force:true}); }
});
