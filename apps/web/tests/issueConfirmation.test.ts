import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationLabel, confirmationNote } from '../lib/issueConfirmation';

test('a provisional issue reads "Not reviewed" only where the project uses review', () => {
  assert.equal(confirmationLabel('provisional', true), 'Not reviewed');
  assert.equal(confirmationLabel('provisional', false), 'As reported');
  assert.match(confirmationNote('provisional', false), /does not use review/);
  assert.doesNotMatch(confirmationLabel('provisional', false), /review/i);
});

test('the other states read the same with review on or off', () => {
  for (const c of ['confirmed', 'disputed', 'withdrawn'] as const) {
    assert.equal(confirmationLabel(c, true), confirmationLabel(c, false));
    assert.equal(confirmationNote(c, true), confirmationNote(c, false));
  }
  assert.deepEqual(['confirmed', 'disputed', 'withdrawn'].map(c => confirmationLabel(c as 'confirmed', false)), ['Confirmed', 'Disputed', 'Withdrawn']);
});
