import { naturalOrder } from './naturalOrder';
import type { Principal } from '@relay/platform';
import { canReadReport } from './auth/access';
import type { ObservationType } from './fixtures';
import type { CheckAnswer, Issue, Report, Variation } from './types';
import { answerLabel, checkCounts, raisesIssue, reportName, reportTypeOf } from './reportTypes';
import { ISSUE_WORK as WORK } from './status';

/**
 * The living site diary (EXP-1): a project's story, day by day, made only from
 * what engineers already sent. Nobody writes a diary entry; every line on the
 * page is a card on a sent report, so there is no second round of data entry
 * and nothing here can disagree with the report it came from.
 *
 * Each entry is one report at its latest sent revision, with a link to that
 * revision and to every earlier sent revision it replaced, so provenance and
 * the revision history stay one tap away. Drafts and corrections still being
 * written never appear. Issues and variations show only as the record a card
 * raised or added to, with that record's state as it stands now.
 */

export const DIARY_KINDS: { value: ObservationType; label: string }[] = [
  { value: 'update', label: 'Progress' },
  { value: 'defect', label: 'Defects' },
  { value: 'access', label: 'Access' },
  { value: 'instruction', label: 'Variations' },
  { value: 'check', label: 'Inspections' },
];
/** How many site days one page of the diary holds. */
export const DIARY_DAYS = 10;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface DiaryLink { id: string; reference: string; status: string }
export interface DiaryCard {
  id: string;
  type: ObservationType;
  location: string;
  whatHappened: string;
  actionNeeded: string;
  owner: string;
  photos: { src: string; caption: string }[];
  /** The issue this card raised, or the earlier issue it was a further sighting of. */
  issue?: DiaryLink & { sighting: boolean };
  variation?: DiaryLink;
  /** On an inspection: the question and its answer. */
  check?: { question: string; answer: string; tone: CheckAnswer | 'open' };
}
export interface DiaryRevision {
  id: string;
  revision: number;
  /** When the server received that revision. */
  sentAt?: string;
  /** The reason given when this revision corrected the one before it. */
  correctionReason?: string;
}
export interface DiaryEntry {
  reportId: string;
  reference: string;
  revision: number;
  author: string;
  trade?: string;
  sentAt?: string;
  review: Report['review'];
  /** This revision first, then each earlier sent revision it replaced, newest first. */
  revisions: DiaryRevision[];
  cards: DiaryCard[];
  /** Cards on the report before any filter, so a filtered entry can say "2 of 5 cards". */
  cardCount: number;
  /**
   * An inspection names itself and counts its answers. Only checks that need
   * action, or carry a note or photograph, are its cards: twelve
   * "Satisfactory" lines would bury the one that matters.
   */
  inspection?: { name: string; ok: number; action: number; na: number };
}
export interface DiaryDay { day: string; engineers: string[]; entries: DiaryEntry[] }
export interface SiteDiary {
  projectId: string;
  days: DiaryDay[];
  /** Site days and reports matching the filter, across the whole diary, not just this page. */
  totalDays: number;
  totalReports: number;
  firstDay?: string;
  /** Pass as `before` for the next, older page; absent on the last page. */
  nextBefore?: string;
}
export interface DiaryOptions { kind?: ObservationType | ''; words?: string; before?: string | undefined; days?: number }
export interface DiarySources { reports: Report[]; issues: Issue[]; variations: Variation[] }

const tidy = (text: string | undefined) => (text ?? '').trim().replace(/\s+/g, ' ');
const INSTRUCTION: Record<Variation['instruction'], string> = { pending: 'Awaiting instruction', instructed: 'Instructed', declined: 'Declined', within_contract: 'Within contract' };
const issueStatus = (i: Issue) => i.confirmation === 'withdrawn' ? 'Withdrawn' : WORK[i.work];

export const isDiaryKind = (v: string): v is ObservationType => DIARY_KINDS.some(k => k.value === v);

/** Every word typed must appear somewhere on the card or its report, ignoring case and spacing. */
function matches(card: DiaryCard, entry: Pick<DiaryEntry, 'reference' | 'author' | 'trade'>, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = [card.location, card.whatHappened, card.actionNeeded, card.owner, ...card.photos.map(p => p.caption),
    card.issue?.reference ?? '', card.variation?.reference ?? '', card.check?.question ?? '', card.check?.answer ?? '', entry.reference, entry.author, entry.trade ?? ''].join(' ').toLowerCase().replace(/\s+/g, ' ');
  return terms.every(t => hay.includes(t));
}

export function siteDiary(sources: DiarySources, principal: Principal, projectId: string, options: DiaryOptions = {}): SiteDiary {
  const sent = sources.reports.filter(r => r.projectId === projectId && r.state === 'submitted' && canReadReport(principal, r));
  const byId = new Map(sent.map(r => [r.id, r]));
  // A sent correction replaces the report it corrects; only the latest sent
  // revision of each report is an entry, and the rest are its history.
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id && byId.has(id))));
  const issues = sources.issues.filter(i => i.projectId === projectId);
  const issueById = new Map(issues.map(i => [i.id, i]));
  const variations = sources.variations.filter(v => v.projectId === projectId);
  const terms = tidy(options.words).toLowerCase().split(' ').filter(Boolean);
  const kind = options.kind || '';
  // Records by the report that raised them, keeping their place in the list, so
  // finding a card's issue looks at that report's few records, not the whole register.
  const byReport = <T extends { raisedByReport?: string }>(rows: T[]) => {
    const index = new Map<string, { at: number; rec: T }[]>();
    rows.forEach((rec, at) => { if (rec.raisedByReport) { const list = index.get(rec.raisedByReport); if (list) list.push({ at, rec }); else index.set(rec.raisedByReport, [{ at, rec }]); } });
    return index;
  };
  const issuesByReport = byReport(issues), variationsByReport = byReport(variations);

  const entries: { day: string; entry: DiaryEntry }[] = [];
  for (const r of sent) {
    if (superseded.has(r.id)) continue;
    const chain: Report[] = [];
    for (let at: Report | undefined = r; at && !chain.includes(at); at = at.corrects ? byId.get(at.corrects) : undefined) chain.push(at);
    const chainIds = new Set(chain.map(c => c.id));
    // Corrections keep the update IDs, so the card that raised a record is found
    // whichever revision raised it. A record read back from SharePoint may not
    // know which card raised it; then, like `correctReport`, it is the one on
    // this report with the same location and words.
    const fromChain = (rec: { raisedByReport?: string }) => Boolean(rec.raisedByReport && chainIds.has(rec.raisedByReport));
    const raisedHere = (rec: { raisedByReport?: string; raisedByObservation?: string; location: string; description: string }, o: Report['observations'][number]) =>
      fromChain(rec) && (rec.raisedByObservation ? rec.raisedByObservation === o.id : rec.location === o.location && rec.description === o.whatHappened);
    // The first record in the list raised by this card: the same answer as `rows.find(rec => raisedHere(rec, o))`.
    const firstRaisedHere = <T extends { raisedByReport?: string; raisedByObservation?: string; location: string; description: string }>(index: Map<string, { at: number; rec: T }[]>, o: Report['observations'][number]): T | undefined => {
      let first: { at: number; rec: T } | undefined;
      for (const id of chainIds) for (const candidate of index.get(id) ?? []) if ((!first || candidate.at < first.at) && raisedHere(candidate.rec, o)) first = candidate;
      return first?.rec;
    };
    const base = { reference: r.reference, author: tidy(r.author), ...(r.authorTrade ? { trade: r.authorTrade } : {}) };
    const type = reportTypeOf(r);
    const counts = type.checklist ? checkCounts(r.observations) : undefined;
    const shown = type.checklist ? r.observations.filter(o => o.check?.answer === 'action' || tidy(o.whatHappened) || tidy(o.actionNeeded) || o.photos.length) : r.observations;
    const all: DiaryCard[] = shown.map(o => {
      // A check keeps its link after a correction moves it off Action needed; it no longer speaks for the issue.
      const linked = o.linkedIssueId && (!o.check || o.check.answer === 'action') ? issueById.get(o.linkedIssueId) : undefined;
      // A correction points its copied defect at the issue the original raised: still "raised" here, not seen again.
      const raised = (o.type === 'defect' || o.type === 'access' || raisesIssue(type, o) ? firstRaisedHere(issuesByReport, o) : undefined) ?? (linked && fromChain(linked) ? linked : undefined);
      const seen = !raised ? linked : undefined;
      const issue = raised ?? seen;
      const variation = o.type === 'instruction' ? firstRaisedHere(variationsByReport, o) : undefined;
      return {
        id: o.id, type: o.type, location: tidy(o.location), whatHappened: tidy(o.whatHappened), actionNeeded: tidy(o.actionNeeded), owner: tidy(o.owner),
        photos: o.photos.filter(p => p.dataUrl).map(p => ({ src: p.dataUrl, caption: tidy(p.caption) })),
        ...(issue ? { issue: { id: issue.id, reference: issue.reference, status: issueStatus(issue), sighting: Boolean(seen) } } : {}),
        ...(variation ? { variation: { id: variation.id, reference: variation.reference, status: INSTRUCTION[variation.instruction] } } : {}),
        ...(o.check ? { check: { question: tidy(o.check.question), answer: answerLabel(o.check.answer), tone: o.check.answer ?? 'open' } } : {}),
      };
    });
    const filtering = Boolean(kind || terms.length);
    const cards = all.filter(c => (!kind || c.type === kind) && matches(c, base, terms));
    // Filtered to inspections, an inspection with nothing to act on is still one.
    if (filtering && !cards.length && !(counts && kind === 'check' && !terms.length)) continue;
    entries.push({ day: r.visitDate, entry: {
      reportId: r.id, ...base, revision: r.revision, review: r.review, cardCount: all.length, cards,
      ...(counts ? { inspection: { name: reportName(r), ok: counts.ok, action: counts.action, na: counts.na } } : {}),
      ...(r.serverAcknowledgedAt ? { sentAt: r.serverAcknowledgedAt } : {}),
      revisions: chain.map(c => ({ id: c.id, revision: c.revision, ...(c.serverAcknowledgedAt ? { sentAt: c.serverAcknowledgedAt } : {}), ...(c.corrects && c.correctionReason ? { correctionReason: tidy(c.correctionReason) } : {}) })),
    } });
  }

  // Newest day first; within a day, in the order the reports reached the office.
  entries.sort((a, b) => b.day.localeCompare(a.day) || (a.entry.sentAt ?? '').localeCompare(b.entry.sentAt ?? '') || naturalOrder(a.entry.reference, b.entry.reference));
  const allDays: DiaryDay[] = [];
  for (const { day, entry } of entries) {
    const last = allDays.at(-1);
    if (last?.day === day) last.entries.push(entry); else allDays.push({ day, engineers: [], entries: [entry] });
  }
  for (const d of allDays) d.engineers = [...new Set(d.entries.map(e => e.author))].sort((a, b) => a.localeCompare(b));

  const before = options.before && DAY.test(options.before) ? options.before : undefined;
  const size = Math.max(1, Math.min(60, Math.floor(options.days ?? DIARY_DAYS) || DIARY_DAYS));
  const older = before ? allDays.filter(d => d.day < before) : allDays;
  const days = older.slice(0, size);
  return {
    projectId, days, totalDays: allDays.length, totalReports: entries.length,
    ...(allDays.length ? { firstDay: allDays.at(-1)!.day } : {}),
    ...(older.length > size ? { nextBefore: days.at(-1)!.day } : {}),
  };
}
