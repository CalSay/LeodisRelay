import { revisionsBefore, sectionOf, type RaisedRecord } from './sectionMatch';
import { randomUUID } from 'node:crypto';
import type { Correction, CorrectionAction, Issue, Report, Variation } from './types';
import { atomic, database, putRecord } from './storage';
import { getReport } from './serverStore';
import { applyCommand, getIssue, type IssueOutcome } from './issueStore';
import { applyVariationCommand, getVariation, type VariationOutcome } from './variationStore';
import { IssueSyncError } from './sharepoint/issues';
import { VariationSyncError } from './sharepoint/variations';
import { fmtMoney } from './variations';

/**
 * Office corrections to a sent report.
 *
 * The office reads a report and finds the engineer was wrong about something:
 * the "variation" is work already in our contract, the "new defect" was raised
 * on an earlier visit, or it simply wants a note on a section. Each correction
 * changes the issue or variation through the same commands and SharePoint
 * rules as every other office act, and is recorded against the report and its
 * author in one transaction, so the engineer can be shown what changed later.
 */

/** The owner an issue is given when the work turns out to be ours under the contract. */
export const OUR_CONTRACT_OWNER = 'Leodis M&E (our contract)';

export const CORRECTION_ACTIONS: readonly CorrectionAction[] = ['within_contract', 'already_raised', 'note'];
const TARGET_TYPES: readonly Correction['targetType'][] = ['issue', 'variation', 'observation'];

export interface CorrectionInput {
  reportId: string;
  observationId: string;
  action: CorrectionAction;
  targetType: Correction['targetType'];
  targetId?: string;
  relatedId?: string;
  note: string;
  /** Optional: the SharePoint etag of the target issue the office was looking at. */
  expectedEtag?: string;
}
export interface CorrectionResult { correction: Correction; issue?: Issue; variation?: Variation; related?: Issue | Variation }
export type CorrectionOutcome = { ok: true; value: CorrectionResult } | { ok: false; status: number; reason: string };

class Refusal extends Error { constructor(readonly status: number, reason: string) { super(reason); } }

const optionalString = (v: unknown): v is string | undefined => v === undefined || typeof v === 'string';

/** Shape only. Anything that is the wrong type is a 400; business validation happens in applyCorrection. */
export function readCorrectionInput(body: unknown): { ok: true; value: CorrectionInput } | { ok: false; reason: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'Invalid correction.' };
  const b = body as Record<string, unknown>;
  if (typeof b.reportId !== 'string' || !b.reportId || typeof b.observationId !== 'string' || !b.observationId ||
      !CORRECTION_ACTIONS.includes(b.action as CorrectionAction) || !TARGET_TYPES.includes(b.targetType as Correction['targetType']) ||
      !optionalString(b.targetId) || !optionalString(b.relatedId) || !optionalString(b.expectedEtag) ||
      (b.note !== undefined && typeof b.note !== 'string')) {
    return { ok: false, reason: 'Invalid correction.' };
  }
  return { ok: true, value: {
    reportId: b.reportId, observationId: b.observationId, action: b.action as CorrectionAction, targetType: b.targetType as Correction['targetType'],
    ...(b.targetId ? { targetId: b.targetId as string } : {}), ...(b.relatedId ? { relatedId: b.relatedId as string } : {}),
    ...(b.expectedEtag ? { expectedEtag: b.expectedEtag as string } : {}),
    note: typeof b.note === 'string' ? b.note : '',
  } };
}

/** Oldest first, newest last. */
export function listCorrections(filter: { reportId?: string; engineerId?: string }): Correction[] {
  const where = ["kind='corrections'"];
  const args: string[] = [];
  if (filter.reportId) { where.push("json_extract(data,'$.reportId')=?"); args.push(filter.reportId); }
  if (filter.engineerId) { where.push("json_extract(data,'$.engineerId')=?"); args.push(filter.engineerId); }
  return database().prepare(`SELECT data FROM records WHERE ${where.join(' AND ')}`).all(...args)
    .map(row => JSON.parse(row.data as string) as Correction)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-09-14" → "14 Sep 2026". Worked by hand: ICU versions disagree about "Sep" and "Sept". */
function visitDay(report: Report): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(report.visitDate ?? '');
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : report.visitDate || 'date not recorded';
}

/** The record must have come from this report (or a revision it corrects) and this section of it. */
function raisedHere(record: RaisedRecord & { projectId: string }, report: Report, observationId: string): boolean {
  return record.projectId === report.projectId && sectionOf(record, report, revisionsBefore(report, id => getReport(id)?.corrects)) === observationId;
}

function done<T>(outcome: IssueOutcome | VariationOutcome): T {
  // A refusal from the store at this point is a state the record is in, not a malformed request.
  if (!outcome.ok) throw new Refusal(outcome.status === 404 ? 404 : 409, outcome.reason);
  return outcome.value as T;
}

export function applyCorrection(input: CorrectionInput, actor: { name: string; id: string }): CorrectionOutcome {
  try {
    return { ok: true, value: atomic(() => correct(input, actor)) };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, status: error.status, reason: error.message };
    if (error instanceof IssueSyncError || error instanceof VariationSyncError) return { ok: false, status: 409, reason: error.message };
    throw error;
  }
}

function correct(input: CorrectionInput, actor: { name: string; id: string }): CorrectionResult {
  const report = getReport(input.reportId);
  if (!report) throw new Refusal(404, 'No such report.');
  if (report.state !== 'submitted') throw new Refusal(409, 'Only a sent report can be corrected by the office.');
  const observation = report.observations.find(o => o.id === input.observationId);
  if (!observation) throw new Refusal(404, 'That section is not on this report.');

  const reason = input.note.trim();
  if (input.note.length > 4000) throw new Refusal(422, 'Keep the note under 4,000 characters.');
  if (input.action === 'note' && !reason) throw new Refusal(422, 'Write the note.');
  if (input.targetType === 'observation' && input.action !== 'note') throw new Refusal(422, 'A section that raised no issue or variation can only be given a note.');
  if (input.targetType !== 'observation' && !input.targetId) throw new Refusal(422, `Say which ${input.targetType} is being corrected.`);
  if (input.action === 'already_raised' && !input.relatedId) throw new Refusal(422, `Say which ${input.targetType} it was already raised as.`);

  const id = `cor-${randomUUID()}`;
  const at = new Date().toISOString();
  const context = { sourceReportId: report.id, correctionId: id };
  const by = { actor: actor.name, actorId: actor.id };
  const result: Omit<CorrectionResult, 'correction'> = {};
  let title = 'Note added', detail = '';

  if (input.targetType === 'issue') {
    const issue = getIssue(input.targetId!);
    if (!issue) throw new Refusal(404, 'No such issue.');
    if (!raisedHere(issue, report, observation.id)) throw new Refusal(422, 'That issue was not raised by this section of the report.');
    if (input.expectedEtag && issue.sync?.etag && input.expectedEtag !== issue.sync.etag) throw new Refusal(409, 'This issue changed in SharePoint. Refresh and review the current record before correcting it.');

    if (input.action === 'within_contract') {
      if (issue.confirmation === 'withdrawn' || issue.work === 'closed') throw new Refusal(409, `This issue is ${issue.confirmation === 'withdrawn' ? 'withdrawn' : 'closed'}; its responsibility cannot be changed.`);
      title = 'Responsibility changed';
      detail = `From ${issue.owner.trim() || 'no owner'} to ${OUR_CONTRACT_OWNER}.`;
      result.issue = done<Issue>(applyCommand(issue.id, { kind: 'assign', ...by, owner: OUR_CONTRACT_OWNER, targetDate: issue.targetDate,
        note: `Within our contract. ${detail}${reason ? ` ${reason}` : ''}` }, context));
    } else if (input.action === 'already_raised') {
      const related = getIssue(input.relatedId!);
      if (!related) throw new Refusal(404, 'No such issue to link to.');
      if (related.id === issue.id) throw new Refusal(422, 'An issue cannot duplicate itself.');
      if (related.projectId !== issue.projectId) throw new Refusal(422, 'The existing issue must be on the same project.');
      if (issue.confirmation === 'withdrawn') throw new Refusal(409, 'This issue is already withdrawn.');
      title = 'Marked as already raised';
      detail = `Linked to ${related.reference} instead of a new issue.`;
      result.issue = done<Issue>(applyCommand(issue.id, { kind: 'withdraw', ...by, note: `Already raised as ${related.reference}.${reason ? ` ${reason}` : ''}` }, { ...context, duplicateOf: related.id }));
      result.related = done<Issue>(applyCommand(related.id, { kind: 'note', ...by, note: `Seen again in ${report.reference} (${visitDay(report)}) as ${issue.reference}.` }, context));
    } else {
      result.issue = done<Issue>(applyCommand(issue.id, { kind: 'note', ...by, note: reason }, context));
    }
  } else if (input.targetType === 'variation') {
    const variation = getVariation(input.targetId!);
    if (!variation) throw new Refusal(404, 'No such variation.');
    if (!raisedHere(variation, report, observation.id)) throw new Refusal(422, 'That variation was not raised by this section of the report.');

    if (input.action === 'within_contract') {
      if (variation.instruction !== 'pending') throw new Refusal(409, 'Only a variation awaiting instruction can be reclassified as within contract.');
      title = 'Reclassified as within contract';
      detail = `Not chargeable. Was ${variation.quotedValue === undefined ? 'not priced' : fmtMoney(variation.quotedValue)}.`;
      result.variation = done<Variation>(applyVariationCommand(variation.id, { kind: 'within_contract', ...by, note: reason }, context));
    } else if (input.action === 'already_raised') {
      const related = getVariation(input.relatedId!);
      if (!related) throw new Refusal(404, 'No such variation to link to.');
      if (related.id === variation.id) throw new Refusal(422, 'A variation cannot duplicate itself.');
      if (related.projectId !== variation.projectId) throw new Refusal(422, 'The existing variation must be on the same project.');
      if (variation.instruction !== 'pending') throw new Refusal(409, 'Only a variation awaiting instruction can be marked as already raised.');
      title = 'Marked as already raised';
      detail = `Linked to ${related.reference} instead of a new variation.`;
      result.variation = done<Variation>(applyVariationCommand(variation.id, { kind: 'decline', ...by, note: `Already raised as ${related.reference}.${reason ? ` ${reason}` : ''}` }, { ...context, duplicateOf: related.id }));
      result.related = done<Variation>(applyVariationCommand(related.id, { kind: 'note', ...by, note: `Seen again in ${report.reference} (${visitDay(report)}) as ${variation.reference}.` }, context));
    } else {
      result.variation = done<Variation>(applyVariationCommand(variation.id, { kind: 'note', ...by, note: reason }, context));
    }
  }

  const correction: Correction = {
    id, reportId: report.id, observationId: observation.id, projectId: report.projectId,
    action: input.action, targetType: input.targetType,
    ...(input.targetType !== 'observation' && input.targetId ? { targetId: input.targetId } : {}),
    ...(input.action === 'already_raised' && input.relatedId ? { relatedId: input.relatedId } : {}),
    title, detail, note: reason, actor: actor.name, actorId: actor.id, at,
    ...(report.authorId ? { engineerId: report.authorId } : {}), ...(report.author ? { engineer: report.author } : {}),
  };
  putRecord('corrections', correction);
  return { correction, ...result };
}
