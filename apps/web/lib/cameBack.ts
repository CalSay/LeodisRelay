import type { Issue, Variation } from './types';

/**
 * What the engineer home needs for "Came back from the office": the latest
 * issues and variations the engineer raised on a project, and how many of the
 * project's issues are open. Worked out on the server, so a phone fetches a
 * dozen records rather than every issue and variation on a busy project.
 *
 * The home merges these with the engineer's own sent reports, the ones the
 * office wrote on or sent back first (`waitingOnYouFirst`), and shows the first
 * `CAME_BACK_ROWS`. Each list here is cut to that many, newest first, so an
 * answer on an older record, behind that many newer ones, is not fetched.
 */
export const CAME_BACK_ROWS = 6;

export interface CameBack { issues: Issue[]; variations: Variation[]; open: number }

/** The engineer reported it, or raised it from a report. */
export const raisedIssue = (i: Issue, principalId: string): boolean => i.reportedById === principalId || i.events[0]?.actorId === principalId;
export const isOpenIssue = (i: Issue): boolean => i.work !== 'closed' && i.confirmation !== 'withdrawn';

/** Newest last change first; a stable sort, so records changed at the same moment keep their order. */
const latest = <T extends { raisedAt: string; events: { at: string }[] }>(rows: T[]): T[] =>
  rows.map(row => ({ row, at: row.events.at(-1)?.at ?? row.raisedAt })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, CAME_BACK_ROWS).map(x => x.row);

export function cameBack(issues: readonly Issue[], variations: readonly Variation[], principalId: string): CameBack {
  return {
    issues: latest(issues.filter(i => raisedIssue(i, principalId))),
    variations: latest(variations.filter(v => v.raisedById === principalId)),
    open: issues.filter(isOpenIssue).length,
  };
}

/**
 * The order of the home's rows: anything the office wrote on, or sent back
 * (a returned report not yet corrected, an issue reopened or disputed), comes first, newest
 * first; then the rest, newest first. So the engineer's own new defect or a
 * report the office has only received never pushes an answer down the list.
 */
export function waitingOnYouFirst(a: { at: string; word?: unknown; sentBack?: boolean }, b: { at: string; word?: unknown; sentBack?: boolean }): number {
  const waits = (row: typeof a) => (row.word || row.sentBack ? 1 : 0);
  return waits(b) - waits(a) || b.at.localeCompare(a.at);
}

/**
 * The office reopened the issue ("Not finished"), with or without a note, and
 * the engineer has not added anything since. Read back from the newest event:
 * the engineer's own event, or the office checking it, ends the search.
 */
export function issueReopened(events: readonly Written[], principal: { id: string; name: string }): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.actorId ? e.actorId === principal.id : e.actor === principal.name) return false;
    if (e.kind === 'reopened') return true;
    if (e.kind === 'verified') return false;
  }
  return false;
}

/** Who wrote to the engineer on a record they raised, when, and what. */
export interface OfficeWord { by: string; at: string; note: string }
type Written = { at: string; actor: string; actorId?: string; kind: string; note: string; correctionId?: string; source?: unknown };

/**
 * What to do with one event, reading back from the newest: `word` shows its
 * note, `stop` means the record has moved on since anything worth showing,
 * `skip` reads on. Only words a person typed count: notes RELAY writes itself
 * (a review's "needs triage", "Quoted £…", a correction's links) are never
 * shown as if someone wrote them.
 */
type Reading = 'word' | 'stop' | 'skip';
const ISSUE_EVENTS = (e: Written): Reading => {
  // Raised, and site people's own updates (another engineer's included), are not the office's answer.
  // Nor is an assignment: "Who is fixing it" already says it, and its note is for the fixer. It leaves a question standing.
  if (e.kind === 'raised' || e.kind === 'progress' || e.kind === 'closure_submitted' || e.kind === 'assigned') return 'skip';
  // A review confirming or disputing every issue on a report writes its own note (with no source before #58).
  if (e.kind === 'confirmation' && (e.source || REVIEW_NOTES.has(e.note.trim()))) return 'stop';
  // Checked, reopened or decided without a word moves past anything asked before.
  return e.note.trim() ? 'word' : 'stop';
};
const REVIEW_NOTES = new Set(['Source report returned for correction — needs triage.', 'Confirmed at report review.']);
/** What variationStore writes when the office leaves the note empty. */
const VARIATION_FILLERS = [/^Details updated(:.*)?\.$/, /^Quoted .*\.$/, /^Instructed by .*\.$/, /^Within contract\. Not chargeable\.$/];
const VARIATION_EVENTS = (e: Written): Reading => {
  if (e.kind === 'raised') return 'skip';
  if (e.kind === 'note' || e.kind === 'reopened' || e.kind === 'declined') return e.note.trim() ? 'word' : 'skip';
  // Priced, instructed, within contract or details changed: shown when the office typed a note, otherwise the
  // answer above says it and anything asked before is past.
  const note = e.note.trim();
  return note && !VARIATION_FILLERS.some(f => f.test(note)) ? 'word' : 'stop';
};

/**
 * The latest note someone else wrote on a record this engineer raised, while
 * it still waits on them: once the engineer has added anything since, it has
 * been answered and the history keeps it. Someone else is told apart by
 * signed-in id, or by name on events recorded without one. Events made by an
 * office correction of a report are left to that report.
 */
function latestWord(events: readonly Written[], principal: { id: string; name: string }, read: (e: Written) => Reading): OfficeWord | undefined {
  const mine = (e: Written) => e.actorId ? e.actorId === principal.id : e.actor === principal.name;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (mine(e)) return undefined;
    // A correction's link note is left to its report; a correction that withdraws, declines or reassigns moves past what came before.
    if (e.correctionId) { if (e.kind === 'note') continue; return undefined; }
    const reading = read(e);
    if (reading === 'stop') return undefined;
    if (reading === 'word') return { by: e.actor, at: e.at, note: e.note.trim() };
  }
  return undefined;
}
export const issueWord = (events: readonly Written[], principal: { id: string; name: string }) => latestWord(events, principal, ISSUE_EVENTS);
export const variationWord = (events: readonly Written[], principal: { id: string; name: string }) => latestWord(events, principal, VARIATION_EVENTS);

/**
 * On a sent report: why it was returned, or what the office said on opening
 * it. Not once the engineer has sent a correction of it (`corrected`).
 */
export function reportWord(r: { review?: string; reviewNote?: string; reviewedBy?: string; reviewedAt?: string; acknowledged?: { by: string; at: string; note?: string } }, corrected = false): OfficeWord | undefined {
  if (corrected) return undefined;
  if (r.review === 'returned' && r.reviewNote?.trim()) return { by: r.reviewedBy ?? 'The office', at: r.reviewedAt ?? '', note: r.reviewNote.trim() };
  if (r.acknowledged?.note?.trim()) return { by: r.acknowledged.by, at: r.acknowledged.at, note: r.acknowledged.note.trim() };
  return undefined;
}
