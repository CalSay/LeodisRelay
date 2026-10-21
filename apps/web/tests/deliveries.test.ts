import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BACKDATE_DAYS, DELIVERY_COLUMNS, RECENT_DAYS, cleanDelivery, deliveriesAll, deliveryAttention, deliveryProblem, deliveryRowWords, deliveryRows, deliveryState,
  deliverySuppliers, projectDeliveries, sortedProblem, ukDay, withdrawProblem, type Delivery, type DeliveryInput,
} from '../lib/deliveries';
import { canWithdraw, deliveriesAcross, deliveriesFor, recordDelivery, sortDelivery, withdrawDelivery } from '../lib/deliveryStore';
import { registerFileName } from '../lib/sheet';
import { database, records } from '../lib/storage';
import type { Principal } from '@relay/platform';

const TODAY = '2026-10-21';
const addDays = (n: number, day = TODAY) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ok: DeliveryInput = { supplier: 'City Plumbing, Leeds', items: '40 lengths 22mm copper', day: TODAY, receivedBy: 'Pat Pipe', condition: 'complete' };
const short: DeliveryInput = { ...ok, condition: 'short', problem: '20 lengths short, rest promised Thursday' };
const delivery = (id: string, extra: Partial<Delivery> = {}): Delivery => ({ id, projectId: 'p1', ...ok, by: 'Pat Pipe', byId: 'entra:pat', at: `${TODAY}T08:00:00Z`, ...extra });
const uuid = (n: number) => `7a1c2b8e-1a2b-4c3d-8e9f-${String(n).padStart(12, '0')}`;
const sign = { by: 'Office', byId: 'entra:office', at: `${TODAY}T09:00:00Z` };

test('the UK day, so a delivery at half past midnight in summer is on the right day', () => {
  assert.equal(ukDay(new Date('2026-07-01T23:30:00Z')), '2026-07-02');
  assert.equal(ukDay(new Date('2026-12-01T23:30:00Z')), '2026-12-01');
  assert.equal(ukDay('nonsense'), '');
});

test('a delivery needs a supplier, what arrived, a day up to a week back, who took it in, and what was wrong if anything was', () => {
  assert.equal(deliveryProblem(ok, TODAY), undefined);
  assert.equal(deliveryProblem(short, TODAY), undefined);
  assert.match(deliveryProblem({ ...ok, supplier: ' ' }, TODAY)!, /supplier is/);
  assert.match(deliveryProblem({ ...ok, supplier: 'x'.repeat(81) }, TODAY)!, /80 characters/);
  assert.match(deliveryProblem({ ...ok, items: '' }, TODAY)!, /what arrived/);
  assert.match(deliveryProblem({ ...ok, items: 'x'.repeat(301) }, TODAY)!, /300 characters/);
  assert.match(deliveryProblem({ ...ok, noteNumber: 'x'.repeat(41) }, TODAY)!, /delivery note number/);
  assert.match(deliveryProblem({ ...ok, day: '2026-02-30' }, TODAY)!, /day it arrived/);
  assert.match(deliveryProblem({ ...ok, day: addDays(1) }, TODAY)!, /future/);
  assert.equal(deliveryProblem({ ...ok, day: addDays(-BACKDATE_DAYS) }, TODAY), undefined);
  assert.match(deliveryProblem({ ...ok, day: addDays(-BACKDATE_DAYS - 1) }, TODAY)!, /within 7 days/);
  assert.match(deliveryProblem({ ...ok, receivedBy: '' }, TODAY)!, /who took it in/);
  assert.match(deliveryProblem({ ...ok, storedAt: 'x'.repeat(121) }, TODAY)!, /120 characters/);
  assert.match(deliveryProblem({ ...ok, condition: 'lost' as never }, TODAY)!, /all there/);
  assert.match(deliveryProblem({ ...short, problem: '  ' }, TODAY)!, /short, damaged or wrong/);
  assert.match(deliveryProblem({ ...ok, condition: 'damaged', problem: 'x'.repeat(301) }, TODAY)!, /300 characters/);
  assert.equal(cleanDelivery({ ...ok, problem: 'left over from a change of mind' }).problem, undefined, 'all there keeps no problem');
  assert.match(sortedProblem(' ')!, /how it was sorted/);
  assert.match(sortedProblem('x'.repeat(301))!, /300 characters/);
  assert.equal(sortedProblem('Rest arrived Thursday'), undefined);
  assert.match(withdrawProblem('')!, /why/);
  assert.equal(withdrawProblem('Recorded twice'), undefined);
});

test('one with a problem is to sort until sorted; the page puts those first, oldest first, then the rest newest first', () => {
  assert.equal(deliveryState(delivery('a')), 'fine');
  assert.equal(deliveryState(delivery('a', short)), 'to-sort');
  assert.equal(deliveryState(delivery('a', { ...short, sorted: { ...sign, note: 'Rest came' } })), 'sorted');
  assert.equal(deliveryState(delivery('a', { ...short, withdrawn: { ...sign, reason: 'x' } })), 'withdrawn');
  const p = projectDeliveries([
    delivery('old', { day: addDays(-RECENT_DAYS) }),
    delivery('yesterday', { day: addDays(-1) }),
    delivery('today', { at: `${TODAY}T10:00:00Z` }),
    delivery('short-new', { ...short }),
    delivery('short-old', { ...short, day: addDays(-3) }),
    delivery('sorted', { ...short, day: addDays(-2), sorted: { ...sign, note: 'Rest came' } }),
    delivery('mistake', { ...short, withdrawn: { ...sign, reason: 'Twice' } }),
    delivery('other', { projectId: 'p2' }),
  ], 'p1', TODAY);
  assert.deepEqual(p.deliveries.map(d => d.id), ['short-old', 'short-new', 'today', 'mistake', 'yesterday', 'sorted', 'old']);
  assert.deepEqual(p.summary, { recent: 5, toSort: 2, any: true }, 'the last 7 days include today, not a week ago; withdrawn ones are left out');
  assert.equal(deliveryRowWords(p.summary), '5 in the last 7 days · 2 to sort');
  assert.equal(deliveryRowWords({ recent: 0, toSort: 0, any: true }), 'None in the last 7 days');
  assert.match(deliveryRowWords(projectDeliveries([delivery('w', { withdrawn: { ...sign, reason: 'x' } })], 'p1', TODAY).summary), /None recorded yet/);
});

test('the office gets one Needs attention line per project with deliveries to sort, longest waiting first', () => {
  const projects = [{ id: 'p1', projectNumber: '011LME', projectName: 'Tetley Hall' }, { id: 'p2', projectNumber: '012ABC', projectName: 'Mill Yard' }, { id: 'p3', projectNumber: '013XYZ', projectName: 'Quiet' }];
  const all = deliveriesAll(projects, [
    delivery('a', { ...short }),
    delivery('b', { ...short, condition: 'damaged', problem: 'One radiator dented', day: addDays(-1) }),
    delivery('c', { ...short, projectId: 'p2', supplier: 'Edmundson', condition: 'wrong', problem: '15mm sent instead of 22mm', day: addDays(-4) }),
    delivery('d', { projectId: 'p3' }),
    delivery('e', { ...short, projectId: 'p3', sorted: { ...sign, note: 'Done' } }),
  ], TODAY);
  assert.deepEqual(all.totals, { toSort: 3 });
  assert.deepEqual(all.projects.map(p => [p.projectId, p.toSort.map(d => d.id)]), [['p2', ['c']], ['p1', ['b', 'a']]]);
  const lines = deliveryAttention(all, d => `on ${d}`);
  assert.equal(lines[0]!.key, 'dl-p2');
  assert.equal(lines[0]!.title, 'Wrong items delivery from Edmundson, not sorted yet');
  assert.equal(lines[0]!.sub, `Mill Yard · Edmundson: 15mm sent instead of 22mm · arrived on ${addDays(-4)}`);
  assert.equal(lines[1]!.title, '2 deliveries with a problem, not sorted yet');
  assert.match(lines[1]!.sub, /^Tetley Hall · City Plumbing, Leeds: One radiator dented/);
});

test('recent suppliers are the latest few different ones, not withdrawn ones', () => {
  assert.deepEqual(deliverySuppliers([
    delivery('a', { at: `${TODAY}T08:00:00Z` }),
    delivery('b', { at: `${TODAY}T09:00:00Z`, supplier: 'CITY PLUMBING, LEEDS' }),
    delivery('c', { at: `${TODAY}T07:00:00Z`, supplier: 'Edmundson' }),
    delivery('d', { at: `${TODAY}T10:00:00Z`, supplier: 'Gone', withdrawn: { ...sign, reason: 'x' } }),
  ]), ['CITY PLUMBING, LEEDS', 'Edmundson']);
});

test('the spreadsheet has one row per delivery in the house order, in UK time, and is named for the project', () => {
  const project = { projectNumber: '011LME', projectName: 'Tetley Hall' };
  const rows = deliveryRows([delivery('a', { ...short, noteNumber: 'DN 448120', storedAt: 'Level 2 store', sorted: { ...sign, at: '2026-10-21T16:10:00Z', note: 'Rest came' } })], project);
  assert.equal(rows[0]!.length, DELIVERY_COLUMNS.length);
  assert.deepEqual(rows[0], ['DN 448120', '011LME', 'Tetley Hall', ok.supplier, ok.items, TODAY, 'Pat Pipe', 'Level 2 store', 'Short or part delivery', short.problem, 'Sorted', `${TODAY} 17:10`, 'Office', 'Rest came', `${TODAY} 09:00`, 'Pat Pipe', undefined, undefined, undefined]);
  assert.equal(deliveryRows([delivery('b')], project)[0]![DELIVERY_COLUMNS.indexOf('Status')], 'All there');
  const gone = deliveryRows([delivery('c', { withdrawn: { ...sign, at: '2026-10-21T23:30:00Z', reason: 'Wrong project' } })], project)[0]!;
  assert.deepEqual([gone[DELIVERY_COLUMNS.indexOf('Status')], ...gone.slice(-3)], ['Withdrawn', '2026-10-22', 'Office', 'Wrong project']);
  assert.deepEqual(DELIVERY_COLUMNS.slice(0, 3), ['Delivery note number', 'Project number', 'Project'], 'reference, then the project, as the other registers');
  assert.deepEqual(DELIVERY_COLUMNS.slice(-3), ['Withdrawn on', 'Withdrawn by', 'Withdrawn because']);
  assert.equal(registerFileName('deliveries', TODAY, '011LME'), 'relay-deliveries-011LME-2026-10-21.csv');
});

test('a delivery is recorded by whoever is signed in, a retry is kept once, anyone on the project sorts it, and only its recorder or the office withdraws it', () => {
  const root = mkdtempSync(join(tmpdir(), 'relay-deliveries-'));
  process.env.RELAY_DATA_ROOT = root;
  const engineer = { id: 'entra:pat', name: 'Pat Pipe', role: 'Engineer', trade: 'P&H' } as Principal;
  const other = { id: 'entra:sam', name: 'Sam Spark', role: 'Engineer', trade: 'Electrical' } as Principal;
  const office = { id: 'entra:office', name: 'Office Manager', role: 'Manager' } as Principal;
  const now = new Date(`${TODAY}T09:00:00Z`);
  try {
    const first = recordDelivery({ projectId: 'p1', requestId: uuid(1), ...short, supplier: '  City   Plumbing ', noteNumber: ' ', storedAt: '' }, engineer, now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.supplier, 'City Plumbing');
    assert.equal(first.value.noteNumber, undefined);
    assert.equal(first.value.storedAt, undefined);
    assert.equal(first.value.by, 'Pat Pipe');
    assert.deepEqual(recordDelivery({ projectId: 'p1', requestId: uuid(1), ...short, supplier: 'City Plumbing' }, engineer, now), first, 'a retry returns the first save');
    const changed = recordDelivery({ projectId: 'p1', requestId: uuid(1), ...short, supplier: 'Someone else' }, engineer, now);
    assert.equal(changed.ok ? 0 : changed.status, 409);
    const bad = recordDelivery({ projectId: 'p1', requestId: uuid(2), ...short, problem: '' }, engineer, now);
    assert.equal(bad.ok ? 0 : bad.status, 422);
    assert.equal(recordDelivery({ projectId: 'p1', requestId: 'nope', ...ok }, engineer, now).ok, false);
    assert.equal(records('deliveries').length, 1);

    const noNote = sortDelivery(first.value.id, ' ', other, now);
    assert.equal(noNote.ok ? 0 : noNote.status, 422, 'sorting says how');
    const sorted = sortDelivery(first.value.id, '  Rest   arrived Thursday ', other, now);
    assert.equal(sorted.ok && sorted.value.sorted?.by, 'Sam Spark', 'another engineer on the project may sort it');
    assert.equal(sorted.ok && sorted.value.sorted?.note, 'Rest arrived Thursday');
    assert.deepEqual(sortDelivery(first.value.id, 'again', office, now), sorted, 'sorting again changes nothing');
    assert.equal(sortDelivery('delivery-missing', 'x', office, now).ok, false);

    const fine = recordDelivery({ projectId: 'p1', requestId: uuid(3), ...ok }, engineer, now);
    assert.equal(fine.ok, true);
    if (!fine.ok) return;
    const nothing = sortDelivery(fine.value.id, 'x', office, now);
    assert.equal(nothing.ok ? 0 : nothing.status, 409, 'one that was all there has nothing to sort');

    assert.equal(canWithdraw(fine.value, other), false);
    assert.equal(canWithdraw(fine.value, office), true);
    const refused = withdrawDelivery(fine.value.id, 'Not mine', other, now);
    assert.equal(refused.ok ? 0 : refused.status, 403);
    assert.equal(withdrawDelivery(fine.value.id, ' ', engineer, now).ok, false);
    const gone = withdrawDelivery(fine.value.id, ' Wrong   project ', engineer, now);
    assert.equal(gone.ok && gone.value.withdrawn?.reason, 'Wrong project');
    assert.deepEqual(withdrawDelivery(fine.value.id, 'Again', office, now), gone, 'withdrawing again changes nothing');

    const waiting = recordDelivery({ projectId: 'p1', requestId: uuid(4), ...short, condition: 'damaged', problem: 'Dented' }, office, now);
    assert.equal(waiting.ok && waiting.value.by, 'Office Manager');
    if (!waiting.ok) return;
    assert.equal(withdrawDelivery(waiting.value.id, 'Mistake', office, now).ok, true);
    const noSort = sortDelivery(waiting.value.id, 'x', engineer, now);
    assert.equal(noSort.ok ? 0 : noSort.status, 409, 'a withdrawn record cannot be sorted');

    assert.equal(recordDelivery({ projectId: 'p1', requestId: uuid(5), ...short }, engineer, now).ok, true);
    const p = deliveriesFor('p1', now);
    assert.equal(p.deliveries.length, 4, 'withdrawn ones stay listed');
    assert.deepEqual(p.summary, { recent: 2, toSort: 1, any: true });
    const across = deliveriesAcross([{ id: 'p1', projectNumber: '011LME', projectName: 'Tetley Hall' }, { id: 'p2', projectNumber: '012ABC', projectName: 'Mill Yard' }], now);
    assert.deepEqual(across.projects.map(x => [x.projectId, x.toSort.length]), [['p1', 1]]);
  } finally {
    database().close();
    rmSync(root, { recursive: true, force: true });
  }
});
