import { naturalOrder } from './naturalOrder';
import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import { ACTIVE_PROJECT_STATUS } from './projectGroups';
import type { Report } from './types';
import { weekStart } from './weeklySummary';

/**
 * Site coverage: for every reportable project, which days somebody sent a
 * report from site over a fortnight, and how long an active site has gone
 * without one. Made for the project manager's question "is anyone covering
 * Aire Court this week?", which today means opening each project in turn.
 *
 * It reads sent reports only (never drafts), placed on the visit day the
 * engineer gave. A sent correction stands in for the report it corrects, so a
 * visit is counted once. Nothing is stored and nothing is expected of
 * engineers: there is no rota and no rule that a site must report daily. The
 * "quiet" flag is a prompt to look, not a breach.
 */

export const QUIET_WORKING_DAYS = 3;
export const COVERAGE_DAYS = 14;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (ymd: string) => (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
export const isWeekend = (ymd: string) => weekday(ymd) >= 5;

const realDay = (ymd: string | undefined): ymd is string => !!ymd && DAY.test(ymd) && !Number.isNaN(Date.parse(`${ymd}T12:00:00Z`)) && addDays(ymd, 0) === ymd;
/**
 * The Monday a fortnight starts on. A chosen day starts the fortnight on its
 * own week; with none (or not a real date) it is last week and this week, so
 * the page opens on the days up to today.
 */
export function fortnightStart(ymd: string | undefined, today: string): string {
  return realDay(ymd) ? weekStart(ymd, today) : addDays(weekStart(undefined, today), -7);
}
export const fortnightEnd = (monday: string) => addDays(monday, COVERAGE_DAYS - 1);
export const shiftFortnight = (monday: string, n: number) => addDays(monday, COVERAGE_DAYS * n);

/** Weekdays after `from` and before `to`, both left out: the full working days with no report. Bank holidays are not known, so they count. */
export function workingDaysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) if (!isWeekend(d)) n++;
  return n;
}

export interface CoverageVisit { reportId: string; reference: string; author: string; trade?: string; revision: number }
export interface CoverageProject {
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectManager: string;
  active: boolean;
  /** One entry per day of the fortnight, in order. */
  days: CoverageVisit[][];
  /** Every trade that reported in the fortnight, so a missing one is easy to spot. */
  trades: string[];
  /** The latest visit on or before today, from any time, not just this fortnight. */
  last?: CoverageVisit & { visitDate: string };
  /** Full working days since the last visit, up to today (today is still going, so it is not counted). */
  workingDaysSince?: number;
  /** Active, and nobody has reported for QUIET_WORKING_DAYS working days or more, or ever. */
  quiet: boolean;
}
export interface SiteCoverage {
  start: string;
  end: string;
  today: string;
  /** The fortnight's days, Monday first. */
  days: string[];
  projects: CoverageProject[];
}

export interface CoverageProjectSource { id: string; projectNumber: string; projectName: string; projectManager: string; status: string }

/**
 * `projects` are the reportable projects the person may open, in the order the
 * office lists them; `reports` may hold any project's reports and are filtered
 * here, by project and by what the person may read.
 */
export function siteCoverage(projects: CoverageProjectSource[], reports: Report[], principal: Principal, start: string, today: string): SiteCoverage {
  const days = Array.from({ length: COVERAGE_DAYS }, (_, i) => addDays(start, i));
  const end = days.at(-1)!;
  const sent = reports.filter(r => r.state === 'submitted' && canReadReport(principal, r));
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const visits = sent.filter(r => !superseded.has(r.id) && DAY.test(r.visitDate));
  const visit = (r: Report): CoverageVisit => ({ reportId: r.id, reference: r.reference, author: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}), revision: r.revision });
  const order = (a: Report, b: Report) => (a.authorTrade ?? '~').localeCompare(b.authorTrade ?? '~') || a.author.localeCompare(b.author) || naturalOrder(a.reference, b.reference);

  return {
    start, end, today, days,
    projects: projects.map(p => {
      const mine = visits.filter(r => r.projectId === p.id);
      const inRange = mine.filter(r => r.visitDate >= start && r.visitDate <= end).sort(order);
      const latest = mine.filter(r => r.visitDate <= today).sort((a, b) => b.visitDate.localeCompare(a.visitDate) || naturalOrder(b.reference, a.reference))[0];
      const active = p.status === ACTIVE_PROJECT_STATUS;
      const workingDaysSince = latest ? workingDaysBetween(latest.visitDate, today) : -1;
      return {
        projectId: p.id, projectNumber: p.projectNumber, projectName: p.projectName, projectManager: p.projectManager, active,
        days: days.map(d => inRange.filter(r => r.visitDate === d).map(visit)),
        trades: [...new Set(inRange.map(r => r.authorTrade).filter((t): t is NonNullable<Report['authorTrade']> => Boolean(t)))].sort(),
        ...(latest ? { last: { ...visit(latest), visitDate: latest.visitDate }, workingDaysSince } : {}),
        quiet: active && (!latest || workingDaysSince >= QUIET_WORKING_DAYS),
      };
    }),
  };
}
