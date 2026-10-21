import { naturalOrder } from './naturalOrder';
import { checkCounts, reportName, reportTypeOf } from './reportTypes';
import type { Principal } from '@relay/platform';
import { canReadReport, ownsReport } from './auth/access';
import type { ObservationType } from './fixtures';
import type { Issue, Report } from './types';
import { londonDay, weekEnd } from './weeklySummary';

/**
 * My week: one person's own week across every project, day by day. Made for
 * the engineer filling in a timesheet or answering "where were you on
 * Tuesday?", which today means opening each project's reports in turn.
 *
 * It only reads what the person already recorded: reports they sent (placed
 * on the visit day they gave), defects they flagged on their own, and updates
 * or fixes they recorded on an issue page. Drafts for the week are listed
 * apart as not sent yet. Nothing is stored or entered, and RELAY knows no
 * hours: a day with records is not a claim about time on site.
 */

export interface MyWeekReport {
  id: string;
  reference: string;
  revision: number;
  kinds: Record<ObservationType, number>;
  photos: number;
  /** Where the work was, as written, without repeats. */
  locations: string[];
  /** An inspection: its name and how many checks need action, said instead of counting its checks. */
  inspection?: { name: string; action: number };
}
export interface MyWeekDraft { id: string; reference: string; cards: number; correction: boolean;
  /** What kind of report the draft is, such as "Safety inspection". */
  typeName: string }
export type MyWeekIssueKind = 'flagged' | 'progress' | 'fixed';
export interface MyWeekIssue { id: string; reference: string; description: string; location: string; at: string; kind: MyWeekIssueKind }
export interface MyWeekProject {
  projectId: string;
  projectNumber: string;
  projectName: string;
  reports: MyWeekReport[];
  drafts: MyWeekDraft[];
  issues: MyWeekIssue[];
}
export interface MyWeekDay { day: string; projects: MyWeekProject[] }
export interface MyWeek {
  start: string;
  end: string;
  /** True while the week is still going, so the page can say "so far". */
  current: boolean;
  /** Every day of the week, Monday first, each with the projects that have records that day. */
  days: MyWeekDay[];
  totals: { days: number; projects: number; reports: number; flagged: number; issueUpdates: number; drafts: number };
}

export interface MyWeekProjectSource { id: string; projectNumber: string; projectName: string }
export interface MyWeekSources { reports: Report[]; issues: Issue[] }

const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');
const byRef = (a: { reference: string }, b: { reference: string }) => naturalOrder(a.reference, b.reference);
const emptyKinds = (): Record<ObservationType, number> => ({ update: 0, defect: 0, instruction: 0, access: 0, check: 0 });

/**
 * `projects` are the projects the person may open, in the order the app lists
 * them; records on any other project are left out. `monday` starts the week
 * and `today` is today in the office calendar.
 */
export function myWeek(projects: MyWeekProjectSource[], sources: MyWeekSources, principal: Principal, monday: string, today: string): MyWeek {
  const end = weekEnd(monday);
  const inWeek = (ymd: string) => ymd >= monday && ymd <= end;
  const known = new Map(projects.map(p => [p.id, p]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const slots = new Map(days.map(d => [d, new Map<string, MyWeekProject>()]));
  const slot = (day: string, projectId: string): MyWeekProject | undefined => {
    const project = known.get(projectId), byProject = slots.get(day);
    if (!project || !byProject) return undefined;
    let entry = byProject.get(projectId);
    if (!entry) { entry = { projectId, projectNumber: project.projectNumber, projectName: project.projectName, reports: [], drafts: [], issues: [] }; byProject.set(projectId, entry); }
    return entry;
  };

  // Sent reports this person wrote. A sent correction stands in for the report
  // it corrects, so a visit is listed once, at its latest sent revision.
  const readable = sources.reports.filter(r => known.has(r.projectId) && canReadReport(principal, r));
  const sent = readable.filter(r => r.state === 'submitted');
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  for (const r of sent) {
    if (superseded.has(r.id) || !ownsReport(principal, r) || !inWeek(r.visitDate)) continue;
    const kinds = emptyKinds();
    const places = new Map<string, string>();
    for (const o of r.observations) {
      kinds[o.type] = (kinds[o.type] ?? 0) + 1;
      const place = tidy(o.location);
      if (place && !places.has(place.toLowerCase())) places.set(place.toLowerCase(), place);
    }
    const type = reportTypeOf(r), checks = type.checklist ? checkCounts(r.observations) : undefined;
    slot(r.visitDate, r.projectId)?.reports.push({ id: r.id, reference: r.reference, revision: r.revision, kinds,
      photos: r.observations.reduce((n, o) => n + o.photos.length, 0), locations: [...places.values()],
      ...(checks ? { inspection: { name: reportName(r), action: checks.action } } : {}) });
  }
  // Drafts are theirs alone and not yet records, so they are counted apart.
  for (const r of readable) {
    if (r.state !== 'draft' || !ownsReport(principal, r) || !inWeek(r.visitDate)) continue;
    slot(r.visitDate, r.projectId)?.drafts.push({ id: r.id, reference: r.reference, cards: r.observations.length, correction: Boolean(r.corrects), typeName: reportTypeOf(r).name });
  }

  // Issue changes this person made on the issue itself. A sighting or fix
  // that came in with a report already shows under that report (its event
  // names the report), and office decisions (assigning, verifying) are desk
  // work, not a record from site.
  for (const i of sources.issues) {
    if (!known.has(i.projectId)) continue;
    i.events.forEach((e, n) => {
      if (e.actorId !== principal.id || e.source) return;
      const kind: MyWeekIssueKind | undefined = e.kind === 'raised' && n === 0 && i.source === 'individual' ? 'flagged'
        : e.kind === 'progress' ? 'progress' : e.kind === 'closure_submitted' ? 'fixed' : undefined;
      const day = londonDay(e.at);
      if (!kind || !inWeek(day)) return;
      slot(day, i.projectId)?.issues.push({ id: i.id, reference: i.reference, description: i.description, location: tidy(i.location), at: e.at, kind });
    });
  }

  const order = (a: MyWeekProject, b: MyWeekProject) => naturalOrder(a.projectNumber, b.projectNumber) || a.projectName.localeCompare(b.projectName);
  const out = days.map(day => ({ day, projects: [...slots.get(day)!.values()].sort(order).map(p => ({
    ...p, reports: p.reports.sort(byRef), drafts: p.drafts.sort(byRef), issues: p.issues.sort((a, b) => a.at.localeCompare(b.at) || byRef(a, b)),
  })) }));
  const all = out.flatMap(d => d.projects);
  const recorded = (p: MyWeekProject) => p.reports.length + p.issues.length > 0;
  return {
    start: monday, end, current: inWeek(today), days: out,
    totals: {
      days: out.filter(d => d.projects.some(recorded)).length,
      projects: new Set(all.filter(recorded).map(p => p.projectId)).size,
      reports: all.reduce((n, p) => n + p.reports.length, 0),
      flagged: all.reduce((n, p) => n + p.issues.filter(i => i.kind === 'flagged').length, 0),
      issueUpdates: all.reduce((n, p) => n + p.issues.filter(i => i.kind !== 'flagged').length, 0),
      drafts: all.reduce((n, p) => n + p.drafts.length, 0),
    },
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/**
 * "Mon 12 Oct", or "Monday 12 October" in full. Spelt out here rather than by
 * the browser, whose date wording differs from the server's (a comma or not)
 * and would make the page's first paint disagree with the server's.
 */
export function dayLabel(ymd: string, full = false): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  const weekday = WEEKDAYS[d.getUTCDay()]!, month = MONTHS[d.getUTCMonth()]!;
  return full ? `${weekday} ${d.getUTCDate()} ${month}` : `${weekday.slice(0, 3)} ${d.getUTCDate()} ${month.slice(0, 3)}`;
}
const fmtDay = (ymd: string) => dayLabel(ymd);
const isWeekend = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay() % 6 === 0;

/**
 * The week as plain text to paste into a timesheet or a message: one line per
 * weekday (and per weekend day with records), naming each project and what
 * was recorded there. Days after `today` are left out, so a week copied
 * midway never claims an empty Friday. Drafts are left out: they are not
 * records yet.
 */
export function myWeekText(week: MyWeek, name: string, today: string): string {
  const lines = [`${name} · ${fmtDay(week.start)} to ${fmtDay(week.end)} ${week.end.slice(0, 4)}`];
  for (const d of week.days) {
    const projects = d.projects.filter(p => p.reports.length + p.issues.length > 0);
    if (d.day > today || (!projects.length && isWeekend(d.day))) continue;
    const said = projects.map(p => {
      const what = [
        ...p.reports.map(r => r.reference),
        ...(() => { const n = p.issues.filter(i => i.kind === 'flagged').length; return n ? [`${n} defect${n === 1 ? '' : 's'} flagged`] : []; })(),
        ...(() => { const n = p.issues.filter(i => i.kind !== 'flagged').length; return n ? [`${n} issue update${n === 1 ? '' : 's'}`] : []; })(),
      ];
      return `${p.projectNumber} ${p.projectName} (${what.join(', ')})`;
    });
    lines.push(`${fmtDay(d.day)}: ${said.length ? said.join('; ') : 'nothing recorded'}`);
  }
  return lines.join('\n');
}
