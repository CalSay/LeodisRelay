import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { CLEARED_DAYS, daysBetween, safetyActions, safetyAttention } from '../lib/safetyActions';
import type { CheckAnswer, Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };

const projects = [
  { id:'p1', projectNumber:'011LME', projectName:'Tetley Hall' },
  { id:'p2', projectNumber:'009LME', projectName:'Aire Court' },
];
const TODAY = '2026-10-20';
const check = (item: string, answer: CheckAnswer | undefined, o: Partial<Observation> = {}): Observation => ({
  id:`obs-check-${item}`, type:'check', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[],
  check:{ item, question:`Question ${item}`, ...(answer ? { answer } : {}) }, ...o });
let n = 0;
const inspection = (visitDate: string, checks: Observation[], r: Partial<Report> = {}): Report => ({
  id:`ssi-${++n}`, projectId:'p1', reference:`011LME-SSI-00${n}`, visitDate, author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:checks, review:'not_required', reportType:'safety-inspection', ...r } as Report);

test('an action stays open until a later inspection answers the check satisfactory or not applicable', () => {
  n = 0;
  const first = inspection('2026-10-05', [
    check('housekeeping', 'action', { whatHappened:' Offcuts  in riser ', actionNeeded:'Clear riser', owner:'ACME Electrical', location:'Level 2', photos:[{ id:'ph', dataUrl:'', caption:'', capturedAt:'' }] }),
    check('fire', 'action', { whatHappened:'Fire point blocked', actionNeeded:'Move pallets' }),
    check('ppe', 'ok'),
  ]);
  const second = inspection('2026-10-12', [check('housekeeping', 'action', { whatHappened:'Still offcuts', actionNeeded:'Clear riser today' }), check('fire', 'ok', { whatHappened:'Pallets moved' }), check('ppe', 'na')]);
  const s = safetyActions(projects, [second, first], engineer, TODAY);
  const p1 = s.projects.find(p => p.projectId === 'p1')!;
  assert.equal(p1.inspections, 2);
  assert.equal(p1.last?.id, second.id);
  assert.equal(p1.sinceLast, 8);
  assert.equal(p1.due, true, 'more than a week since the last inspection');
  assert.equal(p1.open.length, 1);
  const open = p1.open[0]!;
  assert.equal(open.item, 'housekeeping');
  assert.equal(open.raised.id, first.id, 'open since the inspection that first found it');
  assert.equal(open.latest.id, second.id);
  assert.equal(open.times, 2);
  assert.equal(open.found, 'Still offcuts', 'the latest words');
  assert.equal(open.actionNeeded, 'Clear riser today');
  assert.equal(open.photos, 0);
  assert.equal(open.days, 15);
  assert.equal(open.key, `p1:housekeeping:${first.id}`);
  assert.deepEqual(p1.cleared.map(a => [a.item, a.cleared?.answer, a.cleared?.note, a.days, a.found]), [['fire', 'ok', 'Pallets moved', 7, 'Fire point blocked']]);
  assert.deepEqual(s.totals, { open:1, projects:1, cleared:1, due:1, never:1, towersDue:0 });
  assert.equal(s.projects[0]!.projectId, 'p1', 'projects with open actions first');
  assert.equal(s.projects[1]!.inspections, 0);
});

test('a check found again after it was cleared opens a new action', () => {
  n = 0;
  const a = inspection('2026-10-01', [check('fire', 'action')]);
  const b = inspection('2026-10-08', [check('fire', 'ok')]);
  const c = inspection('2026-10-15', [check('fire', 'action', { whatHappened:'Blocked again' })]);
  const p1 = safetyActions(projects, [a, b, c], engineer, TODAY).projects.find(p => p.projectId === 'p1')!;
  assert.equal(p1.open.length, 1);
  assert.equal(p1.open[0]!.raised.id, c.id);
  assert.equal(p1.open[0]!.times, 1);
  assert.equal(p1.cleared.length, 1);
  assert.notEqual(p1.open[0]!.key, p1.cleared[0]!.key);
  assert.equal(p1.due, false);
});

test('a sent correction stands in for the inspection it corrects; drafts and site updates are left out', () => {
  n = 0;
  const original = inspection('2026-10-12', [check('fire', 'action')], { id:'rev1', reference:'011LME-SSI-001' });
  const corrected = inspection('2026-10-12', [check('fire', 'ok')], { id:'rev2', reference:'011LME-SSI-001', revision:2, corrects:'rev1' });
  const draft = inspection('2026-10-19', [check('ppe', 'action')], { state:'draft' });
  const { reportType: _type, ...update } = inspection('2026-10-19', [check('ppe', 'action')]);
  const p1 = safetyActions(projects, [original, corrected, draft, update as Report], engineer, TODAY).projects.find(p => p.projectId === 'p1')!;
  assert.equal(p1.inspections, 1);
  assert.equal(p1.last?.revision, 2);
  assert.deepEqual(p1.open, []);
  assert.deepEqual(p1.cleared, []);
});

test('another person\'s draft is never read, and projects not open to the person are left out', () => {
  n = 0;
  const theirs = inspection('2026-10-19', [check('ppe', 'action')], { state:'draft', authorId:other.id });
  const elsewhere = inspection('2026-10-19', [check('ppe', 'action')], { projectId:'p9' });
  const s = safetyActions(projects, [theirs, elsewhere], engineer, TODAY);
  assert.equal(s.totals.open, 0);
  assert.deepEqual(s.projects.map(p => p.projectId), ['p2', 'p1'], 'project-number order when nothing is open');
  assert.equal(s.totals.never, 2);
});

test('cleared actions are listed for four weeks, newest first', () => {
  n = 0;
  const old = inspection('2026-08-03', [check('fire', 'action'), check('ppe', 'action')]);
  const longAgo = inspection('2026-08-10', [check('fire', 'ok')]);
  const recent = inspection('2026-10-19', [check('ppe', 'na')]);
  const p1 = safetyActions(projects, [old, longAgo, recent], engineer, TODAY).projects.find(p => p.projectId === 'p1')!;
  assert.equal(daysBetween('2026-08-10', TODAY) > CLEARED_DAYS, true);
  assert.deepEqual(p1.cleared.map(a => a.item), ['ppe']);
  assert.equal(p1.cleared[0]!.days, 77);
  assert.equal(p1.sinceLast, 1);
});

test('two inspections on one day are read in reference order', () => {
  n = 0;
  const later = inspection('2026-10-19', [check('fire', 'ok')], { reference:'011LME-SSI-010' });
  const earlier = inspection('2026-10-19', [check('fire', 'action')], { reference:'011LME-SSI-009' });
  const p1 = safetyActions(projects, [later, earlier], engineer, TODAY).projects.find(p => p.projectId === 'p1')!;
  assert.deepEqual(p1.open, []);
  assert.equal(p1.cleared[0]!.days, 0);
});

test('Needs attention has one line per project with actions open, one per tower due and one per weekly inspection due, safety first', () => {
  n = 0;
  const p1 = inspection('2026-10-08', [check('fire', 'action', { whatHappened:'Fire exit blocked' }), check('ppe', 'action')]);
  const p2 = inspection('2026-10-18', [check('ppe', 'action')], { projectId:'p2', reference:'009LME-SSI-001' });
  const tower = inspection('2026-10-12', [check('guard', 'action')], { reportType:'tower-inspection', inspected:'Podium  P1', reference:'011LME-TWR-001' });
  const recent = inspection('2026-10-19', [check('guard', 'ok')], { reportType:'tower-inspection', inspected:'T3', reference:'011LME-TWR-002' });
  const s = safetyActions(projects, [p1, p2, tower, recent], engineer, TODAY);
  const lines = safetyAttention(s);
  assert.deepEqual(lines.map(l => l.kind), ['tower', 'actions', 'actions', 'inspection']);
  assert.equal(lines[0]!.title, 'Podium P1: tower inspection due');
  assert.match(lines[0]!.sub, /^Tetley Hall · last inspected 8 days ago · 1 action open$/);
  assert.equal(lines[1]!.title, '3 safety actions open', 'the project with the oldest open action comes first, its tower action counted with the rest');
  assert.match(lines[1]!.sub, /oldest found 12 days ago: Fire exit blocked$/);
  assert.equal(lines[2]!.title, '1 safety action open');
  assert.equal(lines[2]!.sub, 'Aire Court · oldest found 2 days ago: Question ppe', 'the question when nothing was written');
  assert.equal(lines[3]!.projectId, 'p1');
  assert.equal(lines.filter(l => l.kind === 'actions').reduce((n, l) => n + Number(l.title.split(' ')[0]), 0), s.totals.open, 'the lines add up to the page total');
  assert.equal(lines.filter(l => l.kind === 'tower').length, s.totals.towersDue);
  assert.equal(lines.filter(l => l.kind === 'inspection').length, s.totals.due);
  assert.equal(new Set(lines.map(l => l.key)).size, lines.length);
});

test('a project never inspected, or inspected this week with nothing open, needs no attention', () => {
  n = 0;
  const s = safetyActions(projects, [inspection('2026-10-19', [check('fire', 'ok')])], engineer, TODAY);
  assert.deepEqual(safetyAttention(s), []);
});
