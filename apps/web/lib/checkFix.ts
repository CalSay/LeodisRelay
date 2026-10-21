import type { Issue, Photo } from './types';

/**
 * Checking a fix (walk of 21 Oct 2026). The office decides from the defect as it
 * was raised beside what was sent with the fix, so both are read here, once.
 */

/** Sending a fix back needs a reason: the engineer has to know what is left. The server and the dialog say the same words. */
export const SEND_BACK_REASON = 'Say what is left to do, so the engineer knows why it came back.';

export interface FixEvidence { defect: Photo[]; fix: Photo[]; note: string; by: string; at?: string | undefined }

/** The defect's photos as raised, and the photos and note from the latest time it was put forward as fixed. */
export function fixEvidence(issue: Pick<Issue, 'events' | 'closureSubmittedBy'>): FixEvidence {
  const raised = issue.events.find(e => e.kind === 'raised');
  const put = [...issue.events].reverse().find(e => e.kind === 'closure_submitted');
  return { defect: raised?.photos ?? [], fix: put?.photos ?? [], note: put?.note.trim() ?? '', by: put?.actor ?? issue.closureSubmittedBy ?? 'unknown', at: put?.at };
}
