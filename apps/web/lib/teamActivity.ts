import { recentDay } from './projectStanding';
import { dateShort, whenShort } from './dates';
import { weekStart } from './weeklySummary';

/**
 * Whether someone on the Team tab has got going: signed in yet, and the site
 * their latest sent report was for. Lets the office see at a glance that a new
 * site is reporting, or who still needs a nudge, without opening each person.
 * Read from reports engineers already send; nothing new is asked of site.
 */

/** The latest report someone sent, as the Team tab shows it. */
export interface LastSent { reportId: string; projectId: string; visitDate: string; at: string }

interface SentReport { id: string; projectId: string; visitDate: string; state: string; authorId?: string; serverAcknowledgedAt?: string }

/** The days this week someone sent a report for, and the sites, as the Team tab shows them. */
export interface SentThisWeek { days: string[]; projectIds: string[] }

/**
 * Each author's latest sent report, by account id: the latest visit day, then
 * the latest sent that day, so a correction to an old report, or an update
 * started without signal and sent days later, does not stand in for where they
 * are now. Drafts and reports with no account are left out.
 */
export function latestSentByAuthor(reports: readonly SentReport[]): Map<string, LastSent> {
  const out = new Map<string, LastSent>();
  for (const r of reports) {
    if (r.state !== 'submitted' || !r.authorId || !r.serverAcknowledgedAt) continue;
    const had = out.get(r.authorId);
    if (had && later(had, r.visitDate, r.serverAcknowledgedAt)) continue;
    out.set(r.authorId, { reportId: r.id, projectId: r.projectId, visitDate: r.visitDate, at: r.serverAcknowledgedAt });
  }
  return out;
}

/** Whether `a` is at least as recent as a report on `visitDate`, sent `at`. */
const later = (a: LastSent, visitDate: string, at: string) => a.visitDate > visitDate || (a.visitDate === visitDate && a.at >= at);

/** The latest of several accounts' reports (one person can have more than one account id over time). */
export function latestOf(byAuthor: Map<string, LastSent>, ids: Iterable<string>): LastSent | undefined {
  let best: LastSent | undefined;
  for (const id of ids) {
    const sent = byAuthor.get(id);
    if (sent && (!best || !later(best, sent.visitDate, sent.at))) best = sent;
  }
  return best;
}

/**
 * The visit days from Monday up to `today` that each author sent a report for,
 * and the sites, by account id. A report counts on the day of the visit, as on
 * Site coverage, so an update sent late still counts for the day it is about.
 * A correction falls on the same day as the report it corrects, so it adds
 * nothing. Drafts and reports with no account are left out.
 */
export function sentThisWeekByAuthor(reports: readonly SentReport[], today: string): Map<string, SentThisWeek> {
  const monday = weekStart(today, today);
  const days = new Map<string, Set<string>>(), sites = new Map<string, Set<string>>();
  for (const r of reports) {
    if (r.state !== 'submitted' || !r.authorId || !r.serverAcknowledgedAt || r.visitDate < monday || r.visitDate > today) continue;
    if (!days.has(r.authorId)) { days.set(r.authorId, new Set()); sites.set(r.authorId, new Set()); }
    days.get(r.authorId)!.add(r.visitDate); sites.get(r.authorId)!.add(r.projectId);
  }
  return new Map([...days].map(([id, d]) => [id, { days: [...d].sort(), projectIds: [...sites.get(id)!].sort() }]));
}

/** This week across several accounts' reports (one person can have more than one account id over time). */
export function weekOf(byAuthor: Map<string, SentThisWeek>, ids: Iterable<string>): SentThisWeek | undefined {
  const days = new Set<string>(), sites = new Set<string>();
  for (const id of ids) {
    const w = byAuthor.get(id);
    w?.days.forEach(d => days.add(d));
    w?.projectIds.forEach(p => sites.add(p));
  }
  return days.size ? { days: [...days].sort(), projectIds: [...sites].sort() } : undefined;
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekdayOf = (ymd: string) => WEEKDAY[(new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7]!;

/**
 * The Team tab's line under "Last sent" for this week, for someone who has
 * sent something: "This week: Mon, Tue, Thu · 3 sites", "This week: today",
 * or "Nothing sent this week". Days the visit was for, not hours on site.
 */
export function thisWeekWords(week: SentThisWeek | undefined, today: string): string {
  // A list loaded last week and left open reads as nothing this week, not last week's days.
  const monday = weekStart(today, today);
  const mine = week?.days.filter(d => d >= monday && d <= today) ?? [];
  if (!week || !mine.length) return 'Nothing sent this week';
  const days = mine.map(d => (d === today ? 'today' : weekdayOf(d))).join(', ');
  return `This week: ${days}${week.projectIds.length > 1 ? ` · ${week.projectIds.length} sites` : ''}`;
}

export interface LastSentWords {
  /** The site's name, or what stands in for one. */
  title: string;
  /** "Visit today", "Signed in Wed 21 Oct, 14:05" and the like. */
  sub?: string;
  /** The person has not got going yet. */
  waiting: boolean;
}

/**
 * The Team tab's "Last sent" cell in plain words:
 * - "Kirkstall Gate - Phase 2" · "Visit today" once they have sent something;
 * - "Nothing sent yet" · "Signed in Wed 21 Oct, 14:05" once signed in;
 * - "Not signed in yet" otherwise.
 */
export function lastSentWords(
  m: { lastSent?: LastSent; everSignedIn?: boolean; lastSignedIn?: string; session?: string },
  projectName: (id: string) => string | undefined,
  today: string,
): LastSentWords {
  if (m.lastSent) {
    const day = recentDay(m.lastSent.visitDate, today) ?? (dateShort(m.lastSent.visitDate, 'auto') || m.lastSent.visitDate);
    return { title: projectName(m.lastSent.projectId) ?? 'A project no longer listed', sub: `Visit ${day}`, waiting: false };
  }
  if (m.everSignedIn || m.lastSignedIn || (m.session && m.session !== 'never')) {
    return { title: 'Nothing sent yet', ...(m.lastSignedIn ? { sub: `Signed in ${whenShort(m.lastSignedIn)}` } : {}), waiting: false };
  }
  return { title: 'Not signed in yet', waiting: true };
}
