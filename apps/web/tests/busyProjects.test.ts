import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { naturalOrder } from '../lib/naturalOrder';
import { londonDay } from '../lib/weeklySummary';
import { againWords } from '../lib/checkFix';
import { deskIssue, londonDay as officeLondonDay, officeActions } from '../lib/officeActions';
import { CAME_BACK_ROWS, cameBack, isOpenIssue, raisedIssue } from '../lib/cameBack';
import { COMPRESS_FROM, jsonResponse } from '../lib/jsonResponse';
import { siteDiary } from '../lib/siteDiary';
import { search } from '../lib/search';
import type { Principal } from '@relay/platform';
import type { Issue, IssueEvent, Report, Variation } from '../lib/types';

// The speed fixes for busy projects must give exactly the answers the slower code gave.

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const event = (at: string, extra: Partial<IssueEvent> = {}): IssueEvent => ({ at, actor:'Sam Spark', actorId:engineer.id, kind:'progress', note:'Started', photos:[{ id:'p', dataUrl:'/api/media/p', caption:'', capturedAt:at }], ...extra });
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'Riser', description:'Tray lid missing', actionNeeded:'', confirmation:'confirmed',
  work:'assigned', owner:'Sparks Ltd', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'Extra socket', location:'Flat 2', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Sam Spark', raisedById:engineer.id, raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', serverAcknowledgedAt:'2026-10-13T16:00:00Z', ...r } as Report);

test('one shared collator sorts references exactly as localeCompare with numeric order', () => {
  const refs = ['011LME-SPR-10', '011LME-SPR-9', '011lme-spr-009', 'Tower T10', 'Tower T2', '', 'Ä-1', 'A-1', '014LME-ISS-100', '014LME-ISS-1000', 'b', 'B'];
  for (const a of refs) for (const b of refs) assert.equal(Math.sign(naturalOrder(a, b)), Math.sign(a.localeCompare(b, 'en', { numeric: true })), `${a} / ${b}`);
});

test('the London day from one formatter matches toLocaleDateString, across the clock changes', () => {
  for (const at of ['2026-03-29T00:59:59Z', '2026-03-29T01:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T23:30:00Z', '2026-06-30T23:00:00Z', '2026-12-31T23:59:59Z']) {
    const old = new Date(at).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    assert.equal(londonDay(at), old, at);
    assert.equal(officeLondonDay(at), old, at);
  }
  assert.equal(londonDay('not a date'), '');
  assert.equal(officeLondonDay('not a date'), new Date('not a date').toLocaleDateString('en-CA', { timeZone: 'Europe/London' }));
});

test('came back: the engineer’s latest issues and variations, cut so the merged rows are unchanged', () => {
  const other = 'entra:other';
  const issues = Array.from({ length: 20 }, (_, n) => issue({ id:`i${n}`, reference:`011LME-ISS-${n}`, raisedAt:`2026-10-${String(1 + (n % 9)).padStart(2, '0')}T10:00:00Z`,
    ...(n % 3 === 0 ? { reportedById: other, events:[event('2026-10-01T10:00:00Z', { actorId: other, kind:'raised' })] } : { reportedById: engineer.id }),
    ...(n % 4 === 0 ? { events:[event('2026-10-01T10:00:00Z', { kind:'raised' }), event(`2026-10-1${n % 10}T08:00:00Z`)] } : {}),
    ...(n % 5 === 0 ? { work:'closed' as const } : {}) }));
  // Same moment, so order in the list decides.
  issues.push(issue({ id:'tie-a', reportedById: engineer.id, raisedAt:'2026-10-30T10:00:00Z' }), issue({ id:'tie-b', reportedById: engineer.id, raisedAt:'2026-10-30T10:00:00Z' }));
  const variations = Array.from({ length: 9 }, (_, n) => variation({ id:`v${n}`, raisedAt:`2026-10-0${1 + n}T09:00:00Z`, ...(n % 2 ? { raisedById: other } : {}) }));
  const back = cameBack(issues, variations, engineer.id);

  // What the home worked out from every record: own records, newest change first, the first six.
  const at = (r: { raisedAt: string; events: { at: string }[] }) => r.events.at(-1)?.at ?? r.raisedAt;
  const merged = (is: Issue[], vs: Variation[]) => [...is.filter(i => raisedIssue(i, engineer.id)).map(i => ({ key: i.id, at: at(i) })), ...vs.filter(v => v.raisedById === engineer.id).map(v => ({ key: v.id, at: at(v) }))]
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, CAME_BACK_ROWS).map(r => r.key);
  assert.deepEqual(merged(back.issues, back.variations), merged(issues, variations));
  assert.ok(back.issues.length <= CAME_BACK_ROWS && back.variations.length <= CAME_BACK_ROWS);
  assert.deepEqual(back.issues.slice(0, 2).map(i => i.id), ['tie-a', 'tie-b'], 'a tie keeps the list order');
  assert.equal(back.open, issues.filter(isOpenIssue).length, 'open counts every trade’s issues, not only the engineer’s');
  assert.ok(back.issues.every(i => raisedIssue(i, engineer.id)) && back.variations.every(v => v.raisedById === engineer.id));
});

test('the office desk’s issues keep every field and their latest event, without notes or photographs', () => {
  const full = issue({ id:'a', work:'awaiting_verification', closureSubmittedBy:'Pat', events:[event('2026-10-01T10:00:00Z', { kind:'raised' }), event('2026-10-09T10:00:00Z', { kind:'closure_submitted', note:'Fixed it' })] });
  const desk = deskIssue(full);
  assert.deepEqual({ ...desk, events: [] }, { ...full, events: [] });
  assert.equal(desk.events.length, 1);
  assert.equal(desk.events[0]!.at, '2026-10-09T10:00:00Z');
  assert.equal(desk.events[0]!.kind, 'closure_submitted');
  assert.equal(desk.events[0]!.note, '');
  assert.deepEqual(desk.events[0]!.photos, []);
  assert.deepEqual(deskIssue(issue({ id:'b' })).events, []);
  // A note after the fix was put forward: the desk keeps both, so "waiting N days" counts from the put forward.
  const noted = deskIssue(issue({ id:'n', work:'awaiting_verification', events:[event('2026-10-01T10:00:00Z', { kind:'raised' }), event('2026-10-09T10:00:00Z', { kind:'closure_submitted' }), event('2026-10-12T10:00:00Z', { kind:'progress' })] }));
  assert.deepEqual(noted.events.map(e => [e.kind, e.at, e.note, e.photos.length]), [['closure_submitted', '2026-10-09T10:00:00Z', '', 0], ['progress', '2026-10-12T10:00:00Z', '', 0]]);
  // Sent back before: the desk keeps each round (no notes), so the row can say "put forward again" as the full issue does.
  const again = issue({ id:'g', work:'awaiting_verification', events:[event('2026-10-01T10:00:00Z', { kind:'raised' }), event('2026-10-05T10:00:00Z', { kind:'closure_submitted' }), event('2026-10-06T10:00:00Z', { kind:'reopened', note:'Back box loose' }), event('2026-10-07T10:00:00Z', { kind:'progress' }), event('2026-10-09T10:00:00Z', { kind:'closure_submitted' })] });
  assert.deepEqual(deskIssue(again).events.map(e => [e.kind, e.note]), [['closure_submitted', ''], ['reopened', ''], ['closure_submitted', '']]);
  assert.equal(againWords(deskIssue(again)), againWords(again));
  assert.equal(againWords(deskIssue(again)), 'put forward again');
  // Waiting with no put forward recorded (older records): only the latest event.
  assert.deepEqual(deskIssue(issue({ id:'w', work:'awaiting_verification', events:[event('2026-10-01T10:00:00Z', { kind:'raised' })] })).events.map(e => e.kind), ['raised']);
  // Not waiting to be checked: only the latest event, as before.
  assert.equal(deskIssue(issue({ id:'o', work:'open', events:[event('2026-10-09T10:00:00Z', { kind:'closure_submitted' }), event('2026-10-12T10:00:00Z', { kind:'reopened' })] })).events.length, 1);
  // The office position reads the same from the trimmed issues as from the full ones.
  const issues = [full, issue({ id:'c', work:'awaiting_verification', events:[event('2026-10-02T10:00:00Z', { kind:'closure_submitted' })] }), issue({ id:'d', owner:'' })];
  assert.deepEqual(officeActions([], issues.map(deskIssue), '2026-10-20').verify.map(i => i.id), officeActions([], issues, '2026-10-20').verify.map(i => i.id));
});

test('a large JSON answer is gzipped when the browser accepts it, and reads back the same', async () => {
  const body = { issues: Array.from({ length: 200 }, (_, n) => issue({ id:`i${n}` })) };
  assert.ok(JSON.stringify(body).length > COMPRESS_FROM);
  const zipped = await jsonResponse(new Request('http://x/', { headers: { 'accept-encoding': 'gzip, deflate, br' } }), body);
  assert.equal(zipped.headers.get('content-encoding'), 'gzip');
  assert.equal(zipped.headers.get('content-type'), 'application/json');
  assert.match(zipped.headers.get('vary') ?? '', /Accept-Encoding/);
  const raw = Buffer.from(await zipped.arrayBuffer());
  assert.ok(raw.length < JSON.stringify(body).length / 4, `compressed to ${raw.length}`);
  assert.deepEqual(JSON.parse(gunzipSync(raw).toString('utf8')), body);
  const plain = await jsonResponse(new Request('http://x/'), body);
  assert.equal(plain.headers.get('content-encoding'), null, 'no gzip unless asked');
  assert.deepEqual(await plain.json(), body);
  const small = await jsonResponse(new Request('http://x/', { headers: { 'accept-encoding': 'gzip' } }), { ok: true }, { status: 201 });
  assert.equal(small.headers.get('content-encoding'), null, 'small answers are sent as they are');
  assert.equal(small.status, 201);
});

test('the diary finds the record a card raised by its report, the first in the list when two claim it', () => {
  const original = report({ id:'r1', observations:[{ id:'o1', type:'defect', location:'Riser', whatHappened:'Lid missing', actionNeeded:'', owner:'', photos:[] }, { id:'o2', type:'instruction', location:'Flat 2', whatHappened:'Extra socket', actionNeeded:'', owner:'', photos:[] }] });
  const corrected = report({ id:'r2', revision:2, corrects:'r1', serverAcknowledgedAt:'2026-10-13T18:00:00Z', observations: original.observations });
  const issues = [
    issue({ id:'elsewhere', raisedByReport:'r9', raisedByObservation:'o1' }),
    issue({ id:'first', reference:'011LME-ISS-002', raisedByReport:'r1', raisedByObservation:'o1' }),
    issue({ id:'second', reference:'011LME-ISS-003', raisedByReport:'r2', raisedByObservation:'o1' }),
    // Read back from SharePoint without the card: matched by its words.
    issue({ id:'by-words', reference:'011LME-ISS-004', raisedByReport:'r2', location:'Flat 2', description:'Extra socket' }),
  ];
  const variations = [variation({ id:'vo', raisedByReport:'r1', raisedByObservation:'o2' })];
  const day = siteDiary({ reports:[original, corrected], issues, variations }, engineer, 'p1').days[0]!;
  const cards = day.entries[0]!.cards;
  assert.equal(day.entries.length, 1, 'the correction stands in for the original');
  assert.equal(cards[0]!.issue?.id, 'first');
  assert.equal(cards[1]!.variation?.id, 'vo');
  const reordered = siteDiary({ reports:[original, corrected], issues:[issues[2]!, issues[1]!], variations }, engineer, 'p1').days[0]!.entries[0]!.cards;
  assert.equal(reordered[0]!.issue?.id, 'second', 'list order decides, as find did');
});

test('search still folds dashes, spacing and accents after its quick check', () => {
  const projects = [{ id:'p1', projectNumber:'011LME', projectName:'Tetley Hall' }];
  const sources = { reports:[report({ observations:[{ id:'o', type:'update', location:'Level-3  riser', whatHappened:'Café counter wired', actionNeeded:'', owner:'', photos:[] }] })], issues:[issue({ reference:'011LME-ISS-004', description:'Socket — cracked' })], variations:[], projects };
  assert.equal(search('level 3 riser', sources, engineer).reports.total, 1);
  assert.equal(search('cafe', sources, engineer).reports.total, 1);
  assert.equal(search('ISS 004', sources, engineer).issues.total, 1);
  assert.equal(search('socket cracked', sources, engineer).issues.total, 1);
  assert.equal(search('level 4', sources, engineer).reports.total, 0);
});
