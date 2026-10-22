import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapWords, tradeVisits } from '../lib/tradeVisits';
import type { ReportSummary } from '../lib/types';

let n = 0;
const sent = (r: Partial<ReportSummary>): ReportSummary => ({ id: `r${++n}`, projectId: 'p1', reference: `011LME-SPR-${String(n).padStart(3, '0')}`, visitDate: '2026-10-20', author: 'Sam Spark', authorId: 'entra:sam',
  authorTrade: 'Electrical', state: 'submitted', version: 1, revision: 1, review: 'not_required', observationCount: 1, photoCount: 0, defectCount: 0, serverAcknowledgedAt: `${r.visitDate ?? '2026-10-20'}T16:00:00.000Z`, ...r } as ReportSummary);

test('the previous and next update are the same trade on the same project, whoever sent them', () => {
  const old = sent({ id: 'old', visitDate: '2026-10-14' });
  const prev = sent({ id: 'prev', visitDate: '2026-10-16', author: 'Ali Amp', authorId: 'entra:ali' });
  const here = sent({ id: 'here', visitDate: '2026-10-20' });
  const next = sent({ id: 'next', visitDate: '2026-10-22' });
  const others = [
    sent({ id: 'hvac', visitDate: '2026-10-19', author: 'Hana Duct', authorTrade: 'HVAC' }),
    sent({ id: 'elsewhere', visitDate: '2026-10-19', projectId: 'p2' }),
    sent({ id: 'draft', visitDate: '2026-10-19', state: 'draft' }),
    sent({ id: 'inspection', visitDate: '2026-10-19', reportType: 'first-fix-inspection', checks: { ok: 3, action: 0, na: 0, open: 0 } }),
  ];
  const v = tradeVisits(here, [old, prev, here, next, ...others]);
  assert.deepEqual(v, { who: 'Electrical', trade: true, previous: { id: 'prev', reference: prev.reference, visitDate: '2026-10-16', author: 'Ali Amp' }, next: { id: 'next', reference: next.reference, visitDate: '2026-10-22', author: 'Sam Spark' } });
  assert.equal(tradeVisits(old, [old, prev, here, next])?.previous, undefined, 'the first update has no previous one');
  assert.equal(tradeVisits(old, [old, prev, here, next])?.next?.id, 'prev');
  assert.equal(tradeVisits(here, [here, ...others]), null, 'nothing to show when the trade has no other update there');
});

test('an inspection or a draft gets nothing, and an update with no trade is matched to the same person', () => {
  const a = sent({ id: 'a', visitDate: '2026-10-16' }), b = sent({ id: 'b' });
  assert.equal(tradeVisits({ ...b, reportType: 'first-fix-inspection' }, [a, b]), null);
  assert.equal(tradeVisits({ ...b, state: 'draft' }, [a, b]), null);
  const noTrade = (r: Partial<ReportSummary>) => { const out = sent(r); delete out.authorTrade; delete out.authorId; return out; };
  const x = noTrade({ id: 'x', visitDate: '2026-10-15', author: 'Jo Bloggs' });
  const y = noTrade({ id: 'y', visitDate: '2026-10-16', author: 'Kim Other' });
  const z = noTrade({ id: 'z', visitDate: '2026-10-20', author: ' Jo Bloggs ' });
  assert.deepEqual(tradeVisits(z, [x, y, z, a]), { who: 'Jo Bloggs', trade: false, previous: { id: 'x', reference: x.reference, visitDate: '2026-10-15', author: 'Jo Bloggs' } });
});

test('a correction stands in for the report it corrects, and a report never points at its own revisions', () => {
  const prev = sent({ id: 'prev', visitDate: '2026-10-16' });
  const prev2 = sent({ id: 'prev2', visitDate: '2026-10-16', corrects: 'prev', revision: 2, serverAcknowledgedAt: '2026-10-21T09:00:00.000Z' });
  const here = sent({ id: 'here', visitDate: '2026-10-20' });
  const here2 = sent({ id: 'here2', visitDate: '2026-10-20', corrects: 'here', revision: 2, serverAcknowledgedAt: '2026-10-21T10:00:00.000Z' });
  const all = [prev, prev2, here, here2];
  assert.equal(tradeVisits(here2, all)?.previous?.id, 'prev2', 'the corrected previous update, not the one it replaced');
  assert.equal(tradeVisits(here2, all)?.next, undefined, 'its own first revision is not the visit before or after');
  assert.equal(tradeVisits(here, all)?.next, undefined, 'nor is its correction the next visit');
  assert.equal(tradeVisits(prev2, all)?.next?.id, 'here2');
  // A correction still being written does not hide what it corrects.
  const draftFix = sent({ id: 'fix', visitDate: '2026-10-16', corrects: 'prev', state: 'draft' });
  assert.equal(tradeVisits(here, [prev, draftFix, here])?.previous?.id, 'prev');
});

test('two updates from one trade on one day are put in the order they arrived', () => {
  const morning = sent({ id: 'm', serverAcknowledgedAt: '2026-10-20T09:00:00.000Z' });
  const late = sent({ id: 'l', serverAcknowledgedAt: '2026-10-20T15:00:00.000Z', author: 'Ali Amp', authorId: 'entra:ali' });
  assert.equal(tradeVisits(late, [morning, late])?.previous?.id, 'm');
  assert.equal(tradeVisits(morning, [morning, late])?.next?.id, 'l');
});

test('the gap between two visits is said in days', () => {
  assert.equal(gapWords('2026-10-20', '2026-10-20', 'before'), 'the same day');
  assert.equal(gapWords('2026-10-19', '2026-10-20', 'before'), 'the day before');
  assert.equal(gapWords('2026-10-21', '2026-10-20', 'after'), 'the day after');
  assert.equal(gapWords('2026-10-16', '2026-10-20', 'before'), '4 days before');
  assert.equal(gapWords('2026-10-24', '2026-10-25', 'before'), 'the day before', 'across the clocks going back');
});
