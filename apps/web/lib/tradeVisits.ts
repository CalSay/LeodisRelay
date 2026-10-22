import { naturalOrder } from './naturalOrder';
import type { ReportSummary } from './types';

/**
 * The same trade's site updates either side of one the office is reading, so
 * "what changed since they were last here?" is one click: open the previous
 * update and compare, or step on to the next. Read only from reports already
 * sent; nothing new is asked of site.
 *
 * Counted as the office's "Latest from site" counts them (lib/projectStanding.ts):
 * sent site updates only (an inspection answers its checklist, not progress),
 * and a sent correction stands in for the report it corrects. "The same trade"
 * is the trade the engineer gave; a report without one is matched to the same
 * person instead, by sign-in or else by name.
 */

type Visit = Pick<ReportSummary, 'id' | 'projectId' | 'reference' | 'visitDate' | 'author' | 'authorId' | 'authorTrade' | 'state' | 'corrects' | 'reportType' | 'serverAcknowledgedAt'> & { checks?: unknown };

export interface TradeVisit { id: string; reference: string; visitDate: string; author: string }
export interface TradeVisits {
  /** The trade in words ("Electrical"), or the person's name when the report gives no trade. */
  who: string;
  /** True when `who` is a trade, false when it is a person. */
  trade: boolean;
  previous?: TradeVisit;
  next?: TradeVisit;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isSiteUpdate = (r: Visit) => !r.checks && (!r.reportType || r.reportType === 'progress');
const keyOf = (r: Visit) => r.authorTrade?.trim() ? `trade:${r.authorTrade.trim()}` : `person:${r.authorId ?? r.author.trim()}`;
// Oldest first: the visit day the engineer gave, then when it reached RELAY, then the reference.
interface Place { visitDate: string; at: string; reference: string }
const order = (a: Place, b: Place) => a.visitDate.localeCompare(b.visitDate) || a.at.localeCompare(b.at) || naturalOrder(a.reference, b.reference);
const brief = (r: Visit): TradeVisit => ({ id: r.id, reference: r.reference, visitDate: r.visitDate, author: r.author });

/** Nothing when the report is not a site update, or has no other update from its trade on the project either side. */
export function tradeVisits(report: Visit, reports: Visit[]): TradeVisits | null {
  if (report.state !== 'submitted' || !isSiteUpdate(report) || !DAY.test(report.visitDate)) return null;
  const key = keyOf(report);
  const sent = reports.filter(r => r.projectId === report.projectId && r.state === 'submitted');
  const byId = new Map(sent.map(r => [r.id, r]));
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  // The report's own revisions, earlier and later, are the same visit, not another one.
  const sameVisit = new Set([report.id]);
  for (let id = report.corrects; id && !sameVisit.has(id); id = byId.get(id)?.corrects) sameVisit.add(id);
  for (let grew = true; grew;) { grew = false; for (const r of sent) if (r.corrects && sameVisit.has(r.corrects) && !sameVisit.has(r.id)) { sameVisit.add(r.id); grew = true; } }
  // A correction is placed where the visit it corrects was received, so it does not jump ahead of the visits after it.
  const placed = (r: Visit): Place => {
    let first = r;
    for (let id = r.corrects, steps = 0; id && steps < 50; steps++) { const o = byId.get(id); if (!o) break; first = o; id = o.corrects; }
    return { visitDate: r.visitDate, at: first.serverAcknowledgedAt ?? r.serverAcknowledgedAt ?? '', reference: r.reference };
  };
  const here = placed(report);
  const visits = sent.filter(r => !superseded.has(r.id) && !sameVisit.has(r.id) && isSiteUpdate(r) && DAY.test(r.visitDate) && keyOf(r) === key).map(r => ({ r, at: placed(r) }));
  let before: Visit | undefined, beforeAt: Place | undefined, after: Visit | undefined, afterAt: Place | undefined;
  for (const { r, at } of visits) {
    const c = order(at, here);
    if (c < 0 && (!beforeAt || order(at, beforeAt) > 0)) { before = r; beforeAt = at; }
    if (c > 0 && (!afterAt || order(at, afterAt) < 0)) { after = r; afterAt = at; }
  }
  if (!before && !after) return null;
  const trade = !!report.authorTrade?.trim();
  return { who: trade ? report.authorTrade!.trim() : report.author.trim(), trade, ...(before ? { previous: brief(before) } : {}), ...(after ? { next: brief(after) } : {}) };
}

/** Whole calendar days between two visit days, in words: "the same day", "the day before", "3 days before". */
export function gapWords(from: string, to: string, direction: 'before' | 'after'): string {
  const days = Math.round(Math.abs(Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
  if (!days) return 'the same day';
  if (days === 1) return direction === 'before' ? 'the day before' : 'the day after';
  return `${days} days ${direction}`;
}
