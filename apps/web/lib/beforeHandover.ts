import { naturalOrder } from './naturalOrder';
import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import { isActiveIssue } from './officeActions';
import { checkCounts, reportTypeOf } from './reportTypes';
import { safetyActions, type SafetyAction } from './safetyActions';
import type { CheckAnswer, Issue, Report, Variation } from './types';

/**
 * Before handover: everything RELAY still has open on one project, on one
 * page, for the question a project manager asks as a job nears completion:
 * "what is stopping us handing this over?". Until now the answer meant the
 * snag list, the issue register, the variation register, Safety actions and
 * each handover inspection in turn.
 *
 * It only reads what is already recorded and changes nothing. It is not a
 * handover pack (EXP-5 leaves packs for later) and it says nothing about what
 * RELAY does not hold: drawings, certificates, O&M manuals, the client's own
 * list. Locations are free text (EXP-4): rows are ordered by them as written,
 * never matched against a catalogue.
 */

/** Leodis's own trades. An issue on any of them is ours to put right. */
export const OUR_TRADES = ['Electrical', 'HVAC', 'P&H'] as const;
export type OurTrade = typeof OUR_TRADES[number];

export interface HandoverIssue {
  id: string;
  reference: string;
  description: string;
  location: string;
  owner: string;
  targetDate: string;
  /** Past its target date and not yet put forward as fixed. */
  overdue: boolean;
  disputed: boolean;
  /** As the register reads it; absent when nobody recorded it. */
  trade?: string;
  /** Who put it forward as fixed, for the rows waiting to be checked. */
  fixedBy?: string;
  /** The handover inspection that raised it, if one did. */
  inspection?: { id: string; reference: string };
}

export interface HandoverInspection {
  id: string;
  reference: string;
  revision: number;
  visitDate: string;
  author: string;
  checks: Record<CheckAnswer | 'open', number>;
  /** Where its actions were, as written, without repeats. */
  locations: string[];
  /** Its actions whose issue is still open, and how many it raised in all. */
  stillOpen: number;
  raised: number;
  /** Of those still open, how many are put forward as fixed and waiting to be checked. */
  waiting: number;
}

export interface HandoverVariation {
  id: string;
  reference: string;
  description: string;
  location: string;
  workDone: boolean;
  quoted: boolean;
}

export interface BeforeHandover {
  projectId: string;
  today: string;
  /** Open snags on our own work, by trade, in OUR_TRADES order; trades with none are left out. */
  ours: { trade: OurTrade; issues: HandoverIssue[] }[];
  /** Put forward as fixed, waiting for someone else to check and close. Any trade. */
  toCheck: HandoverIssue[];
  /** Open issues on another firm's work, or where no trade was recorded. */
  others: HandoverIssue[];
  /** Sent handover inspections, latest first, a corrected one counted once. */
  inspections: HandoverInspection[];
  /** Variations the client has not yet instructed or declined; work already done first. */
  variations: HandoverVariation[];
  /** Safety actions still open, oldest first. */
  safety: SafetyAction[];
  /** Whether any safety inspection has been sent, so "none open" means something. */
  safetyInspected: boolean;
  totals: { ours: number; toCheck: number; others: number; variations: number; workDone: number; safety: number; overdue: number; outstanding: number };
}

export interface HandoverSources { reports: Report[]; issues: Issue[]; variations: Variation[] }
export interface HandoverProject { id: string; projectNumber: string; projectName: string }

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');
const placeKey = (text: string) => tidy(text).toLowerCase();
const byRef = (a: { reference: string }, b: { reference: string }) => naturalOrder(a.reference, b.reference);
/** Walk order: by place as written, no place last, then by reference. */
const byPlace = (a: HandoverIssue, b: HandoverIssue) =>
  (a.location ? 0 : 1) - (b.location ? 0 : 1) || placeKey(a.location).localeCompare(placeKey(b.location), 'en', { numeric: true }) || byRef(a, b);
const isOurs = (trade: string | undefined): trade is OurTrade => OUR_TRADES.some(t => t === trade);

/** `today` is today in the office calendar (YYYY-MM-DD), so target dates compare as strings. */
export function beforeHandover(project: HandoverProject, sources: HandoverSources, principal: Principal, today: string): BeforeHandover {
  const reports = sources.reports.filter(r => r.projectId === project.id && canReadReport(principal, r));
  const sent = reports.filter(r => r.state === 'submitted');
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const issues = sources.issues.filter(i => i.projectId === project.id);
  const live = issues.filter(isActiveIssue);

  // Each revision of a handover inspection points back to the one it corrects,
  // so an issue raised by any revision belongs to the latest one.
  const byId = new Map(sent.map(r => [r.id, r]));
  const chain = (r: Report): Set<string> => {
    const ids = new Set<string>();
    for (let at: Report | undefined = r; at && !ids.has(at.id); at = at.corrects ? byId.get(at.corrects) : undefined) ids.add(at.id);
    return ids;
  };
  const handover = sent.filter(r => r.reportType === 'handover-inspection' && !superseded.has(r.id));
  const raisedBy = new Map<string, { id: string; reference: string }>();
  const inspections = handover.map((r): HandoverInspection => {
    const ids = chain(r);
    const places = new Map<string, string>();
    let raised = 0, stillOpen = 0, waiting = 0;
    for (const o of r.observations) {
      if (o.type !== 'check' || o.check?.answer !== 'action') continue;
      if (tidy(o.location) && !places.has(placeKey(o.location))) places.set(placeKey(o.location), tidy(o.location));
      const issue = (o.linkedIssueId ? issues.find(i => i.id === o.linkedIssueId) : undefined)
        ?? issues.find(i => i.raisedByObservation === o.id && ids.has(i.raisedByReport));
      if (!issue) continue;
      raised += 1;
      if (isActiveIssue(issue)) { stillOpen += 1; if (issue.work === 'awaiting_verification') waiting += 1; }
      // Named only by the inspection that raised it; an action that found an existing issue again is counted, not credited.
      if (ids.has(issue.raisedByReport)) raisedBy.set(issue.id, { id: r.id, reference: r.reference });
    }
    return { id: r.id, reference: r.reference, revision: r.revision, visitDate: r.visitDate, author: r.author,
      checks: checkCounts(r.observations), locations: [...places.values()], stillOpen, raised, waiting };
  }).sort((a, b) => b.visitDate.localeCompare(a.visitDate) || byRef(b, a));

  // Every inspection whose actions are snags in our own work (handover, first
  // fix), any revision: what such an action raised is ours by definition.
  const ownWork = new Set(sent.filter(r => { const t = reportTypeOf(r); return Boolean(t.checklist && t.raisesRecords); }).map(r => r.id));
  const row = (i: Issue): HandoverIssue => {
    // Whose work it is, as recorded on site. An inspection's action is our own
    // work by definition, so it falls back to the inspector's trade; any other
    // issue with no trade recorded is not assumed to be ours.
    const inspection = raisedBy.get(i.id);
    const trade = i.affectedTrade ?? (inspection || ownWork.has(i.raisedByReport) ? i.reporterTrade : undefined);
    const target = /^\d{4}-\d{2}-\d{2}$/.test(i.targetDate) ? i.targetDate : '';
    const fixedBy = i.work === 'awaiting_verification' ? i.closureSubmittedBy?.trim() : undefined;
    return { id: i.id, reference: i.reference, description: tidy(i.description), location: tidy(i.location), owner: tidy(i.owner),
      targetDate: target, overdue: !!target && target < today && i.work !== 'awaiting_verification', disputed: i.confirmation === 'disputed',
      ...(trade ? { trade } : {}), ...(fixedBy ? { fixedBy } : {}), ...(inspection ? { inspection } : {}) };
  };
  const rows = live.map(row);
  const toCheck = rows.filter((_, n) => live[n]!.work === 'awaiting_verification').sort(byPlace);
  const stillToDo = rows.filter((_, n) => live[n]!.work !== 'awaiting_verification');
  const ours = OUR_TRADES.map(trade => ({ trade, issues: stillToDo.filter(i => i.trade === trade).sort(byPlace) })).filter(g => g.issues.length);
  const others = stillToDo.filter(i => !isOurs(i.trade)).sort(byPlace);

  const variations = sources.variations.filter(v => v.projectId === project.id && v.instruction === 'pending')
    .map(v => ({ id: v.id, reference: v.reference, description: tidy(v.description), location: tidy(v.location), workDone: v.workDone, quoted: v.quotedValue !== undefined }))
    .sort((a, b) => Number(b.workDone) - Number(a.workDone) || byRef(a, b));

  const safetyProject = safetyActions([project], reports, principal, today).projects[0];
  const safety = safetyProject?.open ?? [];

  const oursCount = ours.reduce((n, g) => n + g.issues.length, 0);
  return {
    projectId: project.id, today, ours, toCheck, others, inspections, variations, safety,
    safetyInspected: (safetyProject?.inspections ?? 0) > 0 || (safetyProject?.towers.length ?? 0) > 0 || (safetyProject?.open.length ?? 0) > 0,
    totals: {
      ours: oursCount, toCheck: toCheck.length, others: others.length,
      variations: variations.length, workDone: variations.filter(v => v.workDone).length, safety: safety.length,
      overdue: stillToDo.filter(i => i.overdue).length,
      outstanding: oursCount + toCheck.length + others.length + variations.length + safety.length,
    },
  };
}
