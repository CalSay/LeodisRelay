import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueTrend, TREND_WEEKS } from '../lib/issueTrend';
import type { Issue, IssueEvent } from '../lib/types';

// A Tuesday, so the week in progress runs Monday 19 to today.
const TODAY = '2026-10-20';
let n = 0;
const issue = (i: Partial<Issue> = {}): Issue => ({
  id:`iss-${++n}`, reference:`011LME-ISS-${String(n).padStart(3, '0')}`, projectId:'p1', location:'', description:'Something', actionNeeded:'',
  confirmation:'confirmed', work:'open', owner:'', targetDate:'', raisedByReport:'r0', raisedAt:'2026-10-01T09:00:00Z', events:[], ...i });
const verified = (at: string): IssueEvent => ({ at, actor:'Office', kind:'verified', note:'', photos:[] });

test('counts raised, closed and open at the end of each Monday-to-Sunday week, up to today', () => {
  n = 0;
  const t = issueTrend([
    issue({ raisedAt:'2026-10-06T09:00:00Z' }),
    issue({ raisedAt:'2026-10-07T09:00:00Z', work:'closed', events:[verified('2026-10-14T10:00:00Z')] }),
    // Raised late on Sunday 18 October in London (BST): that is still week of 12 October.
    issue({ raisedAt:'2026-10-18T22:30:00Z' }),
    issue({ raisedAt:'2026-10-19T08:00:00Z', work:'awaiting_verification' }),
    issue({ raisedAt:'2026-10-19T08:00:00Z', projectId:'p2' }),
  ], 'p1', TODAY);
  assert.equal(t.weeks.length, TREND_WEEKS);
  assert.equal(t.weeks.at(-1)!.monday, '2026-10-19');
  assert.equal(t.weeks[0]!.monday, '2026-08-03');
  const [w5, w12, w19] = t.weeks.slice(-3);
  assert.deepEqual(w5, { monday:'2026-10-05', raised:2, closed:0, open:2, late:0 });
  assert.deepEqual(w12, { monday:'2026-10-12', raised:1, closed:1, open:2, late:0 });
  // Put forward as fixed is still open until the office checks it.
  assert.deepEqual(w19, { monday:'2026-10-19', raised:1, closed:0, open:3, late:0 });
  assert.equal(t.openNow, 3);
});

test('past target is judged on each week\'s last day, not today', () => {
  n = 0;
  const t = issueTrend([issue({ raisedAt:'2026-10-01T09:00:00Z', targetDate:'2026-10-15' })], 'p1', TODAY);
  assert.equal(t.weeks.find(w => w.monday === '2026-10-12')!.late, 1);
  assert.equal(t.weeks.find(w => w.monday === '2026-10-05')!.late, 0);
  assert.equal(t.lateNow, 1);
});

test('the headline compares today with four weeks ago, and recent counts cover the last four weeks', () => {
  n = 0;
  const old = (k: number) => issue({ raisedAt:'2026-09-01T09:00:00Z', work:'closed', events:[verified(`2026-10-${10 + k}T09:00:00Z`)] });
  const t = issueTrend([old(1), old(2), old(3), issue({ raisedAt:'2026-09-02T09:00:00Z' })], 'p1', TODAY);
  // Four weeks before the week of 19 October is the week of 21 September.
  assert.equal(t.openBefore, 4);
  assert.equal(t.openNow, 1);
  assert.equal(t.direction, 'fewer');
  assert.deepEqual(t.recent, { raised:0, closed:3 });
  // Raised 1 September, closed 11, 12 and 13 October: 40, 41 and 42 days.
  assert.equal(t.medianDaysToClose, 41);
  assert.equal(t.closedInRange, 3);
  assert.deepEqual(t.oldest, { id:'iss-4', reference:'011LME-ISS-004', raisedOn:'2026-09-02', days:48 });

  const worse = issueTrend([issue({ raisedAt:'2026-10-15T09:00:00Z' })], 'p1', TODAY);
  assert.equal(worse.direction, 'more');
  assert.equal(issueTrend([], 'p1', TODAY).direction, 'same');
  assert.equal(issueTrend([], 'p1', TODAY).medianDaysToClose, undefined);
});

test('withdrawn issues are left out, and a closure with no recorded day is never counted as open', () => {
  n = 0;
  const t = issueTrend([
    issue({ confirmation:'withdrawn' }),
    issue({ work:'closed', events:[] }),
    // Reopened after a check: open now, and (as it holds no earlier closing day) open throughout.
    issue({ events:[verified('2026-10-05T09:00:00Z'), { at:'2026-10-08T09:00:00Z', actor:'Office', kind:'reopened', note:'Still loose', photos:[] }] }),
  ], 'p1', TODAY);
  assert.equal(t.openNow, 1);
  assert.equal(t.closedUndated, 1);
  assert.equal(t.weeks.reduce((s, w) => s + w.raised, 0), 2);
  assert.equal(t.weeks.reduce((s, w) => s + w.closed, 0), 0);
  assert.equal(t.weeks.find(w => w.monday === '2026-10-05')!.open, 1);
});

test('past target leaves out work put forward as fixed by then, and counts it again once sent back', () => {
  n = 0;
  const ev = (kind: IssueEvent['kind'], at: string): IssueEvent => ({ at, actor:'Sam', kind, note:'', photos:[] });
  const t = issueTrend([
    // Late since 2 October, put forward as fixed on 9 October and still waiting: late at the end of week 28 Sep only.
    issue({ raisedAt:'2026-09-28T09:00:00Z', targetDate:'2026-10-02', work:'awaiting_verification', events:[ev('closure_submitted', '2026-10-09T09:00:00Z')] }),
    // Put forward on 9 October, sent back on 13 October: late again from the week of 12 October.
    issue({ raisedAt:'2026-09-28T09:00:00Z', targetDate:'2026-10-02', work:'in_progress', events:[ev('closure_submitted', '2026-10-09T09:00:00Z'), ev('reopened', '2026-10-13T09:00:00Z')] }),
  ], 'p1', TODAY);
  const late = (monday: string) => t.weeks.find(w => w.monday === monday)!.late;
  assert.equal(late('2026-09-28'), 2);
  assert.equal(late('2026-10-05'), 0);
  assert.equal(late('2026-10-12'), 1);
  assert.equal(t.lateNow, 1, 'today, the same count as the project sheet');
  assert.equal(t.openNow, 2, 'put forward as fixed is still open');
});
