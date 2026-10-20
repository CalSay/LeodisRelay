import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_PICKER_SIZE, issueThumbnail, linkCandidates, shortReference } from '../lib/issueLink';
import type { Issue } from '../lib/types';

const photo = (id: string) => ({ id, dataUrl: `data:image/png;base64,${id}`, caption: '' });
const issue = (n: number, extra: Partial<Issue> = {}): Issue => ({
  id: `i${n}`, reference: `011LME-ISS-${String(n).padStart(3, '0')}`, projectId: 'proj-011lme', location: 'Plant room',
  description: `Issue ${n}`, actionNeeded: '', confirmation: 'confirmed', work: 'assigned', owner: '', targetDate: '',
  raisedByReport: '', raisedAt: '2026-10-01T09:00:00.000Z',
  events: [{ at: '2026-10-01T09:00:00.000Z', actor: 'E', kind: 'raised', note: '', photos: [] }], ...extra,
} as Issue);

test('issues at the card location come first, then the server order', () => {
  const issues = [issue(1), issue(2, { location: 'Level 3, Riser 2' }), issue(3), issue(4, { location: 'level 3 riser 2 ' })];
  const { shown, hidden } = linkCandidates(issues, 'Level 3 riser 2', undefined);
  assert.deepEqual(shown.map(i => i.id), ['i4', 'i1', 'i2', 'i3']);
  assert.equal(hidden, 0);
});

test('the picker lists a few and says how many more there are', () => {
  const issues = Array.from({ length: 10 }, (_, n) => issue(n + 1));
  const first = linkCandidates(issues, '', undefined);
  assert.equal(first.shown.length, LINK_PICKER_SIZE);
  assert.equal(first.hidden, 10 - LINK_PICKER_SIZE);
  const all = linkCandidates(issues, '', undefined, true);
  assert.equal(all.shown.length, 10);
  assert.equal(all.hidden, 0);
});

test('the linked issue is always listed, even past the limit', () => {
  const issues = Array.from({ length: 10 }, (_, n) => issue(n + 1));
  const { shown, hidden } = linkCandidates(issues, '', 'i9');
  assert.equal(shown[0]!.id, 'i9');
  assert.equal(shown.length, LINK_PICKER_SIZE + 1);
  assert.equal(hidden, 10 - LINK_PICKER_SIZE - 1);
  assert.equal(linkCandidates(issues, '', 'i2').shown.length, LINK_PICKER_SIZE, 'a linked issue already shown is not repeated');
});

test('the thumbnail is the first photograph on the history, if there is one', () => {
  assert.equal(issueThumbnail(issue(1)), undefined);
  const withPhotos = issue(2, { events: [
    { at: '2026-10-01T09:00:00.000Z', actor: 'E', kind: 'raised', note: '', photos: [] },
    { at: '2026-10-02T09:00:00.000Z', actor: 'E', kind: 'seen_again', note: '', photos: [photo('a'), photo('b')] },
    { at: '2026-10-03T09:00:00.000Z', actor: 'E', kind: 'seen_again', note: '', photos: [photo('c')] },
  ] as Issue['events'] });
  assert.equal(issueThumbnail(withPhotos)?.id, 'a');
});

test('the reference drops the project prefix the picker repeats on every row', () => {
  assert.equal(shortReference('011LME-ISS-004'), 'ISS-004');
  assert.equal(shortReference('ISS4'), 'ISS4');
});
