import type { Issue, Variation } from './types';
import { confirmationLabel } from './issueConfirmation';
import { VERIFICATION_LABEL, isOverdueIssue, verificationOf } from './issueQuery';
import { INSTRUCTION_LABEL, estimatedMargin, expectedCost, marginPct, variationValue } from './variations';

/**
 * The issue and variation registers as spreadsheets (CSV), for the office to
 * take to a progress meeting, hand to a client or sort in Excel.
 *
 * Pure: the caller decides which records are in scope (the access rules and
 * the register's own filters) and how to name projects and reports, so a file
 * holds exactly the rows the register shows. Nothing is sent anywhere; the
 * file is a download for the person who asked for it.
 */

export type Cell = string | number | undefined;

/**
 * A cell that starts with = + - @ (or a tab or carriage return) would be run
 * as a formula when the file is opened in Excel, so typed text is led with an
 * apostrophe. Numbers are written as numbers, so a negative margin stays a sum.
 */
function cell(value: Cell): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 rows with CRLF endings, led by a byte-order mark so Excel reads £ and accents as UTF-8. */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** `relay-issues-2026-10-20.csv`, or with the project number when the file is for one project. */
export function exportFileName(kind: 'issues' | 'variations', day: string, projectNumber?: string): string {
  const scope = projectNumber?.replace(/[^A-Za-z0-9-]+/g, '') || '';
  return `relay-${kind}${scope ? `-${scope}` : ''}-${day}.csv`;
}

export interface ProjectName { projectNumber: string; projectName: string }

export interface ExportContext {
  /** Today in London, YYYY-MM-DD, for "days past target". */
  day: string;
  project: (projectId: string) => ProjectName | undefined;
  /** The reference of the report that raised the record, when it is known. */
  reportReference: (reportId: string) => string | undefined;
}

/** A date for a spreadsheet: the day only, as YYYY-MM-DD, which Excel reads as a date. */
const dayOf = (iso: string | undefined): string | undefined => iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined;
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

const WORK: Record<Issue['work'], string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_verification: 'Fixed, to check', closed: 'Closed' };

export const ISSUE_COLUMNS = ['Reference', 'Project number', 'Project', 'Issue', 'Action needed', 'Location', 'Trade', 'Raised on', 'Raised from', 'Raised by', 'Responsible company', 'Target date', 'Days past target', 'Work', 'Verification', 'Confirmation', 'Last change'] as const;

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
      i.affectedTrade ?? i.reporterTrade, dayOf(i.raisedAt), from, i.reportedBy ?? i.events.find(e => e.kind === 'raised')?.actor,
      i.owner.trim() || 'Unassigned', i.targetDate || undefined, late,
      i.confirmation === 'withdrawn' ? 'Withdrawn' : WORK[i.work], verification ? VERIFICATION_LABEL[verification] : undefined,
      confirmationLabel(i.confirmation, context.reviewOn(i.projectId)), dayOf(lastChange),
    ];
  })];
}

/** The instruction as the register words it: work done without an instruction outranks "awaiting". */
export function instructionWords(v: Variation): string {
  if (v.instruction !== 'pending') return INSTRUCTION_LABEL[v.instruction];
  if (v.workDone) return 'Done, not instructed';
  return v.quotedValue === undefined ? 'Needs a quote' : INSTRUCTION_LABEL.pending;
}

export const VARIATION_COLUMNS = ['Reference', 'Project number', 'Project', 'Variation', 'Location', 'Trade', 'Reason', 'Raised on', 'Raised from', 'Raised by', 'Asked for on site by', 'Work already done', 'Instruction', 'Client reference', 'Instructed by', 'Instructed on', 'Quoted (£)', 'Instructed (£)', 'Expected cost (£)', 'Margin (£)', 'Margin (%)'] as const;

/**
 * One row per variation, in the order given. Money is written as plain
 * numbers so the sheet can add it up; margin uses the register's own
 * arithmetic (lib/variations.ts) and is left blank for a declined variation,
 * as on screen.
 */
export function variationRows(variations: readonly Variation[], context: ExportContext): Cell[][] {
  const round = (n: number | undefined, places = 2) => n === undefined ? undefined : Number(n.toFixed(places));
  return [[...VARIATION_COLUMNS], ...variations.map(v => {
    const p = context.project(v.projectId);
    const declined = v.instruction === 'declined';
    const pct = declined ? undefined : marginPct(v);
    const from = v.raisedByReport ? context.reportReference(v.raisedByReport) ?? 'Report' : v.source === 'office' ? 'Raised in the office' : undefined;
    return [
      v.reference, p?.projectNumber, p?.projectName ?? v.projectId, v.description, v.location || undefined, v.trade, v.reason,
      dayOf(v.raisedAt), from, v.raisedBy || undefined, v.askedBy || undefined, v.workDone ? 'Yes' : 'No', instructionWords(v),
      v.instructionReference || undefined, v.instructedBy || undefined, v.instructedOn || undefined,
      round(v.quotedValue), round(v.instruction === 'instructed' ? variationValue(v) : undefined), round(expectedCost(v)),
      round(declined ? undefined : estimatedMargin(v)), round(pct === undefined ? undefined : pct * 100, 1),
    ];
  })];
}
