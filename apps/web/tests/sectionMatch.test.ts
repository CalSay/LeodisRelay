import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionOf } from '../lib/sectionMatch';

const report = { id: 'rep-1', observations: [
  { id: 'o1', whatHappened: 'Pump leaking.', location: 'Plant Room' },
  { id: 'o2', whatHappened: 'Cable tray damaged.', location: 'Level 1' },
  { id: 'o3', whatHappened: 'Cable tray damaged.', location: 'Level 1' },
] };

test('a stored section id wins', () => {
  assert.equal(sectionOf({ raisedByReport: 'rep-1', raisedByObservation: 'o2', description: 'x', location: 'y' }, report), 'o2');
});

test('older records match on description and location when exactly one section fits', () => {
  assert.equal(sectionOf({ raisedByReport: 'rep-1', description: ' Pump  leaking. ', location: 'Plant Room' }, report), 'o1');
});

test('ambiguous, missing or other-report matches are not guessed', () => {
  assert.equal(sectionOf({ raisedByReport: 'rep-1', description: 'Cable tray damaged.', location: 'Level 1' }, report), undefined);
  assert.equal(sectionOf({ raisedByReport: 'rep-1', description: 'Nothing like it', location: '' }, report), undefined);
  assert.equal(sectionOf({ raisedByReport: 'rep-2', description: 'Pump leaking.', location: 'Plant Room' }, report), undefined);
});
