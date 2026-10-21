/**
 * Toolbox talks: the short safety briefing given on site before work starts
 * ("Working at height on the level 3 slab edge", "Safe isolation before
 * second fix"), and who was there to hear it. Principal contractors and
 * clients ask for the record at audits, and today it is a sheet of paper in
 * the site cabin that rarely reaches the office.
 *
 * A record says which day it was given, the topic, who gave it, who attended
 * (names as typed, one per person) and any notes. It is RELAY's own record:
 * not part of any report, never sent, never written to SharePoint, and asks
 * nobody to decide anything. A record entered by mistake is withdrawn with a
 * reason and stays on the page, struck through; nothing is ever removed.
 */

export const TOPIC_MAX = 120;
export const NAME_MAX = 80;
export const NOTES_MAX = 1000;
export const ATTENDEES_MAX = 60;
export const REASON_MAX = 200;
/** A talk can be written up a few weeks late (the paper sheet found in a van), not months. */
export const BACKDATE_DAYS = 31;
/** The page's "last four weeks" figures. */
export const RECENT_DAYS = 28;

/** Topics most M&E sites brief on. Offered as one-tap starters; the topic stays free text. */
export const COMMON_TOPICS: readonly string[] = [
  'Working at height', 'Safe isolation', 'Mobile towers and podiums', 'Ladders and stepladders',
  'Manual handling', 'Hot works', 'Asbestos awareness', 'Fire safety and emergency routes',
  'Housekeeping, slips and trips', 'Dust and noise', 'COSHH', 'Hand-arm vibration',
];

export interface ToolboxTalkWithdrawn { by: string; byId: string; at: string; reason: string }
export interface ToolboxTalk {
  id: string;
  projectId: string;
  /** The day it was given, YYYY-MM-DD, UK time. */
  day: string;
  topic: string;
  givenBy: string;
  attendees: string[];
  notes?: string;
  /** Who typed it into RELAY, and when; may differ from who gave it. */
  by: string;
  byId: string;
  at: string;
  withdrawn?: ToolboxTalkWithdrawn;
}

export interface ToolboxTalkInput { day: string; topic: string; givenBy: string; attendees: readonly string[]; notes?: string }

export interface ToolboxSummary {
  /** The latest talk not withdrawn, if any. */
  latest?: { day: string; topic: string; attendees: number };
  /** Whole days from the latest talk to today; 0 is today. */
  daysSince?: number;
  /** In the last `RECENT_DAYS`, today included: talks, names signed in across them, and different people. */
  recent: { talks: number; attendances: number; people: number };
}

export interface ProjectTalks { projectId: string; talks: ToolboxTalk[]; summary: ToolboxSummary }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86400000);
const validDay = (day: string) => DAY.test(day) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The attendees as typed, one name per entry: spaces tidied, blanks dropped,
 * and the same name twice kept once (ignoring capitals), in the order written.
 */
export function cleanAttendees(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = tidy(raw);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * A textarea's lines (or semicolons, as the spreadsheet writes them) as names.
 * Not commas: "Ali Khan, Northbank Electrical" is one person and their company.
 */
export function splitAttendees(text: string): string[] {
  return cleanAttendees(text.split(/[\r\n;]+/));
}

/** The record as it will be kept: trimmed, attendees cleaned, empty notes left out. */
export function cleanTalk(input: ToolboxTalkInput): ToolboxTalkInput & { attendees: string[] } {
  const notes = (input.notes ?? '').trim();
  return { day: input.day.trim(), topic: tidy(input.topic), givenBy: tidy(input.givenBy), attendees: cleanAttendees(input.attendees), ...(notes ? { notes } : {}) };
}

/** Why this talk cannot be kept, in words for the form, or nothing if it can. `today` is YYYY-MM-DD in London. */
export function talkProblem(input: ToolboxTalkInput, today: string): string | undefined {
  const t = cleanTalk(input);
  if (!validDay(t.day)) return 'Give the day the talk was given.';
  const ago = dayNumber(today) - dayNumber(t.day);
  if (ago < 0) return 'The talk cannot be in the future.';
  if (ago > BACKDATE_DAYS) return `Record a talk within ${BACKDATE_DAYS} days of giving it.`;
  if (!t.topic) return 'Say what the talk was about.';
  if (t.topic.length > TOPIC_MAX) return `Keep the topic to ${TOPIC_MAX} characters.`;
  if (!t.givenBy) return 'Say who gave the talk.';
  if (t.givenBy.length > NAME_MAX) return `Keep the name of who gave it to ${NAME_MAX} characters.`;
  if (!t.attendees.length) return 'Add the name of everyone who attended.';
  if (t.attendees.length > ATTENDEES_MAX) return `A talk can have up to ${ATTENDEES_MAX} names. Record a larger briefing as two talks.`;
  const long = t.attendees.find(n => n.length > NAME_MAX);
  if (long) return `Keep each name to ${NAME_MAX} characters ("${long.slice(0, 20)}…").`;
  if ((t.notes ?? '').length > NOTES_MAX) return `Keep the notes to ${NOTES_MAX} characters.`;
  return undefined;
}

/** Why this withdrawal cannot be kept, or nothing if it can. */
export function withdrawProblem(reason: string): string | undefined {
  const r = tidy(reason);
  if (!r) return 'Say why the record is being withdrawn.';
  if (r.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters.`;
  return undefined;
}

/** Newest day first; on the same day, the one recorded last first. */
export const newestFirst = (a: ToolboxTalk, b: ToolboxTalk) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at) || b.id.localeCompare(a.id);

export function talkSummary(talks: readonly ToolboxTalk[], today: string): ToolboxSummary {
  const kept = talks.filter(t => !t.withdrawn).sort(newestFirst);
  const latest = kept[0];
  const recent = kept.filter(t => dayNumber(today) - dayNumber(t.day) < RECENT_DAYS);
  const people = new Set(recent.flatMap(t => t.attendees.map(n => n.toLowerCase())));
  return {
    ...(latest ? { latest: { day: latest.day, topic: latest.topic, attendees: latest.attendees.length }, daysSince: dayNumber(today) - dayNumber(latest.day) } : {}),
    recent: { talks: recent.length, attendances: recent.reduce((n, t) => n + t.attendees.length, 0), people: people.size },
  };
}

/** One project's talks, newest first, withdrawn ones included, with the summary that leaves them out. */
export function projectTalks(talks: readonly ToolboxTalk[], projectId: string, today: string): ProjectTalks {
  const mine = talks.filter(t => t.projectId === projectId).sort(newestFirst);
  return { projectId, talks: mine, summary: talkSummary(mine, today) };
}

/** "today", "yesterday", "3 days ago". */
export function daysAgo(days: number): string {
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * Starters for the topic: this project's own recent topics first (the same
 * talk is often given again to the next gang), then the common ones not
 * already listed. At most `max`.
 */
export function topicStarters(talks: readonly ToolboxTalk[], max = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (topic: string) => { const k = topic.toLowerCase(); if (!seen.has(k) && out.length < max) { seen.add(k); out.push(topic); } };
  for (const t of [...talks].filter(t => !t.withdrawn).sort(newestFirst)) add(t.topic);
  for (const t of COMMON_TOPICS) add(t);
  return out;
}

export const TALK_COLUMNS = ['Day', 'Topic', 'Given by', 'Attendees', 'Number attending', 'Notes', 'Recorded by', 'Recorded at', 'Withdrawn', 'Withdrawn because'] as const;

const LONDON = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** "2026-10-21 08:14", UK time, which Excel reads as a date and time. */
export function londonStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const p = Object.fromEntries(LONDON.formatToParts(at).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** One spreadsheet row per talk, attendees in one cell separated by semicolons, times in UK time. */
export function talkRows(talks: readonly ToolboxTalk[]): (string | number | undefined)[][] {
  return talks.map(t => [t.day, t.topic, t.givenBy, t.attendees.join('; '), t.attendees.length, t.notes, t.by, londonStamp(t.at), t.withdrawn ? londonStamp(t.withdrawn.at).slice(0, 10) : undefined, t.withdrawn?.reason]);
}

/** `relay-toolbox-talks-011LME-2026-10-21.csv`. */
export function talkFileName(day: string, projectNumber?: string): string {
  const scope = projectNumber?.replace(/[^A-Za-z0-9-]+/g, '') || '';
  return `relay-toolbox-talks${scope ? `-${scope}` : ''}-${day}.csv`;
}
