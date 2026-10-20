import type { Principal } from '@relay/platform';
import { atomic, getRecord, putRecord, records } from './storage';
import { canManage } from './auth/access';
import { noteProblem, projectNotes, type ProjectNotes, type SiteNote } from './siteNotes';

/**
 * Notes for the next visit in the local store, kind `site-notes`. RELAY's own
 * record: nothing here is written to SharePoint or sent anywhere. Rules in
 * `siteNotes.ts`.
 */

const KIND = 'site-notes';
const REQUEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NoteOutcome = { ok: true; value: SiteNote } | { ok: false; status: number; reason: string };

/**
 * Keep one note on a project, attributed to whoever is signed in.
 * `requestId` is the form's own id, so a retry after a lost reply returns the
 * first save rather than leaving the note twice; the same id with different
 * words is refused.
 */
export function leaveNote(input: { projectId: string; text: string; requestId: string }, principal: Principal): NoteOutcome {
  if (!REQUEST.test(input.requestId)) return { ok: false, status: 422, reason: 'Invalid request.' };
  return atomic(() => {
    const id = `note-${input.requestId.toLowerCase()}`;
    const text = input.text.trim();
    const previous = getRecord<SiteNote>(KIND, id);
    if (previous) {
      const same = previous.byId === principal.id && previous.projectId === input.projectId && previous.text === text;
      return same ? { ok: true, value: previous } : { ok: false, status: 409, reason: 'This note was already saved with different words. Reload the page.' };
    }
    const open = records<SiteNote>(KIND, input.projectId).filter(n => !n.done).length;
    const problem = noteProblem(text, open);
    if (problem) return { ok: false, status: 422, reason: problem };
    const byTrade = principal.trade ?? (canManage(principal) ? 'Office' : undefined);
    const note: SiteNote = { id, projectId: input.projectId, text, by: principal.name, byId: principal.id, ...(byTrade ? { byTrade } : {}), at: new Date().toISOString() };
    putRecord(KIND, note);
    return { ok: true, value: note };
  });
}

/**
 * Mark a note done with, or put it back. Anyone on the project can do either:
 * the note is for the site, not its writer. Asking for the state it is
 * already in returns it unchanged, so a double tap or a retry is harmless.
 */
export function markNote(id: string, done: boolean, principal: Principal, now = new Date()): NoteOutcome {
  return atomic(() => {
    const note = getRecord<SiteNote>(KIND, id);
    if (!note) return { ok: false, status: 404, reason: 'No such note.' };
    if (!!note.done === done) return { ok: true, value: note };
    if (!done) {
      const open = records<SiteNote>(KIND, note.projectId).filter(n => !n.done).length;
      const problem = noteProblem(note.text, open);
      if (problem) return { ok: false, status: 422, reason: problem };
    }
    const { done: _was, ...rest } = note;
    const next: SiteNote = done ? { ...rest, done: { by: principal.name, byId: principal.id, at: now.toISOString() } } : rest;
    putRecord(KIND, next);
    return { ok: true, value: next };
  });
}

export function getNote(id: string): SiteNote | undefined { return getRecord<SiteNote>(KIND, id); }

export function notesFor(projectId: string, now = new Date()): ProjectNotes {
  return projectNotes(records<SiteNote>(KIND, projectId), projectId, now);
}
