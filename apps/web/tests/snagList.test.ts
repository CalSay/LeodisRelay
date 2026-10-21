import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_LOCATION, raisedPhoto, snagList, snagOwners } from '../lib/snagList';
import type { Issue } from '../lib/types';

function issue(id: string, extra: Partial<Issue> = {}): Issue {
  return { id, reference: `011LME-ISS-${id}`, projectId: 'p1', location: 'Level 1', description: `Issue ${id}`, actionNeeded: '', confirmation: 'confirmed',
    work: 'assigned', owner: 'Sparks Ltd', targetDate: '', raisedByReport: '', raisedAt: '2026-10-01T09:00:00Z', events: [], ...extra } as Issue;
}
const DAY = '2026-10-20';

test('lists only open issues on the chosen project', () => {
  const list = snagList([issue('1'), issue('2', { work: 'closed' }), issue('3', { confirmation: 'withdrawn' }), issue('4', { projectId: 'p2' })], { projectId: 'p1' }, DAY);
  assert.deepEqual(list.groups.flatMap(g => g.rows.map(r => r.issue.id)), ['1']);
  assert.equal(list.total, 1);
});

test('narrows to one company and one trade, reading the reporter trade when the affected trade is missing', () => {
  const all = [issue('1', { affectedTrade: 'HVAC' }), issue('2', { owner: 'Other Co', affectedTrade: 'HVAC' }), issue('3', { reporterTrade: 'HVAC' }), issue('4', { affectedTrade: 'Electrical', reporterTrade: 'HVAC' })];
  const ids = (owner?: string, trade?: string) => snagList(all, { projectId: 'p1', owner, trade }, DAY).groups.flatMap(g => g.rows.map(r => r.issue.id)).sort();
  assert.deepEqual(ids('Sparks Ltd'), ['1', '3', '4']);
  assert.deepEqual(ids(undefined, 'HVAC'), ['1', '2', '3']);
  assert.deepEqual(ids(' Sparks Ltd ', 'HVAC'), ['1', '3']);
});

test('a company typed with different case or spacing is the same company', () => {
  const all = [issue('1'), issue('2', { owner: 'sparks  ltd' }), issue('3', { owner: 'Sparks Ltd (North)' })];
  const ids = snagList(all, { projectId: 'p1', owner: 'SPARKS LTD' }, DAY).groups.flatMap(g => g.rows.map(r => r.issue.id)).sort();
  assert.deepEqual(ids, ['1', '2']);
});

test('groups free-text locations as written, ignoring only case and spacing, with no location last', () => {
  const list = snagList([issue('1', { location: 'Plant room' }), issue('2', { location: ' plant  room' }), issue('3', { location: '' }), issue('4', { location: 'Corridor' })], { projectId: 'p1' }, DAY);
  assert.deepEqual(list.groups.map(g => [g.location, g.rows.length]), [['Corridor', 1], ['Plant room', 2], [NO_LOCATION, 1]]);
  const later = snagList([issue('5', { location: 'PLANT ROOM', raisedAt: '2026-10-05T09:00:00Z' }), issue('6', { location: 'Plant room' })], { projectId: 'p1' }, DAY);
  assert.equal(later.groups[0]!.location, 'Plant room', 'labelled as the earliest issue wrote it, whatever the load order');
});

test('flags past-target and fixed work, and puts fixed work last within a location', () => {
  const list = snagList([
    issue('1', { work: 'awaiting_verification', targetDate: '2026-10-01' }),
    issue('2', { targetDate: '2026-10-25' }),
    issue('3', { targetDate: '2026-10-19' }),
    issue('4', { targetDate: '2026-10-20' }),
  ], { projectId: 'p1' }, DAY);
  assert.deepEqual(list.groups[0]!.rows.map(r => [r.issue.id, r.overdue, r.fixed]), [['3', true, false], ['4', false, false], ['2', false, false], ['1', false, true]], 'fixed work waits on the office, so it is not past target');
  assert.equal(list.overdue, 1);
  assert.equal(list.fixed, 1);
});

test('offers the owners named on the project open issues, once each', () => {
  assert.deepEqual(snagOwners([issue('1', { owner: 'B Co' }), issue('2', { owner: 'A Co ' }), issue('3', { owner: 'A Co' }), issue('4', { owner: '' }), issue('5', { owner: 'Gone', work: 'closed' }), issue('6', { owner: 'Elsewhere', projectId: 'p2' })], 'p1'), ['A Co', 'B Co']);
});

test('uses the first photograph taken when the issue was raised', () => {
  const photo = (id: string) => ({ id, dataUrl: `/x/${id}`, caption: '' }) as unknown as Issue['events'][number]['photos'][number];
  const i = issue('1', { events: [{ at: '', actor: 'A', kind: 'raised', note: '', photos: [photo('a'), photo('b')] }, { at: '', actor: 'B', kind: 'progress', note: '', photos: [photo('c')] }] });
  assert.equal(raisedPhoto(i)?.id, 'a');
  assert.equal(raisedPhoto(issue('2')), undefined);
});
