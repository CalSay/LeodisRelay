import type { SiteNote } from './siteNotes';

/**
 * Notes for the next visit, kept on the phone so they can be read with no
 * signal (a basement, a riser, a plant room). The app leaves a copy of the
 * open notes on each project the engineer reports on while it has signal;
 * the offline page (public/offline.js) shows it when the server cannot be
 * reached (the service worker serves that page for /engineer, /site-notes
 * and any other address), with when each project's copy was taken.
 *
 * Read only: a note cannot be left or marked done with on the copy. The copy
 * holds the words, who left each note and when, nothing else (no ids of
 * people). It is personal to whoever is signed in, so signing out removes it
 * (PwaRegistration.tsx), as it does the offline person and projects
 * (offlineStart.ts). Notes are never sent anywhere from here.
 */

/** The device copy for one person. Must match the key read in public/offline.js. */
export const offlineNotesKey = (principalId: string) => `relay-offline-notes:${principalId}`;

export interface OfflineNote { id: string; text: string; by: string; byTrade?: string; at: string }
export interface OfflineProjectNotes { projectId: string; projectNumber: string; projectName: string; savedAt: string; open: OfflineNote[] }
export interface OfflineNotes { projects: OfflineProjectNotes[] }

/** Only what a reader needs from a note. */
export const offlineNote = (n: Pick<SiteNote, 'id' | 'text' | 'by' | 'byTrade' | 'at'>): OfflineNote =>
  ({ id: n.id, text: n.text, by: n.by, ...(n.byTrade ? { byTrade: n.byTrade } : {}), at: n.at });

const isText = (v: unknown): v is string => typeof v === 'string';
const validNote = (n: unknown): n is OfflineNote => {
  const x = n as Partial<OfflineNote> | null;
  return !!x && isText(x.id) && isText(x.text) && isText(x.by) && isText(x.at) && (x.byTrade === undefined || isText(x.byTrade));
};

/** The device copy, if it is there and makes sense; a damaged copy reads as none. */
export function readOfflineNotes(raw: string | null): OfflineNotes | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const projects = (parsed as Partial<OfflineNotes> | null)?.projects;
  if (!Array.isArray(projects)) return null;
  return {
    projects: projects.filter((p): p is OfflineProjectNotes => !!p && isText(p.projectId) && isText(p.projectNumber) && isText(p.projectName)
      && isText(p.savedAt) && !Number.isNaN(Date.parse(p.savedAt)) && Array.isArray(p.open) && p.open.every(validNote)),
  };
}

/**
 * Put one project's open notes into the copy, as just read from the server.
 * Only a project already in the copy is changed: which projects are kept is
 * decided by the engineer home (the projects they report on), so the office
 * opening notes on many projects leaves nothing extra on their device.
 */
export function withProjectNotes(copy: OfflineNotes | null, projectId: string, open: readonly SiteNote[], savedAt: string): OfflineNotes | null {
  if (!copy || !copy.projects.some(p => p.projectId === projectId)) return copy;
  return { projects: copy.projects.map(p => p.projectId === projectId ? { ...p, savedAt, open: open.map(offlineNote) } : p) };
}

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Whole copy from the server (`/api/site-notes/mine`). A failed read leaves the old copy, which says how old it is. */
export async function keepNotesOnDevice(principalId: string): Promise<void> {
  const store = storage();
  if (!store) return;
  try {
    const response = await fetch('/api/site-notes/mine', { cache: 'no-store' });
    if (!response.ok) return;
    const copy = readOfflineNotes(await response.text());
    if (copy) store.setItem(offlineNotesKey(principalId), JSON.stringify(copy));
  } catch {}
}

/** Refresh one project in the copy after the notes page has read or changed it. */
export function keepProjectNotesOnDevice(principalId: string, projectId: string, open: readonly SiteNote[]): void {
  const store = storage();
  if (!store) return;
  try {
    const next = withProjectNotes(readOfflineNotes(store.getItem(offlineNotesKey(principalId))), projectId, open, new Date().toISOString());
    if (next) store.setItem(offlineNotesKey(principalId), JSON.stringify(next));
  } catch {}
}
