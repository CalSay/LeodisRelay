/**
 * Notes for the next visit: a short note anyone on a project leaves for
 * whoever is on site next ("Riser 3 key is with the site manager", "Ceiling
 * grid on level 2 goes up Tuesday, finish first fix there first"). It is the
 * word passed between engineers and the office between visits, which today
 * goes by phone or not at all when someone covers a site they do not know.
 *
 * A note is not part of any report: it is never sent, never on a PDF, raises
 * no issue and asks nobody to decide anything. It stays on the project until
 * someone marks it done with, and a note marked done with is kept, shown for
 * a fortnight and can be put back. Nothing is ever removed.
 */

export const NOTE_MAX = 500;
/** More than this and nobody reads them; the form asks for some to be marked done first. */
export const OPEN_MAX = 20;
/** How long a note marked done with stays on the page, to put back a slip. */
export const DONE_DAYS = 14;

export interface SiteNoteDone { by: string; byId: string; at: string }
export interface SiteNote {
  id: string;
  projectId: string;
  text: string;
  by: string;
  byId: string;
  /** The writer's trade when they are an engineer, so a reader knows who to ask. */
  byTrade?: string;
  at: string;
  done?: SiteNoteDone;
}
export interface ProjectNotes { projectId: string; open: SiteNote[]; done: SiteNote[] }

/** Why this note cannot be kept, in words for the form, or nothing if it can. */
export function noteProblem(text: string, openCount: number): string | undefined {
  const t = text.trim();
  if (!t) return 'Write the note first.';
  if (t.length > NOTE_MAX) return `Keep the note to ${NOTE_MAX} characters.`;
  if (openCount >= OPEN_MAX) return `This project already has ${OPEN_MAX} notes. Mark some done with first.`;
  return undefined;
}

/** Newest first; two notes in the same millisecond fall in a fixed (id) order. */
const newestFirst = (a: SiteNote, b: SiteNote) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id);

/** One project's notes: open newest first, and those marked done with in the last `DONE_DAYS`, most recently done first. */
export function projectNotes(notes: readonly SiteNote[], projectId: string, now: Date): ProjectNotes {
  const mine = notes.filter(n => n.projectId === projectId);
  const since = now.getTime() - DONE_DAYS * 86400000;
  return {
    projectId,
    open: mine.filter(n => !n.done).sort(newestFirst),
    done: mine.filter(n => n.done && Date.parse(n.done.at) >= since)
      .sort((a, b) => b.done!.at.localeCompare(a.done!.at) || b.id.localeCompare(a.id)),
  };
}
