import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {createReport,getReport,saveDraft} from '../lib/serverStore';
import {database} from '../lib/storage';
import {SaveConflict,saveWithJournal,type SaveJournal,type SaveRequest} from '../lib/saveRequest';
import {compareDrafts,mergeDrafts,mergeSummary,type CardChoice} from '../lib/draftConflict';
import {savedCopy} from '../lib/uploadStatus';
import {pickHeld,type HeldDraft} from '../lib/localDraft';
import type {Observation,Report} from '../lib/types';

const engineer:Principal = {id:'entra:conflict-engineer' as never,oid:'conflict-engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const card = (id:string,whatHappened:string,location = 'L3 riser'):Observation => ({id,type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
const draft = (observations:Observation[],version = 1,extra:Partial<Report> = {}) => ({id:'rep-1',projectId:'p',reference:'R',visitDate:'2026-10-20',author:'G. S.',state:'draft',version,revision:1,review:'not_required',observations,...extra}) as Report;

/** The browser's journal in memory: one per tab, as localSaveJournal keys it. */
function memoryJournal():SaveJournal & {held():SaveRequest | undefined} {
  let pending:SaveRequest | undefined;
  return {
    claim:async request => pending ??= structuredClone(request),
    acknowledge:async id => { if (pending?.requestId === id) pending = undefined; },
    discard:async id => { if (pending?.requestId === id) pending = undefined; },
    held:() => pending,
  };
}

/** What lib/api.ts does with the PUT route's answer: a refused save with the server's copy is a SaveConflict. */
function sendTo(id:string) {
  return async (request:SaveRequest) => {
    const current = getReport(id)!;
    const {draftSignature:_old,...rest} = current;
    const outcome = saveDraft(id,{...rest,observations:request.observations,...(request.signature ? {draftSignature:request.signature} : {})},request.expectedVersion,request.requestId);
    if (outcome.ok) return outcome.value;
    if (outcome.current) throw new SaveConflict(outcome.reason,outcome.current);
    throw new Error(outcome.reason);
  };
}

test('comparing two versions of a draft',async t => {
  await t.test('identical drafts do not differ, so the server copy is taken quietly',() => {
    const both = [card('a','Containment complete')];
    assert.equal(compareDrafts(draft(both,1),draft(structuredClone(both),3)).differs,false);
  });

  await t.test('every card from both is listed, with what differs',() => {
    const here = draft([card('a','Containment complete'),card('b','Edited here'),card('c','Added here')]);
    const there = draft([card('a','Containment complete'),card('d','Added there'),card('b','Edited there')],4);
    const result = compareDrafts(here,there);
    assert.equal(result.differs,true);
    // A card added on the server is placed after the card it follows there.
    assert.deepEqual(result.cards.map(c => [c.id,c.status]),[['a','same'],['d','there'],['b','changed'],['c','here']]);
  });

  await t.test('the signature counts as a difference',() => {
    const result = compareDrafts(draft([],1,{draftSignature:{name:'G. S.'}}),draft([],2));
    assert.equal(result.signature,true);
    assert.equal(result.differs,true);
  });

  await t.test('by default nothing is dropped: this screen’s wording, and every card from both',() => {
    const here = draft([card('b','Edited here'),card('c','Added here')],1,{draftSignature:{name:'Here'}});
    const there = draft([card('b','Edited there'),card('d','Added there')],4,{draftSignature:{name:'There'}});
    const comparison = compareDrafts(here,there);
    const merged = mergeDrafts(here,there,comparison,{},'here',() => 'new');
    assert.equal(merged.version,4,'built on the server version, so a further change is caught again');
    assert.deepEqual(merged.observations.map(o => [o.id,o.whatHappened]),[['b','Edited here'],['d','Added there'],['c','Added here']]);
    assert.equal(merged.draftSignature?.name,'Here');
    assert.equal(mergeSummary(comparison,{}),'Saving keeps 3 cards. 1 card keeps one wording and drops the other.');
  });

  await t.test('choices: keep the other wording, keep both, or leave a card out, and say so',() => {
    const here = draft([card('b','Edited here'),card('c','Added here')]);
    const there = draft([card('b','Edited there'),card('d','Added there')],4,{draftSignature:{name:'There'}});
    const comparison = compareDrafts(here,there);
    const choices:Record<string,CardChoice> = {b:'both',c:'none',d:'there'};
    const merged = mergeDrafts(here,there,comparison,choices,'there',() => 'obs-copy');
    assert.deepEqual(merged.observations.map(o => [o.id,o.whatHappened]),[['b','Edited here'],['obs-copy','Edited there'],['d','Added there']]);
    assert.equal(merged.draftSignature?.name,'There');
    assert.equal(mergeSummary(comparison,choices),'Saving keeps 3 cards. 1 card is left out.');
    // A choice that makes no sense for the card falls back to keeping it.
    assert.deepEqual(mergeDrafts(here,there,comparison,{c:'there'},'here',() => 'x').observations.map(o => o.id),['b','d','c']);
  });

  await t.test('with the base known, the suggestions follow what each side changed',() => {
    const base = draft([card('a','As saved'),card('b','As saved'),card('c','As saved'),card('d','As saved')],2,{draftSignature:{name:'G. S.'}});
    const baseCopy = {cards:Object.fromEntries(base.observations.map(o => [o.id,savedCopy(o)])),signature:JSON.stringify(base.draftSignature)};
    // Here: a edited, b untouched, c untouched (removed there), d removed. There: b edited, c removed, d untouched, e added.
    const here = draft([card('a','Edited here'),card('b','As saved'),card('c','As saved')],2,{draftSignature:{name:'G. S.'}});
    const there = draft([card('a','As saved'),card('b','Edited there'),card('d','As saved'),card('e','Added there')],3,{draftSignature:{name:'George Stephenson'}});
    const comparison = compareDrafts(here,there,baseCopy);
    assert.deepEqual(comparison.cards.map(c => [c.id,c.status,c.change ?? '']),[
      ['a','changed','changed-here'],['b','changed','changed-there'],['d','there','removed-here'],['e','there',''],['c','here','removed-there']]);
    const merged = mergeDrafts(here,there,comparison,{},comparison.signatureChoice,() => 'x');
    assert.deepEqual(merged.observations.map(o => [o.id,o.whatHappened]),[['a','Edited here'],['b','Edited there'],['e','Added there']],'each side’s change is kept, removals are suggested');
    assert.equal(merged.draftSignature?.name,'George Stephenson','only the server changed the signature');
    assert.equal(mergeSummary(comparison,{}),'Saving keeps 3 cards. 2 cards are left out. 2 cards keep one wording and drop the other.');
    // A card removed on one side but edited on the other is kept by default.
    const editedHere = compareDrafts(draft([card('c','Edited here')]),draft([],3),baseCopy);
    assert.equal(editedHere.cards[0]?.change,undefined);
    assert.deepEqual(mergeDrafts(draft([card('c','Edited here')]),draft([],3),editedHere,{},'here',() => 'x').observations.map(o => o.id),['c']);
  });

  await t.test('keeping this screen’s signature when it has none clears the server’s',() => {
    const merged = mergeDrafts(draft([]),draft([],2,{draftSignature:{name:'There'}}),compareDrafts(draft([]),draft([],2,{draftSignature:{name:'There'}})),{},'here',() => 'x');
    assert.equal(merged.draftSignature,undefined);
  });
});

test('which held copy a reopened draft restores',() => {
  const held = (key:string,tab:string,heldAt:string) => ({key,reportId:'r',principalId:'p',seq:1,observations:[],heldAt,tab}) as HeldDraft;
  const ordinary = held('p::r','B','2026-10-20T10:05:00Z');
  const asideA = held('p::r::aside::A','A','2026-10-20T10:01:00Z');
  const asideC = held('p::r::aside::C','C','2026-10-20T10:02:00Z');
  const all = [asideA,ordinary,asideC];
  assert.equal(pickHeld(all,'p::r','p::r::aside::','A'),asideA,'a tab mid-choice gets its own work back');
  assert.equal(pickHeld(all,'p::r','p::r::aside::','B'),ordinary,'another tab’s set-aside work never displaces unsaved edits');
  assert.equal(pickHeld([asideA,asideC],'p::r','p::r::aside::','B'),asideC,'with no unsaved edits, the newest set-aside work comes back');
  assert.equal(pickHeld([],'p::r','p::r::aside::','B'),null);
});

test('stale saves and two tabs on one draft',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-conflict-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    await t.test('a stale save is refused with the server copy, and nothing is overwritten',() => {
      const report = createReport('proj-011lme',engineer.name,engineer);
      const first = saveDraft(report.id,{...report,observations:[card('a','From the laptop')]},report.version);
      assert.equal(first.ok,true);
      const stale = saveDraft(report.id,{...report,observations:[card('a','From the phone')]},report.version);
      assert.equal(stale.ok,false);
      assert.ok(!stale.ok && stale.status === 409);
      assert.equal(!stale.ok && stale.current?.observations[0]?.whatHappened,'From the laptop');
      assert.equal(!stale.ok && stale.current?.version,2);
      assert.equal(getReport(report.id)?.observations[0]?.whatHappened,'From the laptop');
    });

    await t.test('a retried save that landed before another device saved returns the server copy',() => {
      const report = createReport('proj-011lme',engineer.name,engineer);
      const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      assert.equal(saveDraft(report.id,{...report,observations:[card('a','Mine')]},1,requestId).ok,true);
      assert.equal(saveDraft(report.id,{...report,observations:[card('a','Theirs')]},2).ok,true);
      const retried = saveDraft(report.id,{...report,observations:[card('a','Mine')]},1,requestId);
      assert.equal(!retried.ok && retried.current?.observations[0]?.whatHappened,'Theirs');
    });

    await t.test('two tabs: the second tab is told, both versions survive, and the merged save goes through',async () => {
      const report = createReport('proj-011lme',engineer.name,engineer);
      const tabA = memoryJournal(), tabB = memoryJournal();
      const send = sendTo(report.id);
      // Both tabs opened the draft at version 1.
      const savedA = await saveWithJournal({...report,observations:[card('a','Typed in tab A')]},1,tabA,send);
      assert.equal(savedA.version,2);
      const mineB = {...report,observations:[card('b','Typed in tab B')]};
      const refused = await saveWithJournal(mineB,1,tabB,send).then(() => null,(error:unknown) => error);
      assert.ok(refused instanceof SaveConflict,'tab B is told rather than overwriting tab A');
      assert.deepEqual(refused.current.observations.map(o => o.whatHappened),['Typed in tab A']);
      assert.equal(tabB.held(),undefined,'the refused request is not replayed');
      assert.deepEqual(getReport(report.id)?.observations.map(o => o.whatHappened),['Typed in tab A'],'tab A’s work is still on the server');
      // Tab B keeps both cards and saves on top of tab A's version.
      const merged = mergeDrafts(mineB,refused.current,compareDrafts(mineB,refused.current),{},'here',() => 'x');
      const saved = await saveWithJournal(merged,refused.current.version,tabB,send);
      assert.equal(saved.version,3);
      assert.deepEqual(getReport(report.id)?.observations.map(o => o.whatHappened),['Typed in tab A','Typed in tab B']);
    });

    await t.test('a request left over from before a reload is dropped when refused, and the work on screen is asked about',async () => {
      const report = createReport('proj-011lme',engineer.name,engineer);
      const tab = memoryJournal(), send = sendTo(report.id);
      // An uncertain request from before the reload, never received.
      await tab.claim({requestId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',expectedVersion:1,observations:[card('a','Before the reload')],signature:null});
      assert.equal(saveDraft(report.id,{...report,observations:[card('z','Another device')]},1).ok,true);
      const sent:string[] = [];
      const refused = await saveWithJournal({...report,observations:[card('a','After the reload')]},1,tab,async request => { sent.push(request.observations[0]!.whatHappened); return send(request); }).then(() => null,(error:unknown) => error);
      assert.ok(refused instanceof SaveConflict);
      assert.deepEqual(sent,['Before the reload','After the reload'],'the leftover was tried, then the work on screen');
      assert.equal(tab.held(),undefined);
    });
  } finally {
    database().close();
    rmSync(root,{recursive:true,force:true});
  }
});
