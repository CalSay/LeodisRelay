import type { Instruction, Variation, VariationReason, VariationTrade } from './types';

/**
 * Variations, shared by the capture side, the office and the store.
 *
 * The vocabulary and the arithmetic mirror the Variation Register list on the
 * Operations SharePoint site, so a row written there and a record held here
 * say the same thing: the choices are the list's choices, and Expected Cost,
 * Estimated Margin and Margin % are the list's calculated columns, worked the
 * same way. Nothing here invents a figure the list would not.
 */

export const VARIATION_TRADES: readonly VariationTrade[] = ['Electrical', 'HVAC', 'P&H', 'Multi'];
export const VARIATION_REASONS: readonly VariationReason[] = ['Client instruction', 'Design change', 'Site condition', 'Damage by others', 'Omission', 'Spec change'];
export const INSTRUCTION_LABEL: Record<Instruction, string> = { pending: 'Awaiting instruction', instructed: 'Instructed', declined: 'Declined' };

/** The money and hours on a variation. Every figure is optional until the office prices it. */
export type Costing = Pick<Variation, 'labourHours' | 'labourRate' | 'partsCost' | 'plantSubcontract' | 'upliftPct' | 'quotedValue' | 'instructedValue'>;
export const COSTING_FIELDS = ['labourHours', 'labourRate', 'partsCost', 'plantSubcontract', 'upliftPct', 'quotedValue', 'instructedValue'] as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Labour × rate + parts + plant. Undefined until at least one cost is known. */
export function expectedCost(c: Costing): number | undefined {
  if ([c.labourHours, c.labourRate, c.partsCost, c.plantSubcontract].every(x => x === undefined)) return undefined;
  return round2((c.labourHours ?? 0) * (c.labourRate ?? 0) + (c.partsCost ?? 0) + (c.plantSubcontract ?? 0));
}

/** What the variation is worth: the instructed value once instructed, the quote until then. */
export function variationValue(v: Costing & { instruction: Instruction }): number | undefined {
  return v.instruction === 'instructed' ? (v.instructedValue ?? v.quotedValue) : v.quotedValue;
}

export function estimatedMargin(v: Costing & { instruction: Instruction }): number | undefined {
  const value = variationValue(v), cost = expectedCost(v);
  return value === undefined || cost === undefined ? undefined : round2(value - cost);
}

/** Margin as a fraction of the value, as the list works it. Undefined when there is no positive value to divide by. */
export function marginPct(v: Costing & { instruction: Instruction }): number | undefined {
  const value = variationValue(v), margin = estimatedMargin(v);
  return value === undefined || value <= 0 || margin === undefined ? undefined : margin / value;
}

/** Expected cost with the uplift on top: the starting point for a quote, never the quote itself. */
export function suggestedQuote(c: Costing): number | undefined {
  const cost = expectedCost(c);
  return cost === undefined ? undefined : round2(cost * (1 + (c.upliftPct ?? 0) / 100));
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (n: number | undefined): string => n === undefined ? '—' : GBP.format(n);
export const fmtPct = (n: number | undefined): string => n === undefined ? '—' : `${(n * 100).toFixed(1)}%`;
export const fmtHours = (n: number | undefined): string => n === undefined ? '—' : `${n % 1 === 0 ? n : n.toFixed(1)} h`;

/**
 * Read a costing from a form or a request body. Blank means "not known", and
 * is kept apart from zero: a variation with no parts is £0.00 of parts, a
 * variation nobody has priced has no parts figure at all.
 */
export function readCosting(input: unknown): { ok: true; value: Costing } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'Costing must be an object.' };
  const raw = input as Record<string, unknown>;
  const value: Costing = {};
  for (const key of COSTING_FIELDS) {
    const given = raw[key];
    if (given === undefined || given === null || given === '') continue;
    const n = typeof given === 'number' ? given : typeof given === 'string' ? Number(given.replace(/[£,\s]/g, '')) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, reason: `${LABEL[key]} must be a number from 0 to 10,000,000.` };
    value[key] = key === 'labourHours' ? round2(n) : key === 'upliftPct' ? round2(n) : round2(n);
  }
  return { ok: true, value };
}
export const LABEL: Record<keyof Costing, string> = {
  labourHours: 'Expected labour (hours)', labourRate: 'Labour rate', partsCost: 'Expected parts cost',
  plantSubcontract: 'Plant and subcontract', upliftPct: 'Uplift %', quotedValue: 'Quoted value', instructedValue: 'Instructed value',
};
