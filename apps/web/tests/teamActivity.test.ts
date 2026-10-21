import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastSentWords, latestOf, latestSentByAuthor } from '../lib/teamActivity';

const sent = (id: string, authorId: string | null, at: string, extra: { projectId?: string; state?: string; visitDate?: string } = {}) =>
  ({ id, projectId: 'proj-014lme', visitDate: at.slice(0, 10), state: 'submitted', ...(authorId ? { authorId } : {}), serverAcknowledgedAt: at, ...extra });

test('each author’s latest sent report, leaving out drafts and reports with no account', () => {
  const byAuthor = latestSentByAuthor([
    sent('001', 'entra:ray', '2026-10-19T15:00:00.000Z', { projectId: 'proj-011lme' }),
    sent('002', 'entra:ray', '2026-10-21T15:00:00.000Z'),
    sent('003', 'entra:ray', '2026-10-20T15:00:00.000Z', { projectId: 'proj-011lme' }),
    sent('004', 'entra:ray', '2026-10-22T09:00:00.000Z', { state: 'draft' }),
    sent('005', null, '2026-10-22T09:00:00.000Z'),
    sent('006', 'entra:nina', '2026-10-21T16:00:00.000Z'),
  ]);
  assert.deepEqual([...byAuthor.keys()].sort(), ['entra:nina', 'entra:ray']);
  assert.equal(byAuthor.get('entra:ray')?.reportId, '002', 'the latest sent, not the latest listed or a draft');
  assert.equal(byAuthor.get('entra:ray')?.projectId, 'proj-014lme');
  assert.equal(latestOf(byAuthor, ['entra:old', 'entra:nina', 'entra:ray'])?.reportId, '006', 'the latest across a person’s accounts');
  assert.equal(latestOf(byAuthor, ['entra:nobody']), undefined);
});

test('a correction to an old visit, or an update sent days late, does not move someone back to an old site', () => {
  const byAuthor = latestSentByAuthor([
    sent('010', 'entra:ray', '2026-10-21T15:00:00.000Z'),
    sent('011', 'entra:ray', '2026-10-22T09:00:00.000Z', { projectId: 'proj-011lme', visitDate: '2026-10-14' }),
  ]);
  assert.equal(byAuthor.get('entra:ray')?.reportId, '010');
  assert.equal(latestOf(new Map([['a', { reportId: 'old', projectId: 'p', visitDate: '2026-10-14', at: '2026-10-22T09:00:00.000Z' }], ['b', { reportId: 'new', projectId: 'p', visitDate: '2026-10-21', at: '2026-10-21T15:00:00.000Z' }]]), ['a', 'b'])?.reportId, 'new');
});

test('the Team tab says in plain words whether someone has got going, and where', () => {
  const name = (id: string) => (id === 'proj-014lme' ? 'Kirkstall Gate - Phase 2' : undefined);
  const today = '2026-10-21';
  const at = (visitDate: string, projectId = 'proj-014lme') => ({ reportId: 'r', projectId, visitDate, at: `${visitDate}T15:00:00.000Z` });
  assert.deepEqual(lastSentWords({ lastSent: at('2026-10-21') }, name, today), { title: 'Kirkstall Gate - Phase 2', sub: 'Visit today', waiting: false });
  assert.equal(lastSentWords({ lastSent: at('2026-10-20') }, name, today).sub, 'Visit yesterday');
  assert.equal(lastSentWords({ lastSent: at('2026-10-14') }, name, today).sub, 'Visit 14 Oct');
  assert.equal(lastSentWords({ lastSent: at('2026-10-21', 'gone') }, name, today).title, 'A project no longer listed');
  assert.deepEqual(lastSentWords({ everSignedIn: true, lastSignedIn: '2026-10-21T13:05:00.000Z', session: 'active' }, name, today), { title: 'Nothing sent yet', sub: 'Signed in Wed 21 Oct, 14:05', waiting: false });
  assert.deepEqual(lastSentWords({ everSignedIn: true, session: 'never' }, name, today), { title: 'Nothing sent yet', waiting: false }, 'signed in before, every session since gone');
  assert.deepEqual(lastSentWords({ everSignedIn: false, session: 'never' }, name, today), { title: 'Not signed in yet', waiting: true });
});
