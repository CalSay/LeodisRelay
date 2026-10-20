import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardAtSameLocation, insertAfterSameLocation, sameLocationText } from '../lib/sameLocation';
import type { Observation } from '../lib/types';

const blank = (id: string): Observation => ({ id, type: 'update', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [] });
const card = (id: string, location: string, extra: Partial<Observation> = {}): Observation => ({ ...blank(id), location, ...extra });

test('the new card takes the location and nothing else', () => {
  const source = card('a', '  Level 3, riser 2 ', {
    type: 'instruction', whatHappened: 'Moved the board', actionNeeded: 'Price it', owner: 'Client',
    photos: [{ id: 'p1', dataUrl: 'data:image/png;base64,AA', caption: 'Board', capturedAt: '2026-10-20T09:00:00.000Z' }], linkedIssueId: 'i1',
    affectedTrade: 'Electrical', variationReason: 'Client instruction', workDone: true,
    askedBy: 'Site manager', roughSize: 'day', partsEstimate: 120,
  });
  const next = cardAtSameLocation(source, blank('b'));
  assert.deepEqual(next, { ...blank('b'), location: 'Level 3, riser 2' });
  assert.equal(next.photos.length, 0);
  assert.notEqual(next.photos, source.photos);
  assert.equal(source.photos.length, 1, 'the earlier card keeps its photograph');
});

test('the new card goes after the source and the cards already added there', () => {
  const cards = [card('a', 'Plant room'), card('b', 'plant room '), card('c', 'Roof'), card('d', 'Plant room')];
  assert.deepEqual(insertAfterSameLocation(cards, 'a', blank('n')).map(o => o.id), ['a', 'b', 'n', 'c', 'd']);
  assert.deepEqual(insertAfterSameLocation(cards, 'c', blank('n')).map(o => o.id), ['a', 'b', 'c', 'n', 'd']);
  assert.deepEqual(insertAfterSameLocation(cards, 'd', blank('n')).map(o => o.id), ['a', 'b', 'c', 'd', 'n']);
  assert.deepEqual(insertAfterSameLocation(cards, 'gone', blank('n')).map(o => o.id), ['a', 'b', 'c', 'd', 'n']);
});

test('locations match on wording, not case or outer spaces', () => {
  assert.equal(sameLocationText(' Plant Room', 'plant room '), true);
  assert.equal(sameLocationText('Plant room', 'Plant room 2'), false);
  assert.equal(sameLocationText('', ''), false);
});
