import { naturalOrder } from './naturalOrder';
import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import type { ObservationType } from './fixtures';
import type { Issue, Report, Variation } from './types';
import { checkCounts, reportName, reportTypeOf } from './reportTypes';

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
  /** An inspection: its name and how its checks came out. Its checks are not counted as cards. */
  inspection?: { name: string; ok: number; action: number; na: number };
}
export interface WeekIssue { id: string; reference: string; location: string; description: string; owner: string; trade?: string; at: string; status: string }
export interface WeekVariation { id: string; reference: string; location: string; description: string; at: string; status: string; workDone: boolean }
export interface WeeklySummary {
  projectId: string;
  start: string;
  end: string;
  /** True while the week is still going, so the page can say "so far". */
  current: boolean;
  reports: WeekReport[];
  engineers: string[];
  siteDays: string[];
  kinds: Record<ObservationType, number>;
  issuesRaised: WeekIssue[];
  issuesFixed: WeekIssue[];
  issuesClosed: WeekIssue[];
  /** As things stand when the page is opened, not as they stood at the end of the week. */
  openNow: { total: number; pastTarget: number; toCheck: number };
  variationsRaised: WeekVariation[];
  variationsInstructed: WeekVariation[];
}

const WORK: Record<Issue['work'], string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_verification: 'Fixed, to check', closed: 'Closed' };
const INSTRUCTION: Record<Variation['instruction'], string> = { pending: 'Awaiting instruction', instructed: 'Instructed', declined: 'Declined' };
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

export interface WeekSources { reports: Report[]; issues: Issue[]; variations: Variation[] }

/**
 * `monday` is the first day of the week; `today` is today in the office
 * calendar. Reports are placed by their visit day, everything else by when
 * its event happened, in UK time.
 */
export function weeklySummary(sources: WeekSources, principal: Principal, projectId: string, monday: string, today: string): WeeklySummary {
  const end = weekEnd(monday);
  const inWeek = (ymd: string) => ymd >= monday && ymd <= end;

  // Only sent reports the person may read. A sent report whose correction has
  // also been sent is replaced by that correction, so a visit is counted once.
  const sent = sources.reports.filter(r => r.projectId === projectId && r.state === 'submitted' && canReadReport(principal, r));
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const reports: WeekReport[] = sent.filter(r => !superseded.has(r.id) && inWeek(r.visitDate)).map(r => {
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
  const live = issues.filter(i => i.work !== 'closed' && i.confirmation !== 'withdrawn');
  const openNow = {
    total: live.length,
    pastTarget: live.filter(i => i.work !== 'awaiting_verification' && DAY.test(i.targetDate) && i.targetDate < today).length,
    toCheck: live.filter(i => i.work === 'awaiting_verification').length,
  };

  const variations = sources.variations.filter(v => v.projectId === projectId);
  const variationsRaised = variations.filter(v => inWeek(londonDay(v.raisedAt))).map(v => weekVariation(v, v.raisedAt));
  const variationsInstructed = variations.flatMap(v => {
    const at = v.events.filter(e => e.kind === 'instructed' && inWeek(londonDay(e.at))).at(-1)?.at;
    return at && v.instruction === 'instructed' ? [weekVariation(v, at)] : [];
  });

  const byTime = <T extends { at: string; reference: string }>(rows: T[]) => rows.sort((a, b) => a.at.localeCompare(b.at) || byRef(a, b));
  return {
    projectId, start: monday, end, current: inWeek(today),
    reports, engineers: [...new Set(reports.map(r => r.author))].sort((a, b) => a.localeCompare(b)),
    siteDays: [...new Set(reports.map(r => r.visitDate))].sort(), kinds,
    issuesRaised: byTime(issuesRaised), issuesFixed: byTime(issuesFixed), issuesClosed: byTime(issuesClosed), openNow,
    variationsRaised: byTime(variationsRaised), variationsInstructed: byTime(variationsInstructed),
  };
}
