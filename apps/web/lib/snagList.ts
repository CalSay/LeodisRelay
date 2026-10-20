import type { Issue } from './types';

/**
 * A snag list: the open issues on one project that someone has to put right,
 * laid out to hand over or walk the site with.
 *
 * Locations are free text (EXP-4), so rows are grouped by the location as it
 * was written, ignoring only case and spacing. Nothing is matched against a
 * catalogue, and an issue with no location is listed last rather than guessed.
 */

export interface SnagScope { projectId: string; owner?: string | undefined; trade?: string | undefined }
export interface SnagRow { issue: Issue; overdue: boolean; fixed: boolean }
export interface SnagGroup { location: string; rows: SnagRow[] }
export interface SnagList { groups: SnagGroup[]; total: number; overdue: number; fixed: number }

export const NO_LOCATION = 'No location recorded';
const isLive = (i: Issue) => i.work !== 'closed' && i.confirmation !== 'withdrawn';
/** The trade an issue belongs to, as the office register reads it: the affected trade, else the reporter's. */
export const issueTrade = (i: Issue) => i.affectedTrade ?? i.reporterTrade;
const key = (location: string) => location.trim().replace(/\s+/g, ' ').toLowerCase();

/** Companies and people named as owners on the project's open issues, for the picker. */
export function snagOwners(issues: Issue[], projectId: string): string[] {
  return [...new Set(issues.filter(i => i.projectId === projectId && isLive(i)).map(i => i.owner.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** `day` is today as YYYY-MM-DD in the office calendar, so target dates compare as strings. */
export function snagList(issues: Issue[], scope: SnagScope, day: string): SnagList {
  const owner = scope.owner?.trim();
  const picked = issues.filter(i => i.projectId === scope.projectId && isLive(i)
    && (!owner || i.owner.trim() === owner)
    && (!scope.trade || issueTrade(i) === scope.trade));
  const groups = new Map<string, SnagGroup>();
  // A location is labelled as the earliest issue there wrote it, so the heading does not change with load order.
  const byAge = [...picked].sort((a, b) => a.raisedAt.localeCompare(b.raisedAt) || a.reference.localeCompare(b.reference, 'en', { numeric: true }));
  for (const issue of byAge) {
    const k = key(issue.location);
    const group = groups.get(k) ?? { location: issue.location.trim().replace(/\s+/g, ' ') || NO_LOCATION, rows: [] };
    group.rows.push({ issue, overdue: /^\d{4}-\d{2}-\d{2}$/.test(issue.targetDate) && issue.targetDate < day, fixed: issue.work === 'awaiting_verification' });
    groups.set(k, group);
  }
  // Within a location: still to do before fixed, earliest target first, then by reference.
  const order = (a: SnagRow, b: SnagRow) => Number(a.fixed) - Number(b.fixed)
    || (a.issue.targetDate || '9999').localeCompare(b.issue.targetDate || '9999')
    || a.issue.reference.localeCompare(b.issue.reference, 'en', { numeric: true });
  const sorted = [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0) || a.localeCompare(b, 'en', { numeric: true }))
    .map(([, g]) => ({ ...g, rows: g.rows.sort(order) }));
  const rows = sorted.flatMap(g => g.rows);
  return { groups: sorted, total: rows.length, overdue: rows.filter(r => r.overdue).length, fixed: rows.filter(r => r.fixed).length };
}

/** The first photograph taken when the issue was raised, if any. */
export const raisedPhoto = (i: Issue) => i.events.find(e => e.kind === 'raised')?.photos[0] ?? i.events[0]?.photos[0];
