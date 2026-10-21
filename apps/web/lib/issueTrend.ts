import { naturalOrder } from './naturalOrder';
import type { Issue } from './types';
import { isOverdueIssue } from './officeActions';
import { londonDay, shiftWeek, weekEnd, weekStart } from './weeklySummary';

/**
 * Issues over time: for one project, week by week, how many issues were
 * raised, how many were closed, and how many were still open (and how many of
 * those past their target) at the end of each week. It answers the question
 * asked at every progress meeting, "is the list getting shorter?", which the
 * registers only answer for today.
 *
 * It only reads the issue register and changes nothing. History is rebuilt
 * from what each issue holds now: when it was raised and, if it is closed, the
 * day of its last office check. So an issue closed, reopened and still open
 * counts as open throughout, and a withdrawn issue (recorded in error) is left
 * out of every week. Weeks run Monday to Sunday in the office calendar.
 */

export const TREND_WEEKS = 12;
/** How far back "four weeks ago" looks for the headline. */
export const COMPARE_WEEKS = 4;

export interface TrendWeek {
  /** The Monday that starts the week, YYYY-MM-DD. */
  monday: string;
  raised: number;
  closed: number;
  /** Still open at the end of the week (or today, for the week in progress). */
  open: number;
  /** Of those, past their target date on that day. */
  late: number;
}

export type TrendDirection = 'fewer' | 'more' | 'same';

export interface IssueTrend {
  projectId: string;
  today: string;
  weeks: TrendWeek[];
  openNow: number;
  lateNow: number;
  /** Open at the end of the week four weeks before this one. */
  openBefore: number;
  direction: TrendDirection;
  /** Raised and closed over the last four weeks, this one included. */
  recent: { raised: number; closed: number };
  /** Middle number of days from raised to closed, for issues closed in the weeks shown; absent when none were. */
  medianDaysToClose?: number;
  closedInRange: number;
  /** The open issue raised longest ago. */
  oldest?: { id: string; reference: string; raisedOn: string; days: number };
  /** Closed with no record of the day, so left out of the weekly closed counts (still not counted as open). */
  closedUndated: number;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** The day the issue was last closed by an office check, or '' when it is not closed or the day is not recorded. */
function closedOn(issue: Issue): string {
  if (issue.work !== 'closed') return '';
  const verified = issue.events.filter(e => e.kind === 'verified').at(-1);
  return verified ? londonDay(verified.at) : '';
}

/**
 * The days an issue's history turns on, worked out once: reading the London day
 * of every date again for each week made Issues over time four times slower on
 * a busy project.
 */
export interface IssueDays {
  raised: string;
  closed: string;
  /** Its fixes, send-backs and checks, oldest first, each with its day. */
  marks: { day: string; kind: string }[];
}
export function issueDays(issue: Issue): IssueDays {
  return {
    raised: londonDay(issue.raisedAt),
    closed: closedOn(issue),
    marks: issue.events.filter(e => e.kind === 'closure_submitted' || e.kind === 'reopened' || e.kind === 'verified').map(e => ({ day: londonDay(e.at), kind: e.kind })),
  };
}

/** Put forward as fixed at the end of `day`: its latest fix, send-back or check by then was a fix. */
function putForwardOn(issue: Issue, day: string, days: IssueDays): boolean {
  if (issue.work === 'awaiting_verification' && !issue.events.some(e => e.kind === 'closure_submitted')) return true; // no history: as it stands now
  const last = days.marks.filter(m => m.day <= day).at(-1);
  return last?.kind === 'closure_submitted';
}

/**
 * Open at the end of `day`: raised by then, not withdrawn, and not closed by
 * then. A closure with no recorded day is never open. On today this is the
 * register's open (lib/officeActions.ts `isActiveIssue`).
 */
export function isOpenOn(issue: Issue, day: string, days: IssueDays = issueDays(issue)): boolean {
  if (issue.confirmation === 'withdrawn') return false;
  if (!days.raised || days.raised > day) return false;
  if (issue.work !== 'closed') return true;
  return Boolean(days.closed) && days.closed > day;
}

/**
 * Past target at the end of `day`, as the office counts it (lib/officeActions.ts
 * `isOverdueIssue`): open, past its target date, and not put forward as fixed
 * by then (or sent back or checked since). On today it is the register's rule
 * itself, so the figure always matches the project sheet.
 */
export function isLateOn(issue: Issue, day: string, today: string, days: IssueDays = issueDays(issue)): boolean {
  if (day === today) return isOverdueIssue(issue, today);
  if (!isOpenOn(issue, day, days)) return false;
  return isDay(issue.targetDate) && issue.targetDate < day && !putForwardOn(issue, day, days);
}

/** Open and put forward as fixed at the end of `day`, waiting for the office to check it: "fixed, to check" on that day. */
export function isToCheckOn(issue: Issue, day: string, today: string, days: IssueDays = issueDays(issue)): boolean {
  return isOpenOn(issue, day, days) && (day === today ? issue.work === 'awaiting_verification' : putForwardOn(issue, day, days));
}

/** `today` is YYYY-MM-DD in the office calendar. Issues from other projects are ignored. */
export function issueTrend(issues: Issue[], projectId: string, today: string): IssueTrend {
  const thisWeek = weekStart(today, today);
  const mondays = Array.from({ length: TREND_WEEKS }, (_, k) => shiftWeek(thisWeek, k - (TREND_WEEKS - 1)));
  const first = mondays[0]!;
  const rows = issues
    .filter(i => i.projectId === projectId && i.confirmation !== 'withdrawn')
    .map(i => { const days = issueDays(i); return { issue: i, days, raised: days.raised, closed: days.closed, undated: i.work === 'closed' && !days.closed }; })
    .filter(r => r.raised);

  // The same rules the monthly summary reads its month-end figures with.
  const openOn = (day: string) => rows.filter(r => isOpenOn(r.issue, day, r.days));
  const lateOn = (day: string) => rows.filter(r => isLateOn(r.issue, day, today, r.days)).length;

  const weeks: TrendWeek[] = mondays.map(monday => {
    const end = monday === thisWeek ? today : weekEnd(monday);
    const inWeek = (day: string) => day >= monday && day <= end;
    return {
      monday,
      raised: rows.filter(r => inWeek(r.raised)).length,
      closed: rows.filter(r => r.closed && inWeek(r.closed)).length,
      open: openOn(end).length,
      late: lateOn(end),
    };
  });

  const now = weeks.at(-1)!;
  const before = weeks.at(-1 - COMPARE_WEEKS)!;
  const recentWeeks = weeks.slice(-COMPARE_WEEKS);
  const closedRows = rows.filter(r => r.closed && r.closed >= first && r.closed <= today);
  const durations = closedRows.map(r => Math.max(0, daysBetween(r.raised, r.closed))).sort((a, b) => a - b);
  const mid = durations.length >> 1;
  const median = durations.length ? (durations.length % 2 ? durations[mid]! : Math.round((durations[mid - 1]! + durations[mid]!) / 2)) : undefined;
  const oldest = openOn(today).sort((a, b) => a.raised.localeCompare(b.raised) || naturalOrder(a.issue.reference, b.issue.reference))[0];

  return {
    projectId,
    today,
    weeks,
    openNow: now.open,
    lateNow: now.late,
    openBefore: before.open,
    direction: now.open < before.open ? 'fewer' : now.open > before.open ? 'more' : 'same',
    recent: { raised: recentWeeks.reduce((n, w) => n + w.raised, 0), closed: recentWeeks.reduce((n, w) => n + w.closed, 0) },
    ...(median === undefined ? {} : { medianDaysToClose: median }),
    closedInRange: closedRows.length,
    ...(oldest ? { oldest: { id: oldest.issue.id, reference: oldest.issue.reference, raisedOn: oldest.raised, days: daysBetween(oldest.raised, today) } } : {}),
    closedUndated: rows.filter(r => r.undated).length,
  };
}
