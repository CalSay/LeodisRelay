import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { dayLabel, myWeek, myWeekText, type MyWeekSources } from '../lib/myWeek';
import type { Issue, IssueEvent, Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };

const projects = [
  { id:'p1', projectNumber:'011LME', projectName:'Tetley Hall' },
  { id:'p2', projectNumber:'009LME', projectName:'Aire Court' },
];
const card = (o: Partial<Observation>): Observation => ({ id:'o', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], ...o });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', ...r } as Report);
const ev = (kind: IssueEvent['kind'], at: string, by: Principal = engineer, extra: Partial<IssueEvent> = {}): IssueEvent => ({ kind, at, actor:by.name, actorId:by.id, note:'', photos:[], ...extra });
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'', description:'', actionNeeded:'', confirmation:'confirmed',
  work:'open', owner:'', targetDate:'', raisedByReport:'', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const none: MyWeekSources = { reports:[], issues:[] };
const MONDAY = '2026-10-12';
const TODAY = '2026-10-20';

test('places only my sent reports on their visit day, across projects, never anyone else\'s', () => {
  const w = myWeek(projects, { ...none, reports:[
    report({ id:'tue', visitDate:'2026-10-13', observations:[card({ type:'defect', location:'Level 3 riser', photos:[{ id:'ph', dataUrl:'', caption:'', capturedAt:'' }] }), card({ location:' level 3  RISER ' })] }),
    report({ id:'tue-aire', projectId:'p2', reference:'009LME-SPR-004', visitDate:'2026-10-13' }),
    report({ id:'theirs', visitDate:'2026-10-14', author:'Pat Pipe', authorId:other.id }),
    report({ id:'last-week', visitDate:'2026-10-11' }),
    report({ id:'unknown', projectId:'p9', visitDate:'2026-10-13' }),
  ] }, engineer, MONDAY, TODAY);
  assert.equal(w.days.length, 7);
  assert.deepEqual(w.days.map(d => d.day), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  const tue = w.days[1]!;
  assert.deepEqual(tue.projects.map(p => p.projectId), ['p2', 'p1'], 'projects in project-number order');
  assert.deepEqual(tue.projects[1]!.reports[0]!.kinds, { update:1, defect:1, instruction:0, access:0 });
  assert.equal(tue.projects[1]!.reports[0]!.photos, 1);
  assert.deepEqual(tue.projects[1]!.reports[0]!.locations, ['Level 3 riser']);
  assert.equal(w.days[2]!.projects.length, 0, 'another engineer\'s report is not mine');
  assert.deepEqual(w.totals, { days:1, projects:2, reports:2, flagged:0, issueUpdates:0, drafts:0 });
  assert.equal(w.current, false);
});

test('a sent correction stands in for the report it corrects', () => {
  const w = myWeek(projects, { ...none, reports:[
    report({ id:'rev1', reference:'011LME-SPR-001' }),
    report({ id:'rev2', reference:'011LME-SPR-001', revision:2, corrects:'rev1' }),
  ] }, engineer, MONDAY, TODAY);
  assert.deepEqual(w.days[1]!.projects[0]!.reports.map(r => [r.id, r.revision]), [['rev2', 2]]);
  assert.equal(w.totals.reports, 1);
});

test('my drafts for the week are listed apart and do not make a day with records', () => {
  const w = myWeek(projects, { ...none, reports:[
    report({ id:'draft', state:'draft', visitDate:'2026-10-15', observations:[card({}), card({})] }),
    report({ id:'their-draft', state:'draft', visitDate:'2026-10-15', authorId:other.id }),
    report({ id:'fix', state:'draft', visitDate:'2026-10-16', corrects:'x' }),
  ] }, engineer, MONDAY, TODAY);
  assert.deepEqual(w.days[3]!.projects[0]!.drafts, [{ id:'draft', reference:'011LME-SPR-001', cards:2, correction:false }]);
  assert.equal(w.days[4]!.projects[0]!.drafts[0]!.correction, true);
  assert.deepEqual(w.totals, { days:0, projects:0, reports:0, flagged:0, issueUpdates:0, drafts:2 });
});

test('defects I flagged and updates I made on an issue count, by UK day; report sightings and office decisions do not', () => {
  const w = myWeek(projects, { ...none, issues:[
    issue({ id:'flagged', source:'individual', reportedById:engineer.id, events:[ev('raised', '2026-10-14T22:30:00Z')] }), // 23:30 BST Wednesday
    issue({ id:'from-report', source:'report', events:[ev('raised', '2026-10-14T09:00:00Z', engineer, { source:{ reportId:'r', reference:'R', revision:1 } })] }),
    issue({ id:'worked', reference:'011LME-ISS-002', events:[ev('raised', '2026-10-01T09:00:00Z', other), ev('progress', '2026-10-15T09:00:00Z'), ev('closure_submitted', '2026-10-16T09:00:00Z'),
      ev('progress', '2026-10-15T10:00:00Z', engineer, { source:{ reportId:'r', reference:'R', revision:1 } }), ev('verified', '2026-10-16T12:00:00Z'), ev('assigned', '2026-10-16T13:00:00Z')] }),
    issue({ id:'someone-else', events:[ev('progress', '2026-10-15T09:00:00Z', other)] }),
    issue({ id:'next-week', events:[ev('progress', '2026-10-18T23:30:00Z')] }), // 00:30 BST Monday
  ] }, engineer, MONDAY, TODAY);
  const kinds = w.days.map(d => d.projects.flatMap(p => p.issues.map(i => `${i.id}:${i.kind}`)));
  assert.deepEqual(kinds, [[], [], ['flagged:flagged'], ['worked:progress'], ['worked:fixed'], [], []]);
  assert.deepEqual(w.totals, { days:3, projects:1, reports:0, flagged:1, issueUpdates:2, drafts:0 });
});

test('the timesheet text names every weekday up to today, weekends only with records, and leaves drafts out', () => {
  const w = myWeek(projects, { reports:[
    report({ id:'mon', visitDate:'2026-10-12', reference:'011LME-SPR-001' }),
    report({ id:'sat', projectId:'p2', visitDate:'2026-10-17', reference:'009LME-SPR-002' }),
    report({ id:'draft', state:'draft', visitDate:'2026-10-14' }),
  ], issues:[issue({ source:'individual', events:[ev('raised', '2026-10-12T11:00:00Z'), ev('progress', '2026-10-12T12:00:00Z')] })] }, engineer, MONDAY, '2026-10-14');
  assert.equal(w.current, true);
  assert.equal(myWeekText(w, 'Sam Spark', '2026-10-20'), [
    'Sam Spark · Mon 12 Oct to Sun 18 Oct 2026',
    'Mon 12 Oct: 011LME Tetley Hall (011LME-SPR-001, 1 defect flagged, 1 issue update)',
    'Tue 13 Oct: nothing recorded',
    'Wed 14 Oct: nothing recorded',
    'Thu 15 Oct: nothing recorded',
    'Fri 16 Oct: nothing recorded',
    'Sat 17 Oct: 009LME Aire Court (009LME-SPR-002)',
  ].join('\n'));
  assert.equal(myWeekText(w, 'Sam Spark', '2026-10-13'), [
    'Sam Spark · Mon 12 Oct to Sun 18 Oct 2026',
    'Mon 12 Oct: 011LME Tetley Hall (011LME-SPR-001, 1 defect flagged, 1 issue update)',
    'Tue 13 Oct: nothing recorded',
  ].join('\n'), 'copied midweek: days still to come are left out');
});

test('days are spelt out the same way on the server and in the browser', () => {
  assert.equal(dayLabel('2026-10-12'), 'Mon 12 Oct');
  assert.equal(dayLabel('2026-10-18', true), 'Sunday 18 October');
  assert.equal(dayLabel('2026-03-29', true), 'Sunday 29 March', 'the clocks going forward');
});
