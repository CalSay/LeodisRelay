import type { Principal } from '@relay/platform';
import { atomic, getRecord, putRecord, records } from './storage';
import { canManage } from './auth/access';
import { cleanPermit, closeProblem, londonMinute, permitProblem, permitsAll, projectPermits, withdrawProblem, type Permit, type PermitInput, type PermitsAll, type ProjectPermits } from './permits';

/**
 * Permits to work in the local store, kind `permits`. RELAY's own record:
 * nothing here is written to SharePoint or sent anywhere. Rules in
 * `permits.ts`.
 */

const KIND = 'permits';
const REQUEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PermitOutcome = { ok: true; value: Permit } | { ok: false; status: number; reason: string };

const samePermit = (a: PermitInput, b: Permit) => a.kind === b.kind && (a.reference ?? '') === (b.reference ?? '') && a.work === b.work && a.issuedBy === b.issuedBy
  && a.heldBy === b.heldBy && a.day === b.day && a.ends === b.ends && (a.notes ?? '') === (b.notes ?? '');

/**
 * Keep one permit on a project, recorded by whoever is signed in.
 * `requestId` is the form's own id, so a retry after a lost reply returns the
 * first save rather than keeping the permit twice; the same id with different
 * details is refused.
 */
export function recordPermit(input: PermitInput & { projectId: string; requestId: string }, principal: Principal, now = new Date()): PermitOutcome {
  if (!REQUEST.test(input.requestId)) return { ok: false, status: 422, reason: 'Invalid request.' };
  return atomic(() => {
    const id = `permit-${input.requestId.toLowerCase()}`;
    const permit = cleanPermit(input);
    const previous = getRecord<Permit>(KIND, id);
    if (previous) {
      const same = previous.byId === principal.id && previous.projectId === input.projectId && samePermit(permit, previous);
      return same ? { ok: true, value: previous } : { ok: false, status: 409, reason: 'This permit was already saved with different details. Reload the page.' };
    }
    const problem = permitProblem(permit, londonMinute(now));
    if (problem) return { ok: false, status: 422, reason: problem };
    const kept: Permit = { id, projectId: input.projectId, ...permit, by: principal.name, byId: principal.id, at: now.toISOString() };
    putRecord(KIND, kept);
    return { ok: true, value: kept };
  });
}

/**
 * Close an open permit, confirming the closing check for its kind. Anyone on
 * the project may: the holder may have gone home, and the office closes it
 * once site has said. Closing one already closed returns it unchanged.
 */
export function closePermit(id: string, confirmed: boolean, note: string | undefined, principal: Principal, now = new Date()): PermitOutcome {
  return atomic(() => {
    const permit = getRecord<Permit>(KIND, id);
    if (!permit) return { ok: false, status: 404, reason: 'No such permit.' };
    if (permit.closed) return { ok: true, value: permit };
    if (permit.withdrawn) return { ok: false, status: 409, reason: 'This permit record was withdrawn, so it cannot be closed.' };
    const problem = closeProblem(confirmed, note);
    if (problem) return { ok: false, status: 422, reason: problem };
    const tidyNote = (note ?? '').replace(/\s+/g, ' ').trim();
    const next: Permit = { ...permit, closed: { by: principal.name, byId: principal.id, at: now.toISOString(), ...(tidyNote ? { note: tidyNote } : {}) } };
    putRecord(KIND, next);
    return { ok: true, value: next };
  });
}

/** Whoever recorded the permit, or the office, may withdraw it. */
export function canWithdraw(permit: Permit, principal: Principal): boolean {
  return permit.byId === principal.id || canManage(principal);
}

/**
 * Withdraw a permit recorded by mistake, with the reason. It stays on the page
 * and in the spreadsheet, marked withdrawn, and is left out of the counts.
 * Withdrawing one already withdrawn returns it unchanged.
 */
export function withdrawPermit(id: string, reason: string, principal: Principal, now = new Date()): PermitOutcome {
  return atomic(() => {
    const permit = getRecord<Permit>(KIND, id);
    if (!permit) return { ok: false, status: 404, reason: 'No such permit.' };
    if (permit.withdrawn) return { ok: true, value: permit };
    if (!canWithdraw(permit, principal)) return { ok: false, status: 403, reason: 'Only whoever recorded this permit, or the office, can withdraw it.' };
    const problem = withdrawProblem(reason);
    if (problem) return { ok: false, status: 422, reason: problem };
    const next: Permit = { ...permit, withdrawn: { by: principal.name, byId: principal.id, at: now.toISOString(), reason: reason.replace(/\s+/g, ' ').trim() } };
    putRecord(KIND, next);
    return { ok: true, value: next };
  });
}

export function getPermit(id: string): Permit | undefined { return getRecord<Permit>(KIND, id); }

export function permitsFor(projectId: string, now = new Date()): ProjectPermits {
  return projectPermits(records<Permit>(KIND, projectId), projectId, londonMinute(now));
}

/** Open permits past their end time on these projects, for the office's Needs attention. */
export function permitsAcross(projects: readonly { id: string; projectNumber: string; projectName: string }[], now = new Date()): PermitsAll {
  return permitsAll(projects, projects.flatMap(p => records<Permit>(KIND, p.id)), londonMinute(now));
}
