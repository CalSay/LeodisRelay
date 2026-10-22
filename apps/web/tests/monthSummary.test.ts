import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { monthLast, monthOf, monthSummary, reportKindsLine, shiftMonth, MONTH_PHOTOS } from '../lib/monthSummary';
import { weeklySummary, type WeekSources } from '../lib/weeklySummary';
import { issueFigures } from '../lib/officeActions';
import type { Issue, IssueEvent, Observation, Report, Variation } from '../lib/types';

const manager: Principal = { id:'entra:mgr' as never, oid:'mgr', name:'Morgan', email:'m@example.test', role:'Manager' };
const photo = (id: string, capturedAt = '') => ({ id, dataUrl:`/api/media/${id}`, caption:'', capturedAt });
const card = (o: Partial<Observation>): Observation => ({ id:'o', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], ...o });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:'entra:eng',
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', ...r } as Report);
const ev = (kind: IssueEvent['kind'], at: string): IssueEvent => ({ kind, at, actor:'Morgan', note:'', photos:[] });
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'', description:'', actionNeeded:'', confirmation:'confirmed',
  work:'open', owner:'', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'', location:'', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Sam Spark', raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);
const none: WeekSources = { reports:[], issues:[], variations:[] };

test('months: a real month or this one, the last day, and stepping across a year', () => {
  assert.equal(monthOf('2026-09', '2026-10-21'), '2026-09');
  assert.equal(monthOf('2026-13', '2026-10-21'), '2026-10');
  assert.equal(monthOf('soon', '2026-10-21'), '2026-10');
  assert.equal(monthOf(undefined, '2026-10-21'), '2026-10');
  assert.equal(monthLast('2026-10'), '2026-10-31');
  assert.equal(monthLast('2028-02'), '2028-02-29');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('a row a week, cut to the month, adding up to the month and matching each full weekly page', () => {
  // October 2026 starts on a Thursday: the first row is 1 to 4 Oct from the week of 28 Sep.
  const sources: WeekSources = {
    reports:[
      report({ id:'sep', visitDate:'2026-09-29' }),
      report({ id:'a', visitDate:'2026-10-01' }), report({ id:'b', visitDate:'2026-10-01', reference:'011LME-SPR-002' }),
      report({ id:'c', visitDate:'2026-10-06' }), report({ id:'d', visitDate:'2026-10-31' }), report({ id:'nov', visitDate:'2026-11-01' }),
    ],
    issues:[
      issue({ id:'i-sep', raisedAt:'2026-09-30T10:00:00Z' }), issue({ id:'i1', raisedAt:'2026-10-02T10:00:00Z' }),
      issue({ id:'i2', raisedAt:'2026-10-07T10:00:00Z', work:'closed', events:[ev('verified', '2026-10-08T10:00:00Z')] }),
      // 23:30 on 31 Oct in UK time (GMT after the clocks went back) is still October.
      issue({ id:'i3', raisedAt:'2026-10-31T23:30:00Z' }),
    ],
    variations:[variation({ id:'v1', raisedAt:'2026-10-05T10:00:00Z', instruction:'instructed', events:[{ kind:'instructed', at:'2026-10-19T10:00:00Z', actor:'Morgan', note:'', photos:[] } as never] })],
  };
  const m = monthSummary(sources, manager, 'p1', '2026-10', '2026-11-20');
  assert.equal(m.start, '2026-10-01'); assert.equal(m.end, '2026-10-31'); assert.equal(m.current, false); assert.equal(m.asOf, '2026-10-31');
  assert.deepEqual(m.weeks.map(w => [w.monday, w.from, w.to]), [
    ['2026-09-28', '2026-10-01', '2026-10-04'], ['2026-10-05', '2026-10-05', '2026-10-11'], ['2026-10-12', '2026-10-12', '2026-10-18'],
    ['2026-10-19', '2026-10-19', '2026-10-25'], ['2026-10-26', '2026-10-26', '2026-10-31'],
  ]);
  assert.deepEqual(m.period.reports.map(r => r.id).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(m.period.siteDays, ['2026-10-01', '2026-10-06', '2026-10-31']);
  assert.deepEqual(m.period.issuesRaised.map(i => i.id), ['i1', 'i2', 'i3']);
  const sum = (k: 'daysOnSite' | 'reports' | 'issuesRaised' | 'issuesClosed' | 'variationsRaised' | 'variationsInstructed') => m.weeks.reduce((n, w) => n + w[k], 0);
  assert.equal(sum('daysOnSite'), 3); assert.equal(sum('reports'), 4); assert.equal(sum('issuesRaised'), 3);
  assert.equal(sum('issuesClosed'), 1); assert.equal(sum('variationsRaised'), 1); assert.equal(sum('variationsInstructed'), 1);
  assert.deepEqual(m.weeks.map(w => w.reports), [2, 1, 0, 0, 1]);
  // A full week reads the same as its weekly page; the first week's page also has September's report.
  const week = (monday: string) => weeklySummary(sources, manager, 'p1', monday, '2026-11-20');
  assert.equal(week('2026-10-05').reports.length, m.weeks[1]!.reports);
  assert.equal(week('2026-10-05').issuesRaised.length, m.weeks[1]!.issuesRaised);
  assert.equal(week('2026-10-05').issuesClosed.length, m.weeks[1]!.issuesClosed);
  assert.equal(week('2026-10-19').variationsInstructed.length, m.weeks[3]!.variationsInstructed);
  assert.equal(week('2026-09-28').reports.length, 3, 'the weekly page has September too');
  assert.equal(week('2026-09-28').reports.filter(r => r.visitDate >= '2026-10-01').length, m.weeks[0]!.reports);
});

test('where work moved on: grouped by place as written, newest line first, blanks counted apart', () => {
  const m = monthSummary({ ...none, reports:[
    report({ id:'r1', visitDate:'2026-10-02', authorTrade:'Electrical', observations:[
      card({ type:'update', location:'Plant room', whatHappened:'Containment started' }),
      card({ type:'update', location:'', whatHappened:'Labels printed' }),
      card({ type:'defect', location:'Riser', whatHappened:'Cracked' })] }),
    report({ id:'r2', visitDate:'2026-10-09', reference:'011LME-SPR-002', author:'Pat Pipe', authorTrade:'P&H', observations:[
      card({ type:'update', location:' plant  ROOM ', whatHappened:'Pumps set on their bases' }),
      card({ type:'update', location:'Level 2 corridor', whatHappened:'Pipework lagged' })] }),
    report({ id:'r3', visitDate:'2026-10-05', reference:'011LME-SPR-003', observations:[card({ type:'update', location:'Plant room', whatHappened:'Earlier, sent later' })] }),
  ] }, manager, 'p1', '2026-10', '2026-10-21');
  assert.deepEqual(m.places.map(p => [p.place, p.updates, p.first, p.latest.day, p.latest.text, p.latest.trade]), [
    ['Level 2 corridor', 1, '2026-10-09', '2026-10-09', 'Pipework lagged', 'P&H'],
    ['Plant room', 3, '2026-10-02', '2026-10-09', 'Pumps set on their bases', 'P&H'],
  ], 'grouped ignoring case and spacing; the newest visit wins, whatever order reports arrive in; defects are not progress');
  assert.equal(m.unplaced, 1);
  assert.equal(m.current, true); assert.equal(m.asOf, '2026-10-21');
});

test('behind or stuck: access problems on more than one day, by place', () => {
  const m = monthSummary({ ...none, reports:[
    report({ id:'a', visitDate:'2026-10-02', observations:[card({ type:'access', location:'Level 3', whatHappened:'Locked' }), card({ type:'access', location:'Roof', whatHappened:'No scaffold' })] }),
    report({ id:'b', visitDate:'2026-10-02', reference:'011LME-SPR-002', observations:[card({ type:'access', location:'level 3', whatHappened:'Still locked' })] }),
    report({ id:'c', visitDate:'2026-10-07', reference:'011LME-SPR-003', observations:[card({ type:'access', location:'Level 3', whatHappened:'Plasterers in' })] }),
  ] }, manager, 'p1', '2026-10', '2026-10-21');
  assert.deepEqual(m.access.map(a => [a.place, a.times, a.days, a.latest]), [['Level 3', 3, ['2026-10-02', '2026-10-07'], 'Plasterers in']],
    'the roof once is left out; twice on one day is one day');
});

test('photographs: the newest progress photograph from each place, up to eight, never defects', () => {
  const places = Array.from({ length: 10 }, (_, n) => `Flat ${n + 1}`);
  const m = monthSummary({ ...none, reports:[
    report({ id:'old', visitDate:'2026-10-01', observations:places.map((place, n) => card({ id:`o${n}`, location:place, whatHappened:'Started', photos:[photo(`old-${n}`)] })) }),
    report({ id:'new', visitDate:'2026-10-08', reference:'011LME-SPR-002', observations:[
      card({ location:'Flat 1', whatHappened:'Finished', photos:[photo('new-1a', '2026-10-08T09:00:00Z'), photo('new-1b', '2026-10-08T11:00:00Z')] }),
      card({ type:'defect', location:'Flat 2', whatHappened:'Hole', photos:[photo('defect')] })] }),
  ] }, manager, 'p1', '2026-10', '2026-10-21');
  assert.equal(m.photos.length, MONTH_PHOTOS);
  assert.equal(new Set(m.photos.map(p => p.place)).size, MONTH_PHOTOS, 'one a place');
  assert.equal(m.photos[0]!.src, '/api/media/new-1b', 'newest place first, its newest photograph');
  assert.ok(!m.photos.some(p => p.src === '/api/media/defect'));
});

test('health and safety inspections stay off the month', () => {
  const m = monthSummary({ ...none, reports:[report({ id:'tower', reportType:'tower-inspection' }), report({ id:'site', reference:'011LME-SPR-002' })] }, manager, 'p1', '2026-10', '2026-10-21');
  assert.deepEqual(m.period.reports.map(r => r.id), ['site']);
});

test('still open and past target at the end of a past month, as it stood then', () => {
  const issues = [
    // Closed after the month ended: open on 31 Oct and past its target then.
    issue({ id:'late', reference:'011LME-ISS-001', owner:'Acme Ltd', targetDate:'2026-10-20', work:'closed', events:[ev('verified', '2026-11-03T10:00:00Z')] }),
    // Put forward as fixed before the month ended: waiting on the office, not late.
    issue({ id:'fixed', reference:'011LME-ISS-002', owner:'acme  ltd', targetDate:'2026-10-10', work:'closed', events:[ev('closure_submitted', '2026-10-15T10:00:00Z'), ev('verified', '2026-11-02T10:00:00Z')] }),
    issue({ id:'closed', reference:'011LME-ISS-003', owner:'Acme Ltd', work:'closed', events:[ev('verified', '2026-10-25T10:00:00Z')] }),
    issue({ id:'novel', reference:'011LME-ISS-004', raisedAt:'2026-11-02T10:00:00Z' }),
    issue({ id:'nobody', reference:'011LME-ISS-005', targetDate:'2026-10-30' }),
    issue({ id:'gone', reference:'011LME-ISS-006', confirmation:'withdrawn' }),
  ];
  const m = monthSummary({ ...none, issues }, manager, 'p1', '2026-10', '2026-11-20');
  assert.equal(m.openAtEnd, 3);
  assert.deepEqual(m.pastTarget.map(i => [i.id, i.daysLate]), [['late', 11], ['nobody', 1]]);
  assert.deepEqual(m.companies.map(c => [c.owner, c.open.map(i => [i.id, i.status]), c.pastTarget]), [
    ['Acme Ltd', [['late', 'Past target'], ['fixed', 'Fixed, to check']], 1],
    ['', [['nobody', 'Past target']], 1],
  ], 'one company whatever the spelling; nobody assigned comes last');
});

test('this month reads open and past target as the office does today', () => {
  const issues = [
    issue({ id:'a', owner:'Acme', targetDate:'2026-10-01' }),
    issue({ id:'b', owner:'Acme', targetDate:'2026-10-01', work:'awaiting_verification' }),
    issue({ id:'c', owner:'Bolt', targetDate:'2026-12-01' }),
    issue({ id:'d', work:'closed', events:[ev('verified', '2026-10-05T10:00:00Z')] }),
  ];
  const m = monthSummary({ ...none, issues }, manager, 'p1', '2026-10', '2026-10-21');
  const f = issueFigures(issues, '2026-10-21');
  assert.equal(m.openAtEnd, f.open);
  assert.equal(m.pastTarget.length, f.overdue);
  assert.equal(m.companies.reduce((n, c) => n + c.pastTarget, 0), f.overdue);
  assert.equal(m.companies.flatMap(c => c.open).filter(i => i.status === 'Fixed, to check').length, f.toCheck);
});

test('this month counts an issue with no recorded raise date, as the register does', () => {
  const issues = [issue({ id:'undated', raisedAt:'', owner:'Acme', targetDate:'2026-10-01' })];
  const m = monthSummary({ ...none, issues }, manager, 'p1', '2026-10', '2026-10-21');
  assert.equal(m.openAtEnd, issueFigures(issues, '2026-10-21').open);
  assert.equal(m.pastTarget.length, issueFigures(issues, '2026-10-21').overdue);
});

test('this month: weeks still to come have no row, and this week ends today, still adding up to the month', () => {
  // Thursday 22 October 2026: the week of 19 Oct runs to today; 26 to 31 Oct has not happened.
  const sources: WeekSources = { ...none,
    reports:[report({ id:'a', visitDate:'2026-10-01' }), report({ id:'b', visitDate:'2026-10-20', reference:'011LME-SPR-002' })],
    issues:[issue({ id:'i1', raisedAt:'2026-10-21T10:00:00Z' })] };
  const m = monthSummary(sources, manager, 'p1', '2026-10', '2026-10-22');
  assert.deepEqual(m.weeks.map(w => [w.from, w.to, w.soFar]), [
    ['2026-10-01', '2026-10-04', false], ['2026-10-05', '2026-10-11', false], ['2026-10-12', '2026-10-18', false], ['2026-10-19', '2026-10-22', true],
  ]);
  assert.equal(m.weeks.reduce((n, w) => n + w.reports, 0), m.period.reports.length);
  assert.equal(m.weeks.reduce((n, w) => n + w.issuesRaised, 0), m.period.issuesRaised.length);
  // On a Monday the new week is a row of its own, so today's visits have a place to go.
  const monday = monthSummary(sources, manager, 'p1', '2026-10', '2026-10-26').weeks.at(-1)!;
  assert.deepEqual([monday.from, monday.to, monday.soFar], ['2026-10-26', '2026-10-26', true]);
  // A visit dated a day ahead keeps its week whole, so it is still counted in a row.
  const ahead = monthSummary({ ...none, reports:[report({ id:'c', visitDate:'2026-10-26' })] }, manager, 'p1', '2026-10', '2026-10-25');
  assert.deepEqual(ahead.weeks.slice(-2).map(w => [w.from, w.to, w.soFar, w.reports]), [['2026-10-19', '2026-10-25', false, 0], ['2026-10-26', '2026-10-31', false, 1]]);
  // A month that is over keeps every week.
  assert.equal(monthSummary(sources, manager, 'p1', '2026-10', '2026-11-02').weeks.length, 5);
});

test('the Site reports line says what the reports were and adds up to the figure', () => {
  const reports = [report({ id:'a' }), report({ id:'b', reference:'011LME-SPR-002', observations:[card({}), card({ id:'o2' }), card({ id:'o3' })] }),
    report({ id:'f', reference:'011LME-FFI-001', reportType:'first-fix-inspection' }), report({ id:'h', reference:'011LME-PHI-001', reportType:'handover-inspection' }),
    report({ id:'s', reference:'011LME-SSI-001', reportType:'safety-inspection' })];
  const m = monthSummary({ ...none, reports }, manager, 'p1', '2026-10', '2026-10-22');
  assert.equal(m.period.reports.length, 4);
  assert.deepEqual(m.reportKinds, [{ name:'Site update', count:2 }, { name:'Handover inspection', count:1 }, { name:'First fix inspection', count:1 }]);
  assert.equal(m.reportKinds.reduce((n, k) => n + k.count, 0), m.period.reports.length);
  assert.equal(reportKindsLine(m.reportKinds), '2 site updates, 1 handover inspection, 1 first fix inspection');
  assert.equal(reportKindsLine([{ name:'Site update', count:42 }]), 'all site updates');
  assert.equal(reportKindsLine([]), 'no visits reported');
});
