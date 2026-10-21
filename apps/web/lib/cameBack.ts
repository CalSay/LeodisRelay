import type { Issue, Variation } from './types';

/**
 * What the engineer home needs for "Came back from the office": the latest
 * issues and variations the engineer raised on a project, and how many of the
 * project's issues are open. Worked out on the server, so a phone fetches a
 * dozen records rather than every issue and variation on a busy project.
 *
 * The home merges these with the engineer's own sent reports, newest first,
 * and shows the first `CAME_BACK_ROWS`. Each list here is cut to that many in
 * the same order, so the merged rows are the ones the full lists would give.
 */
export const CAME_BACK_ROWS = 6;

export interface CameBack { issues: Issue[]; variations: Variation[]; open: number }

/** The engineer reported it, or raised it from a report. */
export const raisedIssue = (i: Issue, principalId: string): boolean => i.reportedById === principalId || i.events[0]?.actorId === principalId;
export const isOpenIssue = (i: Issue): boolean => i.work !== 'closed' && i.confirmation !== 'withdrawn';

/** Newest last change first; a stable sort, so records changed at the same moment keep their order. */
const latest = <T extends { raisedAt: string; events: { at: string }[] }>(rows: T[]): T[] =>
  rows.map(row => ({ row, at: row.events.at(-1)?.at ?? row.raisedAt })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, CAME_BACK_ROWS).map(x => x.row);

export function cameBack(issues: readonly Issue[], variations: readonly Variation[], principalId: string): CameBack {
  return {
    issues: latest(issues.filter(i => raisedIssue(i, principalId))),
    variations: latest(variations.filter(v => v.raisedById === principalId)),
    open: issues.filter(isOpenIssue).length,
  };
}
