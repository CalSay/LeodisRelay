import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {correctReport,createReport,getReport,saveDraft,submitReport} from '../lib/serverStore';
import {listIssues} from '../lib/issueStore';
import {database} from '../lib/storage';
import {SaveConflict,saveWithJournal,type SaveJournal,type SaveRequest} from '../lib/saveRequest';
import {carryIntoCorrection,unsentWork} from '../lib/sentElsewhere';
import {savedCopy} from '../lib/uploadStatus';
import type {DraftBase} from '../lib/draftConflict';
import type {Observation,Report} from '../lib/types';

const engineer:Principal = {id:'entra:sent-engineer' as never,oid:'sent-engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const card = (id:string,whatHappened:string,extra:Partial<Observation> = {}):Observation => ({id,type:'update',location:'L3 riser',whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const report = (observations:Observation[],extra:Partial<Report> = {}) => ({id:'rep-1',projectId:'p',reference:'R',visitDate:'2026-10-20',author:'G. S.',state:'draft',version:3,revision:1,review:'not_required',observations,...extra}) as Report;
const photo = {id:'22222222-2222-4222-8222-222222222222',dataUrl:'/api/media/22222222-2222-4222-8222-222222222222',caption:'Tray cover',capturedAt:'2026-10-20T08:00:00.000Z'};
const baseOf = (cards:Observation[]):DraftBase => ({cards:Object.fromEntries(cards.map(o => [o.id,savedCopy(o)]))});
const ids = (o:readonly Observation[]) => o.map(x => `${x.id}:${x.whatHappened}`);

test('changes left on a screen when the report was sent elsewhere',async t => {
  await t.test('nothing is offered when the screen holds what was sent, even with a different draft signature',() => {
    const cards = [card('a','Containment complete')];
    const work = unsentWork(report(cards,{draftSignature:{name:'G. S.'}}),report(structuredClone(cards),{state:'submitted'}),baseOf(cards));
    assert.deepEqual(work.changes,[]);
  });

  await t.test('with the base known, only this screen\'s own changes are carried and the other screen\'s stand',() => {
    const base = [card('a','Same'),card('b','Original b'),card('c','Original c'),card('d','Original d'),card('e','Original e')];
    // This screen: edited b, removed c, added f. The other screen: edited d, removed e, added g, then sent.
    const here = report([card('a','Same'),card('b','Edited here'),card('d','Original d'),card('e','Original e'),card('f','Added here')]);
    const sent = report([card('a','Same'),card('b','Original b'),card('c','Original c'),card('d','Edited there'),card('g','Added there')],{state:'submitted'});
    const work = unsentWork(here,sent,baseOf(base));
    assert.deepEqual(work.changes.map(c => [c.id,c.kind,c.check]),[['b','changed',undefined],['c','removed',undefined],['f','added',undefined]]);
    assert.deepEqual(ids(work.observations),['a:Same','b:Edited here','d:Edited there','g:Added there','f:Added here'],
      'the other screen\'s edit, removal and new card are kept; this screen\'s edit and new card are added and its removal applied');
  });

  await t.test('a card changed on both screens uses this screen\'s wording and is marked to check',() => {
    const work = unsentWork(report([card('a','Mine')]),report([card('a','Theirs')],{state:'submitted'}),baseOf([card('a','Before')]));
    assert.deepEqual(work.changes.map(c => [c.id,c.kind,c.check]),[['a','changed','both']]);
    assert.deepEqual(ids(work.observations),['a:Mine']);
  });

  await t.test('without a base nothing in the sent report is dropped, and this screen\'s differences are marked to check',() => {
    const work = unsentWork(report([card('a','Mine'),card('f','Only here')]),report([card('a','Theirs'),card('g','Only sent')],{state:'submitted'}));
    assert.deepEqual(work.changes.map(c => [c.id,c.kind,c.check]),[['a','changed','both'],['g','removed','maybe-removed-here'],['f','added','maybe-removed']]);
    assert.deepEqual(ids(work.observations),['a:Mine','g:Only sent','f:Only here']);
  });

  await t.test('a card one screen removed and the other edited is kept, and said so either way',() => {
    const base = [card('a','Before a'),card('b','Before b')];
    // This screen edited a and removed b; the other screen removed a and edited b, then sent.
    const work = unsentWork(report([card('a','Edited here')]),report([card('b','Edited there')],{state:'submitted'}),baseOf(base));
    assert.deepEqual(work.changes.map(c => [c.id,c.kind,c.check]),[['b','removed','edited-there'],['a','changed','removed-there']]);
    assert.deepEqual(ids(work.observations),['b:Edited there','a:Edited here'],'neither card is dropped without being shown');
  });

  await t.test('the carried cards take the issue links the correction gave the sent cards',() => {
    const correction = report([card('a','Sent',{type:'defect',linkedIssueId:'iss-1'}),card('b','Sent b')],{id:'rep-2',revision:2,corrects:'rep-1'});
    const carried = carryIntoCorrection([card('a','Edited',{type:'defect'}),card('b','Sent b'),card('c','New',{type:'defect',linkedIssueId:'iss-9'})],correction);
    assert.deepEqual(carried.map(o => o.linkedIssueId),['iss-1',undefined,'iss-9']);
  });
});

function memoryJournal():SaveJournal {
  let pending:SaveRequest | undefined;
  return {
    claim:async request => pending ??= structuredClone(request),
    acknowledge:async id => { if (pending?.requestId === id) pending = undefined; },
    discard:async id => { if (pending?.requestId === id) pending = undefined; },
  };
}
/** What lib/api.ts does with the PUT route's answer. */
function sendTo(id:string) {
  return async (request:SaveRequest) => {
    const {draftSignature:_old,...rest} = getReport(id)!;
    const outcome = saveDraft(id,{...rest,observations:request.observations},request.expectedVersion,request.requestId);
    if (outcome.ok) return outcome.value;
    if (outcome.current) throw new SaveConflict(outcome.reason,outcome.current);
    throw new Error(outcome.reason);
  };
}

// One store per file: the connection is a module singleton that is not reopened after close.
test('a save after the report was sent elsewhere, against the real store',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-sent-elsewhere-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    const draft = createReport('proj-011lme',engineer.name,engineer);
    const sentCards = [card('obs-a','Tray cover damaged',{type:'defect',actionNeeded:'Replace',owner:'C&AJ Marshall',photos:[photo]}),card('obs-b','Containment complete')];
    const saved = saveDraft(draft.id,{...draft,observations:sentCards},draft.version);
    assert.equal(saved.ok,true);
    const version = (saved as {ok:true;value:Report}).value.version;
    const sent = await submitReport(draft.id,{name:engineer.name},version);
    assert.equal(sent.ok,true,!sent.ok ? sent.reason : '');

    await t.test('is refused with the sent report, so the screen can offer a correction',async () => {
      const mine = [sentCards[0]!,card('obs-b','Containment complete to L4')];
      const error = await saveWithJournal({...draft,observations:mine},version,memoryJournal(),sendTo(draft.id)).then(() => null,(e:unknown) => e);
      assert.ok(error instanceof SaveConflict,'a conflict, not a dead end');
      assert.equal(error.current.state,'submitted');
      assert.match(error.message,/already been sent/);
      assert.equal(getReport(draft.id)!.observations[1]!.whatHappened,'Containment complete','the sent revision is unchanged');
    });

    await t.test('a retried save that landed before the send is answered with the sent report too',() => {
      const requestId = '00000000-0000-4000-8000-00000000abcd';
      const other = createReport('proj-011lme',engineer.name,engineer);
      const first = saveDraft(other.id,{...other,observations:[card('obs-x','Landed')]},other.version,requestId);
      assert.equal(first.ok,true);
      const v = (first as {ok:true;value:Report}).value.version;
      return submitReport(other.id,{name:engineer.name},v).then(outcome => {
        assert.equal(outcome.ok,true);
        const retry = saveDraft(other.id,{...other,observations:[card('obs-x','Landed')]},other.version,requestId);
        assert.equal(retry.ok,false);
        assert.equal(!retry.ok && retry.current?.state,'submitted');
      });
    });

    await t.test('the carried changes save into a new correction, which links the sent defect, and the original stays as sent',async () => {
      const mine = report([sentCards[0]!,card('obs-b','Containment complete to L4'),card('obs-c','Added after',{photos:[]})],{id:draft.id});
      const work = unsentWork(mine,getReport(draft.id)!,baseOf(sentCards));
      assert.deepEqual(work.changes.map(c => c.kind),['changed','added']);
      const correction = correctReport(draft.id,'Adds changes');
      assert.equal(correction.ok,true);
      const fresh = (correction as {ok:true;value:Report}).value;
      const observations = carryIntoCorrection(work.observations,fresh);
      const into = saveDraft(fresh.id,{...fresh,observations},fresh.version);
      assert.equal(into.ok,true,!into.ok ? into.reason : '');
      const issue = listIssues('proj-011lme').find(i => i.raisedByReport === draft.id);
      assert.ok(issue,'the sent defect raised an issue');
      const stored = getReport(fresh.id)!;
      assert.equal(stored.revision,2);
      assert.equal(stored.corrects,draft.id);
      assert.deepEqual(stored.observations.map(o => o.whatHappened),['Tray cover damaged','Containment complete to L4','Added after']);
      assert.equal(stored.observations[0]!.linkedIssueId,issue.id,'sending the correction adds a sighting, not a second issue');
      const original = getReport(draft.id)!;
      assert.equal(original.state,'submitted');
      assert.deepEqual(original.observations.map(o => o.whatHappened),['Tray cover damaged','Containment complete']);
    });
  } finally {
    database().close();
    rmSync(root,{recursive:true,force:true});
  }
});
