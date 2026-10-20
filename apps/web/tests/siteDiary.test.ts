import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { siteDiary, type DiarySources } from '../lib/siteDiary';
import type { Issue, Observation, Report, Variation } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };
const manager: Principal = { ...other, id:'entra:mgr' as never, oid:'mgr', name:'Morgan', role:'Manager' };

const card = (o: Partial<Observation>): Observation => ({ id:'o', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], ...o });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', ...r } as Report);
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'', description:'', actionNeeded:'', confirmation:'confirmed',
  work:'open', owner:'', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'', location:'', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Sam Spark', raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);
const none: DiarySources = { reports:[], issues:[], variations:[] };
const photo = (id: string, caption = '') => ({ id, dataUrl:`/api/media/${id}`, caption, capturedAt:'' });

test('built only from sent reports: newest day first, never drafts or other projects', () => {
  const d = siteDiary({ ...none, reports:[
    report({ id:'mon', visitDate:'2026-10-12', serverAcknowledgedAt:'2026-10-12T16:00:00Z', observations:[card({ id:'a', location:' Level 2  riser ', whatHappened:'Tray fixed', photos:[photo('m1', 'Before')] })] }),
    report({ id:'wed-late', reference:'011LME-SPR-003', visitDate:'2026-10-14', author:'Pat Pipe', authorId:other.id, authorTrade:'P&H', serverAcknowledgedAt:'2026-10-14T17:00:00Z' }),
    report({ id:'wed-early', reference:'011LME-SPR-002', visitDate:'2026-10-14', serverAcknowledgedAt:'2026-10-14T09:00:00Z' }),
    report({ id:'draft', state:'draft', visitDate:'2026-10-15' }),
    report({ id:'away', projectId:'p2' }),
  ] }, manager, 'p1');
  assert.deepEqual(d.days.map(x => x.day), ['2026-10-14', '2026-10-12']);
  assert.deepEqual(d.days[0]!.entries.map(e => e.reportId), ['wed-early', 'wed-late'], 'within a day, in the order they reached the office');
  assert.deepEqual(d.days[0]!.engineers, ['Pat Pipe', 'Sam Spark']);
  assert.equal(d.totalDays, 2);
  assert.equal(d.totalReports, 3);
  assert.equal(d.firstDay, '2026-10-12');
  assert.equal(d.nextBefore, undefined);
  const c = d.days[1]!.entries[0]!.cards[0]!;
  assert.equal(c.location, 'Level 2 riser', 'text tidied, not rewritten');
  assert.equal(c.whatHappened, 'Tray fixed');
  assert.deepEqual(c.photos, [{ src:'/api/media/m1', caption:'Before' }]);
});

test('an engineer reads every sent report on the project but never another engineer\'s draft', () => {
  const sources = { ...none, reports:[report({ id:'theirs', authorId:other.id }), report({ id:'their-draft', state:'draft', authorId:other.id }), report({ id:'my-draft', state:'draft' })] };
  assert.deepEqual(siteDiary(sources, engineer, 'p1').days.flatMap(x => x.entries.map(e => e.reportId)), ['theirs']);
});

test('each entry is the latest sent revision and links every earlier revision it replaced', () => {
  const d = siteDiary({ ...none, reports:[
    report({ id:'r1', serverAcknowledgedAt:'2026-10-13T16:00:00Z', observations:[card({ id:'a', whatHappened:'Old words' })] }),
    report({ id:'r2', revision:2, corrects:'r1', correctionReason:'Wrong  level', serverAcknowledgedAt:'2026-10-14T09:00:00Z', observations:[card({ id:'a', whatHappened:'Middle words' })] }),
    report({ id:'r3', revision:3, corrects:'r2', correctionReason:'Photo missing', serverAcknowledgedAt:'2026-10-15T09:00:00Z', observations:[card({ id:'a', whatHappened:'New words' })] }),
    report({ id:'q1', reference:'011LME-SPR-002', visitDate:'2026-10-12' }),
    report({ id:'q2', reference:'011LME-SPR-002', revision:2, corrects:'q1', state:'draft' }),
  ] }, manager, 'p1');
  const entries = d.days.flatMap(x => x.entries);
  assert.deepEqual(entries.map(e => [e.reportId, e.revision]), [['r3', 3], ['q1', 1]], 'one entry per report; a correction still in draft changes nothing');
  const r = entries[0]!;
  assert.equal(r.cards[0]!.whatHappened, 'New words');
  assert.deepEqual(r.revisions, [
    { id:'r3', revision:3, sentAt:'2026-10-15T09:00:00Z', correctionReason:'Photo missing' },
    { id:'r2', revision:2, sentAt:'2026-10-14T09:00:00Z', correctionReason:'Wrong level' },
    { id:'r1', revision:1, sentAt:'2026-10-13T16:00:00Z' },
  ]);
  assert.equal(d.totalReports, 2);
});

test('a card shows the issue or variation it raised, found from any revision, with its state now', () => {
  const d = siteDiary({
    reports:[
      report({ id:'r1', observations:[card({ id:'def', type:'defect' }), card({ id:'vo', type:'instruction' })] }),
      report({ id:'r2', revision:2, corrects:'r1', observations:[card({ id:'def', type:'defect', linkedIssueId:'raised' }), card({ id:'vo', type:'instruction' }), card({ id:'again', type:'defect', linkedIssueId:'old' })] }),
    ],
    issues:[
      issue({ id:'raised', reference:'011LME-ISS-004', raisedByReport:'r1', raisedByObservation:'def', work:'awaiting_verification' }),
      issue({ id:'old', reference:'011LME-ISS-001', raisedByReport:'earlier', raisedByObservation:'x', work:'closed' }),
      issue({ id:'elsewhere', reference:'011LME-ISS-009', raisedByReport:'another', raisedByObservation:'def' }),
    ],
    variations:[variation({ raisedByReport:'r1', raisedByObservation:'vo', instruction:'instructed' })],
  }, manager, 'p1');
  const cards = d.days[0]!.entries[0]!.cards;
  assert.deepEqual(cards[0]!.issue, { id:'raised', reference:'011LME-ISS-004', status:'Fixed, to check', sighting:false }, 'the issue raised by rev 1, not one from another report with the same card ID');
  assert.deepEqual(cards[1]!.variation, { id:'v', reference:'011LME-VO-001', status:'Instructed' });
  assert.deepEqual(cards[2]!.issue, { id:'old', reference:'011LME-ISS-001', status:'Closed', sighting:true });
  assert.equal(cards[1]!.issue, undefined);
});

test('a withdrawn issue says so rather than showing its work state', () => {
  const d = siteDiary({ ...none, reports:[report({ observations:[card({ id:'def', type:'defect' })] })], issues:[issue({ raisedByObservation:'def', confirmation:'withdrawn' })] }, manager, 'p1');
  assert.equal(d.days[0]!.entries[0]!.cards[0]!.issue!.status, 'Withdrawn');
});

test('filters by kind and words, keeping only matching cards and saying how many the report had', () => {
  const sources = { ...none, reports:[
    report({ id:'a', visitDate:'2026-10-12', authorTrade:'Electrical', observations:[card({ id:'1', type:'update', location:'Plant room' }), card({ id:'2', type:'defect', location:'Level 3 riser', whatHappened:'Fire  stopping missing' })] }),
    report({ id:'b', visitDate:'2026-10-13', observations:[card({ id:'3', type:'update', location:'Roof', photos:[photo('p', 'Riser door')] })] }),
  ] };
  const defects = siteDiary(sources, manager, 'p1', { kind:'defect' });
  assert.deepEqual(defects.days.map(x => x.day), ['2026-10-12']);
  assert.deepEqual(defects.days[0]!.entries[0]!.cards.map(c => c.id), ['2']);
  assert.equal(defects.days[0]!.entries[0]!.cardCount, 2);
  assert.equal(defects.totalReports, 1);
  assert.deepEqual(siteDiary(sources, manager, 'p1', { words:'RISER' }).days.flatMap(x => x.entries.flatMap(e => e.cards.map(c => c.id))), ['3', '2'], 'matches location and photo captions');
  assert.deepEqual(siteDiary(sources, manager, 'p1', { words:'fire stopping' }).days.flatMap(x => x.entries.flatMap(e => e.cards.map(c => c.id))), ['2'], 'spacing ignored');
  assert.equal(siteDiary(sources, manager, 'p1', { words:'electrical plant' }).totalReports, 1, 'words can match the report and the card together');
  assert.equal(siteDiary(sources, manager, 'p1', { words:'nowhere' }).totalDays, 0);
});

test('a report sent with no cards still shows when nothing is filtered', () => {
  const sources = { ...none, reports:[report({})] };
  assert.equal(siteDiary(sources, manager, 'p1').totalReports, 1);
  assert.equal(siteDiary(sources, manager, 'p1', { kind:'update' }).totalReports, 0);
});

test('pages by site day, older pages continuing from the last day shown', () => {
  const reports = Array.from({ length:5 }, (_, n) => report({ id:`r${n}`, visitDate:`2026-10-1${n}` }));
  const first = siteDiary({ ...none, reports }, manager, 'p1', { days:2 });
  assert.deepEqual(first.days.map(x => x.day), ['2026-10-14', '2026-10-13']);
  assert.equal(first.nextBefore, '2026-10-13');
  assert.equal(first.totalDays, 5);
  const second = siteDiary({ ...none, reports }, manager, 'p1', { days:2, before:first.nextBefore });
  assert.deepEqual(second.days.map(x => x.day), ['2026-10-12', '2026-10-11']);
  const last = siteDiary({ ...none, reports }, manager, 'p1', { days:2, before:second.nextBefore });
  assert.deepEqual(last.days.map(x => x.day), ['2026-10-10']);
  assert.equal(last.nextBefore, undefined);
  assert.deepEqual(siteDiary({ ...none, reports }, manager, 'p1', { days:2, before:'not a day' }).days.map(x => x.day), ['2026-10-14', '2026-10-13'], 'a bad cursor reads as the start');
});

test('an issue read back without its card ID is matched by location and words, and stays "raised" after a correction', () => {
  const synced = issue({ id:'sp', reference:'011LME-ISS-007', raisedByReport:'r1', location:'Plant room', description:'Tray lid missing' });
  const defectCard = card({ id:'def', type:'defect', location:'Plant room', whatHappened:'Tray lid missing' });
  const once = siteDiary({ ...none, reports:[report({ id:'r1', observations:[defectCard, card({ id:'other', type:'defect', location:'Roof' })] })], issues:[synced] }, manager, 'p1');
  const cards = once.days[0]!.entries[0]!.cards;
  assert.equal(cards[0]!.issue?.id, 'sp');
  assert.equal(cards[0]!.issue?.sighting, false);
  assert.equal(cards[1]!.issue, undefined);
  const corrected = siteDiary({ ...none, reports:[
    report({ id:'r1', observations:[defectCard] }),
    report({ id:'r2', revision:2, corrects:'r1', observations:[{ ...defectCard, whatHappened:'Tray lid missing, level 2', linkedIssueId:'sp' }] }),
  ], issues:[synced] }, manager, 'p1');
  assert.deepEqual(corrected.days[0]!.entries[0]!.cards[0]!.issue, { id:'sp', reference:'011LME-ISS-007', status:'Open', sighting:false });
});
