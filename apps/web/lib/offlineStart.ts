import type { Observation, Report } from './types';

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
}

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

/** One line for the note shown once held work has gone up, in the engineer's words. */
export function sentLine(sent: readonly { reference: string; projectName?: string | undefined; started: boolean }[]): string {
  if (!sent.length) return '';
  const started = sent.filter(s => s.started).length;
  const what = sent.length === 1
    ? `${started ? 'The report you started' : 'Your changes'} on this phone ${started ? 'is' : 'are'} now on the server`
    : `${plural(sent.length, 'report')} from this phone are now on the server`;
  return `${what}. ${sent.length === 1 ? 'It stays a draft' : 'They stay drafts'} until you sign and send.`;
}
