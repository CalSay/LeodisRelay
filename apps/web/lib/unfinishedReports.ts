import type { Observation, Report, ReportSummary } from './types';
import type { SignedOffline, StartedOffline } from './offlineStart';
import { reportTypeOf } from './reportTypes';

/** What the home screen needs from a copy held on this device (see localDraft.ts). */
export interface HeldCopy { reportId: string; heldAt: string; observations: Observation[]; report?: Report; started?: StartedOffline; problem?: string; signed?: SignedOffline }

export interface UnfinishedReport {
  id: string;
  projectId: string;
  projectName: string;
  reference: string;
  visitDate: string;
  cards: number;
  correction: boolean;
  /** "Site update" or "Safety inspection": what to call it on the home screen. */
  typeName: string;
  /** An inspection, whose cards are its checks. */
  checklist: boolean;
  /** When the server last accepted a save, if it has this report at all. */
  savedAt?: string | undefined;
  /** When this device last took a copy the server has not acknowledged. */
  changedAt?: string;
  /** `unsent`: edits on this device are newer than the server copy. `only`: the server could not be asked. */
  device?: 'unsent' | 'only';
  /** Started on this phone with no connection and not yet on the server: it has no reference, and opens on the offline page. */
  started?: boolean;
  /** Why the server refused it, if it did. */
  problem?: string | undefined;
  /** Signed on the offline page and waiting to go to the office by itself. */
  signed?: boolean;
}

/**
 * Every unsent report the engineer has started, across all their projects,
 * newest change first.
 *
 * Server drafts come first-hand from the server. A device copy of one of them
 * means edits are waiting to go up. A device copy the server did not list is
 * included only when the caller passes it as `deviceOnly`: the home screen
 * asks the server about each one and keeps it only when the server could not
 * answer, because a copy of a report since sent from another device is stale.
 */
const kind = (r: Pick<Report, 'reportType'>) => { const type = reportTypeOf(r); return { typeName: type.name, checklist: Boolean(type.checklist) }; };

export function unfinishedReports(
  drafts: ReportSummary[],
  held: HeldCopy[],
  projects: { id: string; projectName: string }[],
  deviceOnly: ReadonlySet<string> = new Set(),
): UnfinishedReport[] {
  const name = new Map(projects.map(p => [p.id, p.projectName]));
  const copies = new Map(held.map(h => [h.reportId, h]));
  const rows: UnfinishedReport[] = [];
  for (const d of drafts) {
    if (d.state !== 'draft' || !name.has(d.projectId)) continue;
    const copy = copies.get(d.id);
    rows.push({ id:d.id, projectId:d.projectId, projectName:name.get(d.projectId)!, reference:d.reference, visitDate:d.visitDate,
      cards:copy ? copy.observations.length : d.observationCount, correction:!!d.corrects, savedAt:d.lastSavedAt, ...kind(d),
      ...(copy ? { changedAt:copy.heldAt, device:'unsent' as const, ...(copy.signed ? { signed:true } : {}) } : {}) });
  }
  for (const h of held) {
    const r = h.report;
    if (!r || !deviceOnly.has(h.reportId) || rows.some(row => row.id === h.reportId) || r.state !== 'draft' || !name.has(r.projectId)) continue;
    rows.push({ id:r.id, projectId:r.projectId, projectName:name.get(r.projectId)!, reference:r.reference, visitDate:r.visitDate,
      cards:h.observations.length, correction:!!r.corrects, savedAt:r.lastSavedAt, changedAt:h.heldAt, device:'only', ...kind(r), ...(h.signed ? { signed:true } : {}) });
  }
  // Started offline and not yet started on the server (it goes up by itself
  // when RELAY opens with signal, so this shows only while that is pending or refused).
  for (const h of held) {
    const s = h.started;
    if (!s || !name.has(s.projectId)) continue;
    rows.push({ id:h.reportId, projectId:s.projectId, projectName:name.get(s.projectId)!, reference:'', visitDate:s.visitDate,
      cards:h.observations.length, correction:false, ...kind(s), changedAt:h.heldAt, device:'only', started:true, problem:h.problem, ...(h.signed ? { signed:true } : {}) });
  }
  const latest = (r: UnfinishedReport) => [r.changedAt ?? '', r.savedAt ?? ''].sort().at(-1)!;
  return rows.sort((a, b) => latest(b).localeCompare(latest(a)) || a.id.localeCompare(b.id));
}
