import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DONE_DAYS, NOTE_MAX, OPEN_MAX, noteProblem, projectNotes, type SiteNote } from '../lib/siteNotes';
import { leaveNote, markNote, notesFor } from '../lib/siteNoteStore';
import { database, records } from '../lib/storage';
import type { Principal } from '@relay/platform';

const NOW = new Date('2026-10-20T12:00:00Z');
const note = (id: string, at: string, extra: Partial<SiteNote> = {}): SiteNote => ({ id, projectId: 'p1', text: `Note ${id}`, by: 'Sam', byId: 'entra:sam', at, ...extra });
const uuid = (n: number) => `6f1c2b8e-1a2b-4c3d-8e9f-${String(n).padStart(12, '0')}`;

test('a note needs some words, at most 500 characters, and room on the project', () => {
  assert.equal(noteProblem('Riser 3 key is with the site manager', 0), undefined);
  assert.match(noteProblem('   ', 0)!, /Write the note/);
  assert.equal(noteProblem('x'.repeat(NOTE_MAX), 0), undefined);
  assert.match(noteProblem('x'.repeat(NOTE_MAX + 1), 0)!, /500 characters/);
  assert.match(noteProblem('ok', OPEN_MAX)!, /done with first/);
});

test('a project shows its open notes newest first and those done with in the last fortnight, most recently done first', () => {
  const done = (at: string) => ({ by: 'Jo', byId: 'entra:jo', at });
  const list = projectNotes([
    note('a', '2026-10-18T09:00:00Z'),
    note('b', '2026-10-19T09:00:00Z'),
    note('other', '2026-10-19T10:00:00Z', { projectId: 'p2' }),
    note('c', '2026-10-01T09:00:00Z', { done: done('2026-10-15T09:00:00Z') }),
    note('d', '2026-10-01T09:00:00Z', { done: done('2026-10-17T09:00:00Z') }),
    note('old', '2026-09-01T09:00:00Z', { done: done(new Date(NOW.getTime() - (DONE_DAYS + 1) * 86400000).toISOString()) }),
  ], 'p1', NOW);
  assert.deepEqual(list.open.map(n => n.id), ['b', 'a']);
  assert.deepEqual(list.done.map(n => n.id), ['d', 'c'], 'older than a fortnight drops off the page');
});

test('a note is attributed to whoever is signed in, a retry is not left twice, and done with can be undone', () => {
  const root = mkdtempSync(join(tmpdir(), 'relay-site-notes-'));
  process.env.RELAY_DATA_ROOT = root;
  const engineer = { id: 'entra:sam', name: 'Sam Taylor', role: 'Engineer', trade: 'Electrical' } as Principal;
  const office = { id: 'entra:office', name: 'Office Manager', role: 'Manager' } as Principal;
  try {
    const first = leaveNote({ projectId: 'p1', text: '  Key is with the site manager ', requestId: uuid(1) }, engineer);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.text, 'Key is with the site manager');
    assert.equal(first.value.by, 'Sam Taylor');
    assert.equal(first.value.byTrade, 'Electrical');
    assert.deepEqual(leaveNote({ projectId: 'p1', text: 'Key is with the site manager', requestId: uuid(1) }, engineer), first, 'a retry returns the first save');
    const changed = leaveNote({ projectId: 'p1', text: 'Something else', requestId: uuid(1) }, engineer);
    assert.deepEqual(changed.ok ? 0 : changed.status, 409);
    assert.equal(records('site-notes').length, 1);
    assert.equal(leaveNote({ projectId: 'p1', text: 'x', requestId: 'not-an-id' }, engineer).ok, false);
    const fromOffice = leaveNote({ projectId: 'p1', text: 'Client visit Thursday', requestId: uuid(2) }, office);
    assert.equal(fromOffice.ok && fromOffice.value.byTrade, 'Office');

    const done = markNote(first.value.id, true, office, NOW);
    assert.equal(done.ok && done.value.done?.by, 'Office Manager', 'anyone on the project can mark a note done with');
    assert.deepEqual(markNote(first.value.id, true, engineer, NOW), done, 'marking it again changes nothing');
    assert.deepEqual(notesFor('p1', NOW).done.map(n => n.id), [first.value.id]);
    const back = markNote(first.value.id, false, engineer, NOW);
    assert.equal(back.ok && back.value.done, undefined);
    assert.equal(notesFor('p1', NOW).open.length, 2);
    assert.deepEqual((() => { const m = markNote('note-missing', true, engineer); return m.ok ? 0 : m.status; })(), 404);

    for (let n = 3; n < OPEN_MAX + 1; n++) assert.equal(leaveNote({ projectId: 'p1', text: `Note ${n}`, requestId: uuid(n) }, engineer).ok, true);
    const full = leaveNote({ projectId: 'p1', text: 'One too many', requestId: uuid(99) }, engineer);
    assert.deepEqual(full.ok ? 0 : full.status, 422, `no more than ${OPEN_MAX} open on a project`);
    assert.equal(leaveNote({ projectId: 'p2', text: 'Another project has room', requestId: uuid(100) }, engineer).ok, true);
  } finally {
    database().close();
    rmSync(root, { recursive: true, force: true });
  }
});
