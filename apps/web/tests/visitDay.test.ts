import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftFromEarlierDay, visitDayWords } from '../lib/visitDay';

test('the day an update is for reads today, yesterday or the date', () => {
  assert.equal(visitDayWords('2026-10-22', '2026-10-22'), 'today, Thu 22 Oct');
  assert.equal(visitDayWords('2026-10-21', '2026-10-22'), 'yesterday, Wed 21 Oct');
  assert.equal(visitDayWords('2026-10-19', '2026-10-22'), 'Mon 19 Oct');
  // Yesterday across a month end, and an earlier year with its year.
  assert.equal(visitDayWords('2026-10-31', '2026-11-01'), 'yesterday, Sat 31 Oct');
  assert.match(visitDayWords('2025-12-31', '2026-10-22'), /^Wed 31 Dec 2025$/);
});

test('only an unsent site update from an earlier day is flagged', () => {
  const today = '2026-10-22';
  assert.equal(leftFromEarlierDay({ visitDate: '2026-10-21', state: 'draft' }, today), true);
  assert.equal(leftFromEarlierDay({ visitDate: '2026-10-21', state: 'draft', reportType: 'progress' }, today), true);
  assert.equal(leftFromEarlierDay({ visitDate: '2026-10-22', state: 'draft' }, today), false, 'today’s');
  assert.equal(leftFromEarlierDay({ visitDate: '2026-10-21', state: 'submitted' }, today), false, 'already sent');
  assert.equal(leftFromEarlierDay({ visitDate: '2026-10-21', state: 'draft', corrects: 'rep-1' }, today), false, 'a correction keeps its report’s day');
  assert.equal(leftFromEarlierDay({ visitDate: '2026-10-21', state: 'draft', reportType: 'handover-inspection' }, today), false, 'an inspection');
});
