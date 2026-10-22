import type { Observation, Report } from './types';
import { CHECKLIST_TYPES, reportTypeOf, type ReportTypeId } from './reportTypes';
import { signs } from './signature';
import type { HeldSignature } from './api';

/**
 * Reports started on a phone with no signal, and work typed on the offline
 * page, and how both reach the server once it can be reached (FE-3e).
 *
 * The offline page (public/offline.js) is a static file the service worker
 * keeps, so it can open when RELAY is started with no connection at all. It
 * cannot ask the server who is signed in or which projects are open, so the
 * app leaves both on the device while it has a connection: the person (name
 * and id, no credentials) and the projects they may report on (number and
 * name). Signing out removes them. Nothing about a report is cached by the
 * service worker; held work lives in the same device store as before
 * (localDraft.ts, localMedia.ts).
 *
 * A report started offline has no server id or reference yet. It is held
 * under its own key with a client key, which the server uses to make starting
 * it idempotent: a start that reached the server but whose answer was lost
 * returns the same report when it is retried, never a second one.
 */

/** The person last signed in on this device, for the offline page. */
export const OFFLINE_PERSON_KEY = 'relay-offline-person';
/** That person's reportable projects, for starting a report offline. */
export const offlineProjectsKey = (principalId: string) => `relay-offline-projects:${principalId}`;

/**
 * The inspection types and their checks, so the offline page can start one.
 * Not personal (the same for everyone), so it stays when a person signs out.
 */
export const OFFLINE_TYPES_KEY = 'relay-offline-types';

export interface OfflinePerson { id: string; name: string }
export interface OfflineProject { id: string; projectNumber: string; projectName: string }

/** What the device knows about a report started with no connection. */
export interface StartedOffline {
  clientKey: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  visitDate: string;
  startedAt: string;
  /** Absent: a site update. An inspection starts with its checks already on the phone. */
  reportType?: ReportTypeId;
  /** On a type that inspects one thing, its name as typed on the phone (a tower inspection's tower). */
  inspected?: string;
}

/** What the offline page needs to start each inspection: its name, line and checks. */
export interface OfflineType { id: ReportTypeId; name: string; blurb: string; raisesIssues: boolean; inspects?: { label: string; placeholder: string; hint: string }; checklist: { item: string; question: string; hint: string }[] }
export const offlineTypes = (): OfflineType[] => CHECKLIST_TYPES.map(t => ({
  id: t.id, name: t.name, blurb: t.blurb, raisesIssues: t.raisesRecords, ...(t.inspects ? { inspects: { ...t.inspects } } : {}),
  checklist: (t.checklist ?? []).map(c => ({ item: c.item, question: c.question, hint: c.hint })),
}));

/** "New site update · Tetley Hall", "New safety inspection · Tetley Hall": a report with no reference yet. */
export const startedTitle = (started: Pick<StartedOffline, 'reportType' | 'projectName' | 'inspected'>): string =>
  `New ${reportTypeOf(started).name.toLowerCase()}${started.inspected ? ` of ${started.inspected}` : ''} · ${started.projectName}`;

/**
 * The checks a report started offline takes to the server, fitted onto the
 * cards the server started it with. Each answer, its words and photographs
 * move onto the server's check for the same item, so the server's ids and
 * wording are kept and the save keeps the inspection's shape. A check no
 * longer on the server's inspection is dropped if nothing was put on it. If
 * one the phone answered is gone (the checklist changed in between), the
 * phone's copy is returned unchanged: the server refuses it,
 * and it stays on the phone, named once, rather than losing an answer.
 */
export function fitStartedChecks(held: readonly Observation[], server: readonly Observation[]): Observation[] {
  if (!server.some(o => o.check)) return [...held];
  const byItem = new Map(held.filter(o => o.check).map(o => [o.check!.item, o]));
  // A check gone from the server's inspection matters only if the phone put something on it.
  const used = (o: Observation) => Boolean(o.check?.answer || o.location || o.whatHappened || o.actionNeeded || o.owner || o.photos.length);
  if (held.length !== byItem.size || held.some(o => used(o) && !server.some(s => s.check?.item === o.check?.item))) return [...held];
  return server.map(card => {
    const mine = card.check ? byItem.get(card.check.item) : undefined;
    if (!mine) return card;
    const { answer } = mine.check!;
    return { ...card, location: mine.location, whatHappened: mine.whatHappened, actionNeeded: mine.actionNeeded, owner: mine.owner, photos: mine.photos,
      check: { ...card.check!, ...(answer ? { answer } : {}) } };
  });
}

/** The fields of a held copy (localDraft.ts HeldDraft) that the send needs. */
export interface HeldWork {
  key: string;
  reportId: string;
  principalId: string;
  seq: number | string;
  observations: Observation[];
  heldAt: string;
  baseVersion?: number;
  report?: Report;
  tab?: string;
  started?: StartedOffline;
  /** Last changed on the offline page, so nobody's editor is holding it: it can go up by itself. */
  heldOffline?: boolean;
  /** The save being sent, kept so a retry after a lost answer reuses its request id. */
  sending?: { requestId: string; seq: number | string; expectedVersion: number };
  /** Why it could not go up last time, so the same failure is not reported on every page. */
  problem?: string;
  /** Signed on the offline page: it goes to the office by itself, if nothing changed since. */
  signed?: SignedOffline;
}

/**
 * An inspection signed on the offline page, drawn (`dataUrl`) or typed with
 * the statement ticked (`typed`, lib/signature.ts). `content` is what was signed
 * (signedContent), so a copy that changed afterwards is never sent with it.
 * `savedVersion` is set once the signed copy is saved on the server, so a
 * send interrupted between saving and sending finishes without saving again.
 */
export interface SignedOffline { name: string; dataUrl?: string; typed?: true; signedAt: string; content: string; savedVersion?: number }

/** What goes to the server for a phone signature: the drawing, or the typed name. */
export const heldSignature = (signed: SignedOffline): HeldSignature =>
  signed.typed ? { name: signed.name, typed: true } : { name: signed.name, dataUrl: signed.dataUrl ?? '' };

/**
 * What a signature covers: each check's question and answer, the words on it
 * and which photographs, in order. Ids are left out, because the server gives
 * a report started offline its own. Must match `signedContent` in
 * public/offline.js, where the signature is taken (tests/offlineSign.test.ts).
 */
export const signedContent = (observations: readonly Observation[]): string => JSON.stringify(observations.map(o => [o.type, o.check?.item ?? '', o.check?.question ?? '', o.check?.answer ?? '', o.location ?? '', o.whatHappened ?? '', o.actionNeeded ?? '', o.owner ?? '', (o.photos ?? []).map(p => [p.id, p.caption ?? ''])]));

/** Whether a held copy may go to the office with its signature: signed, and unchanged since. */
export const signedAsIs = (held: Pick<HeldWork, 'signed' | 'observations'>): boolean =>
  signs(held.signed) && held.signed!.content === signedContent(held.observations);

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const isClientKey = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
export const startedKey = (principalId: string, clientKey: string) => `${principalId}::new::${clientKey}`;
export const startedReportId = (clientKey: string) => `new:${clientKey}`;
export const isStartedId = (reportId: string) => reportId.startsWith('new:');

/** How far back a report started offline may be dated: a phone left a few weeks in a van still sends. */
export const VISIT_DATE_DAYS_BACK = 30;

/**
 * Why a visit date given for a report started offline is refused, or null if
 * it is fine. A date the server has not set itself must be a real day, not
 * after tomorrow (a phone's clock may be ahead of the server's by a time
 * zone), and not more than a month back.
 */
export function visitDateProblem(value: unknown, now = new Date()): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Visit date must be a date.';
  const day = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) return 'Visit date must be a date.';
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (day.getTime() > today + 86400000) return 'Visit date cannot be in the future.';
  if (day.getTime() < today - VISIT_DATE_DAYS_BACK * 86400000) return `Visit date must be within the last ${VISIT_DATE_DAYS_BACK} days.`;
  return null;
}

/**
 * What to do with the work this device holds for one person when the server
 * can be reached: start the reports begun offline, then send the copies last
 * changed on the offline page. Copies an editor holds (a tab key, or no
 * offline mark) are left to that editor, which already saves and compares
 * them; set-aside copies wait for the person's choice.
 */
export function planHeldSend(held: readonly HeldWork[], principalId: string): { start: HeldWork[]; send: HeldWork[] } {
  const mine = held.filter(h => h.principalId === principalId && !h.key.includes('::aside::'));
  return {
    start: mine.filter(h => !!h.started && isStartedId(h.reportId)),
    send: mine.filter(h => !h.started && h.heldOffline && Number.isInteger(h.baseVersion) && !isStartedId(h.reportId)),
  };
}

/** How many cards and photographs a held copy carries, for the words on screen. */
export function heldCounts(observations: readonly Observation[]): { cards: number; photos: number } {
  return { cards: observations.length, photos: observations.reduce((n, o) => n + o.photos.length, 0) };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One line for the note shown once held work has gone up, in the engineer's
 * words. `submitted` is an inspection signed on the phone, now sent to the
 * office; everything else is on the server as a draft.
 */
export function sentLine(sent: readonly { reference: string; projectName?: string | undefined; started: boolean; submitted?: boolean }[]): string {
  if (!sent.length) return '';
  const submitted = sent.filter(s => s.submitted).length;
  const drafts = sent.length - submitted;
  if (sent.length === 1 && submitted) return 'The inspection you signed on this phone has gone to the office.';
  if (!submitted) {
    const started = sent.filter(s => s.started).length;
    const what = sent.length === 1
      ? `${started ? 'The report you started' : 'Your changes'} on this phone ${started ? 'is' : 'are'} now saved to RELAY`
      : `${plural(sent.length, 'report')} from this phone are now saved to RELAY`;
    return `${what}. ${sent.length === 1 ? 'It stays a draft' : 'They stay drafts'} until you send ${sent.length === 1 ? 'it' : 'them'}.`;
  }
  const parts = [`${plural(submitted, 'signed inspection')} sent to the office`];
  if (drafts) parts.push(`${plural(drafts, 'report')} saved to RELAY as ${drafts === 1 ? 'a draft' : 'drafts'} until you send ${drafts === 1 ? 'it' : 'them'}`);
  return `From this phone: ${parts.join('; ')}.`;
}
