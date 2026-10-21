import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BACKDATE_DAYS, LONGEST_DAYS, PERMIT_COLUMNS, PERMIT_KINDS, RECENT_DAYS, closeCheck, closeProblem, endsWords, londonMinute, permitAttention,
  permitProblem, permitRepeats, permitRowWords, permitRows, permitState, permitsAll, projectPermits, withdrawProblem, type Permit, type PermitInput,
} from '../lib/permits';
import { canWithdraw, closePermit, permitsAcross, permitsFor, recordPermit, withdrawPermit } from '../lib/permitStore';
import { database, records } from '../lib/storage';
import type { Principal } from '@relay/platform';

const TODAY = '2026-10-21';
const NOW = `${TODAY}T10:00`;
const addDays = (n: number, day = TODAY) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ok: PermitInput = { kind: 'hot-works', work: 'Brazing LTHW flow and return, level 3 riser', issuedBy: 'Dana, Principal Contractor', heldBy: 'Pat Pipe', day: TODAY, ends: `${TODAY}T17:00` };
const permit = (id: string, extra: Partial<Permit> = {}): Permit => ({ id, projectId: 'p1', ...ok, by: 'Pat Pipe', byId: 'entra:pat', at: `${TODAY}T08:00:00Z`, ...extra });
const uuid = (n: number) => `7a1c2b8e-1a2b-4c3d-8e9f-${String(n).padStart(12, '0')}`;
const sign = { by: 'Office', byId: 'entra:office', at: `${TODAY}T09:00:00Z` };

test('UK time to the minute, in the shape of a date-and-time box', () => {
  assert.equal(londonMinute(new Date('2026-10-21T08:14:59Z')), '2026-10-21T09:14', 'BST');
  assert.equal(londonMinute(new Date('2026-12-01T23:30:00Z')), '2026-12-01T23:30', 'GMT');
  assert.equal(londonMinute('nonsense'), '');
});

test('a permit needs a kind, the work, who issued and holds it, a day up to a week back and an end within a week of it', () => {
  assert.equal(permitProblem(ok, NOW), undefined);
  assert.match(permitProblem({ ...ok, kind: 'boiler' as never }, NOW)!, /kind of permit/);
  assert.match(permitProblem({ ...ok, work: '  ' }, NOW)!, /work is and where/);
  assert.match(permitProblem({ ...ok, work: 'x'.repeat(301) }, NOW)!, /300 characters/);
  assert.match(permitProblem({ ...ok, reference: 'x'.repeat(41) }, NOW)!, /permit number/);
  assert.match(permitProblem({ ...ok, issuedBy: '' }, NOW)!, /who issued/);
  assert.match(permitProblem({ ...ok, heldBy: ' ' }, NOW)!, /who holds/);
  assert.match(permitProblem({ ...ok, heldBy: 'x'.repeat(81) }, NOW)!, /80 characters/);
  assert.match(permitProblem({ ...ok, day: '2026-02-30' }, NOW)!, /day the permit was issued/);
  assert.match(permitProblem({ ...ok, day: addDays(1) }, NOW)!, /future/);
  assert.equal(permitProblem({ ...ok, day: addDays(-BACKDATE_DAYS) }, NOW), undefined, 'a week late is fine, and may already have ended');
  assert.match(permitProblem({ ...ok, day: addDays(-BACKDATE_DAYS - 1) }, NOW)!, /within 7 days/);
  assert.match(permitProblem({ ...ok, ends: '' }, NOW)!, /runs until/);
  assert.match(permitProblem({ ...ok, ends: `${TODAY}T24:00` }, NOW)!, /runs until/);
  assert.match(permitProblem({ ...ok, ends: `${addDays(-1)}T17:00` }, NOW)!, /before the day it was issued/);
  assert.equal(permitProblem({ ...ok, ends: `${addDays(LONGEST_DAYS)}T23:59` }, NOW), undefined);
  assert.match(permitProblem({ ...ok, ends: `${addDays(LONGEST_DAYS + 1)}T08:00` }, NOW)!, /up to 7 days/);
  assert.match(permitProblem({ ...ok, notes: 'x'.repeat(1001) }, NOW)!, /1000 characters/);
  assert.match(closeProblem(false, undefined)!, /Confirm the closing check/);
  assert.match(closeProblem(true, 'x'.repeat(301))!, /300 characters/);
  assert.equal(closeProblem(true, 'Fire watch by Chris'), undefined);
  assert.match(withdrawProblem(' ')!, /why/);
  assert.equal(withdrawProblem('Recorded twice'), undefined);
});

test('every kind has a closing check, and hot works asks for the fire watch', () => {
  for (const k of PERMIT_KINDS) assert.ok(closeCheck(k.id).length > 20, k.id);
  assert.match(closeCheck('hot-works'), /fire watch was kept for at least 60 minutes/);
});

test('a permit is open until its end time, then past it until closed; withdrawn ones are left out of the figures', () => {
  assert.equal(permitState(permit('a'), NOW), 'open');
  assert.equal(permitState(permit('a', { ends: `${TODAY}T10:00` }), NOW), 'open', 'at its end time it is not yet past it');
  assert.equal(permitState(permit('a', { ends: `${TODAY}T09:59` }), NOW), 'overdue');
  assert.equal(permitState(permit('a', { ends: `${TODAY}T09:59`, closed: sign }), NOW), 'closed');
  assert.equal(permitState(permit('a', { closed: sign, withdrawn: { ...sign, reason: 'x' } }), NOW), 'withdrawn');
  const p = projectPermits([
    permit('closed-old', { day: addDays(-RECENT_DAYS), ends: `${addDays(-RECENT_DAYS)}T17:00`, closed: { ...sign, at: `${addDays(-RECENT_DAYS)}T16:00:00Z` } }),
    permit('closed-late', { day: addDays(-RECENT_DAYS - 3), ends: `${addDays(-RECENT_DAYS - 3)}T17:00`, closed: sign }),
    permit('closed', { day: addDays(-1), ends: `${addDays(-1)}T17:00`, closed: sign }),
    permit('later', { ends: `${addDays(1)}T12:00` }),
    permit('soon'),
    permit('late', { day: addDays(-1), ends: `${addDays(-1)}T17:00` }),
    permit('mistake', { withdrawn: { ...sign, reason: 'Twice' } }),
    permit('other', { projectId: 'p2' }),
  ], 'p1', NOW);
  assert.deepEqual(p.permits.map(x => x.id), ['late', 'soon', 'later', 'mistake', 'closed', 'closed-old', 'closed-late'], 'past their end first, then by end time, then the rest newest first');
  assert.deepEqual(p.summary, { open: 3, overdue: 1, recent: 2, any: true }, 'closed in the last four weeks by the day it was closed');
  assert.equal(permitRowWords(p.summary), '3 open · 1 past its end time');
  assert.equal(permitRowWords({ open: 0, overdue: 0, recent: 0, any: true }), 'None open');
  assert.equal(permitRowWords({ open: 2, overdue: 2, recent: 0, any: true }), '2 open · 2 past their end time');
  assert.match(permitRowWords(projectPermits([permit('w', { withdrawn: { ...sign, reason: 'x' } })], 'p1', NOW).summary), /None recorded yet/, 'only withdrawn ones is nothing recorded');
});

test('end times read as today, yesterday or the day', () => {
  const day = (d: string) => `on ${d}`;
  assert.equal(endsWords(`${TODAY}T17:00`, NOW, day), '17:00 today');
  assert.equal(endsWords(`${addDays(-1)}T17:00`, NOW, day), '17:00 yesterday');
  assert.equal(endsWords(`${addDays(1)}T08:00`, NOW, day), '08:00 tomorrow');
  assert.equal(endsWords(`${addDays(-3)}T17:00`, NOW, day), `17:00 on ${addDays(-3)}`);
});

test('the office gets one Needs attention line per project with permits past their end time', () => {
  const projects = [{ id: 'p1', projectNumber: '011LME', projectName: 'Tetley Hall' }, { id: 'p2', projectNumber: '012ABC', projectName: 'Mill Yard' }, { id: 'p3', projectNumber: '013XYZ', projectName: 'Quiet' }];
  const all = permitsAll(projects, [
    permit('a', { ends: `${addDays(-1)}T17:00`, day: addDays(-1) }),
    permit('b', { ends: `${TODAY}T08:00`, kind: 'electrical-isolation' }),
    permit('c', { projectId: 'p2', ends: `${addDays(-2)}T16:00`, day: addDays(-2), work: 'Roof plant deck', heldBy: 'Chris' }),
    permit('d', { projectId: 'p3' }),
    permit('e', { projectId: 'p3', ends: `${addDays(-1)}T17:00`, day: addDays(-1), closed: sign }),
  ], NOW);
  assert.deepEqual(all.totals, { open: 4, overdue: 3 });
  assert.deepEqual(all.projects.map(p => [p.projectId, p.overdue.map(o => o.id)]), [['p2', ['c']], ['p1', ['a', 'b']]], 'longest past first; a project with nothing past is left out');
  const lines = permitAttention(all, d => d);
  assert.equal(lines[0]!.title, 'Hot works permit still open past its end time');
  assert.equal(lines[0]!.sub, `Mill Yard · Hot works · Roof plant deck · held by Chris · ended 16:00 ${addDays(-2)}`);
  assert.equal(lines[1]!.title, '2 permits still open past their end time');
  assert.match(lines[1]!.sub, /ended 17:00 yesterday$/);
});

test('starting from a recent one offers the latest of each kind and work, not withdrawn ones', () => {
  const repeats = permitRepeats([
    permit('a', { at: `${TODAY}T08:00:00Z` }),
    permit('b', { at: `${TODAY}T09:00:00Z`, work: ok.work.toUpperCase() }),
    permit('c', { at: `${TODAY}T07:00:00Z`, kind: 'electrical-isolation' }),
    permit('d', { at: `${TODAY}T10:00:00Z`, work: 'Gone', withdrawn: { ...sign, reason: 'x' } }),
  ]);
  assert.deepEqual(repeats.map(p => p.id), ['b', 'c']);
});

test('the spreadsheet has one row per permit in UK time, and is named for the project', () => {
  const rows = permitRows([permit('a', { reference: 'HW-0142', closed: { ...sign, at: '2026-10-21T16:10:00Z', note: 'Fire watch by Chris' } }), permit('b', { ends: `${TODAY}T09:00` })], NOW, { projectNumber: '011LME', projectName: 'Tetley Hall' });
  assert.equal(rows[0]!.length, PERMIT_COLUMNS.length);
  assert.deepEqual(rows[0], ['HW-0142', '011LME', 'Tetley Hall', 'Hot works', ok.work, TODAY, ok.issuedBy, 'Pat Pipe', `${TODAY} 17:00`, 'Closed', `${TODAY} 17:10`, 'Office', closeCheck('hot-works'), 'Fire watch by Chris', undefined, `${TODAY} 09:00`, 'Pat Pipe', undefined, undefined, undefined]);
  assert.equal(rows[1]![PERMIT_COLUMNS.indexOf('Status')], 'Open, past its end time');
  const gone = permitRows([permit('c', { withdrawn: { ...sign, at: '2026-10-21T23:30:00Z', reason: 'Wrong project' } })], NOW, { projectNumber: '011LME', projectName: 'Tetley Hall' })[0]!;
  assert.deepEqual([gone[PERMIT_COLUMNS.indexOf('Status')], ...gone.slice(-3)], ['Withdrawn', '2026-10-22', 'Office', 'Wrong project'], 'withdrawn on the UK day, by whom and why');
});

test('a permit is recorded by whoever is signed in, a retry is kept once, anyone on the project closes it, and only its recorder or the office withdraws it', () => {
  const root = mkdtempSync(join(tmpdir(), 'relay-permits-'));
  process.env.RELAY_DATA_ROOT = root;
  const engineer = { id: 'entra:pat', name: 'Pat Pipe', role: 'Engineer', trade: 'P&H' } as Principal;
  const other = { id: 'entra:sam', name: 'Sam Spark', role: 'Engineer', trade: 'Electrical' } as Principal;
  const office = { id: 'entra:office', name: 'Office Manager', role: 'Manager' } as Principal;
  const now = new Date(`${TODAY}T09:00:00Z`);
  try {
    const first = recordPermit({ projectId: 'p1', requestId: uuid(1), ...ok, work: '  Brazing   LTHW ', reference: ' ', notes: '  ' }, engineer, now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.work, 'Brazing LTHW');
    assert.equal(first.value.reference, undefined, 'an empty permit number is left out');
    assert.equal(first.value.notes, undefined);
    assert.equal(first.value.by, 'Pat Pipe');
    assert.deepEqual(recordPermit({ projectId: 'p1', requestId: uuid(1), ...ok, work: 'Brazing LTHW' }, engineer, now), first, 'a retry returns the first save');
    const changed = recordPermit({ projectId: 'p1', requestId: uuid(1), ...ok, work: 'Something else' }, engineer, now);
    assert.equal(changed.ok ? 0 : changed.status, 409);
    const bad = recordPermit({ projectId: 'p1', requestId: uuid(2), ...ok, ends: `${addDays(-1)}T17:00` }, engineer, now);
    assert.equal(bad.ok ? 0 : bad.status, 422);
    assert.equal(recordPermit({ projectId: 'p1', requestId: 'nope', ...ok }, engineer, now).ok, false);
    assert.equal(records('permits').length, 1);

    const unconfirmed = closePermit(first.value.id, false, undefined, other, now);
    assert.equal(unconfirmed.ok ? 0 : unconfirmed.status, 422, 'closing needs the check confirmed');
    const closed = closePermit(first.value.id, true, '  Fire watch   by Chris ', other, now);
    assert.equal(closed.ok && closed.value.closed?.by, 'Sam Spark', 'another engineer on the project may close it');
    assert.equal(closed.ok && closed.value.closed?.note, 'Fire watch by Chris');
    assert.deepEqual(closePermit(first.value.id, true, 'again', office, now), closed, 'closing again changes nothing');
    assert.equal(closePermit('permit-missing', true, undefined, office, now).ok, false);

    assert.equal(canWithdraw(first.value, other), false);
    assert.equal(canWithdraw(first.value, office), true);
    const refused = withdrawPermit(first.value.id, 'Not mine', other, now);
    assert.equal(refused.ok ? 0 : refused.status, 403);
    assert.equal(withdrawPermit(first.value.id, ' ', engineer, now).ok, false);
    const gone = withdrawPermit(first.value.id, ' Wrong   project ', office, now);
    assert.equal(gone.ok && gone.value.withdrawn?.reason, 'Wrong project');
    assert.deepEqual(withdrawPermit(first.value.id, 'Again', engineer, now), gone, 'withdrawing again changes nothing');

    const second = recordPermit({ projectId: 'p1', requestId: uuid(3), ...ok, kind: 'electrical-isolation', ends: `${TODAY}T09:30` }, office, now);
    assert.equal(second.ok && second.value.by, 'Office Manager');
    if (!second.ok) return;
    assert.equal(withdrawPermit(second.value.id, 'Mistake', office, now).ok, true);
    const noClose = closePermit(second.value.id, true, undefined, engineer, now);
    assert.equal(noClose.ok ? 0 : noClose.status, 409, 'a withdrawn record cannot be closed');

    const third = recordPermit({ projectId: 'p1', requestId: uuid(4), ...ok, ends: `${TODAY}T09:30` }, engineer, now);
    assert.equal(third.ok, true);
    const later = new Date(`${TODAY}T09:00:00Z`.replace('09:00', '10:00'));
    const p = permitsFor('p1', later);
    assert.equal(p.permits.length, 3, 'withdrawn ones stay listed');
    assert.deepEqual(p.summary, { open: 1, overdue: 1, recent: 0, any: true }, 'past its end time at 11:00 UK time');
    const across = permitsAcross([{ id: 'p1', projectNumber: '011LME', projectName: 'Tetley Hall' }], later);
    assert.equal(across.projects[0]?.overdue.length, 1);
  } finally {
    database().close();
    rmSync(root, { recursive: true, force: true });
  }
});
