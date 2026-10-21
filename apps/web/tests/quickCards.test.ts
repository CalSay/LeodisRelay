import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlankCard, placesToOffer, withoutBlankCards } from '../lib/quickCards';
import type { Observation } from '../lib/types';

const blank = (id: string, extra: Partial<Observation> = {}): Observation => ({ id, type: 'update', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], ...extra });

test('a card with nothing in it is blank, whatever its kind and a defect’s own trade', () => {
  assert.equal(isBlankCard(blank('a')), true);
  assert.equal(isBlankCard(blank('a', { type: 'defect', affectedTrade: 'Electrical' })), true);
  assert.equal(isBlankCard(blank('a', { type: 'instruction', location: '   ', whatHappened: '\n' })), true);
});

test('anything written, photographed, linked or answered keeps a card', () => {
  const photo = { id: 'p', dataUrl: 'data:image/png;base64,AA', caption: '', capturedAt: '2026-10-21T08:00:00.000Z' };
  for (const extra of [
    { location: 'Riser 2' }, { whatHappened: 'Tray in' }, { actionNeeded: 'Fix' }, { owner: 'Main contractor' },
    { photos: [photo] }, { linkedIssueId: 'i1' }, { variationReason: 'Client instruction' as const }, { workDone: false },
    { askedBy: 'Site manager' }, { roughSize: 'day' as const }, { partsEstimate: 0 },
    { type: 'check' as const, check: { item: 'x', question: 'Is it tidy?' } },
  ]) assert.equal(isBlankCard(blank('a', extra)), false, JSON.stringify(extra));
});

test('only blank cards are left off, in order, and no change gives back the same cards', () => {
  const cards = [blank('a'), blank('b', { whatHappened: 'Done' }), blank('c', { type: 'defect' }), blank('d', { location: 'Roof' })];
  assert.deepEqual(withoutBlankCards(cards).map(o => o.id), ['b', 'd']);
  const kept = [cards[1]!, cards[3]!];
  assert.equal(withoutBlankCards(kept), kept);
  assert.deepEqual(withoutBlankCards([blank('a')]), []);
});

test('places on this report come first, latest first, then the project’s, each once', () => {
  const cards = [blank('a', { location: 'Level 2 corridor' }), blank('b', { location: ' plant  room ' }), blank('c', { location: 'Kitchen' })];
  assert.deepEqual(placesToOffer(cards, 'c', ['Roof', 'Level 2 Corridor', 'Kitchen']), ['plant room', 'Level 2 corridor', 'Roof', 'Kitchen']);
  assert.deepEqual(placesToOffer([], 'x', ['Roof', ' ', 'roof']), ['Roof']);
  // The card's own place is not offered back to it, and nor are an inspection's.
  assert.deepEqual(placesToOffer([blank('c', { location: 'Kitchen' }), blank('k', { type: 'check', location: 'Bay 1', check: { item: 'x', question: 'q' } })], 'c', []), []);
});
