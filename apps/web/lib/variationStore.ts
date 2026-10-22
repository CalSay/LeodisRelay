import { createHash, randomUUID } from 'node:crypto';
import type { Principal } from '@relay/platform';
import type { Report, Variation, VariationEvent, VariationReason, VariationTrade } from './types';
import { cachedProject, refreshProjects, reportableProject } from './projects';
import { VARIATION_REASONS, VARIATION_TRADES, readCosting, type Costing } from './variations';
import { atomic, database, getRecord, records } from './storage';
import { saveVariation, VariationSyncError } from './sharepoint/variations';

/**
 * Variation records for the prototype.
 *
 * SQLite today; the Variation Register list on the Operations site at
 * deployment, with the same fields. Raising happens at submission, beside
 * issues, so the office sees a variation the moment the report lands rather
 * than after somebody reads it. Everything after that is an office command
 * with a mandatory reason where the register would want one.
 */

export type VariationOutcome = { ok: true; value: Variation } | { ok: false; status: number; reason: string };
const refuse = (reason: string, status = 422): VariationOutcome => ({ ok: false, status, reason });

export function listVariations(projectId?: string): Variation[] { return records<Variation>('variations', projectId); }
export function getVariation(id: string): Variation | undefined { return getRecord('variations', id); }

/**
 * One variation per "Variation required" update. A correction carries the
 * same update IDs as the report it corrects, so a variation already raised
 * from that update gains a note rather than a second reference.
 */
/** The last sequence used on a project. A reference is never reused, even if the count and the numbering have drifted apart. */
function lastSequence(existing: Variation[]): number {
  return existing.reduce((n, v) => Math.max(n, Number(/-VO-(\d+)$/.exec(v.reference)?.[1] ?? 0)), existing.length);
}
const referenceFor = (projectNumber: string | undefined, sequence: number) => `${projectNumber || 'UNKNOWN'}-VO-${String(sequence).padStart(3, '0')}`;

export function raiseVariationsFromReport(report: Report): Variation[] {
  return atomic(() => {
    const project = cachedProject(report.projectId);
    const existing = listVariations(report.projectId);
    let sequence = lastSequence(existing);
    const raised: Variation[] = [];
    const at = new Date().toISOString();
    const actor = { actor: report.author, ...(report.authorId ? { actorId: report.authorId } : {}) };
    for (const o of report.observations) {
      if (o.type !== 'instruction') continue;
      const already = existing.find(v => v.raisedByObservation === o.id);
      if (already) {
        if (report.corrects) {
          already.events.push({ at, ...actor, kind: 'note', note: `Corrected in ${report.reference} rev ${report.revision}: ${o.whatHappened}`, photos: o.photos });
          saveVariation(already);
        }
        continue;
      }
      sequence++;
      // The engineer's rough size becomes the starting labour figure the office
      // prices from; "more" says nothing the office can use, so it stays blank.
      const hours = o.roughSize === 'half-day' ? 4 : o.roughSize === 'day' ? 8 : o.roughSize === 'two-days' ? 16 : undefined;
      const sizeWords = o.roughSize === 'half-day' ? 'about half a day' : o.roughSize === 'day' ? 'about a day' : o.roughSize === 'two-days' ? 'about two days' : o.roughSize === 'more' ? 'more than two days' : '';
      const extras = [o.workDone ? 'already carried out on a say-so' : '', o.askedBy?.trim() ? `asked for on site by ${o.askedBy.trim()}` : '', sizeWords, o.partsEstimate !== undefined ? `parts about £${o.partsEstimate}` : ''].filter(Boolean);
      const variation: Variation = {
        id: 'var-' + randomUUID(),
        reference: referenceFor(project?.projectNumber, sequence),
        projectId: report.projectId,
        description: o.whatHappened,
        location: o.location,
        ...(report.authorTrade ? { trade: report.authorTrade } : {}),
        ...(o.variationReason ? { reason: o.variationReason } : {}),
        workDone: o.workDone === true,
        ...(o.askedBy?.trim() ? { askedBy: o.askedBy.trim() } : {}),
        ...(hours !== undefined ? { labourHours: hours } : {}),
        ...(o.partsEstimate !== undefined ? { partsCost: o.partsEstimate } : {}),
        instruction: 'pending',
        source: 'report',
        raisedBy: report.author,
        ...(report.authorId ? { raisedById: report.authorId } : {}),
        ...(report.authorTrade ? { raiserTrade: report.authorTrade } : {}),
        raisedAt: at,
        raisedByReport: report.id,
        raisedByObservation: o.id,
        ...(o.linkedIssueId ? { linkedIssueId: o.linkedIssueId } : {}),
        events: [{ at, ...actor, kind: 'raised', note: extras.length ? `${o.whatHappened}\n\n${extras.join(' · ')}.` : o.whatHappened, photos: o.photos }],
      };
      saveVariation(variation);
      raised.push(getVariation(variation.id) ?? variation);
    }
    return raised;
  });
}

/** What the office may say about a variation it raises itself. Authorship, reference and state are the server's. */
export interface OfficeVariationInput {
  /** Chosen by the client once per dialog, so a repeated send returns the same variation rather than a second reference. */
  requestId: string;
  projectId: string;
  description: string;
  location?: string;
  trade?: string;
  reason?: string;
  workDone?: boolean;
  askedBy?: string;
  note?: string;
}

/**
 * A variation the office hears about directly: a client email, a meeting, a
 * phone call. It joins the register exactly as one raised from a report does,
 * pending and unpriced, so pricing and instruction stay the acts they already are.
 */
export async function raiseOfficeVariation(principal: Pick<Principal, 'id' | 'name'>, input: OfficeVariationInput): Promise<VariationOutcome> {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(input.requestId)) return refuse('Invalid variation request.');
  const description = input.description.trim(), location = (input.location ?? '').trim(), askedBy = (input.askedBy ?? '').trim(), note = (input.note ?? '').trim();
  if (!description || description.length > 4000) return refuse('Describe the variation in 1–4,000 characters.');
  if (location.length > 300) return refuse('Keep the location under 300 characters.');
  if (askedBy.length > 300) return refuse('Keep who asked for it under 300 characters.');
  if (note.length > 4000) return refuse('Keep the note under 4,000 characters.');
  if (input.trade && !VARIATION_TRADES.includes(input.trade as VariationTrade)) return refuse('Choose a trade from the list.');
  if (input.reason && !VARIATION_REASONS.includes(input.reason as VariationReason)) return refuse('Choose a reason from the list.');
  await refreshProjects(false, true);
  const project = cachedProject(input.projectId);
  if (!project || !reportableProject(project)) return refuse('This project is not open for variations.');

  const id = 'var-' + createHash('sha256').update(`${principal.id}:${input.requestId}`).digest('hex').slice(0, 32);
  return atomic(() => {
    const repeated = getVariation(id);
    if (repeated) return { ok: true, value: repeated };
    const at = new Date().toISOString();
    const extras = [input.workDone ? 'already carried out on a say-so' : '', askedBy ? `asked for by ${askedBy}` : ''].filter(Boolean);
    const variation: Variation = {
      id,
      reference: referenceFor(project.projectNumber, lastSequence(listVariations(project.id)) + 1),
      projectId: project.id,
      description,
      location,
      ...(input.trade ? { trade: input.trade as VariationTrade } : {}),
      ...(input.reason ? { reason: input.reason as VariationReason } : {}),
      workDone: input.workDone === true,
      ...(askedBy ? { askedBy } : {}),
      instruction: 'pending',
      source: 'office',
      raisedBy: principal.name,
      raisedById: principal.id,
      raisedAt: at,
      events: [{ at, actor: principal.name, actorId: principal.id, kind: 'raised', note: [description, note, extras.length ? `${extras.join(' · ')}.` : ''].filter(Boolean).join('\n\n'), photos: [] }],
    };
    try { saveVariation(variation); }
    catch (error) {
      if (error instanceof VariationSyncError) return refuse(error.message, 409);
      throw error;
    }
    return { ok: true, value: getVariation(id) ?? variation };
  });
}

export interface VariationCommand {
  kind: 'details' | 'price' | 'instruct' | 'decline' | 'within_contract' | 'reopen' | 'note';
  actor: string;
  actorId?: string;
  note: string;
  details?: { description?: string; location?: string; trade?: string; reason?: string; workDone?: boolean };
  costing?: unknown;
  instruction?: { reference?: string; by?: string; on?: string; value?: unknown; signedInstruction?: string };
}

/**
 * Server-side facts attached to a command by trusted callers (office
 * corrections). Never read from a request body.
 */
export interface VariationCommandContext {
  sourceReportId?: string;
  correctionId?: string;
  /** Recorded on the variation when it is declined as a duplicate. */
  duplicateOf?: string;
}

const STATE_WORDS: Record<Variation['instruction'], string> = { pending: 'awaiting instruction', instructed: 'instructed', declined: 'declined', within_contract: 'within contract' };

export function applyVariationCommand(id: string, command: VariationCommand, context: VariationCommandContext = {}): VariationOutcome {
  return atomic(() => {
    const current = getVariation(id);
    if (!current) return refuse('No such variation.', 404);
    const event: VariationEvent = { at: new Date().toISOString(), actor: command.actor, ...(command.actorId ? { actorId: command.actorId } : {}), kind: 'note', note: command.note.trim(), photos: [],
      ...(context.sourceReportId ? { sourceReportId: context.sourceReportId } : {}), ...(context.correctionId ? { correctionId: context.correctionId } : {}) };
    let next: Variation = { ...current };
    const money = (n: number | undefined) => n === undefined ? 'no figure' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

    switch (command.kind) {
      case 'note':
        if (!event.note) return refuse('Write the note.');
        break;

      case 'details': {
        const d = command.details ?? {};
        if (d.description !== undefined) { if (!d.description.trim() || d.description.length > 4000) return refuse('Describe the variation in 1–4,000 characters.'); next.description = d.description.trim(); }
        if (d.location !== undefined) { if (d.location.length > 300) return refuse('Keep the location under 300 characters.'); next.location = d.location.trim(); }
        if (d.trade !== undefined) { if (d.trade === '') delete next.trade; else if (!VARIATION_TRADES.includes(d.trade as VariationTrade)) return refuse('Choose a trade from the list.'); else next.trade = d.trade as VariationTrade; }
        if (d.reason !== undefined) { if (d.reason === '') delete next.reason; else if (!VARIATION_REASONS.includes(d.reason as VariationReason)) return refuse('Choose a reason from the list.'); else next.reason = d.reason as VariationReason; }
        if (d.workDone !== undefined) next.workDone = d.workDone === true;
        event.kind = 'details';
        if (!event.note) event.note = `Details updated${next.workDone !== current.workDone ? (next.workDone ? ': work already carried out without a written instruction' : ': work not yet carried out') : ''}.`;
        break;
      }

      case 'price': {
        if (current.instruction === 'instructed') return refuse('An instructed variation keeps its instructed value. Reopen it to price it again.');
        const read = readCosting(command.costing);
        if (!read.ok) return refuse(read.reason);
        const { instructedValue: _fixed, ...costing } = read.value;
        // Every figure is replaced together: a blank in the form is "not known", not "keep the old one".
        for (const key of ['labourHours', 'labourRate', 'partsCost', 'plantSubcontract', 'upliftPct', 'quotedValue'] as const) delete next[key];
        next = { ...next, ...costing };
        event.kind = 'priced';
        if (!event.note) event.note = `Quoted ${money(costing.quotedValue)}.`;
        break;
      }

      case 'instruct': {
        if (current.instruction !== 'pending') return refuse(`This variation is already ${STATE_WORDS[current.instruction]}.`);
        const i = command.instruction ?? {};
        const reference = (i.reference ?? '').trim(), by = (i.by ?? '').trim(), on = (i.on ?? '').trim();
        if (!reference) return refuse("Record the client's instruction reference.");
        if (!by) return refuse('Say who gave the instruction.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || Number.isNaN(Date.parse(on))) return refuse('Give the instruction date as a date.');
        const read = readCosting({ instructedValue: i.value });
        if (!read.ok) return refuse(read.reason);
        const value = read.value.instructedValue ?? current.quotedValue;
        const signed = (i.signedInstruction ?? '').trim();
        if (signed && !/^https:\/\//.test(signed)) return refuse('The signed copy must be an https link.');
        next = { ...next, instruction: 'instructed', instructionReference: reference, instructedBy: by, instructedOn: on, ...(value !== undefined ? { instructedValue: value } : {}), ...(signed ? { signedInstruction: signed } : {}) };
        if (!signed) delete next.signedInstruction;
        event.kind = 'instructed';
        if (!event.note) event.note = `Instructed by ${by}, ${reference}, ${money(value)}.`;
        break;
      }

      case 'decline':
        if (current.instruction !== 'pending') return refuse(`This variation is already ${STATE_WORDS[current.instruction]}.`);
        if (!event.note) return refuse('Say why it was declined. The reason is recorded on the variation.');
        next.instruction = 'declined';
        if (context.duplicateOf) next.duplicateOf = context.duplicateOf;
        event.kind = 'declined';
        break;

      // The work is already in Leodis's contract: not chargeable, and not the
      // same fact as the client refusing it. The reason is welcome, not required.
      case 'within_contract':
        if (current.instruction !== 'pending') return refuse(`This variation is already ${STATE_WORDS[current.instruction]}.`);
        next.instruction = 'within_contract';
        event.kind = 'within_contract';
        if (!event.note) event.note = 'Within contract. Not chargeable.';
        break;

      case 'reopen':
        if (current.instruction === 'pending') return refuse('This variation is already awaiting instruction.');
        if (!event.note) return refuse('Say why it is being reopened. The reason is recorded on the variation.');
        next.instruction = 'pending';
        event.kind = 'reopened';
        break;

      default:
        return refuse('Unknown variation action.');
    }

    next = { ...next, events: [...current.events, event] };
    try { saveVariation(next); }
    catch (error) {
      if (error instanceof VariationSyncError) return refuse(error.message, 409);
      throw error;
    }
    return { ok: true, value: getVariation(next.id) ?? next };
  });
}

/** Instructed value across a project, for the register's project totals. Within-contract and declined variations are never counted. */
export function projectInstructedValue(projectId: string): number {
  return Number(database().prepare("SELECT COALESCE(SUM(json_extract(data,'$.instructedValue')),0) AS n FROM records WHERE kind='variations' AND project=? AND json_extract(data,'$.instruction')='instructed'").get(projectId)!.n);
}

export type { Costing };
