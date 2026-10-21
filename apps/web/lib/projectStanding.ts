import { naturalOrder } from './naturalOrder';
import { ACTIVE_PROJECT_STATUS } from './projectGroups';
import { QUIET_WORKING_DAYS, workingDaysBetween } from './siteCoverage';
import { weekStart } from './weeklySummary';
import type { Report, ReportSummary } from './types';

/**
 * Where a project stands, for the office: when somebody was last on site,
 * how many visits this week and by which trades, and which recent reports
 * say what progress was made. Read only from the reports engineers already
 * send; nothing new is asked of site.
 *
 * Counted as site coverage counts them (lib/siteCoverage.ts): sent reports on
 * the visit day the engineer gave, a sent correction standing in for the
 * report it corrects, and an active site with no report for
 * QUIET_WORKING_DAYS working days marked quiet. A site in defects liability
 * is visited now and then, so it is never quiet.
 */

/** How far back "Latest from site" looks for each trade's last site update. */
export const LATEST_DAYS = 14;

export interface ProjectStanding {
  /** The latest visit on or before today. */
  last?: { reportId: string; visitDate: string; author: string; trade?: string };
  /** Everyone who sent a visit on the last visit day, latest first, once each: who was on site that day. */
  lastDayPeople: { author: string; trade?: string }[];
  /** Full working days since the last visit (today is still going, so it is not counted). */
  workingDaysSince?: number;
  quiet: boolean;
  /** Visits from Monday to today, and the trades that made them, in name order. */
  thisWeek: number;
  tradesThisWeek: string[];
  /** Each trade's latest site update in the last LATEST_DAYS days, newest first: the reports whose progress the office reads. */
  latest: ReportSummary[];
}

const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// The same order as Site coverage's latest visit, so both name the same person on a busy day.
const newest = (a: ReportSummary, b: ReportSummary) => b.visitDate.localeCompare(a.visitDate) || naturalOrder(b.reference, a.reference);

export function projectStanding(project: { status: string }, reports: ReportSummary[], today: string): ProjectStanding {
  const sent = reports.filter(r => r.state === 'submitted');
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const visits = sent.filter(r => !superseded.has(r.id) && DAY.test(r.visitDate) && r.visitDate <= today).sort(newest);
  const latestVisit = visits[0];
  const lastDayPeople: ProjectStanding['lastDayPeople'] = [];
  for (const r of visits) {
    if (r.visitDate !== latestVisit!.visitDate) break;
    if (!lastDayPeople.some(p => p.author === r.author)) lastDayPeople.push({ author: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}) });
  }
  const workingDaysSince = latestVisit ? workingDaysBetween(latestVisit.visitDate, today) : -1;
  const monday = weekStart(today, today);
  const week = visits.filter(r => r.visitDate >= monday);
  // Progress is in site updates; an inspection answers its checklist instead.
  // Today and the thirteen days before it.
  const from = addDays(today, -(LATEST_DAYS - 1));
  const latest: ReportSummary[] = [];
  for (const r of visits) {
    if (r.checks || (r.reportType && r.reportType !== 'progress') || r.visitDate < from) continue;
    if (!latest.some(x => (x.authorTrade ?? '') === (r.authorTrade ?? ''))) latest.push(r);
  }
  return {
    ...(latestVisit ? { last: { reportId: latestVisit.id, visitDate: latestVisit.visitDate, author: latestVisit.author, ...(latestVisit.authorTrade ? { trade: latestVisit.authorTrade } : {}) }, workingDaysSince } : {}),
    lastDayPeople,
    quiet: project.status === ACTIVE_PROJECT_STATUS && (!latestVisit || workingDaysSince >= QUIET_WORKING_DAYS),
    thisWeek: week.length,
    tradesThisWeek: [...new Set(week.map(r => r.authorTrade).filter((t): t is NonNullable<typeof t> => Boolean(t)))].sort(),
    latest,
  };
}

/** "today", "yesterday", or null when it is longer ago and the date says it better. */
export function recentDay(visitDate: string, today: string): string | null {
  return visitDate === today ? 'today' : visitDate === addDays(today, -1) ? 'yesterday' : null;
}

/** How many names "Last visit" gives before "and N more". */
export const PEOPLE_SHOWN = 3;

/**
 * Who was on site on the last visit day, in words: one person with their
 * trade ("Sam Spark, Electrical"), more by name ("Sam Spark, Hana Duct and Pat
 * Pipe"), and past PEOPLE_SHOWN names "and N more".
 */
export function peopleWords(people: ProjectStanding['lastDayPeople']): string {
  if (!people.length) return '';
  if (people.length === 1) return `${people[0]!.author}${people[0]!.trade ? `, ${people[0]!.trade}` : ''}`;
  const names = people.map(p => p.author);
  if (names.length > PEOPLE_SHOWN) return `${names.slice(0, PEOPLE_SHOWN - 1).join(', ')} and ${names.length - (PEOPLE_SHOWN - 1)} more`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** What a site update says about progress and access, card by card, in the order written. */
export interface ProgressLine { id: string; kind: 'update' | 'access'; location: string; text: string; photos: number }
export function progressLines(report: Pick<Report, 'observations'>): ProgressLine[] {
  return report.observations
    .filter(o => (o.type === 'update' || o.type === 'access') && (o.whatHappened.trim() || o.location.trim()))
    .map(o => ({ id: o.id, kind: o.type as 'update' | 'access', location: o.location.trim(), text: o.whatHappened.trim(), photos: o.photos.length }));
}
