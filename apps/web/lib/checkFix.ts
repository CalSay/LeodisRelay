import type { Issue, Photo } from './types';

/**
 * Checking a fix (walk of 21 Oct 2026). The office decides from the defect as it
 * was raised beside what was sent with the fix, so both are read here, once.
 */

/** Sending a fix back needs a reason: the engineer has to know what is left. The server and the dialog say the same words. */
export const SEND_BACK_REASON = 'Say what is left to do, so the engineer knows why it came back.';

export interface FixEvidence { defect: Photo[]; fix: Photo[]; note: string; by: string; at?: string | undefined }

/**
 * When a fix waiting to be checked was put forward: its latest "put forward as
 * fixed". A note added afterwards does not restart the wait. A record with no
 * such event (put forward before RELAY kept history) falls back to its latest
 * event, then to when it was raised.
 */
export function putForwardAt(issue: Pick<Issue, 'events' | 'raisedAt'>): string {
  for (let n = issue.events.length - 1; n >= 0; n--) if (issue.events[n]!.kind === 'closure_submitted') return issue.events[n]!.at;
  return issue.events.at(-1)?.at ?? issue.raisedAt;
}

/** Longest waiting first: the order the office checks fixes in. Reference breaks a tie, so lists never jump. */
export const byPutForward = (a: Pick<Issue, 'events' | 'raisedAt' | 'reference'>, b: Pick<Issue, 'events' | 'raisedAt' | 'reference'>): number =>
  putForwardAt(a).localeCompare(putForwardAt(b)) || a.reference.localeCompare(b.reference);

/** The defect's photos as raised, and the photos and note from the latest time it was put forward as fixed. */
export function fixEvidence(issue: Pick<Issue, 'events' | 'closureSubmittedBy'>): FixEvidence {
  const raised = issue.events.find(e => e.kind === 'raised');
  const put = [...issue.events].reverse().find(e => e.kind === 'closure_submitted');
  return { defect: raised?.photos ?? [], fix: put?.photos ?? [], note: put?.note.trim() ?? '', by: put?.actor ?? issue.closureSubmittedBy ?? 'unknown', at: put?.at };
}
