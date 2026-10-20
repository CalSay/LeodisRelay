import { ApiError, sendHeldSave, sendHeldSigned, startHeldReport } from './api';
import { clientId } from './clientId';
import { adoptStarted, listHeld, update, type HeldDraft } from './localDraft';
import { heldSignature, planHeldSend, signedAsIs, startedTitle } from './offlineStart';
import type { Report } from './types';
import { SaveConflict } from './saveRequest';

export interface HeldSendResult {
  /** Reports whose held work is now on the server. */
  sent: { reportId: string; reference: string; projectName?: string | undefined; started: boolean; submitted?: boolean }[];
  /** Held work that needs the engineer: a refusal, or a version to choose. Each is reported once. */
  problems: { reportId?: string; title: string; reason: string; headline?: string }[];
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
    try { report = await startHeldReport(started.projectId, started.clientKey, started.visitDate, started.reportType, started.inspected); }
    catch (error) {
      if (error instanceof ApiError && error.offline) return result;
      await noteProblem(held, error, result, startedTitle(started), true);
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
  // Signed on the phone, then changed (the checklist was reworded on the
  // server, say): the signature does not go. The work goes up as a draft and
  // the engineer is told to check it and sign again.
  if (held.signed && !signedAsIs(held)) {
    const seq = held.seq;
    const now = await update(held.key, h => h.seq === seq ? unsign(h) : undefined);
    if (now?.seq !== seq || now.signed) return;
    result.problems.push({ reportId: held.reportId, title: held.report?.reference ?? 'A signed inspection', reason: CHANGED_AFTER_SIGNING, headline: NOT_SENT });
    held = now;
  }
  // Saved on the server last time, but not yet sent: only the sending is left.
  if (held.signed?.savedVersion !== undefined) return submitSigned(held, held.signed.savedVersion, result, startedReports, names);
  const claimed = await update(held.key, h => !h.heldOffline || !Number.isInteger(h.baseVersion) ? undefined
    : h.sending && h.sending.seq === h.seq ? h
    : { ...h, sending: { requestId: clientId(), seq: h.seq, expectedVersion: h.baseVersion! } });
  if (!claimed?.heldOffline || !claimed.sending) return;
  const sending = claimed.sending;
  const signed = claimed.signed && signedAsIs(claimed) ? claimed.signed : undefined;
  // An inspection changed on the phone and not signed there as it now stands
  // goes up unsigned: any signature the draft held (from the phone, or from
  // RELAY before the change) is cleared, so none covers content it never saw.
  const inspection = claimed.observations.some(o => o.check);
  let saved: Report;
  try {
    saved = await sendHeldSave(claimed.reportId, { requestId: sending.requestId, expectedVersion: sending.expectedVersion, observations: claimed.observations,
      ...(signed ? { signature: heldSignature(signed) } : inspection ? { signature: null } : {}) });
  }
  catch (error) {
    if (error instanceof ApiError && error.offline) return 'offline';
    await noteProblem(claimed, error, result, claimed.report?.reference ?? 'A report on this phone', false);
    return;
  }
  if (signed) {
    // Keep the copy until it is sent, marked as saved, so a lost connection now
    // finishes the send next time rather than saving it again.
    // The phone's signature stays out of the copy's report, so an editor that takes it over shows it unsigned.
    const kept = await update(claimed.key, h => h.seq === sending.seq && h.signed
      ? { ...without(h, 'sending'), baseVersion: saved.version, report: unsignedReport(saved), signed: { ...h.signed, savedVersion: saved.version } } : undefined);
    if (kept?.signed?.savedVersion === saved.version) return submitSigned(kept, saved.version, result, startedReports, names);
  }
  // Remove the copy only if it is still the one sent; newer typing stays, built
  // on the saved version (and goes up unsigned next time, clearing what this save carried).
  const after = await update(claimed.key, h => h.seq === sending.seq ? null
    : { ...without(h, 'sending'), baseVersion: saved.version, report: inspection ? unsignedReport(saved) : saved });
  // Changed while the signed copy was going up (an editor took it over): the
  // signature just saved no longer covers what is on the phone, so clear it.
  // If that editor has saved meanwhile, this is refused and its save stands.
  if (signed && after) await sendHeldSave(saved.id, { requestId: clientId(), expectedVersion: saved.version, observations: saved.observations, signature: null }).catch(() => undefined);
  result.sent.push({ reportId: saved.id, reference: saved.reference, projectName: names.get(saved.id) ?? saved.projectSnapshot?.projectName, started: startedReports.has(saved.id) });
}

const NOT_SENT = 'signed, but not sent to the office.';
const CHANGED_AFTER_SIGNING = 'It changed after you signed it, so it was not sent. Open it to check it and sign again.';

/** A copy of `h` without `keys`. */
function without(h: HeldDraft, ...keys: (keyof HeldDraft)[]): HeldDraft {
  const copy = { ...h };
  for (const key of keys) delete copy[key];
  return copy;
}

/** A report without its draft signature. */
function unsignedReport(report: Report): Report {
  const { draftSignature: _drawn, ...rest } = report;
  return rest;
}

/** A held copy with its signature taken back, as the offline page's "Take back" leaves it. */
function unsign(h: HeldDraft): HeldDraft {
  const { signed: _signed, ...rest } = h;
  if (!rest.report?.draftSignature) return rest;
  const { draftSignature: _drawn, ...report } = rest.report;
  return { ...rest, report };
}

/**
 * Send a signed inspection, saved on the server at `version`, to the office.
 * The server sends exactly what it holds at that version, which is what was
 * signed. If it refuses (the project closed, say), the draft stays on the
 * server, its signature is cleared so it is never sent later with other
 * content, and the engineer is told to open it.
 */
async function submitSigned(held: HeldDraft, version: number, result: HeldSendResult, startedReports: ReadonlySet<string>, names: ReadonlyMap<string, string>): Promise<'offline' | void> {
  const signed = held.signed!;
  const name = (r: Pick<Report, 'id' | 'projectSnapshot'>) => names.get(r.id) ?? r.projectSnapshot?.projectName;
  let sent: Report;
  try { sent = await sendHeldSigned(held.reportId, heldSignature(signed), version); }
  catch (error) {
    if (error instanceof ApiError && error.offline) return 'offline';
    const reason = error instanceof Error ? error.message : 'The server would not send it.';
    // A fault on the server's side (a 5xx): kept as it is, signed and saved,
    // and tried again next time. Named once. A refusal (4xx) is final.
    if (!(error instanceof ApiError) || error.status === undefined || error.status >= 500) {
      const kept = await update(held.key, h => h.signed?.savedVersion === version ? { ...h, problem: reason } : undefined).catch(() => null);
      if (kept && held.problem !== reason) result.problems.push({ reportId: held.reportId, title: held.report?.reference ?? 'A signed inspection', reason: `${reason} It is signed and saved, and RELAY tries again next time it opens.`, headline: 'not sent to the office yet.' });
      return;
    }
    // Best effort: a signature left on the draft would show it signed for content it may later not match.
    await sendHeldSave(held.reportId, { requestId: clientId(), expectedVersion: version, observations: held.observations, signature: null }).catch(() => undefined);
    await update(held.key, h => h.signed?.savedVersion === version ? null : undefined).catch(() => null);
    const title = held.report?.reference ?? 'A signed inspection';
    result.problems.push({ reportId: held.reportId, title, reason: `It is saved as a draft. ${reason} Open it to finish it and sign again.`, headline: NOT_SENT });
    return;
  }
  await update(held.key, h => h.signed?.savedVersion === version ? null : undefined);
  // Sent from somewhere else after this phone saved it: what went is not what was signed here.
  if (sent.state !== 'submitted' || sent.version !== version) {
    result.problems.push({ reportId: sent.id, title: sent.reference, reason: 'It was sent from somewhere else before this phone could send it. Open it to check what went.', headline: 'sent from somewhere else.' });
    return;
  }
  result.sent.push({ reportId: sent.id, reference: sent.reference, projectName: name(sent), started: startedReports.has(sent.id), submitted: true });
}

async function noteProblem(held: HeldDraft, error: unknown, result: HeldSendResult, title: string, retry: boolean): Promise<void> {
  const conflict = error instanceof SaveConflict;
  const why = conflict
    ? (error.current.state === 'draft' ? 'It was changed somewhere else too. Open it to choose what to keep.' : 'It was sent from somewhere else. Open it to keep your changes as a correction.')
    : error instanceof Error ? error.message : 'It could not go to the server.';
  const reason = held.signed && !retry ? `${why} Your signature from the phone was not used: sign it there.` : why;
  // A start that was refused is tried again next time (a project may reopen);
  // a save that was refused goes to the editor, which knows how to compare it.
  // A save handed to the editor loses its phone signature: the editor shows what to keep, and it is signed there.
  await update(held.key, h => ({ ...(retry ? without(h, 'sending') : without(unsign(h), 'sending', 'heldOffline')), problem: reason })).catch(() => null);
  if (held.problem !== reason) result.problems.push({ ...(held.started ? {} : { reportId: held.reportId }), title, reason });
}
