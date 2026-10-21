import { ApiError, getReport, saveReport, submitReport } from './api';
import { CROSS_SITE_CODE } from './failure';
import { compareDrafts } from './draftConflict';
import { heldKey, recover, releaseIfCurrent, update, type HeldDraft } from './localDraft';
import { reviewReport } from './review';
import { SaveConflict } from './saveRequest';
import { checkedCopy, clearWaitingToSend, waitingLines } from './sendOnSignal';
import type { Report } from './types';

/**
 * A site update the engineer tapped "Send to office" on with no signal goes
 * by itself once RELAY can get through, from whichever RELAY page is open
 * (2026-10-21), the way a defect does (heldDefect.ts). The report's own page
 * sends it there; anywhere else components/SendOnSignal.tsx calls this.
 *
 * What goes is the copy the editor held on the phone when Send was tapped
 * (localDraft.ts), and only if it still says what was checked (the waiting
 * line's `checked`): nothing the engineer did not check goes by itself. The signature is
 * the one saved with it, or the author's name, as the editor's Send uses.
 *
 * It only goes once: one send at a time per report on a page (shared with a
 * tap), a Web Lock across tabs that the report's page takes too, and the
 * waiting line read again inside the lock, so a tab that finds it gone
 * (sent from another tab) sends nothing. Behind that the server is safe to
 * repeat: a save replays its journalled request, and sending a report
 * already sent answers with it.
 */
export type UpdateSendResult =
  | { kind: 'sent'; report: Report }
  /** No signal, no answer, signed out or a server fault: kept, and tried again by itself. */
  | { kind: 'waiting' }
  /** Not sent, and it no longer goes by itself: the engineer opens it. */
  | { kind: 'refused'; reportId: string; what: string; reason: string }
  /** Not waiting any more (sent from another tab), changed since Send, or left to its own page. */
  | { kind: 'skipped' };

export interface UpdateSendDeps {
  /** null: no Web Locks (older browsers). */
  locks?: Pick<LockManager, 'request'> | null;
}

const lockName = (reportId: string) => `relay-update-send:${reportId}`;

/** Runs `work` while no other tab is sending `reportId`: the report's page and SendOnSignal both take it. */
export function withUpdateLock<T>(reportId: string, work: () => Promise<T>, deps: UpdateSendDeps = {}): Promise<T> {
  const locks = deps.locks === null ? undefined : deps.locks ?? (typeof navigator !== 'undefined' ? navigator.locks : undefined);
  return locks ? locks.request(lockName(reportId), work) as unknown as Promise<T> : work();
}

/** Sends being made from this page, so the report's page opening meanwhile waits for the answer. */
const inFlight = new Map<string, Promise<UpdateSendResult>>();

/** Whether this page is sending `reportId` by itself now. */
export const updateSending = (reportId: string): boolean => inFlight.has(reportId);

/** Settles once this page is not sending `reportId` by itself: the report's page reads it after that. */
export function updateSendSettled(reportId: string): Promise<void> {
  return (inFlight.get(reportId) ?? Promise.resolve()).then(() => undefined, () => undefined);
}

/** Send `reportId`, waiting on this phone for `principalId`, if it still waits as it was when Send was tapped. */
export function sendWaitingUpdate(reportId: string, principalId: string, deps: UpdateSendDeps = {}): Promise<UpdateSendResult> {
  const running = inFlight.get(reportId);
  if (running) return running;
  const send = withUpdateLock(reportId, () => post(reportId, principalId), deps).finally(() => inFlight.delete(reportId));
  inFlight.set(reportId, send);
  return send;
}

/** Nothing wrong with the work: no signal, signed out, the server at fault, or the cross-site check. */
const waits = (error: unknown) => error instanceof ApiError && (error.offline || error.passing || error.code === CROSS_SITE_CODE);

/** The signature the editor's Send uses: the one saved with the draft, or the author's name. */
export function draftSignatureToSend(report: Report): { dataUrl?: string; name: string; typed?: true } {
  const s = report.draftSignature;
  if (s?.typed && !s.dataUrl) return { name: s.name.trim(), typed: true };
  return { ...(s?.dataUrl ? { dataUrl: s.dataUrl } : {}), name: s?.name.trim() || report.author };
}

async function post(reportId: string, principalId: string): Promise<UpdateSendResult> {
  // Read inside the lock: a tab that sent it first has taken the line away.
  const line = waitingLines(principalId).find(w => w.reportId === reportId);
  // A line from before it held what was checked is left to the report's own page.
  if (!line || line.checked === undefined) return { kind: 'skipped' };
  const what = line.what ?? 'report';
  const stop = (reason: string): UpdateSendResult => { clearWaitingToSend(reportId); return { kind: 'refused', reportId, what, reason }; };
  const held = await recover(reportId, principalId).catch(() => null);
  if (held?.key !== heldKey(reportId, principalId) || !held.report || !Number.isInteger(held.baseVersion)) {
    // Nothing held for it any more: sent already (from another phone, say), or the phone's copy has gone.
    let now: Report | undefined;
    try { now = await getReport(reportId); } catch (error) { return waits(error) ? { kind: 'waiting' } : { kind: 'skipped' }; }
    if (now?.state === 'submitted') { clearWaitingToSend(reportId); return { kind: 'skipped' }; }
    return stop('This phone no longer holds it as you sent it. Open it to check it and send it again.');
  }
  if (checkedCopy(held.observations, held.report.draftSignature) !== line.checked) return stop('It changed after you tapped Send. Open it to check it and send it again.');
  return sendHeld(held as HeldDraft & { report: Report; baseVersion: number }, principalId, stop);
}

async function sendHeld(held: HeldDraft & { report: Report; baseVersion: number }, principalId: string, stop: (reason: string) => UpdateSendResult): Promise<UpdateSendResult> {
  const report: Report = { ...held.report, observations: held.observations, version: held.baseVersion };
  if (report.state !== 'draft') return stop('It is not a draft on this phone. Open it to check it.');
  // The same rule as the button: nothing that would stop the send goes by itself.
  if (reviewReport(report).some(f => f.blocking)) return stop('Something on it needs finishing first. Open it to finish it and send it.');
  const done = async (sent: Report): Promise<UpdateSendResult> => {
    await releaseIfCurrent(report.id, principalId, held.seq);
    clearWaitingToSend(report.id);
    return { kind: 'sent', report: sent };
  };
  const submit = (saved: Report) => submitSaved(held, report, saved, done, stop);
  let saved: Report;
  try { saved = await saveReport(report, held.baseVersion, principalId); }
  catch (error) {
    if (error instanceof SaveConflict) {
      const current = error.current;
      // Sent with these very cards: an earlier try whose answer was lost.
      if (current.state === 'submitted' && !compareDrafts(report, { ...current, ...(report.draftSignature ? { draftSignature: report.draftSignature } : {}) }).differs) return done(current);
      // Saved already with these very cards and signature (a save whose answer was lost): only the sending is left.
      if (current.state === 'draft' && !compareDrafts(report, current).differs) return submit(current);
      return stop(current.state === 'draft' ? 'It was changed somewhere else too. Open it to choose what to keep.' : 'It was sent from somewhere else. Open it to check what went.');
    }
    if (waits(error)) return { kind: 'waiting' };
    return stop(error instanceof Error && error.message ? error.message : 'RELAY could not take it.');
  }
  return submit(saved);
}

/** Saved as checked at `saved.version`: send exactly that to the office. */
async function submitSaved(held: HeldDraft, report: Report, saved: Report, done: (sent: Report) => Promise<UpdateSendResult>, stop: (reason: string) => UpdateSendResult): Promise<UpdateSendResult> {
  // Saved: a lost answer below tries again on this version, rather than saving on the old one.
  await update(held.key, h => h.seq === held.seq ? { ...h, baseVersion: saved.version, report: { ...(h.report ?? saved), version: saved.version } } : undefined).catch(() => null);
  let sent: Report;
  try { sent = await submitReport(saved, draftSignatureToSend(report)); }
  catch (error) {
    if (waits(error)) return { kind: 'waiting' };
    return stop(error instanceof Error && error.message ? error.message : 'RELAY could not send it.');
  }
  return done(sent);
}
