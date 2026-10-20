import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { londonDay, shiftWeek, weekStart, weeklySummary, type WeekSources } from '../lib/weeklySummary';
import type { Issue, IssueEvent, Observation, Report, Variation } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };
const manager: Principal = { ...other, id:'entra:mgr' as never, oid:'mgr', name:'Morgan', role:'Manager' };

const card = (o: Partial<Observation>): Observation => ({ id:'o', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], ...o });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', ...r } as Report);
const ev = (kind: IssueEvent['kind'], at: string): IssueEvent => ({ kind, at, actor:'Morgan', note:'', photos:[] });
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'', description:'', actionNeeded:'', confirmation:'confirmed',
  work:'open', owner:'', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'', location:'', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Sam Spark', raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);
const none: WeekSources = { reports:[], issues:[], variations:[] };
const MONDAY = '2026-10-12';
const TODAY = '2026-10-20';

test('weeks run Monday to Sunday, and anything that is not a date reads as this week', () => {
  assert.equal(weekStart('2026-10-12', TODAY), '2026-10-12');
  assert.equal(weekStart('2026-10-18', TODAY), '2026-10-12', 'Sunday belongs to the week before it');
  assert.equal(weekStart('2026-10-19', TODAY), '2026-10-19');
  assert.equal(weekStart(undefined, TODAY), '2026-10-19');
  assert.equal(weekStart('next tuesday', TODAY), '2026-10-19');
  assert.equal(weekStart('2026-02-31', TODAY), '2026-10-19');
  assert.equal(weekStart('2026-13-45', TODAY), '2026-10-19');
  assert.equal(shiftWeek('2026-10-26', -1), '2026-10-19', 'across the clocks going back');
  assert.equal(weekStart('2026-03-31', TODAY), '2026-03-30');
});

test('reads event times in UK time, so late on Sunday stays in that week', () => {
  assert.equal(londonDay('2026-10-18T22:30:00Z'), '2026-10-18', 'BST: 23:30 on Sunday');
  assert.equal(londonDay('2026-10-18T23:30:00Z'), '2026-10-19', 'BST: 00:30 on Monday');
  const s = weeklySummary({ ...none, issues:[issue({ id:'late', raisedAt:'2026-10-18T22:30:00Z' }), issue({ id:'next', raisedAt:'2026-10-18T23:30:00Z' })] }, manager, 'p1', MONDAY, TODAY);
  assert.deepEqual(s.issuesRaised.map(i => i.id), ['late']);
});

test('lists sent reports by visit day, never drafts, other projects or other weeks', () => {
  const s = weeklySummary({ ...none, reports:[
    report({ id:'thu', visitDate:'2026-10-15', reference:'011LME-SPR-004', author:'Pat Pipe', authorId:other.id, authorTrade:'P&H' }),
    report({ id:'tue', visitDate:'2026-10-13', authorTrade:'Electrical', observations:[
      card({ type:'update', location:'Level 3 riser', photos:[{ id:'p', dataUrl:'', caption:'', capturedAt:'' }] }),
      card({ type:'defect', location:' level 3  RISER ' }), card({ type:'instruction', location:'Plant room' })] }),
    report({ id:'draft', state:'draft' }),
    report({ id:'away', projectId:'p2' }),
    report({ id:'last', visitDate:'2026-10-11' }),
  ] }, manager, 'p1', MONDAY, TODAY);
  assert.deepEqual(s.reports.map(r => r.id), ['tue', 'thu']);
  assert.deepEqual(s.reports[0]!.kinds, { update:1, defect:1, instruction:1, access:0 });
  assert.equal(s.reports[0]!.photos, 1);
  assert.deepEqual(s.reports[0]!.locations, ['Level 3 riser', 'Plant room'], 'locations as written, repeats dropped ignoring case and spacing');
  assert.deepEqual(s.engineers, ['Pat Pipe', 'Sam Spark']);
  assert.deepEqual(s.siteDays, ['2026-10-13', '2026-10-15']);
  assert.deepEqual(s.kinds, { update:1, defect:1, instruction:1, access:0 });
  assert.equal(s.current, false);
});

test('an engineer never sees another engineer\'s draft, even their own drafts are left out', () => {
  const sources = { ...none, reports:[report({ id:'mine', state:'draft' }), report({ id:'theirs', state:'draft', authorId:other.id })] };
  assert.deepEqual(weeklySummary(sources, engineer, 'p1', MONDAY, TODAY).reports, []);
});

test('a sent correction replaces the report it corrects, so a visit counts once', () => {
  const s = weeklySummary({ ...none, reports:[
    report({ id:'orig' }), report({ id:'fix', corrects:'orig', revision:2 }),
    report({ id:'orig2', reference:'011LME-SPR-002' }), report({ id:'fixing', corrects:'orig2', revision:2, state:'draft' }),
  ] }, manager, 'p1', MONDAY, TODAY);
  assert.deepEqual(s.reports.map(r => [r.id, r.revision]).sort(), [['fix', 2], ['orig2', 1]], 'a correction still in draft does not replace the sent report');
});

test('keeps issue events apart: raised, put forward as fixed, and checked and closed', () => {
  const s = weeklySummary({ ...none, issues:[
    issue({ id:'new', raisedAt:'2026-10-14T09:00:00Z', affectedTrade:'HVAC', owner:' Acme  Ltd ' }),
    issue({ id:'fixed', work:'awaiting_verification', events:[ev('closure_submitted', '2026-10-15T09:00:00Z')] }),
    issue({ id:'closed', work:'closed', events:[ev('closure_submitted', '2026-10-09T09:00:00Z'), ev('verified', '2026-10-16T09:00:00Z')] }),
    issue({ id:'reopened', work:'open', events:[ev('verified', '2026-10-13T09:00:00Z'), ev('reopened', '2026-10-14T09:00:00Z')] }),
    issue({ id:'twice', work:'awaiting_verification', events:[ev('closure_submitted', '2026-10-12T09:00:00Z'), ev('reopened', '2026-10-13T09:00:00Z'), ev('closure_submitted', '2026-10-17T09:00:00Z')] }),
    issue({ id:'elsewhere', projectId:'p2', raisedAt:'2026-10-14T09:00:00Z' }),
  ] }, manager, 'p1', MONDAY, TODAY);
  assert.deepEqual(s.issuesRaised.map(i => [i.id, i.trade, i.owner, i.status]), [['new', 'HVAC', 'Acme Ltd', 'Open']]);
  assert.deepEqual(s.issuesFixed.map(i => [i.id, i.at]), [['fixed', '2026-10-15T09:00:00Z'], ['twice', '2026-10-17T09:00:00Z']]);
  assert.deepEqual(s.issuesClosed.map(i => i.id), ['closed'], 'verified then reopened is not shown as closed');
});

test('counts what is open now, past target and waiting to be checked', () => {
  const s = weeklySummary({ ...none, issues:[
    issue({ id:'a', targetDate:'2026-10-19' }), issue({ id:'b', targetDate:'2026-10-20' }), issue({ id:'c', targetDate:'2026-10-01', work:'awaiting_verification' }),
    issue({ id:'d', work:'closed' }), issue({ id:'e', confirmation:'withdrawn', targetDate:'2026-10-01' }),
  ] }, manager, 'p1', MONDAY, TODAY);
  assert.deepEqual(s.openNow, { total:3, pastTarget:1, toCheck:1 });
});

test('lists variations raised and instructed in the week, with work done before instruction', () => {
  const s = weeklySummary({ ...none, variations:[
    variation({ id:'new', raisedAt:'2026-10-13T09:00:00Z', workDone:true }),
    variation({ id:'yes', instruction:'instructed', events:[{ kind:'instructed', at:'2026-10-16T09:00:00Z', actor:'Morgan', note:'', photos:[] }] }),
    variation({ id:'undone', instruction:'pending', events:[{ kind:'instructed', at:'2026-10-14T09:00:00Z', actor:'Morgan', note:'', photos:[] }, { kind:'reopened', at:'2026-10-15T09:00:00Z', actor:'Morgan', note:'', photos:[] }] }),
  ] }, engineer, 'p1', MONDAY, TODAY);
  assert.deepEqual(s.variationsRaised.map(v => [v.id, v.status, v.workDone]), [['new', 'Awaiting instruction', true]]);
  assert.deepEqual(s.variationsInstructed.map(v => v.id), ['yes']);
  assert.equal(JSON.stringify(s).includes('Value'), false, 'no prices on the page');
});

test('says when the week is still going', () => {
  assert.equal(weeklySummary(none, manager, 'p1', '2026-10-19', TODAY).current, true);
  assert.equal(weeklySummary(none, manager, 'p1', '2026-10-19', TODAY).end, '2026-10-25');
});
