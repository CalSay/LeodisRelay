import type { Issue, Variation } from './types';
import { confirmationLabel } from './issueConfirmation';
import { VERIFICATION_LABEL, isOverdueIssue, verificationOf } from './issueQuery';
import { INSTRUCTION_LABEL, estimatedMargin, expectedCost, isCharged, marginPct, variationValue } from './variations';
import { sheetDay, type Cell } from './sheet';

export { toCsv, registerFileName, type Cell } from './sheet';

/**
 * The issue and variation registers as spreadsheets (CSV), for the office to
 * take to a progress meeting, hand to a client or sort in Excel.
 *
 * Pure: the caller decides which records are in scope (the access rules and
 * the register's own filters) and how to name projects and reports, so a file
 * holds exactly the rows the register shows. Nothing is sent anywhere; the
 * file is a download for the person who asked for it.
 */

export interface ProjectName { projectNumber: string; projectName: string }

export interface ExportContext {
  /** Today in London, YYYY-MM-DD, for "days past target". */
  day: string;
  project: (projectId: string) => ProjectName | undefined;
  /** The reference of the report that raised the record, when it is known. */
  reportReference: (reportId: string) => string | undefined;
}

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

const WORK: Record<Issue['work'], string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_verification: 'Fixed, to check', closed: 'Closed' };

export const ISSUE_COLUMNS = ['Reference', 'Project number', 'Project', 'Issue', 'Action needed', 'Location', 'Trade', 'Raised on', 'Raised from', 'Raised by', 'Owner', 'Target date', 'Days past target', 'Work', 'Verification', 'Confirmation', 'Last change'] as const;

/**
 * One row per issue, in the order given. Work and confirmation stay two
 * columns, as on the register: an issue can be repaired and still disputed.
 */
export function issueRows(issues: readonly Issue[], context: ExportContext & { reviewOn: (projectId: string) => boolean }): Cell[][] {
  return [[...ISSUE_COLUMNS], ...issues.map(i => {
    const p = context.project(i.projectId);
    const late = isOverdueIssue(i, context.day) ? daysBetween(i.targetDate, context.day) : undefined;
    const verification = verificationOf(i);
    const from = i.source === 'individual' && !i.raisedByReport ? 'Flagged on site' : i.raisedByReport ? context.reportReference(i.raisedByReport) ?? 'Report' : undefined;
    const lastChange = i.events.reduce<string>((at, e) => e.at > at ? e.at : at, i.raisedAt);
    return [
      i.reference, p?.projectNumber, p?.projectName ?? i.projectId, i.description, i.actionNeeded || undefined, i.location || undefined,
      i.affectedTrade ?? i.reporterTrade, sheetDay(i.raisedAt), from, i.reportedBy ?? i.events.find(e => e.kind === 'raised')?.actor,
      i.owner.trim() || 'Unassigned', i.targetDate || undefined, late,
      i.confirmation === 'withdrawn' ? 'Withdrawn' : WORK[i.work], verification ? VERIFICATION_LABEL[verification] : undefined,
      confirmationLabel(i.confirmation, context.reviewOn(i.projectId)), sheetDay(lastChange),
    ];
  })];
}

/** The instruction as the register words it: work done without an instruction outranks "awaiting". */
export function instructionWords(v: Variation): string {
  if (v.instruction !== 'pending') return INSTRUCTION_LABEL[v.instruction];
  if (v.workDone) return 'Done, not instructed';
  return v.quotedValue === undefined ? 'Needs a quote' : INSTRUCTION_LABEL.pending;
}

export const VARIATION_COLUMNS = ['Reference', 'Project number', 'Project', 'Variation', 'Location', 'Trade', 'Reason', 'Raised on', 'Raised from', 'Raised by', 'Asked for on site by', 'Work already done', 'Instruction', 'Client reference', 'Instructed on', 'Instructed by', 'Quoted (£)', 'Instructed (£)', 'Expected cost (£)', 'Margin (£)', 'Margin (%)'] as const;

/**
 * One row per variation, in the order given. Money is written as plain
 * numbers so the sheet can add it up; margin uses the register's own
 * arithmetic (lib/variations.ts) and is left blank for a declined or within-contract variation,
 * as on screen.
 */
export function variationRows(variations: readonly Variation[], context: ExportContext): Cell[][] {
  const round = (n: number | undefined, places = 2) => n === undefined ? undefined : Number(n.toFixed(places));
  return [[...VARIATION_COLUMNS], ...variations.map(v => {
    const p = context.project(v.projectId);
    // Declined and within-contract variations are not charged, so they carry no margin.
    const declined = !isCharged(v);
    const pct = declined ? undefined : marginPct(v);
    const from = v.raisedByReport ? context.reportReference(v.raisedByReport) ?? 'Report' : v.source === 'office' ? 'Raised in the office' : undefined;
    return [
      v.reference, p?.projectNumber, p?.projectName ?? v.projectId, v.description, v.location || undefined, v.trade, v.reason,
      sheetDay(v.raisedAt), from, v.raisedBy || undefined, v.askedBy || undefined, v.workDone ? 'Yes' : 'No', instructionWords(v),
      v.instructionReference || undefined, sheetDay(v.instructedOn), v.instructedBy || undefined,
      round(v.quotedValue), round(v.instruction === 'instructed' ? variationValue(v) : undefined), round(expectedCost(v)),
      round(declined ? undefined : estimatedMargin(v)), round(pct === undefined ? undefined : pct * 100, 1),
    ];
  })];
}
