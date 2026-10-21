import { sheetDay, sheetTime, type Cell } from './sheet';

/**
 * Deliveries to site: what a supplier dropped off, on which day, who took it
 * in and where it was put, and whether it was all there and in good order.
 * On an M&E job materials arrive most days; today a short or damaged delivery
 * is a photo of the delivery note in someone's phone, the office hears about
 * it a week later, and nobody can say when the rest arrived.
 *
 * A delivery with a problem (short, damaged or wrong items) stays "To sort"
 * until someone on the project marks it sorted, saying what was done (the
 * rest arrived, a credit note was agreed). The office sees each project's
 * deliveries still to sort in Needs attention, so the supplier is chased
 * while the delivery note is still to hand. RELAY's own record: not part of
 * any report, never sent, never written to SharePoint, and nobody is asked to
 * decide anything; chasing the supplier is still a phone call. A delivery
 * entered by mistake is withdrawn with a reason and stays listed, struck
 * through. The word "delivered" on a report means filed; this is materials.
 */

export type DeliveryCondition = 'complete' | 'short' | 'damaged' | 'wrong';

export const DELIVERY_CONDITIONS: readonly { id: DeliveryCondition; label: string; short: string }[] = [
  { id: 'complete', label: 'All there and in good order', short: 'All there' },
  { id: 'short', label: 'Short or part delivery', short: 'Short' },
  { id: 'damaged', label: 'Damaged', short: 'Damaged' },
  { id: 'wrong', label: 'Wrong items', short: 'Wrong items' },
];
const CONDITION_IDS = new Set<string>(DELIVERY_CONDITIONS.map(c => c.id));
export const isDeliveryCondition = (v: unknown): v is DeliveryCondition => typeof v === 'string' && CONDITION_IDS.has(v);
export const conditionLabel = (c: DeliveryCondition) => DELIVERY_CONDITIONS.find(x => x.id === c)?.label ?? 'Delivery';
export const conditionShort = (c: DeliveryCondition) => DELIVERY_CONDITIONS.find(x => x.id === c)?.short ?? 'Delivery';

export const SUPPLIER_MAX = 80;
export const ITEMS_MAX = 300;
export const NOTE_NUMBER_MAX = 40;
export const NAME_MAX = 80;
export const STORED_MAX = 120;
export const PROBLEM_MAX = 300;
export const SORTED_MAX = 300;
export const REASON_MAX = 200;
/** A delivery is recorded the day it comes, or within a week (the note found in the van). */
export const BACKDATE_DAYS = 7;
/** The page's and home row's "last 7 days" figure. */
export const RECENT_DAYS = 7;

export interface DeliverySign { by: string; byId: string; at: string }
export interface DeliverySorted extends DeliverySign { note: string }
export interface DeliveryWithdrawn extends DeliverySign { reason: string }
export interface Delivery {
  id: string;
  projectId: string;
  supplier: string;
  /** What arrived, as typed. */
  items: string;
  /** The number on the delivery note, if it has one. */
  noteNumber?: string;
  /** The day it arrived, YYYY-MM-DD, UK time. */
  day: string;
  receivedBy: string;
  /** Where it was put, free text. */
  storedAt?: string;
  condition: DeliveryCondition;
  /** What was wrong, when the condition is not complete. */
  problem?: string;
  /** Who typed it into RELAY, and when. */
  by: string;
  byId: string;
  at: string;
  sorted?: DeliverySorted;
  withdrawn?: DeliveryWithdrawn;
}

export interface DeliveryInput { supplier: string; items: string; noteNumber?: string; day: string; receivedBy: string; storedAt?: string; condition: DeliveryCondition; problem?: string }

/** `fine`: arrived all there. `to-sort`: a problem nobody has sorted yet. */
export type DeliveryState = 'fine' | 'to-sort' | 'sorted' | 'withdrawn';

export interface DeliverySummary {
  /** Received in the last `RECENT_DAYS` days, today included. */
  recent: number;
  /** With a problem not yet sorted. */
  toSort: number;
  /** Whether any delivery has ever been recorded here, withdrawn ones aside. */
  any: boolean;
}

export interface ProjectDeliveries { projectId: string; deliveries: Delivery[]; summary: DeliverySummary }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86400000);
const validDay = (day: string) => DAY.test(day) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();
const UK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The day in the UK, `2026-10-21`, so a delivery taken in at 00:30 in summer is on the day people saw it. */
export function ukDay(at: Date | string = new Date()): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  return Number.isNaN(d.getTime()) ? '' : UK_DAY.format(d);
}
const cut = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** The record as it will be kept: trimmed, empty optional fields left out, and no problem kept on a delivery that was all there. */
export function cleanDelivery(input: DeliveryInput): DeliveryInput {
  const noteNumber = tidy(input.noteNumber ?? ''), storedAt = tidy(input.storedAt ?? ''), problem = input.condition === 'complete' ? '' : tidy(input.problem ?? '');
  return { supplier: tidy(input.supplier), items: tidy(input.items), ...(noteNumber ? { noteNumber } : {}), day: input.day.trim(), receivedBy: tidy(input.receivedBy),
    ...(storedAt ? { storedAt } : {}), condition: input.condition, ...(problem ? { problem } : {}) };
}

/** Why this delivery cannot be kept, in words for the form, or nothing if it can. `today` is the UK day. */
export function deliveryProblem(input: DeliveryInput, today: string): string | undefined {
  const d = cleanDelivery(input);
  if (!d.supplier) return 'Say who the supplier is.';
  if (d.supplier.length > SUPPLIER_MAX) return `Keep the supplier to ${SUPPLIER_MAX} characters.`;
  if (!d.items) return 'Say what arrived.';
  if (d.items.length > ITEMS_MAX) return `Keep what arrived to ${ITEMS_MAX} characters.`;
  if ((d.noteNumber ?? '').length > NOTE_NUMBER_MAX) return `Keep the delivery note number to ${NOTE_NUMBER_MAX} characters.`;
  if (!validDay(d.day)) return 'Give the day it arrived.';
  const ago = dayNumber(today) - dayNumber(d.day);
  if (ago < 0) return 'A delivery cannot arrive in the future.';
  if (ago > BACKDATE_DAYS) return `Record a delivery within ${BACKDATE_DAYS} days of it arriving.`;
  if (!d.receivedBy) return 'Say who took it in.';
  if (d.receivedBy.length > NAME_MAX) return `Keep the name of who took it in to ${NAME_MAX} characters.`;
  if ((d.storedAt ?? '').length > STORED_MAX) return `Keep where it was put to ${STORED_MAX} characters.`;
  if (!isDeliveryCondition(d.condition)) return 'Say whether it was all there and in good order.';
  if (d.condition !== 'complete' && !d.problem) return 'Say what was short, damaged or wrong.';
  if ((d.problem ?? '').length > PROBLEM_MAX) return `Keep what was wrong to ${PROBLEM_MAX} characters.`;
  return undefined;
}

/** Why this "sorted" cannot be kept, or nothing if it can. */
export function sortedProblem(note: string): string | undefined {
  const n = tidy(note);
  if (!n) return 'Say how it was sorted, for example that the rest arrived.';
  if (n.length > SORTED_MAX) return `Keep how it was sorted to ${SORTED_MAX} characters.`;
  return undefined;
}

/** Why this withdrawal cannot be kept, or nothing if it can. */
export function withdrawProblem(reason: string): string | undefined {
  const r = tidy(reason);
  if (!r) return 'Say why the delivery record is being withdrawn.';
  if (r.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters.`;
  return undefined;
}

export function deliveryState(d: Delivery): DeliveryState {
  if (d.withdrawn) return 'withdrawn';
  if (d.condition === 'complete') return 'fine';
  return d.sorted ? 'sorted' : 'to-sort';
}

/** Ones to sort first, oldest first (the longest waiting is the one to chase); then the rest, newest arrived first. */
export function deliveryOrder(a: Delivery, b: Delivery): number {
  const rank = (d: Delivery) => deliveryState(d) === 'to-sort' ? 0 : 1;
  return rank(a) - rank(b)
    || (rank(a) === 0 ? a.day.localeCompare(b.day) || a.at.localeCompare(b.at) : b.day.localeCompare(a.day) || b.at.localeCompare(a.at))
    || a.id.localeCompare(b.id);
}

export function deliverySummary(deliveries: readonly Delivery[], today: string): DeliverySummary {
  let recent = 0, toSort = 0, any = false;
  for (const d of deliveries) {
    const state = deliveryState(d);
    if (state === 'withdrawn') continue;
    any = true;
    if (state === 'to-sort') toSort++;
    const ago = dayNumber(today) - dayNumber(d.day);
    if (ago >= 0 && ago < RECENT_DAYS) recent++;
  }
  return { recent, toSort, any };
}

/** One project's deliveries in page order, withdrawn ones included, with the summary that leaves them out. */
export function projectDeliveries(deliveries: readonly Delivery[], projectId: string, today: string): ProjectDeliveries {
  const mine = deliveries.filter(d => d.projectId === projectId).sort(deliveryOrder);
  return { projectId, deliveries: mine, summary: deliverySummary(mine, today) };
}

/** The home row's words: "4 in the last 7 days · 1 to sort", or nothing recorded yet. */
export function deliveryRowWords(s: DeliverySummary): string {
  if (!s.any) return 'None recorded yet · record the next one here';
  const parts = [s.recent ? `${s.recent} in the last ${RECENT_DAYS} days` : `None in the last ${RECENT_DAYS} days`];
  if (s.toSort) parts.push(`${s.toSort} to sort`);
  return parts.join(' · ');
}

/** What the office's Needs attention reads: per project, the deliveries still to sort. */
export interface DeliveryAttentionProject {
  projectId: string; projectNumber: string; projectName: string;
  toSort: { id: string; supplier: string; condition: DeliveryCondition; problem: string; day: string }[];
}
export interface DeliveriesAll { today: string; projects: DeliveryAttentionProject[]; totals: { toSort: number } }

/** Every project's deliveries still to sort, the longest waiting first, for the office. */
export function deliveriesAll(projects: readonly { id: string; projectNumber: string; projectName: string }[], deliveries: readonly Delivery[], today: string): DeliveriesAll {
  let toSort = 0;
  const out: DeliveryAttentionProject[] = [];
  for (const project of projects) {
    const waiting = deliveries.filter(d => d.projectId === project.id && deliveryState(d) === 'to-sort').sort(deliveryOrder);
    toSort += waiting.length;
    if (waiting.length) out.push({ projectId: project.id, projectNumber: project.projectNumber, projectName: project.projectName,
      toSort: waiting.map(d => ({ id: d.id, supplier: d.supplier, condition: d.condition, problem: d.problem ?? '', day: d.day })) });
  }
  out.sort((a, b) => a.toSort[0]!.day.localeCompare(b.toSort[0]!.day) || a.projectNumber.localeCompare(b.projectNumber));
  return { today, projects: out, totals: { toSort } };
}

/** One line for the office's Needs attention lists. */
export interface DeliveryAttention { key: string; projectId: string; projectNumber: string; title: string; sub: string; tag: { label: string; cls: string } }

/**
 * One line per project with deliveries still to sort: the office's next step
 * is the same for all of them (chase the supplier, or open the project's
 * Deliveries to see the notes). Longest waiting first.
 */
export function deliveryAttention(all: Pick<DeliveriesAll, 'projects'>, dayWords: (day: string) => string): DeliveryAttention[] {
  return all.projects.map(p => {
    const first = p.toSort[0]!, n = p.toSort.length;
    return { key: `dl-${p.projectId}`, projectId: p.projectId, projectNumber: p.projectNumber,
      title: n === 1 ? `${conditionShort(first.condition)} delivery from ${cut(first.supplier, 40)}, not sorted yet` : `${n} deliveries with a problem, not sorted yet`,
      sub: `${p.projectName} · ${cut(first.supplier, 40)}: ${cut(first.problem, 60)} · arrived ${dayWords(first.day)}`,
      tag: { label: 'Delivery', cls: 'tag-caution' } };
  });
}

/** Starters for a new delivery: the last few different suppliers on the project, not withdrawn ones, so a regular wholesaler is one tap. */
export function deliverySuppliers(deliveries: readonly Delivery[], max = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of [...deliveries].filter(d => !d.withdrawn).sort((a, b) => b.at.localeCompare(a.at))) {
    const key = d.supplier.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); out.push(d.supplier);
    if (out.length >= max) break;
  }
  return out;
}

export const DELIVERY_COLUMNS = ['Delivery note number', 'Project number', 'Project', 'Supplier', 'What arrived', 'Arrived on', 'Taken in by', 'Where it was put', 'Condition', 'What was wrong', 'Status', 'Sorted at', 'Sorted by', 'How it was sorted', 'Recorded at', 'Recorded by', 'Withdrawn on', 'Withdrawn by', 'Withdrawn because'] as const;

const STATE_WORDS: Record<DeliveryState, string> = { fine: 'All there', 'to-sort': 'To sort', sorted: 'Sorted', withdrawn: 'Withdrawn' };

/** One spreadsheet row per delivery, in the house column order (`lib/sheet.ts`), times in UK time as Excel reads them. */
export function deliveryRows(deliveries: readonly Delivery[], project: { projectNumber: string; projectName: string }): Cell[][] {
  return deliveries.map(d => [d.noteNumber, project.projectNumber, project.projectName, d.supplier, d.items, d.day, d.receivedBy, d.storedAt, conditionLabel(d.condition), d.problem,
    STATE_WORDS[deliveryState(d)], sheetTime(d.sorted?.at), d.sorted?.by, d.sorted?.note, sheetTime(d.at), d.by, sheetDay(d.withdrawn?.at), d.withdrawn?.by, d.withdrawn?.reason]);
}
