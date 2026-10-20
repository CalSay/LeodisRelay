import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import type { Report } from './types';

/**
 * Safety actions: what the weekly safety inspections found needing action,
 * and whether a later inspection found it put right.
 *
 * An inspection raises no issues (EXP-5 keeps safety actions out of the snag
 * list and the company chase list), so until now an action lived only on the
 * PDF it was written on, and nobody could see at a glance which were still
 * outstanding. This reads the sent inspections of each project in visit
 * order and follows each check through them: "Action needed" opens an action
 * (or, if it was already open, says it was found again); a later
 * "Satisfactory" or "Not applicable" on the same check clears it. Nothing is
 * stored or typed in: the next inspection is the record that it was put
 * right, as it is on a paper inspection.
 */

export interface SafetyInspectionRef {
  id: string;
  reference: string;
  revision: number;
  visitDate: string;
  author: string;
}

export interface SafetyAction {
  /** Stable across loads: the project, the check and the inspection that first found it. */
  key: string;
  item: string;
  /** As the most recent inspection asked it. */
  question: string;
  /** What is wrong, what needs doing and who is to do it, as last written. */
  found: string;
  actionNeeded: string;
  who: string;
  location: string;
  /** Photographs on the check in the most recent inspection that found it. */
  photos: number;
  raised: SafetyInspectionRef;
  /** The most recent inspection that found it needing action. The same as `raised` when found once. */
  latest: SafetyInspectionRef;
  /** How many inspections in a row found it. */
  times: number;
  /** The inspection that found it put right, with its answer and anything the engineer wrote. */
  cleared?: SafetyInspectionRef & { answer: 'ok' | 'na'; note: string };
  /** Days from the inspection that found it to the one that cleared it, or to today while open. */
  days: number;
}

export interface SafetyProject {
  projectId: string;
  projectNumber: string;
  projectName: string;
  /** Sent inspections, counting a corrected one once. */
  inspections: number;
  last?: SafetyInspectionRef;
  /** Days since the last inspection's visit day; absent when there has been none. */
  sinceLast?: number;
  /** The last inspection was more than a week ago. */
  due: boolean;
  /** Oldest first. */
  open: SafetyAction[];
  /** Cleared within the last CLEARED_DAYS days, most recent first. */
  cleared: SafetyAction[];
}

export interface SafetyActions {
  today: string;
  /** Projects with open actions first (longest open first), then the rest in project-number order. */
  projects: SafetyProject[];
  totals: { open: number; projects: number; cleared: number; due: number; never: number };
}

export interface SafetyProjectSource { id: string; projectNumber: string; projectName: string }

/** Inspections are weekly, so one older than this is due. */
export const INSPECTION_DUE_DAYS = 7;
/** How far back cleared actions are listed: long enough to see last month's put right. */
export const CLEARED_DAYS = 28;

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const byNumber = (a: SafetyProject, b: SafetyProject) => a.projectNumber.localeCompare(b.projectNumber, 'en', { numeric: true }) || a.projectName.localeCompare(b.projectName);
const ref = (r: Report): SafetyInspectionRef => ({ id: r.id, reference: r.reference, revision: r.revision, visitDate: r.visitDate, author: r.author });

/**
 * `projects` are the projects the person may open; inspections on any other
 * project, drafts, and inspections the person may not read are left out.
 * `today` is today in the office calendar (YYYY-MM-DD).
 */
export function safetyActions(projects: SafetyProjectSource[], reports: Report[], principal: Principal, today: string): SafetyActions {
  const known = new Map(projects.map(p => [p.id, p]));
  const sent = reports.filter(r => known.has(r.projectId) && r.state === 'submitted' && canReadReport(principal, r));
  // A sent correction stands in for the inspection it corrects.
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const inspections = sent.filter(r => r.reportType === 'safety-inspection' && !superseded.has(r.id))
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.reference.localeCompare(b.reference, 'en', { numeric: true }));

  const out = projects.map(p => {
    const mine = inspections.filter(r => r.projectId === p.id);
    const open = new Map<string, SafetyAction>();
    const cleared: SafetyAction[] = [];
    for (const r of mine) {
      for (const o of r.observations) {
        if (o.type !== 'check' || !o.check?.answer) continue;
        const { item, question, answer } = o.check;
        const was = open.get(item);
        if (answer === 'action') {
          const latest = ref(r);
          open.set(item, {
            key: was?.key ?? `${p.id}:${item}:${r.id}`, item, question: tidy(question),
            found: tidy(o.whatHappened), actionNeeded: tidy(o.actionNeeded), who: tidy(o.owner), location: tidy(o.location), photos: o.photos.length,
            raised: was?.raised ?? latest, latest, times: (was?.times ?? 0) + 1, days: 0,
          });
        } else if (was) {
          open.delete(item);
          cleared.push({ ...was, cleared: { ...ref(r), answer, note: tidy(o.whatHappened) }, days: daysBetween(was.raised.visitDate, r.visitDate) });
        }
      }
    }
    const last = mine.length ? ref(mine[mine.length - 1]!) : undefined;
    const sinceLast = last ? daysBetween(last.visitDate, today) : undefined;
    const project: SafetyProject = {
      projectId: p.id, projectNumber: p.projectNumber, projectName: p.projectName, inspections: mine.length,
      due: sinceLast !== undefined && sinceLast > INSPECTION_DUE_DAYS,
      open: [...open.values()].map(a => ({ ...a, days: daysBetween(a.raised.visitDate, today) }))
        .sort((a, b) => a.raised.visitDate.localeCompare(b.raised.visitDate) || a.question.localeCompare(b.question)),
      cleared: cleared.filter(a => daysBetween(a.cleared!.visitDate, today) <= CLEARED_DAYS)
        .sort((a, b) => b.cleared!.visitDate.localeCompare(a.cleared!.visitDate) || a.question.localeCompare(b.question)),
    };
    if (last && sinceLast !== undefined) { project.last = last; project.sinceLast = sinceLast; }
    return project;
  });

  const withOpen = out.filter(p => p.open.length).sort((a, b) => a.open[0]!.raised.visitDate.localeCompare(b.open[0]!.raised.visitDate) || byNumber(a, b));
  const rest = out.filter(p => !p.open.length).sort(byNumber);
  return {
    today,
    projects: [...withOpen, ...rest],
    totals: {
      open: out.reduce((n, p) => n + p.open.length, 0),
      projects: withOpen.length,
      cleared: out.reduce((n, p) => n + p.cleared.length, 0),
      due: out.filter(p => p.due).length,
      never: out.filter(p => !p.inspections).length,
    },
  };
}
