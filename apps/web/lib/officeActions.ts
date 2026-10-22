import type { Issue, ReportSummary } from './types';
import { byPutForward } from './checkFix';

/**
 * The four things a project manager acts on from the office position: reports
 * that came in since the last working day, reports nobody has acknowledged,
 * issues nobody owns, and closures waiting to be verified. Pure functions, so
 * the office screen stays layout and the rules stay testable.
 */

export const isActiveIssue = (i: Issue): boolean => i.work !== 'closed' && i.confirmation !== 'withdrawn';
export const isUnassigned = (i: Issue): boolean => isActiveIssue(i) && i.owner.trim() === '';
export const isVerify = (i: Issue): boolean => isActiveIssue(i) && i.work === 'awaiting_verification';
/**
 * The office's issue figures, one meaning each wherever they are shown:
 * open is every issue not closed or withdrawn; fixed, to check is put forward
 * as fixed and waiting for someone to check it; overdue is open, past its
 * target date and not put forward as fixed. Fixed, to check is never overdue:
 * the company has done its part and the wait is the office's. `day` is today
 * in the office calendar, as YYYY-MM-DD.
 */
export const isOverdueIssue = (i: Issue, day: string): boolean =>
  isActiveIssue(i) && i.work !== 'awaiting_verification' && /^\d{4}-\d{2}-\d{2}$/.test(i.targetDate) && i.targetDate < day;
export interface IssueFigures { open: number; overdue: number; toCheck: number }
export const issueFigures = (issues: Issue[], day: string): IssueFigures => ({
  open: issues.filter(isActiveIssue).length,
  overdue: issues.filter(i => isOverdueIssue(i, day)).length,
  toCheck: issues.filter(isVerify).length,
});
export const notAcknowledged = (r: ReportSummary): boolean => r.state === 'submitted' && !r.acknowledged;
/** How far back "Not seen yet" looks, in calendar days counting today. */
export const NOT_SEEN_DAYS = 14;
export interface NotSeen {
  /** Received in the last NOT_SEEN_DAYS days and not opened: what the office still has to read. */
  recent: ReportSummary[];
  /** Received before then and never opened. Not counted, so the figure can fall to nought. */
  older: ReportSummary[];
  /** The first day counted as recent, YYYY-MM-DD. */
  from: string;
}
/**
 * Sent reports nobody in the office has opened, split at two weeks back from
 * `day` (London calendar). A report a sent correction replaces is left out:
 * the correction is the one to read. Nothing is marked seen here, so an
 * engineer's "Seen by the office" still means someone opened it.
 */
export function notSeen(reports: ReportSummary[], day: string): NotSeen {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (NOT_SEEN_DAYS - 1));
  const from = d.toISOString().slice(0, 10);
  const replaced = new Set(reports.filter(r => r.state === 'submitted' && r.corrects).map(r => r.corrects));
  const unseen = reports.filter(r => notAcknowledged(r) && !replaced.has(r.id));
  // A sent report always has a received time; one without is kept in view rather than hidden.
  const isRecent = (r: ReportSummary) => !r.serverAcknowledgedAt || londonDay(r.serverAcknowledgedAt) >= from;
  return { recent: unseen.filter(isRecent), older: unseen.filter(r => !isRecent(r)), from };
}
/**
 * Whether this person opening the report marks it seen by the office: a sent
 * report nobody in the office has opened, opened by a Manager or Admin who is
 * not its author. Reading it on the engineer's own page does not count.
 */
export const opensAsSeen = (r: Pick<ReportSummary, 'state' | 'acknowledged' | 'authorId'>, viewer: { id: string; role?: string }): boolean =>
  r.state === 'submitted' && !r.acknowledged && (viewer.role === 'Admin' || viewer.role === 'Manager') && r.authorId !== viewer.id;

/**
 * An issue as the office desk's registers and totals use it: every field, and
 * only its latest event, without its note or photographs. A fix waiting to be
 * checked also keeps its latest "put forward as fixed", so "waiting N days"
 * counts from then and not from a note added since (lib/checkFix.ts). The issue's own page loads its whole history. On a busy
 * register the full histories were most of a 10 MB answer, fetched every
 * 15 seconds.
 */
export const deskIssue = (i: Issue): Issue => {
  const last = i.events.at(-1);
  const put = i.work === 'awaiting_verification' ? [...i.events].reverse().find(e => e.kind === 'closure_submitted') : undefined;
  const kept = put && put !== last ? [put, last!] : last ? [last] : [];
  return { ...i, events: kept.map(e => ({ ...e, note: '', photos: [] })) };
};

const LONDON_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' });
/** The calendar day in the office's time zone, as YYYY-MM-DD. One formatter, made once, as it runs per issue. */
export const londonDay = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'Invalid Date' : LONDON_DAY.format(d); };

/**
 * The working day before `day` (YYYY-MM-DD): Friday for a Saturday, Sunday or
 * Monday, otherwise the day before. Bank holidays are not known here.
 */
export function previousWorkingDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = d.getUTCDay() === 1 ? 3 : d.getUTCDay() === 0 ? 2 : 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** New means received on the previous working day or since, so Monday morning still shows Friday's reports. */
export const isNewReport = (r: ReportSummary, since: string): boolean =>
  r.state === 'submitted' && !!r.serverAcknowledgedAt && londonDay(r.serverAcknowledgedAt) >= since;

const received = (r: ReportSummary): string => r.serverAcknowledgedAt ?? '';

export interface OfficeActions {
  /** First day counted as new, YYYY-MM-DD. */
  since: string;
  /** Newest first. */
  newReports: ReportSummary[];
  /** Not seen yet (`notSeen` recent), newest first, like the Inbox it opens, so today's reports are never behind older ones. */
  notRead: ReportSummary[];
  /** Oldest raised first. */
  unassigned: Issue[];
  /** Longest waiting first. */
  verify: Issue[];
}

export function officeActions(reports: ReportSummary[], issues: Issue[], day: string): OfficeActions {
  const since = previousWorkingDay(day);
  return {
    since,
    newReports: reports.filter(r => isNewReport(r, since)).sort((a, b) => received(b).localeCompare(received(a))),
    notRead: notSeen(reports, day).recent.sort((a, b) => received(b).localeCompare(received(a))),
    unassigned: issues.filter(isUnassigned).sort((a, b) => a.raisedAt.localeCompare(b.raisedAt)),
    verify: issues.filter(isVerify).sort(byPutForward),
  };
}

/** "since yesterday", or "since Friday" when the last working day was further back. */
export function sinceWords(since: string, day: string): string {
  const yesterday = new Date(`${day}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (since === yesterday.toISOString().slice(0, 10)) return 'since yesterday';
  return `since ${new Date(`${since}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}`;
}
