import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { fortnightEnd, fortnightStart, shiftFortnight, siteCoverage, workingDaysBetween, type CoverageProjectSource } from '../lib/siteCoverage';
import type { Report } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const manager: Principal = { ...engineer, id:'entra:mgr' as never, oid:'mgr', name:'Morgan', role:'Manager' };
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:engineer.id,
  authorTrade:'Electrical', state:'submitted', version:1, revision:1, observations:[], review:'not_required', ...r } as Report);
const project = (p: Partial<CoverageProjectSource>): CoverageProjectSource => ({ id:'p1', projectNumber:'011LME', projectName:'Tetley Hall', projectManager:'A. Whitfield', status:'4. Active', ...p });
const START = '2026-10-12';
const TODAY = '2026-10-20'; // a Tuesday

test('a fortnight opens on last week and this week, and a chosen day starts on its own week', () => {
  assert.equal(fortnightStart(undefined, TODAY), '2026-10-12');
  assert.equal(fortnightEnd('2026-10-12'), '2026-10-25');
  assert.equal(fortnightStart('2026-09-30', TODAY), '2026-09-28');
  assert.equal(fortnightStart('2026-02-31', TODAY), '2026-10-12', 'not a real date');
  assert.equal(fortnightStart('2026-13-45', TODAY), '2026-10-12');
  assert.equal(fortnightStart('soon', TODAY), '2026-10-12');
  assert.equal(shiftFortnight('2026-10-12', -1), '2026-09-28');
  assert.equal(shiftFortnight('2026-10-12', 1), '2026-10-26', 'across the clocks going back');
});

test('working days leave out both ends and weekends', () => {
  assert.equal(workingDaysBetween('2026-10-19', '2026-10-20'), 0, 'yesterday');
  assert.equal(workingDaysBetween('2026-10-16', '2026-10-19'), 0, 'Friday to Monday');
  assert.equal(workingDaysBetween('2026-10-15', '2026-10-20'), 2, 'Thursday to Tuesday: Friday and Monday');
  assert.equal(workingDaysBetween('2026-10-20', '2026-10-20'), 0);
});

test('places sent reports on their visit day, leaves out drafts and other projects, and counts a correction once', () => {
  const c = siteCoverage([project({})], [
    report({ id:'a', visitDate:'2026-10-13' }),
    report({ id:'b', visitDate:'2026-10-13', author:'Pat Pipe', authorId:'entra:pat', authorTrade:'P&H', reference:'011LME-SPR-002' }),
    report({ id:'draft', visitDate:'2026-10-14', state:'draft' }),
    report({ id:'other', projectId:'p2', visitDate:'2026-10-14' }),
    report({ id:'orig', visitDate:'2026-10-15', reference:'011LME-SPR-003' }),
    report({ id:'fix', visitDate:'2026-10-15', reference:'011LME-SPR-003', revision:2, corrects:'orig' }),
    report({ id:'before', visitDate:'2026-10-09', reference:'011LME-SPR-000' }),
  ], manager, START, TODAY);
  assert.equal(c.days.length, 14);
  assert.equal(c.start, START); assert.equal(c.end, '2026-10-25');
  const [p] = c.projects;
  assert.deepEqual(p!.days[1]!.map(v => v.reportId), ['a', 'b'], 'Electrical before P&H');
  assert.deepEqual(p!.days[2], [], 'a draft is not a visit');
  assert.deepEqual(p!.days[3]!.map(v => [v.reportId, v.revision]), [['fix', 2]]);
  assert.deepEqual(p!.trades, ['Electrical', 'P&H']);
  assert.equal(p!.days.flat().length, 3, 'the report before the fortnight is not in the grid');
});

test('the last report comes from any time, and an active site goes quiet after three working days', () => {
  const projects = [project({ id:'p1' }), project({ id:'p2', projectNumber:'014LME' }), project({ id:'p3', projectNumber:'009LCP', status:'5. Defects Liability' }), project({ id:'p4', projectNumber:'021LME' })];
  const c = siteCoverage(projects, [
    report({ id:'yesterday', projectId:'p1', visitDate:'2026-10-19' }),
    report({ id:'old', projectId:'p2', visitDate:'2026-09-30' }),
    report({ id:'dlp', projectId:'p3', visitDate:'2026-09-01' }),
    report({ id:'future', projectId:'p1', visitDate:'2026-10-22' }),
  ], manager, START, TODAY);
  const [p1, p2, p3, p4] = c.projects;
  assert.equal(p1!.last?.reportId, 'yesterday', 'a visit dated after today is not the last report');
  assert.equal(p1!.workingDaysSince, 0); assert.equal(p1!.quiet, false);
  assert.deepEqual(p1!.days[10]!.map(v => v.reportId), ['future'], 'but it still shows on its day');
  assert.equal(p2!.last?.reportId, 'old', 'found outside the fortnight');
  assert.equal(p2!.workingDaysSince, 13); assert.equal(p2!.quiet, true);
  assert.equal(p3!.active, false); assert.equal(p3!.quiet, false, 'defects liability sites are never quiet');
  assert.equal(p4!.last, undefined); assert.equal(p4!.quiet, true, 'an active site with no report at all');
  assert.deepEqual(c.projects.map(p => p.projectId), ['p1', 'p2', 'p3', 'p4'], 'keeps the office order');
});

test('three full working days without a report is the line', () => {
  const at = (visitDate: string) => siteCoverage([project({})], [report({ visitDate })], manager, START, TODAY).projects[0]!;
  assert.equal(at('2026-10-15').quiet, false, 'Thursday: Friday and Monday missed');
  assert.equal(at('2026-10-14').workingDaysSince, 3);
  assert.equal(at('2026-10-14').quiet, true, 'Wednesday: Thursday, Friday and Monday missed');
});

test('only reads what the person may read', () => {
  const c = siteCoverage([project({})], [report({ id:'mine', state:'draft' }), report({ id:'sent' })], engineer, START, TODAY);
  assert.deepEqual(c.projects[0]!.days.flat().map(v => v.reportId), ['sent'], 'even the author\'s own draft is not a visit');
});

test('one mark for each person on site each day, opening their site update', () => {
  const c = siteCoverage([project({})], [
    report({ id:'ffi', visitDate:'2026-10-15', reference:'011LME-FFI-001', reportType:'first-fix-inspection' }),
    report({ id:'spr', visitDate:'2026-10-15', reference:'011LME-SPR-009' }),
    report({ id:'jo', visitDate:'2026-10-15', reference:'011LME-SPR-010', author:'Jo Wire', authorId:'entra:jo' as never }),
    report({ id:'same-name', visitDate:'2026-10-16', reference:'011LME-SPR-011', author:'Sam Spark ', authorId:undefined as never }),
    report({ id:'by-name', visitDate:'2026-10-16', reference:'011LME-FFI-002', author:'Sam Spark', authorId:undefined as never, reportType:'first-fix-inspection' }),
  ], manager, START, TODAY);
  const [p] = c.projects;
  assert.deepEqual(p!.days[3]!.map(v => [v.reportId, v.author, v.references]), [
    ['jo', 'Jo Wire', ['011LME-SPR-010']],
    ['spr', 'Sam Spark', ['011LME-SPR-009', '011LME-FFI-001']],
  ], 'two electricians are two marks; one electrician\'s update and inspection are one, opening the update');
  assert.deepEqual(p!.days[4]!.map(v => v.references), [['011LME-SPR-011', '011LME-FFI-002']], 'without a sign-in, a person is known by their name, and the update still opens first');
  assert.equal(p!.days[4]![0]!.reportId, 'same-name');
});
