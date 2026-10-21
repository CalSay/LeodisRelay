import { naturalOrder } from './naturalOrder';
import type { Issue } from './types';
import { issueTrade } from './snagList';
import { londonDay } from './weeklySummary';

/**
 * Open issues by company: for each company or person named as the owner of
 * an issue, what they still have to put right across every project, how much
 * of it is past its target date, what they have marked fixed for the office
 * to check, how long the oldest item has waited, and what was closed in the
 * last four weeks. Made for chasing a subcontractor or a progress meeting,
 * where today the office counts rows project by project.
 *
 * It only reads the issue register. Owners are typed by hand, so a company is
 * matched ignoring case and spacing (as the snag list does) and labelled as
 * its earliest issue spelled it. Nothing is matched against a company list.
 */

export const RECENT_DAYS = 28;

/** `owner` is the company exactly as written (trimmed) on this project's earliest open issue, the spelling its snag list picker lists. */
export interface CompanyProject { projectId: string; projectNumber: string; projectName: string; owner: string; toDo: number; overdue: number; fixed: number }
export interface CompanyLine {
  owner: string;
  /** Still to put right: open and not yet marked fixed. */
  toDo: number;
  /** Open with a target date before today, fixed or not, as the issue register and snag list count it. */
  overdue: number;
  /** Marked fixed by whoever did the work, waiting for the office to check. */
  fixed: number;
  /** Closed after an office check in the last four weeks, whoever raised it. */
  closedRecently: number;
  /** When the longest-waiting item still to put right was raised, as YYYY-MM-DD, and how many days ago. */
  oldest?: { raisedOn: string; days: number; reference: string; issueId: string };
  trades: string[];
  projects: CompanyProject[];
}
export interface CompanyIssues {
  today: string;
  /** The first day counted as "recent" for closures. */
  since: string;
  companies: CompanyLine[];
  /** Open issues nobody has been named against yet. */
  unassigned: { toDo: number; overdue: number; fixed: number };
}
export interface ProjectNames { id: string; projectNumber: string; projectName: string }

/** A company as matched everywhere on this page and its chases: ignoring case and spacing. */
export const companyKey = (owner: string) => owner.trim().replace(/\s+/g, ' ').toLowerCase();
const key = companyKey;
const isLive = (i: Issue) => i.work !== 'closed' && i.confirmation !== 'withdrawn';
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
/** The day the issue was last closed by an office check, if it is closed now. */
const closedOn = (i: Issue) => {
  if (i.work !== 'closed' || i.confirmation === 'withdrawn') return '';
  const verified = i.events.filter(e => e.kind === 'verified').at(-1);
  return verified ? londonDay(verified.at) : '';
};
const TRADE_ORDER = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'];

/** `today` is YYYY-MM-DD in the office calendar, so target dates compare as strings. */
export function companyIssues(issues: Issue[], projects: ProjectNames[], today: string): CompanyIssues {
  const since = addDays(today, -(RECENT_DAYS - 1));
  const named = new Map(projects.map(p => [p.id, p]));
  // Earliest first, so a company is labelled as its first issue spelled it, whatever order the register loads in.
  const byAge = [...issues].sort((a, b) => a.raisedAt.localeCompare(b.raisedAt) || naturalOrder(a.reference, b.reference));
  const lines = new Map<string, CompanyLine & { tradeSet: Set<string>; byProject: Map<string, CompanyProject> }>();
  const unassigned = { toDo: 0, overdue: 0, fixed: 0 };
  for (const issue of byAge) {
    const live = isLive(issue);
    const closed = closedOn(issue);
    if (!live && !(closed && closed >= since && closed <= today)) continue;
    const fixed = live && issue.work === 'awaiting_verification';
    // The register's rule (`isOverdueIssue`): work put forward as fixed but not yet checked is still late if its target has passed.
    const overdue = live && isDay(issue.targetDate) && issue.targetDate < today;
    const k = key(issue.owner);
    if (!k) {
      if (live) { if (fixed) unassigned.fixed++; else unassigned.toDo++;
        if (overdue) unassigned.overdue++; }
      continue;
    }
    let line = lines.get(k);
    if (!line) { line = { owner: issue.owner.trim().replace(/\s+/g, ' '), toDo: 0, overdue: 0, fixed: 0, closedRecently: 0, trades: [], projects: [], tradeSet: new Set(), byProject: new Map() }; lines.set(k, line); }
    if (!live) { line.closedRecently++; continue; }
    const p = named.get(issue.projectId);
    let project = line.byProject.get(issue.projectId);
    if (!project) { project = { projectId: issue.projectId, projectNumber: p?.projectNumber ?? '', projectName: p?.projectName ?? issue.projectId, owner: issue.owner.trim(), toDo: 0, overdue: 0, fixed: 0 }; line.byProject.set(issue.projectId, project); }
    const trade = issueTrade(issue);
    if (trade) line.tradeSet.add(trade);
    if (overdue) { line.overdue++; project.overdue++; }
    if (fixed) { line.fixed++; project.fixed++; continue; }
    line.toDo++; project.toDo++;
    const raisedOn = londonDay(issue.raisedAt);
    if (!line.oldest && raisedOn) line.oldest = { raisedOn, days: Math.max(0, daysBetween(raisedOn, today)), reference: issue.reference, issueId: issue.id };
  }
  const companies = [...lines.values()]
    // A company with nothing open and only recent closures still shows, so good work is seen as well as late work.
    .map(({ tradeSet, byProject, ...line }) => ({
      ...line,
      trades: [...tradeSet].sort((a, b) => TRADE_ORDER.indexOf(a) - TRADE_ORDER.indexOf(b)),
      projects: [...byProject.values()].sort((a, b) => b.overdue - a.overdue || b.toDo - a.toDo || naturalOrder(a.projectNumber, b.projectNumber)),
    }))
    // Most past target first, then most to put right, then those waiting on the office, then by name.
    .sort((a, b) => b.overdue - a.overdue || b.toDo - a.toDo || b.fixed - a.fixed || a.owner.localeCompare(b.owner));
  return { today, since, companies, unassigned };
}

/** Companies whose name holds the words typed, ignoring case and spacing. */
export function matchCompanies(companies: CompanyLine[], text: string): CompanyLine[] {
  const words = key(text).split(' ').filter(Boolean);
  return words.length ? companies.filter(c => words.every(w => key(c.owner).includes(w))) : companies;
}
