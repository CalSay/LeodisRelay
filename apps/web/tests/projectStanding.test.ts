import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LATEST_DAYS, progressLines, projectStanding, recentDay } from '../lib/projectStanding';
import type { Report, ReportSummary } from '../lib/types';

const TODAY = '2026-10-21'; // a Wednesday
const ACTIVE = { status: '4. Active' };
const DLP = { status: '5. Defects Liability' };
let n = 0;
const sent = (r: Partial<ReportSummary>): ReportSummary => ({ id: `r${++n}`, projectId: 'p1', reference: `011LME-SPR-${String(n).padStart(3, '0')}`, visitDate: TODAY, author: 'Sam Spark',
  authorTrade: 'Electrical', state: 'submitted', version: 1, revision: 1, review: 'not_required', observationCount: 1, photoCount: 0, defectCount: 0, serverAcknowledgedAt: `${r.visitDate ?? TODAY}T16:00:00.000Z`, ...r } as ReportSummary);

test('the last visit is the newest visit day, and a draft or a future day does not count', () => {
  const sameDay = projectStanding(ACTIVE, [sent({ id: 'b', reference: '011LME-SPR-010', author: 'Hana Duct', authorTrade: 'HVAC', serverAcknowledgedAt: `${TODAY}T08:00:00.000Z` }), sent({ id: 'a', reference: '011LME-SPR-009', serverAcknowledgedAt: `${TODAY}T17:00:00.000Z` })], TODAY);
  assert.equal(sameDay.last?.reportId, 'b', 'on a busy day, the highest reference, as Site coverage has it');
  const st = projectStanding(ACTIVE, [
    sent({ id: 'old', visitDate: '2026-10-19', author: 'Hana Duct', authorTrade: 'HVAC' }),
    sent({ id: 'new', visitDate: '2026-10-20' }),
    sent({ id: 'draft', visitDate: TODAY, state: 'draft' }),
    sent({ id: 'later', visitDate: '2026-10-22' }),
  ], TODAY);
  assert.deepEqual(st.last, { reportId: 'new', visitDate: '2026-10-20', author: 'Sam Spark', trade: 'Electrical' });
  assert.equal(st.workingDaysSince, 0);
  assert.equal(st.quiet, false);
});

test('this week counts visits from Monday by trade, and a correction stands in for the report it corrects', () => {
  const st = projectStanding(ACTIVE, [
    sent({ id: 'a', visitDate: '2026-10-19' }),
    sent({ id: 'a2', visitDate: '2026-10-19', corrects: 'a', revision: 2 }),
    sent({ visitDate: '2026-10-20', author: 'Pat Pipe', authorTrade: 'P&H' }),
    sent({ visitDate: '2026-10-18', author: 'Hana Duct', authorTrade: 'HVAC' }),
  ], TODAY);
  assert.equal(st.thisWeek, 2, 'Sunday is last week; the corrected report is one visit');
  assert.deepEqual(st.tradesThisWeek, ['Electrical', 'P&H']);
});

test('an active site with no report for three working days is quiet; one in defects liability never is', () => {
  const reports = [sent({ visitDate: '2026-10-15' })]; // Thursday: Friday, Monday, Tuesday since
  assert.equal(projectStanding(ACTIVE, reports, TODAY).workingDaysSince, 3);
  assert.equal(projectStanding(ACTIVE, reports, TODAY).quiet, true);
  assert.equal(projectStanding(DLP, reports, TODAY).quiet, false);
  assert.equal(projectStanding(ACTIVE, [sent({ visitDate: '2026-10-16' })], TODAY).quiet, false, 'two working days');
  const none = projectStanding(ACTIVE, [], TODAY);
  assert.equal(none.last, undefined);
  assert.equal(none.quiet, true, 'never reported');
  assert.equal(projectStanding(DLP, [], TODAY).quiet, false);
});

test('latest from site is each trade\'s newest site update in the last fortnight, newest first, never an inspection', () => {
  const st = projectStanding(ACTIVE, [
    sent({ id: 'e-old', visitDate: '2026-10-19' }),
    sent({ id: 'e-new', visitDate: '2026-10-20' }),
    sent({ id: 'insp', visitDate: TODAY, reportType: 'safety-inspection', checks: { ok: 3, action: 0, na: 0, open: 0 } }),
    sent({ id: 'ff', visitDate: TODAY, reportType: 'first-fix-inspection' }),
    sent({ id: 'h', visitDate: TODAY, author: 'Hana Duct', authorTrade: 'HVAC' }),
    sent({ id: 'p-stale', visitDate: '2026-10-06', author: 'Pat Pipe', authorTrade: 'P&H' }),
  ], TODAY);
  assert.equal(LATEST_DAYS, 14);
  assert.deepEqual(st.latest.map(r => r.id), ['h', 'e-new'], 'P&H last sent an update more than a fortnight ago');
  const edge = projectStanding(ACTIVE, [sent({ id: 'in', visitDate: '2026-10-08' }), sent({ id: 'out', visitDate: '2026-10-07', author: 'Hana Duct', authorTrade: 'HVAC' })], TODAY);
  assert.deepEqual(edge.latest.map(r => r.id), ['in'], 'fourteen days: today and the thirteen before it');
  assert.equal(projectStanding(ACTIVE, [sent({ visitDate: '2026-10-19' }), sent({ id: 'insp', visitDate: TODAY, reportType: 'safety-inspection' })], TODAY).last?.reportId, 'insp', 'an inspection still counts as a visit');
});

test('progress lines are the progress and access cards that say something, in the order written', () => {
  const card = (o: Partial<Report['observations'][number]>) => ({ id: `o${++n}`, type: 'update', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], ...o }) as Report['observations'][number];
  const lines = progressLines({ observations: [
    card({ id: 'u', location: ' Riser 2 ', whatHappened: 'Containment complete ', photos: [{ id: 'x' } as never] }),
    card({ type: 'defect', location: 'Flat 4', whatHappened: 'Cracked faceplate' }),
    card({ type: 'instruction', location: 'Plant room', whatHappened: 'Extra socket' }),
    card({ id: 'a', type: 'access', location: 'Level 2', whatHappened: 'Blocked by scaffold' }),
    card({ location: '  ', whatHappened: ' ' }),
  ] });
  assert.deepEqual(lines, [
    { id: 'u', kind: 'update', location: 'Riser 2', text: 'Containment complete', photos: 1 },
    { id: 'a', kind: 'access', location: 'Level 2', text: 'Blocked by scaffold', photos: 0 },
  ]);
});

test('recent days are named; older ones are left to the date', () => {
  assert.equal(recentDay(TODAY, TODAY), 'today');
  assert.equal(recentDay('2026-10-20', TODAY), 'yesterday');
  assert.equal(recentDay('2026-10-19', TODAY), null);
  assert.equal(recentDay('2026-03-31', '2026-04-01'), 'yesterday', 'across a month end');
});
