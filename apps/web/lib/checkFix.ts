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

const LONDON_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Calendar days (London) since a fix was put forward, up to `today`
 * (YYYY-MM-DD): one put forward yesterday evening has waited 1 day this
 * morning, not 0. Every office screen that says how long a fix has waited
 * counts with this, so they agree with the date "put forward" gives.
 */
export function daysWaiting(issue: Pick<Issue, 'events' | 'raisedAt'>, today: string): number {
  const at = new Date(putForwardAt(issue));
  if (Number.isNaN(at.getTime())) return 0;
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${LONDON_DAY.format(at)}T12:00:00Z`)) / 86400000);
  return Number.isNaN(days) ? 0 : Math.max(0, days);
}

/** "waiting 3 days", "waiting 1 day", or "waiting since today". */
export function waitingWords(issue: Pick<Issue, 'events' | 'raisedAt'>, today: string): string {
  const n = daysWaiting(issue, today);
  return n === 0 ? 'waiting since today' : `waiting ${n} day${n === 1 ? '' : 's'}`;
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

export interface SentBack { by: string; at: string; note: string; times: number }

/**
 * When the fix now waiting was sent back as not finished before (walk of 22 Oct
 * 2026): who sent it back last, when, with what reason, and how many times since
 * it was last verified. The office checks the new attempt against what it asked
 * for, and whoever checks it may not be who sent it back. Undefined for a first
 * attempt, or for a reopened issue's first attempt after a verified close.
 */
export function sentBackBefore(issue: Pick<Issue, 'events'>): SentBack | undefined {
  let put = -1;
  for (let n = issue.events.length - 1; n >= 0; n--) if (issue.events[n]!.kind === 'closure_submitted') { put = n; break; }
  let last: SentBack | undefined;
  let times = 0;
  // Only a reopen of a fix put forward counts: one after a verified close sends the issue back to open, not a fix back.
  let after: 'closure_submitted' | 'verified' | undefined;
  for (const e of issue.events.slice(0, put)) {
    if (e.kind === 'verified') { after = 'verified'; last = undefined; times = 0; }
    else if (e.kind === 'closure_submitted') after = 'closure_submitted';
    else if (e.kind === 'reopened' && after === 'closure_submitted') { times++; last = { by: e.actor, at: e.at, note: e.note.trim(), times: 0 }; after = undefined; }
  }
  return last && { ...last, times };
}

/** "put forward again" (or "put forward 3 times") for a fix sent back before; empty for a first attempt. */
export function againWords(issue: Pick<Issue, 'events'>): string {
  const back = sentBackBefore(issue);
  return !back ? '' : back.times === 1 ? 'put forward again' : `put forward ${back.times + 1} times`;
}
