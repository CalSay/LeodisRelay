import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardWhere, reportWhere, savedCopy } from '../lib/uploadStatus';
import type { Observation, Photo } from '../lib/types';

const photo = (id: string, caption = ''): Photo => ({ id, dataUrl:`/api/media/${id}`, caption, capturedAt:'2026-10-20T09:00:00Z' });
const card = (extra: Partial<Observation> = {}): Observation =>
  ({ id:'c1', type:'defect', location:'Riser 2', whatHappened:'Tray loose', actionNeeded:'', owner:'', photos:[], ...extra } as Observation);
const none = new Set<string>();

test('a card the server holds word for word, with its photos, is on the server', () => {
  const c = card({ photos:[photo('p1')] });
  const where = cardWhere(c, savedCopy(c), none, false);
  assert.deepEqual(where, { where:'server', text:true, photos:1, photosOnServer:1, each:['server'] });
  assert.equal(reportWhere([where], false).text, 'The card and its photo are on the server.');
});

test('the server copy matches whatever order its keys come back in', () => {
  const c = card();
  const reordered = JSON.parse(JSON.stringify({ photos:[], owner:'', actionNeeded:'', whatHappened:'Tray loose', location:'Riser 2', type:'defect', id:'c1' })) as Observation;
  assert.equal(cardWhere(c, savedCopy(reordered), none, false).where, 'server');
});

test('a new photo is pending on its own; the words already saved stay on the server', () => {
  const saved = card({ photos:[photo('p1')] });
  const now = { ...saved, photos:[photo('p1'), photo('p2')] };
  const where = cardWhere(now, savedCopy(saved), none, false);
  assert.deepEqual(where, { where:'pending', text:true, photos:2, photosOnServer:1, each:['server','pending'] });
  assert.equal(reportWhere([where], false).text, '1 photo is not yet on the server.');
});

test('a photo being sent says so, and the card with it', () => {
  const saved = card();
  const now = { ...saved, photos:[photo('p1')] };
  const where = cardWhere(now, savedCopy(saved), new Set(['p1']), false);
  assert.deepEqual([where.where, where.each], ['uploading', ['uploading']]);
  assert.equal(reportWhere([where], false).text, '1 photo is still uploading.');
});

test('uploaded bytes the saved card does not list yet are still pending', () => {
  // localMedia marks the bytes as sent before the report save that lists them.
  const saved = card();
  const where = cardWhere({ ...saved, photos:[photo('p1')] }, savedCopy(saved), none, false);
  assert.equal(where.each[0], 'pending');
});

test('changed words or a changed caption make the card pending, not its saved photos', () => {
  const saved = card({ photos:[photo('p1')] });
  const words = cardWhere({ ...saved, whatHappened:'Tray loose, two brackets missing' }, savedCopy(saved), none, false);
  assert.deepEqual([words.where, words.text, words.each], ['pending', false, ['server']]);
  const caption = cardWhere({ ...saved, photos:[photo('p1','Bracket')] }, savedCopy(saved), none, false);
  assert.deepEqual([caption.where, caption.text], ['pending', false]);
  assert.equal(reportWhere([words], false).text, '1 card is not yet on the server.');
});

test('a removed photo leaves the card pending until the server has the change', () => {
  const saved = card({ photos:[photo('p1'), photo('p2')] });
  const where = cardWhere({ ...saved, photos:[photo('p1')] }, savedCopy(saved), none, false);
  assert.deepEqual([where.where, where.text], ['pending', false]);
});

test('when the server cannot be reached, pending work is only on this phone', () => {
  const fresh = card({ id:'c2', photos:[photo('p3'), photo('p4')] });
  const saved = card();
  const rows = [cardWhere(fresh, undefined, none, true), cardWhere({ ...saved, location:'Riser 3' }, savedCopy(saved), none, true)];
  assert.deepEqual(rows.map(r => [r.where, r.each]), [['phone', ['phone','phone']], ['phone', []]]);
  assert.equal(reportWhere(rows, true).text, '2 cards and 2 photos are only on this phone. They go up by themselves when the server can be reached.');
});

test('counts every card and photo when all are on the server', () => {
  const a = card({ photos:[photo('p1'), photo('p2')] }), b = card({ id:'c2', type:'update' });
  assert.equal(reportWhere([cardWhere(a, savedCopy(a), none, false), cardWhere(b, savedCopy(b), none, false)], false).text,
    'Both cards and 2 photos are on the server.');
  assert.equal(reportWhere([], false).text, '');
});

test('a removed card or a changed signature keeps the summary from going green', () => {
  const a = card();
  const kept = [cardWhere(a, savedCopy(a), none, true)];
  assert.equal(reportWhere(kept, true, { removed:1, signature:false }).text,
    '1 removed card is only on this phone. It goes up by itself when the server can be reached.');
  assert.equal(reportWhere(kept, false, { removed:0, signature:true }).text, 'The signature is not yet on the server.');
  assert.equal(reportWhere([cardWhere({ ...a, location:'Riser 3' }, savedCopy(a), none, false)], false, { removed:2, signature:true }).text,
    '1 card, 2 removed cards and the signature are not yet on the server.');
  assert.equal(reportWhere([], false, { removed:1, signature:false }).where, 'pending');
});
