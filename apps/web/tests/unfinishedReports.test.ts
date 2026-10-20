import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unfinishedReports } from '../lib/unfinishedReports';
import type { Report, ReportSummary } from '../lib/types';

const projects = [{ id:'p1', projectName:'Tetley Hall' }, { id:'p2', projectName:'Kirkgate' }];
function draft(id: string, projectId: string, lastSavedAt: string, extra: Partial<ReportSummary> = {}): ReportSummary {
  return { id, projectId, reference:`R-${id}`, visitDate:'2026-10-20', author:'A', state:'draft', version:1, revision:1, review:'not_required',
    observationCount:2, photoCount:0, defectCount:0, lastSavedAt, ...extra } as ReportSummary;
}
const card = { id:'c', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[] } as unknown as Report['observations'][number];

test('lists drafts from every project, newest first, with project and last save', () => {
  const rows = unfinishedReports([draft('a','p1','2026-10-20T09:00:00Z'), draft('b','p2','2026-10-20T11:00:00Z')], [], projects);
  assert.deepEqual(rows.map(r => [r.id, r.projectName, r.savedAt, r.device]), [
    ['b','Kirkgate','2026-10-20T11:00:00Z',undefined], ['a','Tetley Hall','2026-10-20T09:00:00Z',undefined]]);
});

test('a device copy of a server draft marks edits waiting to go up', () => {
  const row = unfinishedReports([draft('a','p1','2026-10-20T09:00:00Z')], [{ reportId:'a', heldAt:'2026-10-20T10:00:00Z', observations:[card,card,card] }], projects)[0]!;
  assert.equal(row.device, 'unsent');
  assert.equal(row.changedAt, '2026-10-20T10:00:00Z');
  assert.equal(row.cards, 3, 'counts the cards on the device, which are newer');
});

test('a device copy the server did not list shows only when the server could not be asked', () => {
  const report = { ...draft('x','p2','2026-10-19T09:00:00Z'), observations:[card] } as unknown as Report;
  const held = [{ reportId:'x', heldAt:'2026-10-20T12:00:00Z', observations:[card], report }];
  assert.equal(unfinishedReports([], held, projects).length, 0, 'not shown without the server check');
  const row = unfinishedReports([], held, projects, new Set(['x']))[0]!;
  assert.deepEqual([row.id, row.device, row.projectName], ['x','only','Kirkgate']);
});

test('leaves out sent reports and projects no longer open to the engineer', () => {
  const sent = { ...draft('s','p1','2026-10-19T09:00:00Z'), state:'submitted', observations:[] } as unknown as Report;
  const rows = unfinishedReports([draft('a','p9','2026-10-20T09:00:00Z'), draft('s','p1','2026-10-20T09:00:00Z',{ state:'submitted' })],
    [{ reportId:'s', heldAt:'2026-10-20T12:00:00Z', observations:[], report:sent }], projects, new Set(['s']));
  assert.deepEqual(rows, []);
});

test('marks corrections', () => {
  assert.equal(unfinishedReports([draft('c','p1','2026-10-20T09:00:00Z',{ corrects:'orig' })], [], projects)[0]!.correction, true);
});
