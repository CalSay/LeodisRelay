import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chaseProblem, groupChases, standingPromise, RECENT_CHASES, type Chase } from '../lib/companyChases';
import { companyKey } from '../lib/companyIssues';
import { chasesFor, logChase } from '../lib/chaseStore';
import { database, records } from '../lib/storage';
import type { Principal } from '@relay/platform';

const TODAY = '2026-10-20';
const chase = (id: string, at: string, extra: Partial<Chase> = {}): Chase => ({ id, companyKey: 'acme ltd', owner: 'Acme Ltd', note: `Note ${id}`, by: 'Office', byId: 'entra:office', at, ...extra });

test('a chase needs a company and some words; a promised date must be a real day from today to a year ahead', () => {
  const ok = { owner: 'Acme Ltd', note: 'Rang Dave, coming Thursday', promisedBy: '' };
  assert.equal(chaseProblem(ok, TODAY), undefined);
  assert.equal(chaseProblem({ ...ok, promisedBy: '2026-10-20' }, TODAY), undefined, 'today is allowed');
  assert.match(chaseProblem({ ...ok, owner: '  ' }, TODAY)!, /which company/);
  assert.match(chaseProblem({ ...ok, note: '   ' }, TODAY)!, /what was said/);
  assert.match(chaseProblem({ ...ok, note: 'x'.repeat(501) }, TODAY)!, /500 characters/);
  assert.match(chaseProblem({ ...ok, promisedBy: '2026-10-19' }, TODAY)!, /already gone/);
  assert.match(chaseProblem({ ...ok, promisedBy: '2026-02-30' }, TODAY)!, /not a date/);
  assert.match(chaseProblem({ ...ok, promisedBy: '22/10/2026' }, TODAY)!, /not a date/);
  assert.match(chaseProblem({ ...ok, promisedBy: '2027-11-01' }, TODAY)!, /more than a year/);
});

test('chases are grouped by company, newest first, only for the companies asked for, and capped with a count', () => {
  const many = Array.from({ length: RECENT_CHASES + 2 }, (_, n) => chase(`a${String(n).padStart(2, '0')}`, `2026-10-${String(n + 1).padStart(2, '0')}T09:00:00Z`));
  const other = chase('b1', '2026-10-05T09:00:00Z', { companyKey: 'sparks ltd', owner: 'Sparks Ltd' });
  const hidden = chase('c1', '2026-10-05T09:00:00Z', { companyKey: 'not on page', owner: 'Not on page' });
  const grouped = groupChases([...many, other, hidden], ['acme ltd', 'sparks ltd']);
  assert.deepEqual(Object.keys(grouped).sort(), ['acme ltd', 'sparks ltd']);
  assert.equal(grouped['acme ltd']!.total, RECENT_CHASES + 2);
  assert.equal(grouped['acme ltd']!.recent.length, RECENT_CHASES);
  assert.equal(grouped['acme ltd']!.recent[0]!.id, `a${RECENT_CHASES + 1}`, 'the newest first');
});

test('the standing promise is the latest chase\'s date: due, missed once the day has gone with work to do, met when nothing is left', () => {
  const promised = [chase('2', '2026-10-15T09:00:00Z', { promisedBy: '2026-10-19' }), chase('1', '2026-10-10T09:00:00Z', { promisedBy: '2026-10-12' })];
  assert.deepEqual(standingPromise(promised, 3, TODAY), { promisedBy: '2026-10-19', state: 'missed' });
  assert.deepEqual(standingPromise(promised, 3, '2026-10-19'), { promisedBy: '2026-10-19', state: 'due' }, 'the promised day itself is not yet missed');
  assert.deepEqual(standingPromise(promised, 0, TODAY), { promisedBy: '2026-10-19', state: 'met' });
  const setAside = [chase('3', '2026-10-18T09:00:00Z'), ...promised];
  assert.equal(standingPromise(setAside, 3, TODAY), undefined, 'a later chase with no date sets the old promise aside');
  assert.equal(standingPromise([], 3, TODAY), undefined);
});

test('a chase is kept against the company ignoring case and spacing, attributed to the signed-in person, and a retry is not logged twice', () => {
  const root = mkdtempSync(join(tmpdir(), 'relay-chases-'));
  process.env.RELAY_DATA_ROOT = root;
  const office = { id: 'entra:office', name: 'Office Manager', role: 'Manager' } as Principal;
  try {
    const requestId = '6f1c2b8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
    const first = logChase({ requestId, owner: '  ACME   Ltd ', note: ' Rang Dave ', promisedBy: '2026-10-22' }, office, TODAY);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.companyKey, companyKey('Acme Ltd'));
    assert.equal(first.value.owner, 'ACME Ltd');
    assert.equal(first.value.note, 'Rang Dave');
    assert.equal(first.value.by, 'Office Manager');
    const again = logChase({ requestId, owner: 'ACME Ltd', note: 'Rang Dave', promisedBy: '2026-10-22' }, office, '2026-10-25');
    assert.deepEqual(again, first, 'a retry returns the first save, even after the promised day');
    const changed = logChase({ requestId, owner: 'ACME Ltd', note: 'Something else', promisedBy: '' }, office, TODAY);
    assert.equal(changed.ok, false);
    assert.equal(records('company-chases').length, 1);
    assert.equal(logChase({ requestId: 'not-an-id', owner: 'Acme', note: 'x', promisedBy: '' }, office, TODAY).ok, false);
    const late = logChase({ requestId: '7f1c2b8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', owner: 'Acme', note: 'x', promisedBy: '2026-10-01' }, office, TODAY);
    assert.deepEqual(late.ok ? 0 : late.status, 422);
    assert.equal(chasesFor(['acme ltd'])['acme ltd']!.recent[0]!.id, first.value.id);
  } finally {
    database().close();
    rmSync(root, { recursive: true, force: true });
  }
});
