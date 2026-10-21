import type { Issue, ReportSummary } from './types';

/**
 * The four things a project manager acts on from the office position: reports
 * that came in since the last working day, reports nobody has acknowledged,
 * issues nobody owns, and closures waiting to be verified. Pure functions, so
 * the office screen stays layout and the rules stay testable.
 */

export const isActiveIssue = (i: Issue): boolean => i.work !== 'closed' && i.confirmation !== 'withdrawn';
export const isUnassigned = (i: Issue): boolean => isActiveIssue(i) && i.owner.trim() === '';
export const isVerify = (i: Issue): boolean => isActiveIssue(i) && i.work === 'awaiting_verification';
export const notAcknowledged = (r: ReportSummary): boolean => r.state === 'submitted' && !r.acknowledged;
/**
 * Whether this person opening the report marks it seen by the office: a sent
 * report nobody in the office has opened, opened by a Manager or Admin who is
 * not its author. Reading it on the engineer's own page does not count.
 */
export const opensAsSeen = (r: Pick<ReportSummary, 'state' | 'acknowledged' | 'authorId'>, viewer: { id: string; role?: string }): boolean =>
  r.state === 'submitted' && !r.acknowledged && (viewer.role === 'Admin' || viewer.role === 'Manager') && r.authorId !== viewer.id;

/**
 * An issue as the office desk's registers and totals use it: every field, and
 * only its latest event (for "waiting N days"), without its note or
 * photographs. The issue's own page loads its whole history. On a busy
 * register the full histories were most of a 10 MB answer, fetched every
 * 15 seconds.
 */
export const deskIssue = (i: Issue): Issue => {
  const last = i.events.at(-1);
  return { ...i, events: last ? [{ ...last, note: '', photos: [] }] : [] };
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
const lastEvent = (i: Issue): string => i.events.at(-1)?.at ?? i.raisedAt;

export interface OfficeActions {
  /** First day counted as new, YYYY-MM-DD. */
  since: string;
  /** Newest first. */
  newReports: ReportSummary[];
  /** Oldest first: the longest wait comes first. */
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
    notRead: reports.filter(notAcknowledged).sort((a, b) => received(a).localeCompare(received(b))),
    unassigned: issues.filter(isUnassigned).sort((a, b) => a.raisedAt.localeCompare(b.raisedAt)),
    verify: issues.filter(isVerify).sort((a, b) => lastEvent(a).localeCompare(lastEvent(b))),
  };
}

/** "since yesterday", or "since Friday" when the last working day was further back. */
export function sinceWords(since: string, day: string): string {
  const yesterday = new Date(`${day}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (since === yesterday.toISOString().slice(0, 10)) return 'since yesterday';
  return `since ${new Date(`${since}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}`;
}
