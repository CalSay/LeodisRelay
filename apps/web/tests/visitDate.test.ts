import { test, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { createReport } from '../lib/serverStore';
import { database } from '../lib/storage';

const root = mkdtempSync(join(tmpdir(), 'relay-visit-date-'));
process.env.RELAY_DATA_ROOT = root;
after(() => { database().close(); rmSync(root, { recursive: true, force: true }); });
const engineer: Principal = { id: 'entra:visit-date' as Principal['id'], oid: 'visit-date', name: 'Sam Spark', email: 'sam@example.test', role: 'Engineer', trade: 'Electrical' };

test('a report started just after midnight in summer is dated that UK day, not the UTC day before', () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-06-14T23:30:00Z') }); // 00:30 BST on 15 June
  try {
    assert.equal(createReport('proj-011lme', engineer.name, engineer).visitDate, '2026-06-15');
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-12-14T23:30:00Z') }); // 23:30 GMT on 14 December
  try {
    assert.equal(createReport('proj-011lme', engineer.name, engineer).visitDate, '2026-12-14');
  } finally { mock.timers.reset(); }
});
