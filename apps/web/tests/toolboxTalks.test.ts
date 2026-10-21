import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ATTENDEES_MAX, BACKDATE_DAYS, COMMON_TOPICS, RECENT_DAYS, TALK_COLUMNS, cleanAttendees, daysAgo, projectTalks, splitAttendees, talkProblem, talkRows, talkSummary, topicStarters, withdrawProblem, type ToolboxTalk } from '../lib/toolboxTalks';
import { canWithdraw, recordTalk, talksFor, withdrawTalk } from '../lib/toolboxTalkStore';
import { database, records } from '../lib/storage';
import type { Principal } from '@relay/platform';

const TODAY = '2026-10-21';
const talk = (id: string, day: string, extra: Partial<ToolboxTalk> = {}): ToolboxTalk => ({ id, projectId: 'p1', day, topic: `Topic ${id}`, givenBy: 'Sam', attendees: ['Jo', 'Ali'], by: 'Sam', byId: 'entra:sam', at: `${day}T08:00:00Z`, ...extra });
const ok = { day: TODAY, topic: 'Working at height', givenBy: 'Sam Spark', attendees: ['Jo Bloggs'] };
const uuid = (n: number) => `7a1c2b8e-1a2b-4c3d-8e9f-${String(n).padStart(12, '0')}`;
const addDays = (n: number) => { const d = new Date(`${TODAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test('attendees are one name per line or semicolon, tidied, and the same name twice kept once', () => {
  assert.deepEqual(splitAttendees('Jo Bloggs\n  ali   khan, Northbank \n\njo bloggs\r\nPat;Chris'), ['Jo Bloggs', 'ali khan, Northbank', 'Pat', 'Chris']);
  assert.deepEqual(cleanAttendees([' ', 'A', 'a', 'B']), ['A', 'B']);
});

test('a talk needs a real day no later than today and at most a month back, a topic, who gave it and who attended', () => {
  assert.equal(talkProblem(ok, TODAY), undefined);
  assert.match(talkProblem({ ...ok, day: '2026-02-30' }, TODAY)!, /day the talk was given/);
  assert.match(talkProblem({ ...ok, day: '' }, TODAY)!, /day the talk was given/);
  assert.match(talkProblem({ ...ok, day: addDays(1) }, TODAY)!, /future/);
  assert.equal(talkProblem({ ...ok, day: addDays(-BACKDATE_DAYS) }, TODAY), undefined);
  assert.match(talkProblem({ ...ok, day: addDays(-BACKDATE_DAYS - 1) }, TODAY)!, /within 31 days/);
  assert.match(talkProblem({ ...ok, topic: '  ' }, TODAY)!, /what the talk was about/);
  assert.match(talkProblem({ ...ok, topic: 'x'.repeat(121) }, TODAY)!, /120 characters/);
  assert.match(talkProblem({ ...ok, givenBy: '' }, TODAY)!, /who gave/);
  assert.match(talkProblem({ ...ok, attendees: [' ', ''] }, TODAY)!, /everyone who attended/);
  assert.match(talkProblem({ ...ok, attendees: Array.from({ length: ATTENDEES_MAX + 1 }, (_, n) => `Person ${n}`) }, TODAY)!, /up to 60 names/);
  assert.equal(talkProblem({ ...ok, attendees: [...Array.from({ length: ATTENDEES_MAX }, (_, n) => `Person ${n}`), 'person 0'] }, TODAY), undefined, 'a repeated name does not count twice');
  assert.match(talkProblem({ ...ok, attendees: ['x'.repeat(81)] }, TODAY)!, /each name/);
  assert.match(talkProblem({ ...ok, notes: 'x'.repeat(1001) }, TODAY)!, /1000 characters/);
  assert.match(withdrawProblem(' ')!, /why/);
  assert.equal(withdrawProblem('Recorded twice'), undefined);
});

test('the summary leaves out withdrawn talks and counts the last four weeks, today included', () => {
  const withdrawn = { by: 'Office', byId: 'entra:office', at: `${TODAY}T09:00:00Z`, reason: 'Twice' };
  const talks = [
    talk('a', addDays(-3), { attendees: ['Jo', 'Ali', 'Pat'] }),
    talk('b', TODAY, { withdrawn }),
    talk('c', addDays(-(RECENT_DAYS - 1)), { attendees: ['jo', 'Chris'] }),
    talk('d', addDays(-RECENT_DAYS)),
    talk('other', TODAY, { projectId: 'p2' }),
  ];
  const p = projectTalks(talks, 'p1', TODAY);
  assert.deepEqual(p.talks.map(t => t.id), ['b', 'a', 'c', 'd'], 'newest day first, withdrawn ones still listed');
  assert.deepEqual(p.summary.latest, { day: addDays(-3), topic: 'Topic a', attendees: 3 });
  assert.equal(p.summary.daysSince, 3);
  assert.deepEqual(p.summary.recent, { talks: 2, attendances: 5, people: 4 }, 'Jo and jo are one person');
  assert.deepEqual(talkSummary([], TODAY), { recent: { talks: 0, attendances: 0, people: 0 } });
  assert.equal(daysAgo(0), 'today');
  assert.equal(daysAgo(1), 'yesterday');
  assert.equal(daysAgo(5), '5 days ago');
});

test('topic starters put this project\'s own topics first, then the common ones, without repeats', () => {
  const starters = topicStarters([talk('a', addDays(-1), { topic: 'Hot works on the roof' }), talk('b', TODAY, { topic: 'working at height' }), talk('c', TODAY, { topic: 'Gone', withdrawn: { by: 'x', byId: 'x', at: TODAY, reason: 'x' } })]);
  assert.equal(starters.length, 8);
  assert.deepEqual(starters.slice(0, 3), ['working at height', 'Hot works on the roof', 'Safe isolation']);
  assert.ok(!starters.includes('Gone'), 'a withdrawn talk is not offered');
  assert.ok(!starters.includes(COMMON_TOPICS[0]!), 'the common "Working at height" is not offered twice');
});

test('the spreadsheet has one row per talk with attendees in one cell, and is named for the project', () => {
  const project = { projectNumber: '011LME', projectName: 'Tetley Hall' };
  const rows = talkRows([talk('a', TODAY, { notes: 'Asked about harness checks', withdrawn: { by: 'Office', byId: 'o', at: '2026-10-21T23:30:00Z', reason: 'Wrong project' } }), talk('b', TODAY)], project);
  assert.equal(rows[0]!.length, TALK_COLUMNS.length);
  assert.deepEqual(rows[0], ['011LME', 'Tetley Hall', 'Topic a', TODAY, 'Sam', 'Jo; Ali', 2, 'Withdrawn', 'Asked about harness checks', `${TODAY} 09:00`, 'Sam', '2026-10-22', 'Office', 'Wrong project'], 'UK time: 08:00Z is 09:00 BST, 23:30Z is the next day');
  assert.equal(rows[1]![TALK_COLUMNS.indexOf('Status')], 'Given');
});

test('a talk is recorded by whoever is signed in, a retry is kept once, and only its recorder or the office can withdraw it', () => {
  const root = mkdtempSync(join(tmpdir(), 'relay-toolbox-talks-'));
  process.env.RELAY_DATA_ROOT = root;
  const engineer = { id: 'entra:sam', name: 'Sam Spark', role: 'Engineer', trade: 'Electrical' } as Principal;
  const other = { id: 'entra:pat', name: 'Pat Pipe', role: 'Engineer', trade: 'P&H' } as Principal;
  const office = { id: 'entra:office', name: 'Office Manager', role: 'Manager' } as Principal;
  const now = new Date(`${TODAY}T09:00:00Z`);
  try {
    const first = recordTalk({ projectId: 'p1', requestId: uuid(1), day: TODAY, topic: '  Safe   isolation ', givenBy: 'Site manager', attendees: ['Jo', ' jo ', 'Ali'], notes: '  ' }, engineer, now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.topic, 'Safe isolation');
    assert.deepEqual(first.value.attendees, ['Jo', 'Ali']);
    assert.equal(first.value.notes, undefined, 'empty notes are left out');
    assert.equal(first.value.givenBy, 'Site manager', 'who gave it may differ from who recorded it');
    assert.equal(first.value.by, 'Sam Spark');
    assert.deepEqual(recordTalk({ projectId: 'p1', requestId: uuid(1), day: TODAY, topic: 'Safe isolation', givenBy: 'Site manager', attendees: ['Jo', 'Ali'] }, engineer, now), first, 'a retry returns the first save');
    const changed = recordTalk({ projectId: 'p1', requestId: uuid(1), day: TODAY, topic: 'Something else', givenBy: 'Site manager', attendees: ['Jo'] }, engineer, now);
    assert.equal(changed.ok ? 0 : changed.status, 409);
    const future = recordTalk({ projectId: 'p1', requestId: uuid(2), ...ok, day: '2026-10-22' }, engineer, now);
    assert.equal(future.ok ? 0 : future.status, 422);
    assert.equal(recordTalk({ projectId: 'p1', requestId: 'nope', ...ok }, engineer, now).ok, false);
    assert.equal(records('toolbox-talks').length, 1);

    assert.equal(canWithdraw(first.value, other), false);
    assert.equal(canWithdraw(first.value, office), true);
    const refused = withdrawTalk(first.value.id, 'Not mine', other, now);
    assert.equal(refused.ok ? 0 : refused.status, 403, 'another engineer cannot withdraw it');
    const noReason = withdrawTalk(first.value.id, ' ', engineer, now);
    assert.equal(noReason.ok ? 0 : noReason.status, 422);
    const gone = withdrawTalk(first.value.id, ' Recorded   twice ', engineer, now);
    assert.equal(gone.ok && gone.value.withdrawn?.reason, 'Recorded twice');
    assert.deepEqual(withdrawTalk(first.value.id, 'Again', office, now), gone, 'withdrawing again changes nothing');
    assert.equal(withdrawTalk('talk-missing', 'x', office, now).ok, false);
    const p = talksFor('p1', now);
    assert.equal(p.talks.length, 1, 'a withdrawn talk stays listed');
    assert.equal(p.summary.latest, undefined, 'and is left out of the figures');

    const fromOffice = recordTalk({ projectId: 'p1', requestId: uuid(3), ...ok }, office, now);
    assert.equal(fromOffice.ok && fromOffice.value.by, 'Office Manager');
    assert.equal(talksFor('p1', now).summary.recent.talks, 1);
  } finally {
    database().close();
    rmSync(root, { recursive: true, force: true });
  }
});
