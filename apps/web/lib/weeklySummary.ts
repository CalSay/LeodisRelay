import { countVisits } from './visits';
import { naturalOrder } from './naturalOrder';
import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import type { ObservationType } from './fixtures';
import type { Issue, Report, Variation } from './types';
import { checkCounts, reportName, reportTypeOf } from './reportTypes';
import { ISSUE_WORK as WORK } from './status';
import { issueFigures } from './officeActions';
import { isLateOn, isOpenOn, isToCheckOn } from './issueTrend';
import type { ToolboxTalk } from './toolboxTalks';
import { kindLabel, type Permit } from './permits';
import { conditionShort, type Delivery } from './deliveries';

/**
 * A project's week on one page: who was on site, what they reported, which
 * issues were raised, fixed and closed, and which variations came up or were
 * instructed. Made for the weekly site or client meeting, so nobody has to
 * count rows across three registers to say how the week went.
 *
 * It only reads what was already recorded: sent reports (never drafts), the
 * issue register and the variation register. Each record keeps its own events,
 * so a report being received is never read as an issue closing, or the other
 * way round. Money is left off: the page is meant to be shown to a client.
 */

export const LONDON = 'Europe/London';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// One formatter, made once: toLocaleDateString builds a new one on every call,
// which is most of the time on a page that dates thousands of issue events.
const LONDON_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: LONDON });
/** The calendar day an instant fell on in the office's time zone, as YYYY-MM-DD. */
export function londonDay(at: string | Date): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  return Number.isNaN(d.getTime()) ? '' : LONDON_DAY.format(d);
}
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** The Monday that starts the week holding `ymd`. Anything that is not a date reads as `fallback`'s week. */
export function weekStart(ymd: string | undefined, fallback: string): string {
  // A real calendar day only: 31 February would otherwise roll over into March.
  const day = ymd && DAY.test(ymd) && !Number.isNaN(Date.parse(`${ymd}T12:00:00Z`)) && addDays(ymd, 0) === ymd ? ymd : fallback;
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  return addDays(day, -weekday);
}
export const weekEnd = (monday: string) => addDays(monday, 6);
export const shiftWeek = (monday: string, weeks: number) => addDays(monday, 7 * weeks);

export interface WeekReport {
  id: string;
  reference: string;
  visitDate: string;
  author: string;
  trade?: string;
  revision: number;
  /** Kept apart from receipt: a report still awaiting review, or returned, is tagged so on the page. */
  review: Report['review'];
  /** Cards on the report by kind, so the page can say "3 progress, 1 defect". */
  kinds: Record<ObservationType, number>;
  photos: number;
  /** Where the work was, as the engineer wrote it, without repeats. */
  locations: string[];
  /**
   * What was done: each progress update in the order written, so the week reads
   * without opening every report. Defects, access problems and variations are
   * left out: they have their own sections, with their references. None on an inspection.
   */
  work: WeekWork[];
  /** An inspection: its name and how its checks came out. Its checks are not counted as cards. */
  inspection?: { name: string; ok: number; action: number; na: number };
}
/** One progress update as the engineer wrote it. */
export interface WeekWork { id: string; location: string; text: string; photos: number }
export interface WeekIssue { id: string; reference: string; location: string; description: string; owner: string; trade?: string; at: string; status: string }
export interface WeekVariation { id: string; reference: string; location: string; description: string; at: string; status: string; workDone: boolean }
export interface WeekTalk { id: string; day: string; topic: string; givenBy: string; attendees: number }
export interface WeekPermit { id: string; day: string; issued: string; title: string; work: string; heldBy: string; closedDay?: string }
export interface WeekDelivery { id: string; day: string; arrived: string; supplier: string; items: string; condition: string; problem?: string; sortedDay?: string; toSort: boolean }
export interface WeeklySummary {
  projectId: string;
  start: string;
  end: string;
  /** True while the week is still going, so the page can say "so far". */
  current: boolean;
  reports: WeekReport[];
  engineers: string[];
  siteDays: string[];
  /** One person on site on one day, up to today (lib/visits.ts), the same count as the office overview's visits. */
  visits: number;
  kinds: Record<ObservationType, number>;
  issuesRaised: WeekIssue[];
  issuesFixed: WeekIssue[];
  issuesClosed: WeekIssue[];
  /**
   * Issues open, past target and fixed waiting to be checked at the end of
   * `asOf`: the period's last day once it is over, or today while it is going.
   * So a past week printed today shows how that week ended, not today's list.
   */
  open: { asOf: string; total: number; pastTarget: number; toCheck: number };
  variationsRaised: WeekVariation[];
  variationsInstructed: WeekVariation[];
  /** Toolbox talks given, permits issued or closed, and deliveries taken in this week. Withdrawn ones were entered by mistake and are left out. */
  site: { talks: WeekTalk[]; permits: WeekPermit[]; deliveries: WeekDelivery[] };
}

const INSTRUCTION: Record<Variation['instruction'], string> = { pending: 'Awaiting instruction', instructed: 'Instructed', declined: 'Declined', within_contract: 'Within contract' };
const emptyKinds = (): Record<ObservationType, number> => ({ update: 0, defect: 0, instruction: 0, access: 0, check: 0 });
const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');
const byRef = (a: { reference: string }, b: { reference: string }) => naturalOrder(a.reference, b.reference);

function issueStatus(i: Issue): string {
  if (i.confirmation === 'withdrawn') return 'Withdrawn';
  return WORK[i.work];
}
function weekIssue(i: Issue, at: string): WeekIssue {
  const trade = i.affectedTrade ?? i.reporterTrade;
  return { id: i.id, reference: i.reference, location: tidy(i.location), description: i.description, owner: tidy(i.owner), ...(trade ? { trade } : {}), at, status: issueStatus(i) };
}
function weekVariation(v: Variation, at: string): WeekVariation {
  return { id: v.id, reference: v.reference, location: tidy(v.location), description: v.description, at, status: INSTRUCTION[v.instruction], workDone: v.workDone };
}

export interface WeekSources { reports: Report[]; issues: Issue[]; variations: Variation[];
  /** Site records; left out, the week has none. */
  talks?: ToolboxTalk[]; permits?: Permit[]; deliveries?: Delivery[] }

/**
 * `monday` is the first day of the week; `today` is today in the office
 * calendar. Reports are placed by their visit day, everything else by when
 * its event happened, in UK time.
 */
export function weeklySummary(sources: WeekSources, principal: Principal, projectId: string, monday: string, today: string): WeeklySummary {
  return periodSummary(sources, principal, projectId, monday, weekEnd(monday), today);
}

/**
 * Only sent reports the person may read. A sent report whose correction has
 * also been sent is replaced by that correction, so a visit is counted once.
 */
export function sentReports(reports: Report[], principal: Principal, projectId: string): Report[] {
  const sent = reports.filter(r => r.projectId === projectId && r.state === 'submitted' && canReadReport(principal, r));
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  return sent.filter(r => !superseded.has(r.id));
}

/** The same summary for any run of days, `start` to `end` inclusive: a week, or a calendar month (lib/monthSummary.ts). */
export function periodSummary(sources: WeekSources, principal: Principal, projectId: string, start: string, end: string, today: string): WeeklySummary {
  const monday = start;
  const inWeek = (ymd: string) => ymd >= start && ymd <= end;

  const sent = sentReports(sources.reports, principal, projectId).filter(r => inWeek(r.visitDate));
  const reports: WeekReport[] = sent.map(r => {
    const kinds = emptyKinds();
    const places = new Map<string, string>();
    for (const o of r.observations) {
      kinds[o.type] = (kinds[o.type] ?? 0) + 1;
      const place = tidy(o.location);
      if (place && !places.has(place.toLowerCase())) places.set(place.toLowerCase(), place);
    }
    const type = reportTypeOf(r);
    const checks = type.checklist ? checkCounts(r.observations) : undefined;
    return { id: r.id, reference: r.reference, visitDate: r.visitDate, author: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}), revision: r.revision, review: r.review, kinds,
      photos: r.observations.reduce((n, o) => n + o.photos.length, 0), locations: [...places.values()],
      work: checks ? [] : r.observations.filter(o => o.type === 'update' && (o.whatHappened.trim() || o.location.trim()))
        .map(o => ({ id: o.id, location: tidy(o.location), text: o.whatHappened.trim(), photos: o.photos.length })),
      ...(checks ? { inspection: { name: reportName(r), ok: checks.ok, action: checks.action, na: checks.na } } : {}) };
  }).sort((a, b) => a.visitDate.localeCompare(b.visitDate) || byRef(a, b));
  const kinds = emptyKinds();
  for (const r of reports) for (const k of Object.keys(kinds) as ObservationType[]) kinds[k] += r.kinds[k];

  const issues = sources.issues.filter(i => i.projectId === projectId);
  // The latest event of a kind in the week: an issue fixed, reopened and fixed again is listed once.
  const lastIn = (i: Issue, kind: Issue['events'][number]['kind']) => i.events.filter(e => e.kind === kind && inWeek(londonDay(e.at))).at(-1)?.at;
  const issuesRaised = issues.filter(i => inWeek(londonDay(i.raisedAt))).map(i => weekIssue(i, i.raisedAt));
  const issuesFixed = issues.flatMap(i => { const at = lastIn(i, 'closure_submitted'); return at ? [weekIssue(i, at)] : []; });
  // Closed this week and still closed: one that was verified and then reopened is not shown as closed.
  const issuesClosed = issues.flatMap(i => { const at = lastIn(i, 'verified'); return at && i.work === 'closed' ? [weekIssue(i, at)] : []; });
  // Today: the office's figures (lib/officeActions.ts), so this agrees with the project sheet.
  // A period that is over: as the issues stood at its end, read as Issues over time and the Month read them.
  const asOf = end < today ? end : today;
  const figures = asOf === today ? issueFigures(issues, today) : {
    open: issues.filter(i => isOpenOn(i, asOf)).length,
    overdue: issues.filter(i => isLateOn(i, asOf, today)).length,
    toCheck: issues.filter(i => isToCheckOn(i, asOf, today)).length };
  const open = { asOf, total: figures.open, pastTarget: figures.overdue, toCheck: figures.toCheck };

  const variations = sources.variations.filter(v => v.projectId === projectId);
  const variationsRaised = variations.filter(v => inWeek(londonDay(v.raisedAt))).map(v => weekVariation(v, v.raisedAt));
  const variationsInstructed = variations.flatMap(v => {
    const at = v.events.filter(e => e.kind === 'instructed' && inWeek(londonDay(e.at))).at(-1)?.at;
    return at && v.instruction === 'instructed' ? [weekVariation(v, at)] : [];
  });

  // Dated in the week: one issued or taken in last week shows the day it was closed or sorted.
  const shownDay = (day: string, then?: string) => inWeek(day) || !then ? day : then;
  const talks: WeekTalk[] = (sources.talks ?? []).filter(t => t.projectId === projectId && !t.withdrawn && inWeek(t.day))
    .map(t => ({ id: t.id, day: t.day, topic: t.topic, givenBy: t.givenBy, attendees: t.attendees.length }));
  // A permit belongs to the week it was issued or closed in, so one issued last Friday and closed on Monday is not lost.
  const permits: WeekPermit[] = (sources.permits ?? []).flatMap(p => {
    const closedDay = p.closed ? londonDay(p.closed.at) : undefined;
    if (p.projectId !== projectId || p.withdrawn || !(inWeek(p.day) || (closedDay && inWeek(closedDay)))) return [];
    return [{ id: p.id, day: shownDay(p.day, closedDay), issued: p.day, title: `${kindLabel(p.kind)}${p.reference ? ` ${p.reference}` : ''}`, work: tidy(p.work), heldBy: tidy(p.heldBy), ...(closedDay ? { closedDay } : {}) }];
  });
  // Likewise a delivery belongs to the week it arrived or was sorted in.
  const deliveries: WeekDelivery[] = (sources.deliveries ?? []).flatMap(d => {
    const sortedDay = d.sorted ? londonDay(d.sorted.at) : undefined;
    if (d.projectId !== projectId || d.withdrawn || !(inWeek(d.day) || (sortedDay && inWeek(sortedDay)))) return [];
    return [{ id: d.id, day: shownDay(d.day, sortedDay), arrived: d.day, supplier: tidy(d.supplier), items: tidy(d.items), condition: conditionShort(d.condition), ...(d.problem ? { problem: tidy(d.problem) } : {}),
      ...(sortedDay ? { sortedDay } : {}), toSort: d.condition !== 'complete' && !d.sorted }];
  });
  const byDay = <T extends { day: string; id: string }>(rows: T[]) => rows.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));

  const byTime = <T extends { at: string; reference: string }>(rows: T[]) => rows.sort((a, b) => a.at.localeCompare(b.at) || byRef(a, b));
  return {
    projectId, start: monday, end, current: inWeek(today),
    reports, engineers: [...new Set(reports.map(r => r.author))].sort((a, b) => a.localeCompare(b)),
    siteDays: [...new Set(reports.map(r => r.visitDate))].sort(), visits: countVisits(sent.filter(r => r.visitDate <= today)), kinds,
    issuesRaised: byTime(issuesRaised), issuesFixed: byTime(issuesFixed), issuesClosed: byTime(issuesClosed), open,
    variationsRaised: byTime(variationsRaised), variationsInstructed: byTime(variationsInstructed),
    site: { talks: byDay(talks), permits: byDay(permits), deliveries: byDay(deliveries) },
  };
}
