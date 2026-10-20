import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewInUse } from '../lib/reviewQueue';

const off = { reviewRequired: false };
const on = { reviewRequired: true };

test('review off: no review queue, whatever else the reports say', () => {
  assert.equal(reviewInUse(off, []), false);
  assert.equal(reviewInUse(off, [{ state: 'submitted', review: 'not_required' }, { state: 'draft', review: 'not_required' }]), false);
  // An old decision does not bring the queue back.
  assert.equal(reviewInUse(off, [{ state: 'submitted', review: 'approved' }, { state: 'submitted', review: 'returned' }]), false);
  // A draft has not been sent, so nothing waits on the office.
  assert.equal(reviewInUse(off, [{ state: 'draft', review: 'pending' }]), false);
});

test('review on: the queue shows even when it is empty', () => {
  assert.equal(reviewInUse(on, []), true);
  assert.equal(reviewInUse(on, [{ state: 'submitted', review: 'approved' }]), true);
});

test('review switched off with a report still waiting: the queue stays until it is decided', () => {
  assert.equal(reviewInUse(off, [{ state: 'submitted', review: 'pending' }]), true);
});
