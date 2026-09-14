import { randomUUID } from 'node:crypto';
import type { Report, Variation, VariationEvent, VariationReason, VariationTrade } from './types';
import { FIXTURE_PROJECTS } from './fixtures';
import { VARIATION_REASONS, VARIATION_TRADES, readCosting, type Costing } from './variations';
import { atomic, database, getRecord, putRecord, records } from './storage';

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
export function raiseVariationsFromReport(report: Report): Variation[] {
  return atomic(() => {
    const project = FIXTURE_PROJECTS.find(p => p.id === report.projectId);
    const existing = listVariations(report.projectId);
    let sequence = existing.length;
    const raised: Variation[] = [];
    const at = new Date().toISOString();
    const actor = { actor: report.author, ...(report.authorId ? { actorId: report.authorId } : {}) };
    for (const o of report.observations) {
      if (o.type !== 'instruction') continue;
      const already = existing.find(v => v.raisedByObservation === o.id);
      if (already) {
        if (report.corrects) {
          already.events.push({ at, ...actor, kind: 'note', note: `Corrected in ${report.reference} rev ${report.revision}: ${o.whatHappened}`, photos: o.photos });
          putRecord('variations', already);
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
        reference: `${project?.projectNumber ?? 'UNKNOWN'}-VO-${String(sequence).padStart(3, '0')}`,
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
      putRecord('variations', variation);
      raised.push(variation);
    }
    return raised;
  });
}

export interface VariationCommand {
  kind: 'details' | 'price' | 'instruct' | 'decline' | 'reopen' | 'note';
  actor: string;
  actorId?: string;
  note: string;
  details?: { description?: string; location?: string; trade?: string; reason?: string; workDone?: boolean };
  costing?: unknown;
  instruction?: { reference?: string; by?: string; on?: string; value?: unknown; signedInstruction?: string };
}

export function applyVariationCommand(id: string, command: VariationCommand): VariationOutcome {
  return atomic(() => {
    const current = getVariation(id);
    if (!current) return refuse('No such variation.', 404);
    const event: VariationEvent = { at: new Date().toISOString(), actor: command.actor, ...(command.actorId ? { actorId: command.actorId } : {}), kind: 'note', note: command.note.trim(), photos: [] };
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
        if (current.instruction !== 'pending') return refuse(`This variation is already ${current.instruction}.`);
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
        if (current.instruction !== 'pending') return refuse(`This variation is already ${current.instruction}.`);
        if (!event.note) return refuse('Say why it was declined. The reason is recorded on the variation.');
        next.instruction = 'declined';
        event.kind = 'declined';
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
    putRecord('variations', next);
    return { ok: true, value: next };
  });
}

/** Instructed value across a project, for the register's project totals. */
export function projectInstructedValue(projectId: string): number {
  return Number(database().prepare("SELECT COALESCE(SUM(json_extract(data,'$.instructedValue')),0) AS n FROM records WHERE kind='variations' AND project=? AND json_extract(data,'$.instruction')='instructed'").get(projectId)!.n);
}

export type { Costing };
