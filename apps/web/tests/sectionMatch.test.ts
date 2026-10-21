import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionsBefore, sectionOf } from '../lib/sectionMatch';

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

test('a record raised on revision 1 is found on revision 3', () => {
  // Rev 3 corrects rev 2, which corrected rev 1 where the record was raised; the section keeps its id.
  const rev3 = { ...report, id: 'rep-3', corrects: 'rep-2' };
  const earlier = revisionsBefore(rev3, id => ({ 'rep-2': 'rep-1' } as Record<string, string>)[id]);
  assert.deepEqual(earlier, ['rep-2', 'rep-1']);
  assert.equal(sectionOf({ raisedByReport: 'rep-1', raisedByObservation: 'o2', description: 'x', location: 'y' }, rev3, earlier), 'o2');
  assert.equal(sectionOf({ raisedByReport: 'rep-1', raisedByObservation: 'o2', description: 'x', location: 'y' }, rev3), undefined);
});

test('a shared checklist section id on another inspection does not match', () => {
  // Every inspection of a type has obs-check-3; only the inspection that raised it counts.
  const b = { id: 'insp-b', observations: [{ id: 'obs-check-3', whatHappened: 'x', location: '' }] };
  assert.equal(sectionOf({ raisedByReport: 'insp-a', raisedByObservation: 'obs-check-3', description: 'x', location: '' }, b), undefined);
});

test('a loop in corrects links stops', () => {
  assert.deepEqual(revisionsBefore({ corrects: 'a' }, id => (id === 'a' ? 'b' : 'a')), ['a', 'b']);
});
