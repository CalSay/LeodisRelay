import { sheetDay, sheetTime, type Cell } from './sheet';

/**
 * Permits to work: the hot works, isolation and other permits that let a
 * risky job go ahead on site, kept while the work is under way and closed
 * when it is finished and the area is safe. Most M&E permits are issued by
 * the principal contractor on paper; today the record of which are still open
 * lives in the cabin, and a hot works permit left open overnight means nobody
 * can show the fire watch was kept.
 *
 * A record says what kind of permit it is, its number on the paper permit
 * (if any), the work and where (free text), who issued it, who holds it, the
 * day it was issued and when it runs until. It stays open until someone on
 * the project closes it, confirming the closing check for its kind; an open
 * permit past its end time is flagged until it is closed. It is RELAY's own
 * record: not part of any report, never sent, never written to SharePoint,
 * and asks nobody to decide anything. A permit entered by mistake is
 * withdrawn with a reason and stays on the page, struck through.
 */

export type PermitKind = 'hot-works' | 'electrical-isolation' | 'pipework-isolation' | 'work-at-height' | 'confined-space' | 'other';

/**
 * The kinds offered, with the check confirmed when closing one. Claude's first
 * draft of the wording: a site manager has not yet read it over (see Help).
 */
export const PERMIT_KINDS: readonly { id: PermitKind; label: string; close: string }[] = [
  { id: 'hot-works', label: 'Hot works', close: 'Work stopped, a fire watch was kept for at least 60 minutes after, and the area was checked and left safe.' },
  { id: 'electrical-isolation', label: 'Electrical isolation', close: 'Work finished, everyone is clear, and the isolation has been removed or handed back.' },
  { id: 'pipework-isolation', label: 'Pipework isolation', close: 'Work finished, everyone is clear, and the system has been refilled or the isolation handed back.' },
  { id: 'work-at-height', label: 'Roof or work at height', close: 'Work finished, everyone is down, and the access has been left secure.' },
  { id: 'confined-space', label: 'Confined space', close: 'Everyone is out and accounted for, and the space has been closed up.' },
  { id: 'other', label: 'Other', close: 'Work finished and the area has been left safe.' },
];
const KIND_IDS = new Set<string>(PERMIT_KINDS.map(k => k.id));
export const isPermitKind = (v: unknown): v is PermitKind => typeof v === 'string' && KIND_IDS.has(v);
export const kindLabel = (kind: PermitKind) => PERMIT_KINDS.find(k => k.id === kind)?.label ?? 'Permit';
export const closeCheck = (kind: PermitKind) => PERMIT_KINDS.find(k => k.id === kind)?.close ?? 'Work finished and the area has been left safe.';

export const REFERENCE_MAX = 40;
export const WORK_MAX = 300;
export const NAME_MAX = 80;
export const NOTES_MAX = 1000;
export const CLOSE_NOTE_MAX = 300;
export const REASON_MAX = 200;
/** A permit is recorded when it is issued, or within a week (the paper one found in a van). */
export const BACKDATE_DAYS = 7;
/** Permits run for a shift or a few days; anything longer is a new permit. */
export const LONGEST_DAYS = 7;
/** The page's "last four weeks" figure. */
export const RECENT_DAYS = 28;

export interface PermitSign { by: string; byId: string; at: string }
export interface PermitClosed extends PermitSign { note?: string }
export interface PermitWithdrawn extends PermitSign { reason: string }
export interface Permit {
  id: string;
  projectId: string;
  kind: PermitKind;
  /** The number on the paper permit, if it has one. */
  reference?: string;
  /** The work and where, as typed. */
  work: string;
  issuedBy: string;
  heldBy: string;
  /** The day it was issued, YYYY-MM-DD, UK time. */
  day: string;
  /** When it runs until, `YYYY-MM-DDTHH:MM` in UK time (what a date-and-time box gives). */
  ends: string;
  notes?: string;
  /** Who typed it into RELAY, and when. */
  by: string;
  byId: string;
  at: string;
  closed?: PermitClosed;
  withdrawn?: PermitWithdrawn;
}

export interface PermitInput { kind: PermitKind; reference?: string; work: string; issuedBy: string; heldBy: string; day: string; ends: string; notes?: string }

export type PermitState = 'open' | 'overdue' | 'closed' | 'withdrawn';

export interface PermitSummary {
  /** Open, past-their-end-time ones included. */
  open: number;
  /** Open past their end time. */
  overdue: number;
  /** Closed in the last `RECENT_DAYS`, by the day they were closed. */
  recent: number;
  /** Whether any permit has ever been recorded here, withdrawn ones aside. */
  any: boolean;
}

export interface ProjectPermits { projectId: string; permits: Permit[]; summary: PermitSummary }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86400000);
const validDay = (day: string) => DAY.test(day) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

const LONDON = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** `2026-10-21T08:14`, UK time: the same shape as `ends`, so the two compare as text. */
export function londonMinute(at: Date | string): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(LONDON.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The record as it will be kept: trimmed, empty optional fields left out. */
export function cleanPermit(input: PermitInput): PermitInput {
  const reference = tidy(input.reference ?? ''), notes = (input.notes ?? '').trim();
  return { kind: input.kind, ...(reference ? { reference } : {}), work: tidy(input.work), issuedBy: tidy(input.issuedBy), heldBy: tidy(input.heldBy), day: input.day.trim(), ends: input.ends.trim(), ...(notes ? { notes } : {}) };
}

/** Why this permit cannot be kept, in words for the form, or nothing if it can. `now` is `londonMinute` of the present. */
export function permitProblem(input: PermitInput, now: string): string | undefined {
  const p = cleanPermit(input);
  const today = now.slice(0, 10);
  if (!isPermitKind(p.kind)) return 'Choose the kind of permit.';
  if (!p.work) return 'Say what the work is and where.';
  if (p.work.length > WORK_MAX) return `Keep the work and where to ${WORK_MAX} characters.`;
  if ((p.reference ?? '').length > REFERENCE_MAX) return `Keep the permit number to ${REFERENCE_MAX} characters.`;
  if (!p.issuedBy) return 'Say who issued the permit.';
  if (p.issuedBy.length > NAME_MAX) return `Keep the name of who issued it to ${NAME_MAX} characters.`;
  if (!p.heldBy) return 'Say who holds the permit.';
  if (p.heldBy.length > NAME_MAX) return `Keep the name of who holds it to ${NAME_MAX} characters.`;
  if (!validDay(p.day)) return 'Give the day the permit was issued.';
  const ago = dayNumber(today) - dayNumber(p.day);
  if (ago < 0) return 'The permit cannot be issued in the future.';
  if (ago > BACKDATE_DAYS) return `Record a permit within ${BACKDATE_DAYS} days of its issue.`;
  const end = STAMP.exec(p.ends);
  if (!end || !validDay(end[1]!)) return 'Give the day and time the permit runs until.';
  const span = dayNumber(end[1]!) - dayNumber(p.day);
  if (span < 0) return 'The permit cannot end before the day it was issued.';
  if (span > LONGEST_DAYS) return `A permit can run for up to ${LONGEST_DAYS} days. Record a longer job as a new permit.`;
  if ((p.notes ?? '').length > NOTES_MAX) return `Keep the notes to ${NOTES_MAX} characters.`;
  return undefined;
}

/** Why this closing cannot be kept, or nothing if it can. */
export function closeProblem(confirmed: boolean, note: string | undefined): string | undefined {
  if (!confirmed) return 'Confirm the closing check before closing the permit.';
  if (tidy(note ?? '').length > CLOSE_NOTE_MAX) return `Keep the closing note to ${CLOSE_NOTE_MAX} characters.`;
  return undefined;
}

/** Why this withdrawal cannot be kept, or nothing if it can. */
export function withdrawProblem(reason: string): string | undefined {
  const r = tidy(reason);
  if (!r) return 'Say why the permit record is being withdrawn.';
  if (r.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters.`;
  return undefined;
}

export function permitState(p: Permit, now: string): PermitState {
  if (p.withdrawn) return 'withdrawn';
  if (p.closed) return 'closed';
  return p.ends < now ? 'overdue' : 'open';
}

/**
 * Open ones first, those past their end time at the top (longest past first),
 * then the rest by when they end; after them closed and withdrawn ones,
 * newest issued first.
 */
export function permitOrder(now: string) {
  const rank = (p: Permit) => ({ overdue: 0, open: 1, closed: 2, withdrawn: 2 })[permitState(p, now)];
  return (a: Permit, b: Permit) => rank(a) - rank(b)
    || (rank(a) < 2 ? a.ends.localeCompare(b.ends) : b.day.localeCompare(a.day) || b.at.localeCompare(a.at))
    || a.id.localeCompare(b.id);
}

export function permitSummary(permits: readonly Permit[], now: string): PermitSummary {
  const today = now.slice(0, 10);
  let open = 0, overdue = 0, recent = 0, any = false;
  for (const p of permits) {
    const state = permitState(p, now);
    if (state === 'withdrawn') continue;
    any = true;
    if (state === 'overdue') { overdue++; open++; }
    else if (state === 'open') open++;
    else if (dayNumber(today) - dayNumber(londonMinute(p.closed!.at).slice(0, 10) || p.day) < RECENT_DAYS) recent++;
  }
  return { open, overdue, recent, any };
}

/** One project's permits in page order, withdrawn ones included, with the summary that leaves them out. */
export function projectPermits(permits: readonly Permit[], projectId: string, now: string): ProjectPermits {
  const mine = permits.filter(p => p.projectId === projectId).sort(permitOrder(now));
  return { projectId, permits: mine, summary: permitSummary(mine, now) };
}

/** "Hot works · Roof plant deck brazing", trimmed for a line. */
export function permitTitle(p: Pick<Permit, 'kind' | 'work'>, max = 60): string {
  const work = p.work.length > max ? `${p.work.slice(0, max - 1).trimEnd()}…` : p.work;
  return `${kindLabel(p.kind)} · ${work}`;
}

/** "17:00 today", "17:00 yesterday", "17:00 Tue 20 Oct". `now` is `londonMinute` of the present. */
export function endsWords(ends: string, now: string, dayWords: (day: string) => string): string {
  const day = ends.slice(0, 10), time = ends.slice(11, 16);
  const diff = dayNumber(day) - dayNumber(now.slice(0, 10));
  return `${time} ${diff === 0 ? 'today' : diff === -1 ? 'yesterday' : diff === 1 ? 'tomorrow' : dayWords(day)}`;
}

/** The home row's words: "2 open · 1 past its end time", "None open", or nothing recorded yet. */
export function permitRowWords(s: PermitSummary): string {
  if (!s.any) return 'None recorded yet · record the next one here';
  const parts = [s.open ? `${s.open} open` : 'None open'];
  if (s.overdue) parts.push(`${s.overdue} past ${s.overdue === 1 ? 'its' : 'their'} end time`);
  return parts.join(' · ');
}

/** What the office's Needs attention reads: per project, the open permits past their end time. */
export interface PermitAttentionProject {
  projectId: string; projectNumber: string; projectName: string;
  overdue: { id: string; kind: PermitKind; work: string; heldBy: string; ends: string }[];
}
export interface PermitsAll { now: string; projects: PermitAttentionProject[]; totals: { open: number; overdue: number } }

/** Every project's open permits past their end time, longest past first, for the office. */
export function permitsAll(projects: readonly { id: string; projectNumber: string; projectName: string }[], permits: readonly Permit[], now: string): PermitsAll {
  let open = 0, overdue = 0;
  const out: PermitAttentionProject[] = [];
  for (const project of projects) {
    const mine = permits.filter(p => p.projectId === project.id);
    const s = permitSummary(mine, now);
    open += s.open; overdue += s.overdue;
    const late = mine.filter(p => permitState(p, now) === 'overdue').sort((a, b) => a.ends.localeCompare(b.ends));
    if (late.length) out.push({ projectId: project.id, projectNumber: project.projectNumber, projectName: project.projectName,
      overdue: late.map(p => ({ id: p.id, kind: p.kind, work: p.work, heldBy: p.heldBy, ends: p.ends })) });
  }
  out.sort((a, b) => a.overdue[0]!.ends.localeCompare(b.overdue[0]!.ends));
  return { now, projects: out, totals: { open, overdue } };
}

/** One line for the office's Needs attention lists. */
export interface PermitAttention { key: string; projectId: string; projectNumber: string; title: string; sub: string; tag: { label: string; cls: string } }

/**
 * One line per project with permits open past their end time: the office's
 * next step is the same for all of them (ask site to close them, or open the
 * project's Permits to work). Longest past first.
 */
export function permitAttention(all: Pick<PermitsAll, 'projects' | 'now'>, dayWords: (day: string) => string): PermitAttention[] {
  return all.projects.map(p => {
    const first = p.overdue[0]!, n = p.overdue.length;
    return { key: `pw-${p.projectId}`, projectId: p.projectId, projectNumber: p.projectNumber,
      title: n === 1 ? `${kindLabel(first.kind)} permit still open past its end time` : `${n} permits still open past their end time`,
      sub: `${p.projectName} · ${permitTitle(first, 50)} · held by ${first.heldBy} · ended ${endsWords(first.ends, all.now, dayWords)}`,
      tag: { label: 'Permit', cls: 'tag-alert' } };
  });
}

/** Starters for a new permit: the project's recent ones not withdrawn, so today's repeat of yesterday's hot works is two taps. At most `max`, one per kind and work. */
export function permitRepeats(permits: readonly Permit[], max = 3): Permit[] {
  const seen = new Set<string>();
  const out: Permit[] = [];
  for (const p of [...permits].filter(p => !p.withdrawn).sort((a, b) => b.at.localeCompare(a.at))) {
    const key = `${p.kind}|${p.work.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export const PERMIT_COLUMNS = ['Permit number', 'Project number', 'Project', 'Kind', 'Work and where', 'Issued on', 'Issued by', 'Held by', 'Runs until', 'Status', 'Closed at', 'Closed by', 'Closing check', 'Closing note', 'Notes', 'Recorded at', 'Recorded by', 'Withdrawn on', 'Withdrawn by', 'Withdrawn because'] as const;

const STATE_WORDS: Record<PermitState, string> = { open: 'Open', overdue: 'Open, past its end time', closed: 'Closed', withdrawn: 'Withdrawn' };

/** One spreadsheet row per permit, in the house column order (`lib/sheet.ts`), times in UK time as Excel reads them. */
export function permitRows(permits: readonly Permit[], now: string, project: { projectNumber: string; projectName: string }): Cell[][] {
  return permits.map(p => [p.reference, project.projectNumber, project.projectName, kindLabel(p.kind), p.work, p.day, p.issuedBy, p.heldBy, p.ends.replace('T', ' '), STATE_WORDS[permitState(p, now)],
    sheetTime(p.closed?.at), p.closed?.by, p.closed ? closeCheck(p.kind) : undefined, p.closed?.note, p.notes,
    sheetTime(p.at), p.by, sheetDay(p.withdrawn?.at), p.withdrawn?.by, p.withdrawn?.reason]);
}
