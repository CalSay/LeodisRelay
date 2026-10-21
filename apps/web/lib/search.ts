import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import type { Issue, Report, Variation } from './types';
import { reportTypeOf } from './reportTypes';
import { ISSUE_WORK as WORK } from './status';
import { dateShort } from './dates';

/**
 * Find a report, issue or variation by what someone remembers about it.
 *
 * People remember "the riser on level 3" or "VO-004", not which project page
 * or filter it sits behind. Every word typed must appear somewhere in the
 * record (its reference, project, location, notes, who raised it or its
 * history), in any order and any case. Locations are matched as the free text
 * engineers typed: there is no location list to keep up to date (EXP-4).
 *
 * Access is applied before matching, so another engineer's draft is never
 * searched, let alone returned.
 */

export type SearchKind = 'report' | 'issue' | 'variation';
export interface SearchHit {
  kind: SearchKind;
  id: string;
  reference: string;
  projectId: string;
  /** One line a person recognises: the description, or the report's reference. */
  title: string;
  /** Where the words were found, trimmed around the first match. */
  snippet: string;
  /** Who and when, in plain words. */
  meta: string;
  /** The record's state in the words the rest of RELAY uses. */
  status: string;
  at: string;
}
export interface SearchGroup { hits: SearchHit[]; total: number }
export interface SearchResults { query: string; reports: SearchGroup; issues: SearchGroup; variations: SearchGroup }
export interface SearchSources {
  reports: Report[];
  issues: Issue[];
  variations: Variation[];
  projects: { id: string; projectName: string; projectNumber: string }[];
}

export const SEARCH_LIMIT = 25;
export const MIN_QUERY = 2;
const MAX_WORDS = 8;

const INSTRUCTION: Record<Variation['instruction'], string> = { pending: 'With the office', instructed: 'Instructed', declined: 'Declined' };

/** Lower case, no accents, and dashes read as spaces, so "Level-3" finds "level 3" and "VO 004" finds "VO-004". */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-\u2010-\u2015]+/g, ' ').replace(/\s+/g, ' ');
}
export function searchWords(query: string): string[] {
  const words = query.split(/[\s,;]+/).map(w => fold(w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).trim()).filter(Boolean);
  return [...new Set(words)].slice(0, MAX_WORDS);
}

interface Field { label: string; text: string }
function matches(fields: Field[], words: string[]): Field | null | undefined {
  const all = fold(fields.map(f => f.text).join('\n'));
  if (!words.every(w => all.includes(w))) return undefined;
  // The snippet comes from the most telling field: the first one holding a word.
  return fields.find(f => f.label && words.some(w => fold(f.text).includes(w))) ?? null;
}
function snippet(field: Field | null, words: string[]): string {
  if (!field) return '';
  const text = field.text.replace(/\s+/g, ' ').trim();
  const folded = fold(text);
  const at = Math.min(...words.map(w => folded.indexOf(w)).filter(i => i >= 0));
  const start = at > 50 ? text.lastIndexOf(' ', at - 40) + 1 : 0;
  const cut = text.slice(start, start + 140);
  return `${field.label}: ${start > 0 ? '…' : ''}${cut}${start + 140 < text.length ? '…' : ''}`;
}
/** A reference typed in full beats a word in the notes; then the newest first. */
function rank(hit: SearchHit, phrase: string): number {
  const ref = fold(hit.reference);
  if (ref === phrase || ref.endsWith(phrase) && phrase.length >= 3) return 3;
  if (fold(hit.title).includes(phrase)) return 2;
  return 1;
}
function group(hits: SearchHit[], phrase: string): SearchGroup {
  hits.sort((a, b) => rank(b, phrase) - rank(a, phrase) || b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  return { hits: hits.slice(0, SEARCH_LIMIT), total: hits.length };
}
const day = (iso: string) => dateShort(iso);
const history = (events: { note: string }[]) => events.map(e => e.note).filter(Boolean).join('\n');

export function search(query: string, sources: SearchSources, principal: Principal, projectId?: string): SearchResults {
  const words = searchWords(query);
  const empty = { hits: [], total: 0 };
  if (fold(query).trim().length < MIN_QUERY || !words.length) return { query, reports: empty, issues: empty, variations: empty };
  const phrase = fold(query).trim();
  const projects = new Map(sources.projects.map(p => [p.id, p]));
  const inScope = (id: string) => !projectId || id === projectId;
  const projectFields = (id: string): Field[] => {
    const p = projects.get(id);
    return p ? [{ label: '', text: p.projectName }, { label: '', text: p.projectNumber }] : [];
  };

  const reports: SearchHit[] = [];
  for (const r of sources.reports) {
    if (!inScope(r.projectId) || !canReadReport(principal, r)) continue;
    const fields: Field[] = [
      { label: '', text: r.reference }, { label: '', text: reportTypeOf(r).name }, { label: '', text: r.author }, { label: '', text: r.authorTrade ?? '' }, { label: '', text: r.visitDate },
      ...r.observations.flatMap(o => [
        { label: 'Location', text: o.location }, { label: 'Check', text: o.check?.question ?? '' }, { label: 'Note', text: o.whatHappened },
        { label: 'Action', text: o.actionNeeded }, { label: 'Responsible', text: o.owner }, { label: 'Asked by', text: o.askedBy ?? '' },
      ]),
      { label: 'Correction', text: r.correctionReason ?? '' }, ...projectFields(r.projectId),
    ];
    const found = matches(fields, words);
    if (found === undefined) continue;
    const cards = r.observations.length;
    reports.push({
      kind: 'report', id: r.id, reference: r.reference, projectId: r.projectId,
      title: r.reference,
      snippet: snippet(found, words),
      meta: `${r.author}${r.authorTrade ? ` · ${r.authorTrade}` : ''} · visit ${day(r.visitDate)} · ${reportTypeOf(r).checklist ? reportTypeOf(r).name.toLowerCase() : `${cards} card${cards === 1 ? '' : 's'}`}`,
      status: r.state === 'draft' ? (r.corrects ? 'Correction draft' : 'Your draft') : r.revision > 1 ? `Sent · revision ${r.revision}` : 'Sent',
      at: r.serverAcknowledgedAt ?? r.lastSavedAt ?? r.visitDate,
    });
  }

  const issues: SearchHit[] = [];
  for (const i of sources.issues) {
    if (!inScope(i.projectId)) continue;
    const found = matches([
      { label: '', text: i.reference }, { label: 'Defect', text: i.description }, { label: 'Location', text: i.location },
      { label: 'Action', text: i.actionNeeded }, { label: 'Responsible', text: i.owner }, { label: '', text: i.reportedBy ?? '' },
      { label: '', text: i.affectedTrade ?? '' }, { label: 'History', text: history(i.events) }, ...projectFields(i.projectId),
    ], words);
    if (found === undefined) continue;
    issues.push({
      kind: 'issue', id: i.id, reference: i.reference, projectId: i.projectId,
      title: i.description || i.reference,
      // The title and the location are already on the row.
      snippet: found?.label === 'Defect' || found?.label === 'Location' ? '' : snippet(found, words),
      meta: `${i.location || 'No location'} · raised ${day(i.raisedAt)}${i.reportedBy ? ` by ${i.reportedBy}` : ''}`,
      status: i.confirmation === 'withdrawn' ? 'Withdrawn' : WORK[i.work],
      at: i.events.at(-1)?.at ?? i.raisedAt,
    });
  }

  const variations: SearchHit[] = [];
  for (const v of sources.variations) {
    if (!inScope(v.projectId)) continue;
    const found = matches([
      { label: '', text: v.reference }, { label: 'Variation', text: v.description }, { label: 'Location', text: v.location },
      { label: '', text: v.raisedBy }, { label: 'Asked by', text: v.askedBy ?? '' }, { label: 'Instruction', text: v.instructionReference ?? '' },
      { label: '', text: v.trade ?? '' }, { label: 'History', text: history(v.events) }, ...projectFields(v.projectId),
    ], words);
    if (found === undefined) continue;
    variations.push({
      kind: 'variation', id: v.id, reference: v.reference, projectId: v.projectId,
      title: v.description || v.reference,
      // The title and the location are already on the row.
      snippet: found?.label === 'Variation' || found?.label === 'Location' ? '' : snippet(found, words),
      meta: `${v.location || 'No location'} · raised ${day(v.raisedAt)} by ${v.raisedBy}`,
      status: v.instruction === 'pending' && v.workDone ? 'Done, not instructed' : INSTRUCTION[v.instruction],
      at: v.events.at(-1)?.at ?? v.raisedAt,
    });
  }

  return { query, reports: group(reports, phrase), issues: group(issues, phrase), variations: group(variations, phrase) };
}
