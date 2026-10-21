import type { Principal } from '@relay/platform';
import { atomic, getRecord, putRecord, records } from './storage';
import { canManage } from './auth/access';
import { cleanDelivery, ukDay, deliveriesAll, deliveryProblem, projectDeliveries, sortedProblem, withdrawProblem, type DeliveriesAll, type Delivery, type DeliveryInput, type ProjectDeliveries } from './deliveries';

/**
 * Deliveries to site in the local store, kind `deliveries`. RELAY's own
 * record: nothing here is written to SharePoint or sent anywhere. Rules in
 * `deliveries.ts`.
 */

const KIND = 'deliveries';
const REQUEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeliveryOutcome = { ok: true; value: Delivery } | { ok: false; status: number; reason: string };

const sameDelivery = (a: DeliveryInput, b: Delivery) => a.supplier === b.supplier && a.items === b.items && (a.noteNumber ?? '') === (b.noteNumber ?? '') && a.day === b.day
  && a.receivedBy === b.receivedBy && (a.storedAt ?? '') === (b.storedAt ?? '') && a.condition === b.condition && (a.problem ?? '') === (b.problem ?? '');

/**
 * Keep one delivery on a project, recorded by whoever is signed in.
 * `requestId` is the form's own id, so a retry after a lost reply returns the
 * first save rather than keeping the delivery twice; the same id with
 * different details is refused.
 */
export function recordDelivery(input: DeliveryInput & { projectId: string; requestId: string }, principal: Principal, now = new Date()): DeliveryOutcome {
  if (!REQUEST.test(input.requestId)) return { ok: false, status: 422, reason: 'Invalid request.' };
  return atomic(() => {
    const id = `delivery-${input.requestId.toLowerCase()}`;
    const delivery = cleanDelivery(input);
    const previous = getRecord<Delivery>(KIND, id);
    if (previous) {
      const same = previous.byId === principal.id && previous.projectId === input.projectId && sameDelivery(delivery, previous);
      return same ? { ok: true, value: previous } : { ok: false, status: 409, reason: 'This delivery was already saved with different details. Reload the page.' };
    }
    const problem = deliveryProblem(delivery, ukDay(now));
    if (problem) return { ok: false, status: 422, reason: problem };
    const kept: Delivery = { id, projectId: input.projectId, ...delivery, by: principal.name, byId: principal.id, at: now.toISOString() };
    putRecord(KIND, kept);
    return { ok: true, value: kept };
  });
}

/**
 * Mark a delivery's problem sorted, saying how. Anyone on the project may:
 * site sees the rest arrive, the office agrees the credit note. Sorting one
 * already sorted returns it unchanged.
 */
export function sortDelivery(id: string, note: string, principal: Principal, now = new Date()): DeliveryOutcome {
  return atomic(() => {
    const delivery = getRecord<Delivery>(KIND, id);
    if (!delivery) return { ok: false, status: 404, reason: 'No such delivery.' };
    if (delivery.sorted) return { ok: true, value: delivery };
    if (delivery.withdrawn) return { ok: false, status: 409, reason: 'This delivery record was withdrawn, so it cannot be marked sorted.' };
    if (delivery.condition === 'complete') return { ok: false, status: 409, reason: 'This delivery arrived all there, so there is nothing to sort.' };
    const problem = sortedProblem(note);
    if (problem) return { ok: false, status: 422, reason: problem };
    const next: Delivery = { ...delivery, sorted: { by: principal.name, byId: principal.id, at: now.toISOString(), note: note.replace(/\s+/g, ' ').trim() } };
    putRecord(KIND, next);
    return { ok: true, value: next };
  });
}

/** Whoever recorded the delivery, or the office, may withdraw it. */
export function canWithdraw(delivery: Delivery, principal: Principal): boolean {
  return delivery.byId === principal.id || canManage(principal);
}

/**
 * Withdraw a delivery recorded by mistake, with the reason. It stays on the
 * page and in the spreadsheet, marked withdrawn, and is left out of the
 * counts. Withdrawing one already withdrawn returns it unchanged.
 */
export function withdrawDelivery(id: string, reason: string, principal: Principal, now = new Date()): DeliveryOutcome {
  return atomic(() => {
    const delivery = getRecord<Delivery>(KIND, id);
    if (!delivery) return { ok: false, status: 404, reason: 'No such delivery.' };
    if (delivery.withdrawn) return { ok: true, value: delivery };
    if (!canWithdraw(delivery, principal)) return { ok: false, status: 403, reason: 'Only whoever recorded this delivery, or the office, can withdraw it.' };
    const problem = withdrawProblem(reason);
    if (problem) return { ok: false, status: 422, reason: problem };
    const next: Delivery = { ...delivery, withdrawn: { by: principal.name, byId: principal.id, at: now.toISOString(), reason: reason.replace(/\s+/g, ' ').trim() } };
    putRecord(KIND, next);
    return { ok: true, value: next };
  });
}

export function getDelivery(id: string): Delivery | undefined { return getRecord<Delivery>(KIND, id); }

export function deliveriesFor(projectId: string, now = new Date()): ProjectDeliveries {
  return projectDeliveries(records<Delivery>(KIND, projectId), projectId, ukDay(now));
}

/** Deliveries still to sort on these projects, for the office's Needs attention. */
export function deliveriesAcross(projects: readonly { id: string; projectNumber: string; projectName: string }[], now = new Date()): DeliveriesAll {
  return deliveriesAll(projects, projects.flatMap(p => records<Delivery>(KIND, p.id)), ukDay(now));
}
