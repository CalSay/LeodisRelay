import { companyKey } from './companyIssues';

/**
 * Chase notes: a short dated note the office keeps each time it chases a
 * company or person about their open issues ("Rang Dave, coming Thursday"),
 * with the day they promised to be done by, if they gave one. The Issues by
 * company page says who to chase; this says who was chased last, by whom,
 * what was said, and whether a promise has passed with work still to do.
 *
 * A chase is a note, not an issue event: it never changes an issue's status,
 * owner or target date, sends nothing to anyone and asks no one to approve
 * anything. Companies are matched as the page matches them, ignoring case and
 * spacing; nothing is checked against a company list.
 *
 * A chase is about the company, not one project. In the pilot everyone can
 * open every project; if access is ever narrowed per project, someone who
 * sees a company on one project would read notes about its work on another,
 * so chases would then need a project, or to be shown only to those who can
 * open all of that company's projects.
 */

export const NOTE_MAX = 500;
/** How many chases the page carries for each company; the rest are counted. */
export const RECENT_CHASES = 10;
/** A promise further off than this is more likely a typo than a plan. */
export const PROMISE_MAX_DAYS = 366;

export interface Chase {
  id: string;
  /** `companyKey(owner)`: what joins a chase to its company card. */
  companyKey: string;
  /** The company as the office saw it named when they logged the chase. */
  owner: string;
  note: string;
  /** YYYY-MM-DD, the day they said the work would be done by. */
  promisedBy?: string;
  by: string;
  byId: string;
  at: string;
}
export interface CompanyChases { total: number; recent: Chase[] }

export interface ChaseInput { owner: string; note: string; promisedBy: string }

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Why this chase cannot be kept, in words for the form, or nothing if it can. `today` is YYYY-MM-DD in the office calendar. */
export function chaseProblem(input: ChaseInput, today: string): string | undefined {
  if (!companyKey(input.owner)) return 'Say which company or person was chased.';
  if (input.owner.trim().length > 200) return 'That company name is too long.';
  const note = input.note.trim();
  if (!note) return 'Say what was said, even in a few words.';
  if (note.length > NOTE_MAX) return `Keep the note to ${NOTE_MAX} characters.`;
  const promised = input.promisedBy.trim();
  if (promised) {
    if (!isDay(promised)) return 'The promised date is not a date.';
    if (promised < today) return 'The promised date has already gone. Leave it blank, or pick today or later.';
    if (promised > addDays(today, PROMISE_MAX_DAYS)) return 'The promised date is more than a year away.';
  }
  return undefined;
}

/** Newest first; two chases in the same millisecond fall in a fixed (id) order. */
export const newestFirst = (a: Chase, b: Chase) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id);

/** Each company's chases, newest first, the most recent `RECENT_CHASES` carried and the rest counted. Only the companies asked for. */
export function groupChases(chases: Chase[], keys: Iterable<string>): Record<string, CompanyChases> {
  const wanted = new Set(keys);
  const byKey = new Map<string, Chase[]>();
  for (const chase of chases) {
    if (!wanted.has(chase.companyKey)) continue;
    const list = byKey.get(chase.companyKey) ?? [];
    list.push(chase);
    byKey.set(chase.companyKey, list);
  }
  const out: Record<string, CompanyChases> = {};
  for (const [k, list] of byKey) out[k] = { total: list.length, recent: list.sort(newestFirst).slice(0, RECENT_CHASES) };
  return out;
}

/**
 * The promise that stands: the one on the latest chase, if that chase gave a
 * date. A later chase without a date means the promise is no longer the plan,
 * so nothing is shown rather than an old date called missed.
 * `met`: nothing left to put right (all done, or put forward as fixed for the
 * office to check). `missed`: the day has gone with work still to do.
 */
export type PromiseState = 'due' | 'met' | 'missed';
export function standingPromise(recent: readonly Chase[], toDo: number, today: string): { promisedBy: string; state: PromiseState } | undefined {
  const latest = recent[0];
  if (!latest?.promisedBy) return undefined;
  const state: PromiseState = toDo === 0 ? 'met' : latest.promisedBy < today ? 'missed' : 'due';
  return { promisedBy: latest.promisedBy, state };
}
