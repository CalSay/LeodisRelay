import type { DefectInput } from './defects';
import type { Issue } from './types';

/**
 * A quick defect is held on the phone while it is written, one per person and
 * project (`relay-defect:<person>:<project>`). Tapping Send freezes it
 * (`pending`) with its request id; from then on it goes to the office by
 * itself when RELAY can get through (2026-10-21), from whichever RELAY page is
 * open, and "Try again" sends the same one. A draft never sent is never sent
 * by itself.
 *
 * It only goes once: the server keeps one issue per person and request id and
 * answers a repeat with the same issue (defectStore.ts). On this side, one
 * send at a time per defect (a Web Lock across tabs where the browser has
 * them), and a defect no longer held, or held with another id, is not sent by
 * itself.
 */
export const DEFECT_KEY_PREFIX = 'relay-defect:';
export const defectKey = (principalId: string, projectId: string) => `${DEFECT_KEY_PREFIX}${principalId}:${projectId}`;

export type HeldDefect = DefectInput & { pending: boolean };

/**
 * The last receipt for `key`'s defect (`relay-defect-receipt:<person>:<project>`),
 * one per person and project, so another tab showing the same defect can say
 * it went without sending it again.
 */
export const receiptKey = (key: string) => key.replace(DEFECT_KEY_PREFIX, 'relay-defect-receipt:');
export interface DefectReceipt { requestId: string; issue: Pick<Issue, 'id' | 'reference'> }
export function readReceipt(raw: string | null, requestId: string): DefectReceipt['issue'] | null {
  try {
    const r = JSON.parse(raw ?? 'null') as DefectReceipt | null;
    return r?.requestId === requestId && typeof r.issue?.id === 'string' && typeof r.issue.reference === 'string' ? { id: r.issue.id, reference: r.issue.reference } : null;
  } catch { return null; }
}

/** Sent to the window when a held defect went by itself, or was refused; the defect screen showing it takes it (preventDefault). */
export const DEFECT_RESULT_EVENT = 'relay-defect-result';
/** Sent to the window whenever a send of a held defect ends, by itself or from a tap, however it went. */
export const DEFECT_SETTLED_EVENT = 'relay-defect-settled';
export interface DefectResult { key: string; requestId: string; result: DefectSendResult }

export type DefectSendResult =
  | { kind: 'sent'; issue: Issue }
  /** No signal, no answer, signed out or a server fault: kept, and tried again by itself. */
  | { kind: 'waiting'; reason: string }
  /** The server will not take it as it is: kept, but not tried again by itself. `editable` unfreezes it to change. */
  | { kind: 'refused'; reason: string; editable: boolean }
  /** Not held any more (sent from another tab), or another send of it is running. */
  | { kind: 'skipped' };

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { length?: number; key?(index: number): string | null };
export interface SendDeps {
  store?: Store;
  fetch?: typeof fetch;
  blob?: (id: string) => Promise<Blob | undefined>;
  /** null: no Web Locks (older browsers). */
  locks?: Pick<LockManager, 'request'> | null;
}

const local = (given?: Store): Store | undefined => {
  if (given) return given;
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
};

/** A held defect as stored, or null if it is missing or not one RELAY wrote for this project. */
export function readHeldDefect(raw: string | null, projectId: string): HeldDefect | null {
  try {
    const old: unknown = JSON.parse(raw ?? 'null');
    if (!old || typeof old !== 'object') return null;
    const d = old as HeldDefect;
    if (d.projectId !== projectId || typeof d.requestId !== 'string' || typeof d.description !== 'string' || typeof d.location !== 'string' || typeof d.affectedTrade !== 'string' || !Array.isArray(d.photos)) return null;
    if (!d.photos.every((p: { id?: string; dataUrl?: string }) => p?.id && p.dataUrl === `/api/media/${p.id}`)) return null;
    return { ...d, pending: d.pending === true };
  } catch { return null; }
}

/** Defects `principalId` tapped Send on, still held on this device. */
export function heldDefectsToSend(principalId: string, given?: Store): { key: string; defect: HeldDefect }[] {
  const s = local(given);
  if (!s || typeof s.length !== 'number' || !s.key) return [];
  const prefix = `${DEFECT_KEY_PREFIX}${principalId}:`, found: { key: string; defect: HeldDefect }[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (!key?.startsWith(prefix)) continue;
      const defect = readHeldDefect(s.getItem(key), key.slice(prefix.length));
      if (defect?.pending) found.push({ key, defect });
    }
  } catch { return []; }
  return found;
}

/** Sends being made from this page: a timer and a tap at once share one send and its answer. */
const inFlight = new Map<string, Promise<DefectSendResult>>();
/** Refused on this page, by a tap or by itself: left for "Try again", not sent again by itself until RELAY is reopened. */
const refusedHere = new Set<string>();

/**
 * Sends `defect`, frozen, as held under `key`. `onlyIfHeld` (sending by
 * itself) skips it unless the device still holds this very request: once
 * another tab has its receipt, it is not sent again. A tap sends it anyway,
 * which for a defect already received just fetches the same issue.
 */
export function sendHeldDefect(key: string, defect: HeldDefect, onlyIfHeld: boolean, deps: SendDeps = {}): Promise<DefectSendResult> {
  const running = inFlight.get(defect.requestId);
  if (running) return running;
  // A tap tries again: whatever happens next decides whether it goes by itself.
  if (!onlyIfHeld) refusedHere.delete(defect.requestId);
  else if (refusedHere.has(defect.requestId)) return Promise.resolve({ kind: 'skipped' });
  const locks = deps.locks === null ? undefined : deps.locks ?? (typeof navigator !== 'undefined' ? navigator.locks : undefined);
  // Across tabs it waits its turn: the tab holding the lock gets the receipt (this one then skips) or gives up.
  const send = (locks ? locks.request(`relay-defect-send:${defect.requestId}`, () => post(key, defect, onlyIfHeld, deps)) as unknown as Promise<DefectSendResult> : post(key, defect, onlyIfHeld, deps))
    .then(result => { if (result.kind === 'refused') refusedHere.add(defect.requestId); else if (result.kind === 'sent') refusedHere.delete(defect.requestId); return result; })
    .finally(() => {
      inFlight.delete(defect.requestId);
      // However it was sent, a page showing what waits on this phone can look again.
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEFECT_SETTLED_EVENT));
    });
  inFlight.set(defect.requestId, send);
  return send;
}

async function post(key: string, defect: HeldDefect, onlyIfHeld: boolean, deps: SendDeps): Promise<DefectSendResult> {
  const s = local(deps.store);
  const held = () => { try { return readHeldDefect(s?.getItem(key) ?? null, defect.projectId); } catch { return null; } };
  const now = held();
  // Something to change before it can go: unfrozen on the phone, so it is not sent by itself as it is.
  const refuse = (reason: string, editable: boolean): DefectSendResult => {
    if (editable) try { const h = held(); if (h?.requestId === defect.requestId) s?.setItem(key, JSON.stringify({ ...h, pending: false })); } catch { /* Storage blocked: it is refused again next time. */ }
    return { kind: 'refused', reason, editable };
  };
  if (onlyIfHeld && (!now?.pending || now.requestId !== defect.requestId)) return { kind: 'skipped' };
  const blob = deps.blob ?? (await import('./localMedia')).localBlob;
  const form = new FormData();
  form.set('defect', JSON.stringify({ ...defect, pending: true }));
  let size = 0;
  for (const p of defect.photos) {
    const b = await blob(p.id);
    if (!b) return { kind: 'refused', reason: 'A photograph is missing from this phone. Keep this defect and tell the office.', editable: false };
    size += b.size;
    form.set(p.id, b, p.id);
  }
  if (size > 40 * 1024 * 1024) return refuse('Use photographs totalling no more than 40 MB.', true);
  let response: Response;
  try { response = await (deps.fetch ?? fetch)('/api/issues', { method: 'POST', body: form }); }
  catch { return { kind: 'waiting', reason: 'No signal, or no answer from RELAY. Your defect is kept on this phone.' }; }
  let data: { reason?: string } & Partial<Issue> = {};
  try { data = await response.json(); } catch { /* No body: the status says enough. */ }
  if (response.ok && typeof data.id === 'string') {
    // Only this request's copy: a newer defect started since is left alone.
    try {
      s?.setItem(receiptKey(key), JSON.stringify({ requestId: defect.requestId, issue: { id: data.id, reference: String(data.reference) } } satisfies DefectReceipt));
      if (held()?.requestId === defect.requestId) s?.removeItem(key);
    } catch { /* Storage blocked: the server answers a repeat with the same issue. */ }
    return { kind: 'sent', issue: data as Issue };
  }
  if (response.status === 401) return { kind: 'waiting', reason: 'You are signed out. Your defect is kept on this phone and goes once you sign in again.' };
  // 400 is the route's own "could not be received, retry the same submission" (a body cut short, say).
  if (response.ok || response.status >= 500 || [400, 408, 429].includes(response.status)) return { kind: 'waiting', reason: 'RELAY did not answer properly. Your defect is kept on this phone and goes by itself when it does.' };
  return refuse(data.reason ?? 'RELAY could not take this defect.', response.status === 422 || response.status === 413);
}

/** Whether this page is sending `requestId` now (a tap, say), so sending by itself leaves it to that send. */
export const sendingNow = (requestId: string): boolean => inFlight.has(requestId);

/** Says how a defect sent by itself went: false when the defect screen showing it took the news itself. */
export function announceDefectResult(key: string, requestId: string, result: DefectSendResult): boolean {
  if (typeof window === 'undefined') return false;
  return window.dispatchEvent(new CustomEvent<DefectResult>(DEFECT_RESULT_EVENT, { detail: { key, requestId, result }, cancelable: true }));
}
