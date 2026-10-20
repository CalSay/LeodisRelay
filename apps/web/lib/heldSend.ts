import { ApiError, sendHeldSave, startHeldReport } from './api';
import { clientId } from './clientId';
import { adoptStarted, listHeld, update, type HeldDraft } from './localDraft';
import { planHeldSend } from './offlineStart';
import { SaveConflict } from './saveRequest';

export interface HeldSendResult {
  /** Reports whose held work is now on the server. */
  sent: { reportId: string; reference: string; projectName?: string | undefined; started: boolean }[];
  /** Held work that needs the engineer: a refusal, or a version to choose. Each is reported once. */
  problems: { reportId?: string; title: string; reason: string }[];
}

let running: Promise<HeldSendResult> | undefined;

/**
 * Reports whose held copy this page means to send: queued until its turn, then
 * in flight until its result is written. An editor that opens on a queued
 * report takes it over (its own save path sends it), so it waits only for a
 * save already in flight for its own report, never for other reports' uploads.
 */
const pending = new Map<string, { settled: Promise<void>; done: () => void; flying: boolean }>();
const takenOver = new Set<string>();
function hold(reportId: string): void {
  if (pending.has(reportId)) return;
  let done!: () => void;
  const settled = new Promise<void>(resolve => { done = resolve; });
  pending.set(reportId, { settled, flying: false, done: () => { pending.delete(reportId); done(); } });
}
const release = (reportId: string) => pending.get(reportId)?.done();

/**
 * Settles once `reportId`'s held copy is safe for its editor to read: at once
 * if this page is not sending it or has only queued it (the editor takes it
 * over), or when a save already in flight for it has finished.
 */
export function heldSendSettled(reportId: string): Promise<void> {
  const entry = pending.get(reportId);
  if (!entry) return Promise.resolve();
  if (!entry.flying) { takenOver.add(reportId); entry.done(); return Promise.resolve(); }
  return entry.settled;
}

/** Whether this page is sending `reportId`'s held copy now, for the words while the editor waits. */
export const heldSendBusy = (reportId: string): boolean => !!pending.get(reportId)?.flying;

/**
 * Send what this device holds for `principalId` from the offline page: start
 * each report begun offline, then save each copy last changed there. Runs one
 * at a time per page; a second call while one runs shares it.
 *
 * With no connection it stops quietly and keeps everything. A refusal is kept
 * on the device and named once. A save refused because the draft moved on
 * elsewhere is handed to the report's editor, which already shows both
 * versions to choose from, so the device copy is never lost or forced over
 * the server's.
 */
export function sendHeldWork(principalId: string): Promise<HeldSendResult> {
  running ??= run(principalId).finally(() => { running = undefined; });
  return running;
}

async function run(principalId: string): Promise<HeldSendResult> {
  try { return await sendAll(principalId); }
  finally { for (const reportId of [...pending.keys()]) release(reportId); takenOver.clear(); }
}

async function sendAll(principalId: string): Promise<HeldSendResult> {
  const result: HeldSendResult = { sent: [], problems: [] };
  const firstPlan = planHeldSend(await listHeld(principalId), principalId);
  for (const held of firstPlan.send) hold(held.reportId);
  const startedReports = new Set<string>();
  const names = new Map<string, string>();
  for (const held of firstPlan.start) {
    const started = held.started!;
    let report;
    try { report = await startHeldReport(started.projectId, started.clientKey, started.visitDate); }
    catch (error) {
      if (error instanceof ApiError && error.offline) return result;
      await noteProblem(held, error, result, `New site update · ${started.projectName}`, true);
      continue;
    }
    const key = await adoptStarted(held.key, report);
    if (key) { hold(report.id); startedReports.add(report.id); names.set(report.id, started.projectName); }
  }
  // Read again: the adopted copies are now ordinary held copies marked to go up.
  const plan = planHeldSend(await listHeld(principalId), principalId).send;
  for (const held of plan) if (!takenOver.has(held.reportId)) hold(held.reportId);
  for (const held of plan) {
    const entry = pending.get(held.reportId);
    if (!entry) continue; // Its editor opened and took it over.
    entry.flying = true;
    try { if (await sendOne(held, result, startedReports, names) === 'offline') return result; }
    finally { release(held.reportId); }
  }
  return result;
}

async function sendOne(held: HeldDraft, result: HeldSendResult, startedReports: ReadonlySet<string>, names: ReadonlyMap<string, string>): Promise<'offline' | void> {
  const claimed = await update(held.key, h => !h.heldOffline || !Number.isInteger(h.baseVersion) ? undefined
    : h.sending && h.sending.seq === h.seq ? h
    : { ...h, sending: { requestId: clientId(), seq: h.seq, expectedVersion: h.baseVersion! } });
  if (!claimed?.heldOffline || !claimed.sending) return;
  const sending = claimed.sending;
  let saved;
  try { saved = await sendHeldSave(claimed.reportId, { requestId: sending.requestId, expectedVersion: sending.expectedVersion, observations: claimed.observations }); }
  catch (error) {
    if (error instanceof ApiError && error.offline) return 'offline';
    await noteProblem(claimed, error, result, claimed.report?.reference ?? 'A report on this phone', false);
    return;
  }
  // Remove the copy only if it is still the one sent; newer typing stays, built on the saved version.
  await update(claimed.key, h => h.seq === sending.seq ? null
    : { ...h, baseVersion: saved.version, report: saved, sending: undefined });
  result.sent.push({ reportId: saved.id, reference: saved.reference, projectName: names.get(saved.id) ?? saved.projectSnapshot?.projectName, started: startedReports.has(saved.id) });
}

async function noteProblem(held: HeldDraft, error: unknown, result: HeldSendResult, title: string, retry: boolean): Promise<void> {
  const conflict = error instanceof SaveConflict;
  const reason = conflict
    ? (error.current.state === 'draft' ? 'It was changed somewhere else too. Open it to choose what to keep.' : 'It was sent from somewhere else. Open it to keep your changes as a correction.')
    : error instanceof Error ? error.message : 'It could not go to the server.';
  // A start that was refused is tried again next time (a project may reopen);
  // a save that was refused goes to the editor, which knows how to compare it.
  await update(held.key, h => ({ ...h, problem: reason, sending: undefined, ...(retry ? {} : { heldOffline: undefined }) })).catch(() => null);
  if (held.problem !== reason) result.problems.push({ ...(held.started ? {} : { reportId: held.reportId }), title, reason });
}
