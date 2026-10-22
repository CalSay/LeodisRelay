import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAME_BACK_ROWS, cameBack, cameBackElsewhere, cameBackRows, sentBackToYou, sentBackWord } from '../lib/cameBack';
import type { Issue, ReportSummary, Variation } from '../lib/types';

const sam = { id: 'entra:sam', name: 'Sam Sparks' };
const ev = (kind: string, actor: string, actorId: string, at: string, note = '') => ({ kind, actor, actorId, at, note, photos: [] });
const raised = (at = '2026-10-21T09:00:00Z') => ev('raised', 'Sam Sparks', sam.id, at);
let n = 0;
const issue = (extra: Partial<Issue>): Issue => ({ id: `i${++n}`, reference: `KG-ISS-${n}`, projectId: 'kirkstall', location: 'Flat 1.03', description: `Issue ${n}`, actionNeeded: '',
  confirmation: 'confirmed', work: 'assigned', owner: 'Leodis', targetDate: '', raisedByReport: '', raisedAt: '2026-10-21T09:00:00Z', reportedById: sam.id,
  events: [raised()] as Issue['events'], ...extra });
const variation = (extra: Partial<Variation>): Variation => ({ id: `v${++n}`, reference: `KG-VAR-${n}`, projectId: 'kirkstall', description: 'Extra socket', location: 'Flat 1.03',
  raisedAt: '2026-10-21T09:00:00Z', raisedById: sam.id, events: [raised()], ...extra } as unknown as Variation);
const report = (extra: Partial<ReportSummary>, corrected = false) => ({ report: { id: `r${++n}`, projectId: 'kirkstall', reference: `KG-SPR-${n}`, state: 'submitted', authorId: sam.id,
  serverAcknowledgedAt: '2026-10-21T10:00:00Z', review: 'not_required', ...extra } as ReportSummary, corrected });
const sites = new Set(['kirkstall']);

test('other sites: only what waits on the engineer, never their own new records', () => {
  const asked = issue({ events: [raised(), ev('reopened', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z', 'Send a photo of the top?')] as Issue['events'] });
  const justFlagged = issue({});
  const assignedOnly = issue({ events: [raised(), ev('assigned', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z')] as Issue['events'] });
  const disputed = issue({ confirmation: 'disputed', events: [raised(), ev('confirmation', 'Olive Office', 'entra:olive', '2026-10-21T12:00:00Z')] as Issue['events'] });
  const answered = issue({ events: [raised(), ev('reopened', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z', 'Which flat?'), ev('progress', 'Sam Sparks', sam.id, '2026-10-21T12:00:00Z')] as Issue['events'] });
  const someoneElses = issue({ reportedById: 'entra:pat', events: [ev('raised', 'Pat Pipe', 'entra:pat', '2026-10-21T09:00:00Z'), ev('reopened', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z', 'Which flat?')] as Issue['events'] });
  const atTetley = issue({ projectId: 'tetley', events: asked.events });
  const out = cameBackElsewhere({ issues: [asked, justFlagged, assignedOnly, disputed, answered, someoneElses, atTetley], variations: [], reports: [] }, sam, sites);
  assert.deepEqual(out.issues.map(i => i.id).sort(), [asked.id, disputed.id].sort());
});

test('other sites: a variation with the office’s question, a report returned or written on', () => {
  const question = variation({ events: [raised(), ev('note', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z', 'Where does the second go?')] as Variation['events'] });
  const quiet = variation({});
  const returned = report({ review: 'returned', reviewNote: 'Add the riser photo', reviewedBy: 'Olive Office' });
  const returnedCorrected = report({ review: 'returned', reviewNote: 'Add the riser photo' }, true);
  const noted = report({ acknowledged: { by: 'Olive Office', at: '2026-10-21T12:00:00Z', note: 'Thanks, seen' } } as Partial<ReportSummary>);
  const received = report({});
  const notMine = report({ authorId: 'entra:pat', review: 'returned', reviewNote: 'x' });
  const out = cameBackElsewhere({ issues: [], variations: [question, quiet], reports: [returned, returnedCorrected, noted, received, notMine] }, sam, sites);
  assert.deepEqual(out.variations.map(v => v.id), [question.id]);
  assert.deepEqual(out.reports.map(r => r.id).sort(), [returned.report.id, noted.report.id].sort());
});

const row = (k: string, waits = false) => ({ k, ...(waits ? { word: 'x' } : {}) });
const keys = (rows: { k: string }[]) => rows.map(r => r.k).join(' ');

test('rows: the current site first, then other sites, no more than before', () => {
  assert.equal(keys(cameBackRows([row('h1', true), row('h2')], [row('t1', true)])), 'h1 h2 t1');
  // The engineer's own new records give way to another site's questions, but two stay.
  assert.equal(keys(cameBackRows(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(k => row(k)), ['t1', 't2', 't3', 't4', 't5'].map(k => row(k, true)))), 'h1 h2 t1 t2 t3 t4');
  // The current site's answers keep their places; other sites still get two.
  assert.equal(keys(cameBackRows(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(k => row(k, true)), ['t1', 't2', 't3'].map(k => row(k, true)))), 'h1 h2 h3 h4 t1 t2');
  assert.equal(keys(cameBackRows([row('h1')], ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map(k => row(k, true)))), 'h1 t1 t2 t3 t4 t5');
  assert.equal(keys(cameBackRows([], ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map(k => row(k, true)))), 't1 t2 t3 t4 t5 t6');
  assert.equal(keys(cameBackRows(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'].map(k => row(k)), [])), 'h1 h2 h3 h4 h5 h6');
  for (let h = 0; h < 9; h++) for (let t = 0; t < 9; t++) assert.ok(cameBackRows(Array.from({ length: h }, () => row('h')), Array.from({ length: t }, () => row('t', true))).length === Math.min(CAME_BACK_ROWS, h + t));
});

test('a fix the engineer put forward and the office sent back comes back to them, not only to whoever raised it', () => {
  const pat = { id: 'entra:pat', name: 'Pat Wire' };
  const putForward = ev('closure_submitted', 'Pat Wire', pat.id, '2026-10-21T10:00:00Z', 'New plate fitted');
  const notFinished = ev('reopened', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z', 'Back box still loose');
  const sentBack = issue({ work: 'in_progress', events: [raised(), putForward, notFinished] as Issue['events'] });
  const waiting = issue({ work: 'awaiting_verification', events: [raised(), putForward] as Issue['events'] });
  const answered = issue({ work: 'awaiting_verification', events: [raised(), putForward, notFinished, ev('closure_submitted', 'Pat Wire', pat.id, '2026-10-21T12:00:00Z')] as Issue['events'] });
  // Recorded before ids: told apart by name.
  const byName = issue({ work: 'in_progress', events: [raised(), { ...putForward, actorId: undefined }, notFinished] as Issue['events'] });
  const someoneElsesFix = issue({ work: 'in_progress', events: [raised(), ev('closure_submitted', 'Lee Live', 'entra:lee', '2026-10-21T10:00:00Z'), notFinished] as Issue['events'] });
  const withdrawn = issue({ confirmation: 'withdrawn', events: sentBack.events });
  // Lee put it forward again after Pat's was sent back; or the office gave it to another contractor.
  const fixedByLee = issue({ work: 'awaiting_verification', events: [raised(), putForward, notFinished, ev('closure_submitted', 'Lee Live', 'entra:lee', '2026-10-21T12:00:00Z')] as Issue['events'] });
  const reassigned = issue({ work: 'assigned', events: [raised(), putForward, notFinished, { ...ev('assigned', 'Olive Office', 'entra:olive', '2026-10-21T12:00:00Z'), to: 'Bolt' }] as Issue['events'] });
  // Another site person's update does not answer it for Pat.
  const leeUpdated = issue({ work: 'in_progress', events: [raised(), putForward, notFinished, ev('progress', 'Lee Live', 'entra:lee', '2026-10-21T12:00:00Z', 'Parts ordered')] as Issue['events'] });
  // A new target date for the same company, after the send-back, leaves it standing; a closed issue reopened is not a send-back.
  const assign = (to: string, at: string) => ({ ...ev('assigned', 'Olive Office', 'entra:olive', at), to });
  const sameCompany = issue({ work: 'in_progress', events: [raised(), assign('Acme', '2026-10-21T09:30:00Z'), putForward, notFinished, assign('Acme', '2026-10-21T12:00:00Z')] as Issue['events'] });
  const otherCompany = issue({ work: 'in_progress', events: [raised(), assign('Acme', '2026-10-21T09:30:00Z'), putForward, notFinished, assign('Bolt', '2026-10-21T12:00:00Z')] as Issue['events'] });
  const closedThenReopened = issue({ work: 'in_progress', events: [raised(), putForward, ev('verified', 'Olive Office', 'entra:olive', '2026-10-21T10:30:00Z'), notFinished] as Issue['events'] });
  const all = [sentBack, waiting, answered, byName, someoneElsesFix, withdrawn, fixedByLee, reassigned, leeUpdated, sameCompany, otherCompany, closedThenReopened];
  const expected = [sentBack.id, byName.id, leeUpdated.id, sameCompany.id];
  assert.deepEqual(all.filter(i => sentBackToYou(i, pat)).map(i => i.id), expected);
  assert.deepEqual(cameBack(all, [], pat).issues.map(i => i.id).sort(), [...expected].sort());
  assert.deepEqual(cameBackElsewhere({ issues: all, variations: [], reports: [] }, pat, sites).issues.map(i => i.id).sort(), [...expected].sort());
  // The reason, for anyone but the raiser: only a "Not finished" that still stands, never another note.
  const lee = { id: 'entra:lee', name: 'Lee Live' };
  assert.deepEqual(sentBackWord(sentBack.events, lee), { by: 'Olive Office', at: '2026-10-21T11:00:00Z', note: 'Back box still loose' });
  assert.equal(sentBackWord(fixedByLee.events, pat), undefined);
  assert.equal(sentBackWord(reassigned.events, lee), undefined);
  assert.equal(sentBackWord(otherCompany.events, lee), undefined);
  assert.equal(sentBackWord(closedThenReopened.events, lee), undefined);
  assert.equal(sentBackWord(sameCompany.events, lee)?.note, 'Back box still loose');
  assert.equal(sentBackWord(leeUpdated.events, lee), undefined);
  assert.equal(sentBackWord([raised(), ev('note', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z', 'Sam, was this there before?')] as Issue['events'], lee), undefined);
  assert.equal(sentBackWord([raised(), putForward, ev('reopened', 'Olive Office', 'entra:olive', '2026-10-21T11:00:00Z')] as Issue['events'], lee), undefined);
  // Sam raised them all: as before.
  assert.ok(all.every(i => cameBack([i], [], sam).issues.length === 1));
  assert.equal(sentBackToYou(sentBack, sam), false);
});
