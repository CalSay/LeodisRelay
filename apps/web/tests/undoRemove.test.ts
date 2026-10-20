import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canUndo, removeCard, removedLabel, removePhoto, restoreRemoved } from '../lib/undoRemove';
import type { Observation, Photo } from '../lib/types';

const photo = (id: string, caption = ''): Photo => ({ id, dataUrl: `/api/media/00000000-0000-4000-8000-${Buffer.from(id).toString('hex').padStart(12, '0').slice(-12)}`, caption, capturedAt: '2026-10-20T09:00:00.000Z' });
const card = (id: string, extra: Partial<Observation> = {}): Observation => ({ id, type: 'update', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], ...extra });

test('removing a card then undoing puts the same card back where it was, photos and all', () => {
  const b = card('b', { type: 'defect', location: 'Riser 2', whatHappened: 'Cracked tray', photos: [photo('p1'), photo('p2')], linkedIssueId: 'i1' });
  const cards = [card('a'), b, card('c')];
  const { observations, removed } = removeCard(cards, 'b');
  assert.deepEqual(observations.map(o => o.id), ['a', 'c']);
  assert.ok(removed);
  const back = restoreRemoved(observations, removed);
  assert.deepEqual(back, cards);
  // The very same record, not a copy with new ids: nothing new is saved or uploaded.
  assert.equal(back?.[1], b);
  assert.equal(back?.[1]?.photos, b.photos);
});

test('undoing twice does not add the card twice', () => {
  const cards = [card('a'), card('b')];
  const { observations, removed } = removeCard(cards, 'a');
  const once = restoreRemoved(observations, removed!)!;
  const twice = restoreRemoved(once, removed!);
  assert.equal(twice, once, 'unchanged, so the page has nothing to save');
  assert.deepEqual(twice?.map(o => o.id), ['a', 'b']);
});

test('a card goes back after the card that was in front of it, even if others moved', () => {
  const cards = [card('a'), card('b'), card('c')];
  const { observations, removed } = removeCard(cards, 'c');
  const moved = [card('n'), ...observations];
  assert.deepEqual(restoreRemoved(moved, removed!)?.map(o => o.id), ['n', 'a', 'b', 'c']);
  const first = removeCard(cards, 'a');
  assert.deepEqual(restoreRemoved(first.observations, first.removed!)?.map(o => o.id), ['a', 'b', 'c']);
  const gone = removeCard(cards, 'b');
  assert.deepEqual(restoreRemoved([card('c')], gone.removed!)?.map(o => o.id), ['c', 'b'], 'falls back to its old position');
});

test('removing a photo then undoing puts the same photo back in its place', () => {
  const p2 = photo('p2', 'Tray joint');
  const cards = [card('a', { photos: [photo('p1'), p2, photo('p3')] }), card('b')];
  const { observations, removed } = removePhoto(cards, 'a', 'p2');
  assert.deepEqual(observations[0]?.photos.map(p => p.id), ['p1', 'p3']);
  assert.equal(observations[1], cards[1], 'other cards are left alone');
  const back = restoreRemoved(observations, removed!);
  assert.deepEqual(back?.[0]?.photos.map(p => p.id), ['p1', 'p2', 'p3']);
  assert.equal(back?.[0]?.photos[1], p2);
  assert.equal(restoreRemoved(back!, removed!), back, 'a second undo changes nothing');
});

test('a photo whose card has gone cannot be put back', () => {
  const cards = [card('a', { photos: [photo('p1')] })];
  const { removed } = removePhoto(cards, 'a', 'p1');
  assert.equal(restoreRemoved([], removed!), null);
});

test('removing something that is not there offers no undo', () => {
  const cards = [card('a')];
  assert.equal(removeCard(cards, 'x').removed, undefined);
  assert.equal(removePhoto(cards, 'a', 'x').removed, undefined);
  assert.equal(removeCard(cards, 'x').observations, cards);
});

test('the undo bar says what was removed', () => {
  const cards = [card('a'), card('b', { location: ' Level 2 riser ', photos: [photo('p1'), photo('p2', ' Tray ')] })];
  assert.deepEqual(removedLabel(removeCard(cards, 'b').removed!, 2, 'Defect'), { title: 'Card 02 removed', detail: 'Defect · Level 2 riser · 2 photos' });
  assert.deepEqual(removedLabel(removeCard(cards, 'a', true).removed!, 1, 'Progress'), { title: 'Card 01 removed', detail: 'New card · no location' });
  assert.deepEqual(removedLabel(removePhoto(cards, 'b', 'p2').removed!, 2, ''), { title: 'Photo 02 removed', detail: 'Tray' });
  assert.deepEqual(removedLabel(removePhoto(cards, 'b', 'p1').removed!, 2, ''), { title: 'Photo 01 removed', detail: 'From card 02' });
});

test('no undo for a photograph stored inline before the upload service', () => {
  const inline: Photo = { id: 'old', dataUrl: 'data:image/png;base64,AA', caption: '', capturedAt: '2026-09-01T09:00:00.000Z' };
  const cards = [card('a', { photos: [photo('p1'), inline] }), card('b', { photos: [photo('p2')] })];
  assert.equal(canUndo(removeCard(cards, 'a').removed!), false);
  assert.equal(canUndo(removePhoto(cards, 'a', 'old').removed!), false);
  assert.equal(canUndo(removePhoto(cards, 'a', 'p1').removed!), true);
  assert.equal(canUndo(removeCard(cards, 'b').removed!), true);
  assert.equal(canUndo(removeCard([card('c')], 'c').removed!), true, 'a card with no photographs');
});
