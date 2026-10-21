import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { offlineNote, offlineNotesKey, readOfflineNotes, withProjectNotes, type OfflineNotes } from '../lib/offlineNotes';
import type { SiteNote } from '../lib/siteNotes';

const note = (id: string, extra: Partial<SiteNote> = {}): SiteNote => ({ id, projectId: 'p1', text: `Note ${id}`, by: 'Sam', byId: 'entra:sam', byTrade: 'Electrical', at: '2026-10-20T09:00:00Z', ...extra });
const copy = (): OfflineNotes => ({ projects: [
  { projectId: 'p1', projectNumber: '011LME', projectName: 'Tetley Hall', savedAt: '2026-10-20T10:00:00Z', open: [offlineNote(note('a'))] },
  { projectId: 'p2', projectNumber: '012ABC', projectName: 'Quarry Hill', savedAt: '2026-10-20T10:00:00Z', open: [] },
] });

test('the phone keeps only the words, who left a note and when: no ids of people and nothing about done with', () => {
  const kept = offlineNote(note('a', { done: { by: 'Jo', byId: 'entra:jo', at: '2026-10-20T11:00:00Z' } }));
  assert.deepEqual(kept, { id: 'a', text: 'Note a', by: 'Sam', byTrade: 'Electrical', at: '2026-10-20T09:00:00Z' });
  const { byTrade: _t, ...office } = note('b');
  assert.deepEqual(Object.keys(offlineNote(office)), ['id', 'text', 'by', 'at']);
});

test('a damaged or missing copy reads as none, and a damaged project is left out', () => {
  assert.equal(readOfflineNotes(null), null);
  assert.equal(readOfflineNotes('not json'), null);
  assert.equal(readOfflineNotes('{"projects":"no"}'), null);
  const good = copy();
  assert.deepEqual(readOfflineNotes(JSON.stringify(good)), good);
  const mixed = { projects: [...good.projects, { projectId: 'p3', projectNumber: 'x', projectName: 'y', savedAt: 'not a date', open: [] }, { projectId: 'p4', projectNumber: 'x', projectName: 'y', savedAt: '2026-10-20T10:00:00Z', open: [{ text: 1 }] }] };
  assert.deepEqual(readOfflineNotes(JSON.stringify(mixed))?.projects.map(p => p.projectId), ['p1', 'p2']);
});

test('reading a project with signal refreshes only that project, and never adds one the home screen did not keep', () => {
  const next = withProjectNotes(copy(), 'p2', [note('n', { projectId: 'p2' })], '2026-10-21T08:00:00Z')!;
  assert.deepEqual(next.projects[1], { projectId: 'p2', projectNumber: '012ABC', projectName: 'Quarry Hill', savedAt: '2026-10-21T08:00:00Z', open: [offlineNote(note('n', { projectId: 'p2' }))] });
  assert.deepEqual(next.projects[0], copy().projects[0]);
  // Every note on p1 marked done with: the copy is emptied, not left stale.
  assert.deepEqual(withProjectNotes(copy(), 'p1', [], '2026-10-21T08:00:00Z')!.projects[0]!.open, []);
  assert.deepEqual(withProjectNotes(copy(), 'p9', [note('z')], '2026-10-21T08:00:00Z'), copy());
  assert.equal(withProjectNotes(null, 'p1', [note('z')], '2026-10-21T08:00:00Z'), null);
});

test('the offline page reads the copy under the same key, and signing out removes it', () => {
  const offline = readFileSync(resolve(__dirname, '../../public/offline.js'), 'utf8');
  assert.equal(offlineNotesKey('entra:sam'), 'relay-offline-notes:entra:sam');
  assert.match(offline, /localStorage\.getItem\(`relay-offline-notes:\$\{principal\}`\)/);
  // Read only: the offline page has no way to leave a note or mark one done with.
  assert.doesNotMatch(offline, /\/api\/site-notes/);
  const signout = readFileSync(resolve(__dirname, '../../components/PwaRegistration.tsx'), 'utf8');
  assert.match(signout, /key\.startsWith\('relay-offline-notes:'\)/);
});
