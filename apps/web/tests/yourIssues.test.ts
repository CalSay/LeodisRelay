import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isYours, nextYourIssue, yourIssues } from '../lib/yourIssues';
import type { Issue } from '../lib/types';

const sam = { id: 'entra:sam', name: 'Sam Sparks', trade: 'Electrical' };
const ev = (kind: string, actor: string, actorId: string, at: string, note = '') => ({ kind, actor, actorId, at, note, photos: [] });
let n = 0;
const issue = (extra: Partial<Issue>): Issue => ({ id: `i${++n}`, reference: `011LME-ISS-${n}`, projectId: 'p1', location: 'Level 2', description: `Issue ${n}`, actionNeeded: '',
  confirmation: 'confirmed', work: 'assigned', owner: 'Leodis', targetDate: '', raisedByReport: '', raisedAt: '2026-10-19T09:00:00Z',
  events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-19T09:00:00Z')] as Issue['events'], ...extra });

test('an issue is yours when you raised it, it is for your trade, or you added to it', () => {
  assert.ok(isYours(issue({ reportedById: sam.id, affectedTrade: 'P&H' }), sam));
  assert.ok(isYours(issue({ events: [ev('raised', 'Sam Sparks', sam.id, '2026-10-19T09:00:00Z')] as Issue['events'], affectedTrade: 'Other / non-Leodis' }), sam));
  assert.ok(isYours(issue({ affectedTrade: 'Electrical' }), sam));
  assert.ok(isYours(issue({ affectedTrade: 'HVAC', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-19T09:00:00Z'), ev('progress', 'Sam Sparks', sam.id, '2026-10-20T09:00:00Z')] as Issue['events'] }), sam));
  assert.ok(!isYours(issue({ affectedTrade: 'P&H' }), sam), 'another trade\'s issue raised by someone else');
});

test('closed and withdrawn issues are never yours to do', () => {
  assert.ok(!isYours(issue({ affectedTrade: 'Electrical', work: 'closed' }), sam));
  assert.ok(!isYours(issue({ affectedTrade: 'Electrical', confirmation: 'withdrawn' }), sam));
});

test('with no trade set, what you raised or worked on is still yours', () => {
  const noTrade = { id: sam.id, name: sam.name };
  assert.ok(!isYours(issue({ affectedTrade: 'Electrical' }), noTrade));
  assert.ok(isYours(issue({ reportedById: sam.id }), noTrade));
});

test('put forward as fixed is counted as waiting, not listed; sent back comes first, then newest', () => {
  const older = issue({ affectedTrade: 'Electrical', raisedAt: '2026-10-12T09:00:00Z', events: [ev('raised', 'Sam Sparks', sam.id, '2026-10-12T09:00:00Z'), ev('closure_submitted', 'Sam Sparks', sam.id, '2026-10-13T09:00:00Z'), ev('reopened', 'Olive Office', 'entra:olive', '2026-10-14T09:00:00Z', 'Still loose')] as Issue['events'] });
  const newest = issue({ affectedTrade: 'Electrical', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-20T09:00:00Z')] as Issue['events'] });
  const middle = issue({ affectedTrade: 'Electrical', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-18T09:00:00Z')] as Issue['events'] });
  const waiting = issue({ affectedTrade: 'Electrical', work: 'awaiting_verification' });
  const theirs = issue({ affectedTrade: 'P&H' });
  const { toDo, waiting: count } = yourIssues([middle, newest, waiting, theirs, older], sam);
  assert.deepEqual(toDo.map(r => r.issue.id), [older.id, newest.id, middle.id]);
  assert.equal(count, 1);
  assert.equal(toDo[0]!.sentBack, true);
  assert.deepEqual(toDo[0]!.word, { by: 'Olive Office', at: '2026-10-14T09:00:00Z', note: 'Still loose' });
  assert.equal(toDo[1]!.sentBack, false);
});

test('a disputed issue counts as sent back', () => {
  const disputed = issue({ affectedTrade: 'Electrical', confirmation: 'disputed', raisedAt: '2026-10-01T09:00:00Z', events: [ev('raised', 'Sam Sparks', sam.id, '2026-10-01T09:00:00Z')] as Issue['events'] });
  const fresh = issue({ affectedTrade: 'Electrical', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-20T09:00:00Z')] as Issue['events'] });
  assert.equal(yourIssues([fresh, disputed], sam).toDo[0]!.issue.id, disputed.id);
});

test('the next issue after putting one forward is the top of the same site\'s list, never the one just done', () => {
  const done = issue({ affectedTrade: 'Electrical', work: 'awaiting_verification', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-21T09:00:00Z')] as Issue['events'] });
  const sentBack = issue({ affectedTrade: 'Electrical', events: [ev('raised', 'Sam Sparks', sam.id, '2026-10-12T09:00:00Z'), ev('closure_submitted', 'Sam Sparks', sam.id, '2026-10-13T09:00:00Z'), ev('reopened', 'Olive Office', 'entra:olive', '2026-10-14T09:00:00Z', 'Still loose')] as Issue['events'] });
  const newer = issue({ affectedTrade: 'Electrical', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-20T09:00:00Z')] as Issue['events'] });
  const otherSite = issue({ affectedTrade: 'Electrical', projectId: 'p2', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-21T10:00:00Z')] as Issue['events'] });
  const theirs = issue({ affectedTrade: 'P&H' });
  const waiting = issue({ affectedTrade: 'Electrical', work: 'awaiting_verification' });
  assert.deepEqual(nextYourIssue([done, newer, otherSite, theirs, waiting, sentBack], sam, 'p1', done.id), { next: sentBack, left: 2 });
  assert.deepEqual(nextYourIssue([{ ...done, work: 'assigned' }], sam, 'p1', done.id), { left: 0 }, 'the one just done is left out even if the list has not caught up');
  assert.deepEqual(nextYourIssue([otherSite, theirs], sam, 'p1', done.id), { left: 0 }, 'other sites and other trades are not offered');
});
