import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTableRows } from '../lib/tableSorting';

const rows = [
  { ref: 'ISS-002', target: '2026-09-09' },
  { ref: 'ISS-001', target: '2026-09-10' },
  { ref: 'ISS-010', target: '' },
];

test('table sorting treats issue references naturally', () => {
  assert.deepEqual(sortTableRows([...rows], 'ascending', row => row.ref, row => row.ref).map(row => row.ref), ['ISS-001', 'ISS-002', 'ISS-010']);
  assert.deepEqual(sortTableRows([...rows], 'descending', row => row.ref, row => row.ref).map(row => row.ref), ['ISS-010', 'ISS-002', 'ISS-001']);
});

test('blank table values remain last in either direction', () => {
  assert.equal(sortTableRows([...rows], 'ascending', row => row.target, row => row.ref).at(-1)?.ref, 'ISS-010');
  assert.equal(sortTableRows([...rows], 'descending', row => row.target, row => row.ref).at(-1)?.ref, 'ISS-010');
});
