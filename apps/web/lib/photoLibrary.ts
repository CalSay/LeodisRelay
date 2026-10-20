import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import { londonDay } from './weeklySummary';
import type { Issue, IssueEvent, Photo, Report, Variation } from './types';

/**
 * Every photograph taken on a project, newest first, in one place. Made for
 * the questions a site and an office ask every week: what did that ceiling
 * look like before it was boarded, has the riser been tidied, show the client
 * the plant room. Today the answer means opening reports one by one.
 *
 * It only reads what is already recorded: cards on sent reports (never
 * drafts), and the photographs added to issues and variations afterwards.
 * Nothing is captured, moved or edited here, so FE-2 (camera, zoom,
 * reordering, annotation) stays out of scope.
 */

/**
 * What a photograph shows, as the page groups it. `defect` covers defect and
 * access cards and issues raised on their own; `fix` is the evidence added to
 * an issue after it was raised (progress, put forward as fixed, checked).
 */
export type PhotoGroup = 'progress' | 'defect' | 'variation' | 'fix';
export const PHOTO_GROUPS: { value: PhotoGroup; label: string }[] = [
  { value: 'progress', label: 'Progress' },
  { value: 'defect', label: 'Defects and access' },
  { value: 'variation', label: 'Variations' },
  { value: 'fix', label: 'Fixes and checks' },
];

export interface LibraryPhoto {
  /** The media address, also the key: a photograph copied onto an issue is still one photograph. */
  src: string;
  caption: string;
  /** The visit day for a report, the day of the change for an issue or variation, in UK time. */
  day: string;
  /** For ordering within a day; the photograph's own time where there is one. */
  at: string;
  group: PhotoGroup;
  /** Short plain words for what the photograph was attached to, such as "Defect" or "Put forward as fixed". */
  label: string;
  location: string;
  description: string;
  by: string;
  /** The trade of whoever sent the report; left off issue and variation evidence, where it would be the issue's trade, not the person's. */
  trade?: string;
  source: { kind: 'report' | 'issue' | 'variation'; id: string; reference: string };
}

export interface PhotoLibrary {
  projectId: string;
  photos: LibraryPhoto[];
}

const CARD: Record<string, [PhotoGroup, string]> = {
  update: ['progress', 'Progress'], defect: ['defect', 'Defect'], access: ['defect', 'Access problem'], instruction: ['variation', 'Variation required'],
};
const ISSUE_EVENT: Partial<Record<IssueEvent['kind'], [PhotoGroup, string]>> = {
  raised: ['defect', 'Issue raised'], progress: ['fix', 'Progress on issue'], closure_submitted: ['fix', 'Put forward as fixed'],
  verified: ['fix', 'Checked and closed'], reopened: ['fix', 'Reopened'],
};
const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');

export interface LibrarySources { reports: Report[]; issues: Issue[]; variations: Variation[] }

export function photoLibrary(sources: LibrarySources, principal: Principal, projectId: string): PhotoLibrary {
  const seen = new Set<string>();
  const photos: LibraryPhoto[] = [];
  const add = (p: Photo, entry: Omit<LibraryPhoto, 'src' | 'caption' | 'at'> & { at: string }) => {
    if (!p.dataUrl || seen.has(p.dataUrl)) return;
    seen.add(p.dataUrl);
    photos.push({ ...entry, src: p.dataUrl, caption: tidy(p.caption ?? ''), at: p.capturedAt || entry.at });
  };

  // Sent reports the person may read. A correction that has also been sent
  // replaces the report it corrects, so its photographs link to the latest
  // revision; any the correction dropped still show from the original.
  const sent = sources.reports.filter(r => r.projectId === projectId && r.state === 'submitted' && canReadReport(principal, r));
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const ordered = [...sent.filter(r => !superseded.has(r.id)), ...sent.filter(r => superseded.has(r.id)).sort((a, b) => b.revision - a.revision)];
  for (const r of ordered) for (const o of r.observations) {
    const [group, label] = CARD[o.type] ?? ['progress', 'Progress'];
    for (const p of o.photos) add(p, { day: r.visitDate, at: r.serverAcknowledgedAt ?? r.visitDate, group, label, location: tidy(o.location), description: tidy(o.whatHappened),
      by: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}), source: { kind: 'report', id: r.id, reference: r.reference } });
  }

  // Issues withdrawn as raised in error are left out; their report cards still show.
  for (const i of sources.issues) {
    if (i.projectId !== projectId || i.confirmation === 'withdrawn') continue;
    for (const e of i.events) {
      const [group, label] = ISSUE_EVENT[e.kind] ?? ['fix', 'Issue update'];
      for (const p of e.photos) add(p, { day: londonDay(e.at), at: e.at, group, label, location: tidy(i.location), description: tidy(e.note) || tidy(i.description),
        by: e.actor, source: { kind: 'issue', id: i.id, reference: i.reference } });
    }
  }

  for (const v of sources.variations) {
    if (v.projectId !== projectId) continue;
    for (const e of v.events) for (const p of e.photos) add(p, { day: londonDay(e.at), at: e.at, group: 'variation', label: e.kind === 'raised' ? 'Variation raised' : 'Variation note',
      location: tidy(v.location), description: tidy(v.description), by: e.actor, source: { kind: 'variation', id: v.id, reference: v.reference } });
  }

  photos.sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at) || a.source.reference.localeCompare(b.source.reference, 'en', { numeric: true }));
  return { projectId, photos };
}

/** Words typed in the find box, all of which must appear somewhere on the photograph, ignoring case and spacing. */
export function matchesPhoto(p: LibraryPhoto, words: string, group: PhotoGroup | ''): boolean {
  if (group && p.group !== group) return false;
  const terms = words.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = [p.location, p.description, p.caption, p.label, p.by, p.trade ?? '', p.source.reference].join(' ').toLowerCase().replace(/\s+/g, ' ');
  return terms.every(t => hay.includes(t));
}
