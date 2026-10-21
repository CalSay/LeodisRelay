import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueReopened, issueWord, reportWord, variationWord, waitingOnYouFirst } from '../lib/cameBack';

const latestWord = issueWord;

const sam = { id: 'entra:sam', name: 'Sam Sparks' };
const ev = (kind: string, actor: string, note: string, actorId?: string, at = '2026-10-21T09:00:00Z') => ({ kind, actor, note, at, ...(actorId ? { actorId } : {}) });

test('the office’s latest note shows while it waits on the engineer', () => {
  const events = [
    ev('raised', 'Sam Sparks', 'Fire stopping missing', 'entra:sam'),
    ev('closure_submitted', 'Sam Sparks', 'Done', 'entra:sam'),
    ev('reopened', 'Olive Office', '  Still a gap at the top. Send a photo?  ', 'entra:olive', '2026-10-21T10:00:00Z'),
    ev('assigned', 'Olive Office', '', 'entra:olive'),
  ];
  assert.deepEqual(latestWord(events, sam), { by: 'Olive Office', at: '2026-10-21T10:00:00Z', note: 'Still a gap at the top. Send a photo?' });
});

test('once the engineer has added something since, the note is answered', () => {
  const events = [
    ev('raised', 'Sam Sparks', 'Fire stopping missing', 'entra:sam'),
    ev('reopened', 'Olive Office', 'Still a gap', 'entra:olive'),
    ev('progress', 'Sam Sparks', '', 'entra:sam'),
  ];
  assert.equal(latestWord(events, sam), undefined);
});

test('nothing written by anyone else, or only the raising words, shows nothing', () => {
  assert.equal(latestWord([ev('raised', 'Sam Sparks', 'Loose tray', 'entra:sam')], sam), undefined);
  assert.equal(latestWord([ev('raised', 'Olive Office', 'Raised in the office', 'entra:olive')], sam), undefined);
  assert.equal(latestWord([ev('raised', 'Sam Sparks', 'x', 'entra:sam'), ev('assigned', 'Olive Office', '', 'entra:olive')], sam), undefined);
});

test('events without a signed-in id are told apart by name', () => {
  assert.equal(latestWord([ev('raised', 'Sam Sparks', 'x'), ev('progress', 'Sam Sparks', 'On it')], sam), undefined);
  assert.equal(latestWord([ev('raised', 'Sam Sparks', 'x'), ev('note', 'Olive Office', 'Priced at £120')], sam)?.by, 'Olive Office');
});

test('a sent report: why it was returned comes first, then a note left on opening it', () => {
  assert.deepEqual(reportWord({ review: 'returned', reviewNote: ' Add the riser photo ', reviewedBy: 'Olive Office', reviewedAt: 'T1', acknowledged: { by: 'Olive Office', at: 'T2', note: 'Thanks' } }), { by: 'Olive Office', at: 'T1', note: 'Add the riser photo' });
  assert.deepEqual(reportWord({ review: 'not_required', acknowledged: { by: 'Olive Office', at: 'T2', note: 'Thanks' } }), { by: 'Olive Office', at: 'T2', note: 'Thanks' });
  assert.equal(reportWord({ review: 'not_required', acknowledged: { by: 'Olive Office', at: 'T2' } }), undefined);
  assert.equal(reportWord({ review: 'approved', reviewNote: 'Fine' }), undefined);
});

test('notes RELAY writes itself are not shown as someone writing', () => {
  const raised = ev('raised', 'Sam Sparks', 'x', 'entra:sam');
  assert.equal(latestWord([raised, { ...ev('confirmation', 'Olive Office', 'Source report returned for correction — needs triage.', 'entra:olive'), source: { reportId: 'r1' } }], sam), undefined);
  assert.equal(latestWord([raised, ev('note', 'Olive Office', 'Which flat?', 'entra:olive'), { ...ev('confirmation', 'Olive Office', 'Confirmed at report review.', 'entra:olive'), source: { reportId: 'r1' } }], sam), undefined);
  assert.equal(latestWord([raised, { ...ev('note', 'Olive Office', 'Seen again in SPR-004 as ISS-009.', 'entra:olive'), correctionId: 'c1' }], sam), undefined);
  const v = ev('raised', 'Sam Sparks', 'Extra socket', 'entra:sam');
  assert.equal(variationWord([v, ev('priced', 'Olive Office', 'Quoted £120.', 'entra:olive')], sam), undefined);
  assert.equal(variationWord([v, ev('note', 'Olive Office', 'Where does the second go?', 'entra:olive'), ev('instructed', 'Olive Office', 'Instructed by A. Client, PO-1, £120.', 'entra:olive')], sam), undefined);
  assert.equal(variationWord([v, ev('priced', 'Olive Office', 'Quoted £120.', 'entra:olive'), ev('note', 'Olive Office', 'Where does the second go?', 'entra:olive')], sam)?.note, 'Where does the second go?');
});

test('an issue the office has moved on from shows nothing old', () => {
  const raised = ev('raised', 'Sam Sparks', 'x', 'entra:sam');
  const asked = ev('note', 'Olive Office', 'Which flat?', 'entra:olive');
  assert.equal(latestWord([raised, asked, ev('verified', 'Olive Office', '', 'entra:olive')], sam), undefined);
  assert.equal(latestWord([raised, asked, ev('confirmation', 'Olive Office', '', 'entra:olive')], sam), undefined);
  // Reassigned leaves the question standing, and the assignment's own note is for the fixer.
  assert.equal(latestWord([raised, asked, ev('assigned', 'Olive Office', 'Over to Northbank', 'entra:olive')], sam)?.note, 'Which flat?');
  assert.equal(latestWord([raised, ev('assigned', 'Olive Office', 'Over to Northbank, key from the site office', 'entra:olive')], sam), undefined);
  // A reason given on withdrawing is shown.
  assert.equal(latestWord([raised, ev('confirmation', 'Olive Office', 'Already raised as ISS-002.', 'entra:olive')], sam)?.note, 'Already raised as ISS-002.');
});

test('another engineer’s update is not the office’s answer, and does not answer it', () => {
  const raised = ev('raised', 'Sam Sparks', 'x', 'entra:sam');
  assert.equal(latestWord([raised, ev('progress', 'Jo Bloggs', 'Bracket still loose', 'entra:jo')], sam), undefined);
  assert.equal(latestWord([raised, ev('note', 'Olive Office', 'Which flat?', 'entra:olive'), ev('progress', 'Jo Bloggs', 'Seen it', 'entra:jo')], sam)?.note, 'Which flat?');
});

test('an old event of the engineer’s with no id, then the office with one', () => {
  assert.equal(latestWord([ev('raised', 'Sam Sparks', 'x'), ev('progress', 'Sam Sparks', 'On it'), ev('reopened', 'Olive Office', 'Not yet', 'entra:olive')], sam)?.note, 'Not yet');
});

test('a returned report the engineer has corrected shows nothing', () => {
  assert.equal(reportWord({ review: 'returned', reviewNote: 'Add the riser photo', reviewedBy: 'Olive Office', reviewedAt: 'T1' }, true), undefined);
});

test('a correction that withdraws or declines moves past an earlier note', () => {
  const raised = ev('raised', 'Sam Sparks', 'x', 'entra:sam');
  const asked = ev('note', 'Olive Office', 'Which flat?', 'entra:olive');
  assert.equal(latestWord([raised, asked, { ...ev('confirmation', 'Olive Office', 'Already raised as ISS-002.', 'entra:olive'), correctionId: 'c1' }], sam), undefined);
  assert.equal(variationWord([raised, asked, { ...ev('declined', 'Olive Office', 'Already raised as VO-002.', 'entra:olive'), correctionId: 'c1' }], sam), undefined);
});

test('a note the office typed with a price or an instruction shows; RELAY’s own words do not', () => {
  const v = ev('raised', 'Sam Sparks', 'Extra socket', 'entra:sam');
  assert.equal(variationWord([v, ev('priced', 'Olive Office', 'Can you confirm it is two sockets?', 'entra:olive')], sam)?.note, 'Can you confirm it is two sockets?');
  for (const filler of ['Details updated.', 'Details updated: work already carried out without a written instruction.', 'Instructed by A. Client, PO-1, £120.00.', 'Within contract. Not chargeable.'])
    assert.equal(variationWord([v, ev('note', 'Olive Office', 'Where?', 'entra:olive'), ev('details', 'Olive Office', filler, 'entra:olive')], sam), undefined, filler);
});

test('review notes from before #58 (no source) are not shown as someone writing', () => {
  assert.equal(latestWord([ev('raised', 'Sam Sparks', 'x', 'entra:sam'), ev('confirmation', 'Olive Office', 'Source report returned for correction — needs triage.', 'entra:olive')], sam), undefined);
});

test('rows the office wrote on or sent back come first, then the rest, each newest first', () => {
  const word = { by: 'Olive Office', at: '2026-10-20T10:00:00Z', note: 'Still a gap at the top' };
  const rows = [
    { key: 'own new defect', at: '2026-10-21T12:00:00Z' },
    { key: 'question', at: '2026-10-20T10:00:00Z', word },
    { key: 'received report', at: '2026-10-21T11:00:00Z' },
    { key: 'returned report', at: '2026-10-19T09:00:00Z', sentBack: true },
    { key: 'older received', at: '2026-10-18T09:00:00Z' },
  ];
  assert.deepEqual([...rows].sort(waitingOnYouFirst).map(r => r.key), ['question', 'returned report', 'own new defect', 'received report', 'older received']);
});

test('an issue the office reopened counts as sent back, with or without a note, until the engineer adds something', () => {
  const raised = ev('raised', 'Sam Sparks', 'Fire stopping missing', 'entra:sam');
  const fixed = ev('closure_submitted', 'Sam Sparks', 'Done', 'entra:sam');
  assert.equal(issueReopened([raised, fixed, ev('reopened', 'Olive Office', '', 'entra:olive')], sam), true);
  assert.equal(issueReopened([raised, fixed, ev('reopened', 'Olive Office', 'Gap at the top', 'entra:olive'), ev('assigned', 'Olive Office', '', 'entra:olive')], sam), true);
  assert.equal(issueReopened([raised, fixed, ev('reopened', 'Olive Office', '', 'entra:olive'), ev('progress', 'Sam Sparks', 'On it', 'entra:sam')], sam), false);
  assert.equal(issueReopened([raised, ev('assigned', 'Olive Office', '', 'entra:olive')], sam), false);
  assert.equal(issueReopened([raised, fixed, ev('reopened', 'Olive Office', '', 'entra:olive'), ev('closure_submitted', 'Priya Pipe', 'Done', 'entra:priya'), ev('verified', 'Olive Office', '', 'entra:olive')], sam), false);
});
