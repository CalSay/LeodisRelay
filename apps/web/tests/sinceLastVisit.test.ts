import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { sinceLastVisit, type CatchUpSources } from '../lib/sinceLastVisit';
import type { Issue, IssueEvent, Observation, Report, Variation, VariationEvent } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };

const card = (type: Observation['type']): Observation => ({ id:'o', type, location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[] });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-14', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', serverAcknowledgedAt:'2026-10-14T15:00:00Z', ...r } as Report);
const theirs = (r: Partial<Report>) => report({ author:'Pat Pipe', authorId:other.id, authorTrade:'P&H', ...r });
const ev = (kind: IssueEvent['kind'], at: string, actorId: string = 'entra:mgr'): IssueEvent => ({ kind, at, actor:'Morgan', actorId, note:'', photos:[] });
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'', description:'', actionNeeded:'', confirmation:'confirmed',
  work:'open', owner:'', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', reportedBy:'Pat Pipe', reportedById:other.id, events:[], ...i });
const vev = (kind: VariationEvent['kind'], at: string): VariationEvent => ({ kind, at, actor:'Morgan', actorId:'entra:mgr', note:'', photos:[] });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'', location:'', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Pat Pipe', raisedById:other.id, raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);
const none: CatchUpSources = { reports:[], issues:[], variations:[] };
const NOW = new Date('2026-10-20T08:00:00Z');
const lastVisit = report({ id:'mine' });

test('the last visit is my latest original report from an earlier day, and only newer things count', () => {
  const s = sinceLastVisit({ ...none, reports:[
    report({ id:'older', visitDate:'2026-10-07', serverAcknowledgedAt:'2026-10-07T15:00:00Z' }),
    lastVisit,
    report({ id:'today', visitDate:'2026-10-20', serverAcknowledgedAt:'2026-10-20T07:30:00Z' }),
    report({ id:'late-fix', corrects:'older', visitDate:'2026-10-07', serverAcknowledgedAt:'2026-10-19T09:00:00Z', revision:2 }),
    theirs({ id:'before', serverAcknowledgedAt:'2026-10-14T12:00:00Z' }),
    theirs({ id:'after', reference:'011LME-SPR-005', visitDate:'2026-10-16', serverAcknowledgedAt:'2026-10-16T16:00:00Z', observations:[card('update'), card('defect'), card('defect')] }),
  ] }, engineer, 'p1', NOW);
  assert.deepEqual(s.lastVisit, { reportId:'mine', reference:'011LME-SPR-001', visitDate:'2026-10-14' }, 'today\'s report and a later correction do not move the last visit');
  assert.equal(s.since, '2026-10-14T15:00:00Z');
  assert.deepEqual(s.reports.map(r => r.id), ['after'], 'my own reports and ones sent before my last visit are left out');
  assert.deepEqual([s.reports[0]!.cards, s.reports[0]!.defects, s.reports[0]!.trade], [3, 2, 'P&H']);
});

test('with no earlier report of my own, it shows the last seven days', () => {
  const s = sinceLastVisit({ ...none, reports:[
    report({ id:'today', visitDate:'2026-10-20', serverAcknowledgedAt:'2026-10-20T07:30:00Z' }),
    theirs({ id:'recent', serverAcknowledgedAt:'2026-10-15T10:00:00Z' }),
    theirs({ id:'old', serverAcknowledgedAt:'2026-10-10T10:00:00Z' }),
  ] }, engineer, 'p1', NOW);
  assert.equal(s.lastVisit, null);
  assert.equal(s.since, '2026-10-13T08:00:00.000Z');
  assert.deepEqual(s.reports.map(r => r.id), ['recent']);
});

test('never drafts or other projects, and a sent correction stands in for the report it corrects', () => {
  const s = sinceLastVisit({ ...none, reports:[lastVisit,
    theirs({ id:'draft', state:'draft', lastSavedAt:'2026-10-16T10:00:00Z' }),
    theirs({ id:'away', projectId:'p2', serverAcknowledgedAt:'2026-10-16T10:00:00Z' }),
    theirs({ id:'orig', serverAcknowledgedAt:'2026-10-15T10:00:00Z' }),
    theirs({ id:'fix', corrects:'orig', revision:2, serverAcknowledgedAt:'2026-10-17T10:00:00Z' }),
  ] }, engineer, 'p1', NOW);
  assert.deepEqual(s.reports.map(r => [r.id, r.correction]), [['fix', true]]);
});

test('issues: each once, by the latest change that still stands, and never my own doing', () => {
  const s = sinceLastVisit({ ...none, reports:[lastVisit], issues:[
    issue({ id:'new', reference:'011LME-ISS-010', raisedAt:'2026-10-16T09:00:00Z', affectedTrade:'Electrical', owner:' Acme  Ltd ', location:' Level 3  riser ' }),
    issue({ id:'mine', raisedAt:'2026-10-16T09:00:00Z', reportedById:engineer.id }),
    issue({ id:'mine-fixed', reportedById:engineer.id, work:'awaiting_verification', events:[ev('closure_submitted', '2026-10-17T09:00:00Z', other.id)] }),
    issue({ id:'fixed', work:'awaiting_verification', events:[ev('closure_submitted', '2026-10-17T09:00:00Z', other.id)] }),
    issue({ id:'i-fixed', work:'awaiting_verification', events:[ev('closure_submitted', '2026-10-17T09:00:00Z', engineer.id)] }),
    issue({ id:'closed', work:'closed', affectedTrade:'Electrical', events:[ev('closure_submitted', '2026-10-15T09:00:00Z'), ev('verified', '2026-10-18T09:00:00Z')] }),
    issue({ id:'undone', work:'open', events:[ev('verified', '2026-10-16T09:00:00Z')] }),
    issue({ id:'reopened', work:'open', events:[ev('verified', '2026-10-16T09:00:00Z'), ev('reopened', '2026-10-19T09:00:00Z')] }),
    issue({ id:'assigned', work:'assigned', owner:'Acme', raisedAt:'2026-10-15T09:00:00Z', events:[ev('assigned', '2026-10-15T10:00:00Z')] }),
    issue({ id:'progress', events:[ev('progress', '2026-10-16T09:00:00Z')] }),
    issue({ id:'withdrawn', confirmation:'withdrawn', raisedAt:'2026-10-16T09:00:00Z' }),
    issue({ id:'before', work:'closed', events:[ev('verified', '2026-10-13T09:00:00Z')] }),
    issue({ id:'away', projectId:'p2', raisedAt:'2026-10-16T09:00:00Z' }),
  ] }, engineer, 'p1', NOW);
  assert.deepEqual(s.issues.map(i => [i.id, i.change]), [['reopened', 'reopened'], ['closed', 'closed'], ['fixed', 'fixed'], ['new', 'raised'], ['assigned', 'assigned']]);
  const fresh = s.issues.find(i => i.id === 'new')!;
  assert.deepEqual([fresh.by, fresh.owner, fresh.location, fresh.yourTrade], ['Pat Pipe', 'Acme Ltd', 'Level 3 riser', true]);
  assert.equal(s.issues.find(i => i.id === 'fixed')!.yourTrade, false);
});

test('variations: raised by others, or instructed or declined since, while that answer still stands', () => {
  const s = sinceLastVisit({ ...none, reports:[lastVisit], variations:[
    variation({ id:'new', raisedAt:'2026-10-16T09:00:00Z' }),
    variation({ id:'mine', raisedAt:'2026-10-16T09:00:00Z', raisedById:engineer.id, raisedBy:'Sam Spark' }),
    variation({ id:'instructed', instruction:'instructed', events:[vev('priced', '2026-10-15T09:00:00Z'), vev('instructed', '2026-10-17T09:00:00Z')] }),
    variation({ id:'my-instructed', instruction:'instructed', raisedById:engineer.id, events:[vev('instructed', '2026-10-18T09:00:00Z')] }),
    variation({ id:'reopened', instruction:'pending', events:[vev('declined', '2026-10-16T09:00:00Z'), vev('reopened', '2026-10-17T09:00:00Z')] }),
    variation({ id:'note', events:[vev('note', '2026-10-16T09:00:00Z')] }),
  ] }, engineer, 'p1', NOW);
  assert.deepEqual(s.variations.map(v => [v.id, v.change]), [['instructed', 'instructed'], ['new', 'raised']],
    'the answer to a variation I raised is left to "Came back from the office"');
});

test('another engineer sees my work as news, and theirs not', () => {
  const s = sinceLastVisit({ ...none, reports:[
    theirs({ id:'their-visit', serverAcknowledgedAt:'2026-10-14T16:00:00Z' }),
    report({ id:'mine-after', visitDate:'2026-10-16', serverAcknowledgedAt:'2026-10-16T15:00:00Z' }),
  ], issues:[issue({ id:'theirs', raisedAt:'2026-10-16T09:00:00Z' }), issue({ id:'mine', raisedAt:'2026-10-16T09:00:00Z', reportedById:engineer.id, reportedBy:'Sam Spark' })] }, other, 'p1', NOW);
  assert.equal(s.lastVisit?.reportId, 'their-visit');
  assert.deepEqual(s.reports.map(r => r.id), ['mine-after']);
  assert.deepEqual(s.issues.map(i => i.id), ['mine']);
});
