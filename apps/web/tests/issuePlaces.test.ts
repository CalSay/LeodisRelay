import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issuePlaces, issuesAtPlace } from '../lib/issuePlaces';
import type { Issue } from '../lib/types';

const issue = (n: number, location: string): Issue => ({
  id: `i${n}`, reference: `011LME-ISS-${String(n).padStart(3, '0')}`, projectId: 'proj-011lme', location,
  description: `Issue ${n}`, actionNeeded: '', confirmation: 'confirmed', work: 'assigned', owner: '', targetDate: '',
  raisedByReport: '', raisedAt: '2026-10-01T09:00:00.000Z', events: [],
} as unknown as Issue);

test('one choice per place however it was typed, in the spelling used most', () => {
  const places = issuePlaces([issue(1, 'Flat 204 kitchen'), issue(2, 'flat 204  kitchen '), issue(3, 'Flat 204 kitchen'), issue(4, 'Plant room')]);
  assert.deepEqual(places, [{ place: 'Flat 204 kitchen', count: 3 }, { place: 'Plant room', count: 1 }]);
});

test('places come in natural order and issues with no place are not offered', () => {
  const places = issuePlaces([issue(1, 'Level 10'), issue(2, 'Level 2'), issue(3, '  '), issue(4, '')]);
  assert.deepEqual(places.map(p => p.place), ['Level 2', 'Level 10']);
});

test('a place counts and lists the smaller places inside it, but not a different number', () => {
  const issues = [issue(1, 'Flat 204'), issue(2, 'Flat 204 kitchen'), issue(3, 'Flat 2041'), issue(4, 'Level 1'), issue(5, 'Level 12')];
  const places = issuePlaces(issues);
  assert.equal(places.find(p => p.place === 'Flat 204')!.count, 2);
  assert.equal(places.find(p => p.place === 'Flat 204 kitchen')!.count, 1);
  assert.deepEqual(issuesAtPlace(issues, 'Flat 204 kitchen').map(i => i.id), ['i2']);
  assert.deepEqual(issuesAtPlace([issue(6, 'Kitchen'), issue(7, 'Flat 204 kitchen')], 'Flat 204 kitchen').map(i => i.id), ['i7']);
  assert.deepEqual(issuesAtPlace(issues, 'Flat 204').map(i => i.id), ['i1', 'i2']);
  assert.deepEqual(issuesAtPlace(issues, 'level 1').map(i => i.id), ['i4']);
});

test('no place chosen lists every issue', () => {
  const issues = [issue(1, 'A'), issue(2, '')];
  assert.equal(issuesAtPlace(issues, '').length, 2);
  assert.equal(issuesAtPlace(issues, ' ').length, 2);
});
