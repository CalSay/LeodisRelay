import type { Issue } from './types';
import { isActiveIssue, isUnassigned, isVerify } from './officeActions';
import { sortTableRows, type SortDirection } from './tableSorting';

/**
 * The issue register as a query: filter, count, sort and page on the server,
 * so the office looks through the whole register it may see rather than
 * whatever one response happened to hold.
 *
 * Pure over an array of issues. The caller decides which issues are in scope
 * (the access rules and the store), so the same rules run against SQLite and
 * against the SharePoint list cache.
 */

/** The register's chips. `all` lets the other filters reach closed issues too. */
export const ISSUE_VIEWS = ['open', 'overdue', 'verify', 'unassigned', 'notReviewed', 'disputed', 'closed', 'all'] as const;
export type IssueView = typeof ISSUE_VIEWS[number];

/** Where the closure has got to: not put forward yet, put forward and waiting, or checked and closed. */
export const VERIFICATION = ['not_put_forward', 'awaiting', 'verified'] as const;
export type Verification = typeof VERIFICATION[number];
export const VERIFICATION_LABEL: Record<Verification, string> = {
  not_put_forward: 'Not put forward as fixed',
  awaiting: 'Fixed, to check',
  verified: 'Verified and closed',
};

export const ISSUE_SORTS = ['reference', 'issue', 'project', 'raised', 'owner', 'target', 'work', 'confirmation'] as const;
export type IssueSort = typeof ISSUE_SORTS[number];

export const PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface IssueQuery {
  view: IssueView;
  projectId?: string | undefined;
  trade?: string | undefined;
  /** Words found in the location, in any order, ignoring case and spacing. */
  location?: string | undefined;
  /** Words found in the responsible company or person, the same way. */
  company?: string | undefined;
  verification?: Verification | undefined;
  /** No sort means priority order. */
  sort?: { key: IssueSort; direction: SortDirection } | undefined;
  page: number;
  pageSize: number;
}

export interface IssuePage {
  issues: Issue[];
  /** Matching issues across every page. */
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  /** How many issues each chip would show, with the other filters applied. */
  counts: Record<IssueView, number>;
  /** Every company or person named as an owner in the register, for suggestions. */
  owners: string[];
  /** The longest-waiting closure in this search that this person may verify. */
  oldestToVerify?: Issue | undefined;
}

const pick = <T extends string>(values: readonly T[], value: string | null): T | undefined =>
  values.find(v => v === value);
const text = (value: string | null): string | undefined => value?.trim() || undefined;
const whole = (value: string | null, fallback: number, max: number): number => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
};

/** Read a query from the address. Anything unknown falls back to the default rather than failing. */
export function parseIssueQuery(params: URLSearchParams): IssueQuery {
  const key = pick(ISSUE_SORTS, params.get('sort'));
  return {
    view: pick(ISSUE_VIEWS, params.get('view')) ?? 'open',
    projectId: text(params.get('projectId')),
    trade: text(params.get('trade')),
    location: text(params.get('location')),
    company: text(params.get('company')),
    verification: pick(VERIFICATION, params.get('verification')),
    sort: key ? { key, direction: params.get('direction') === 'descending' ? 'descending' : 'ascending' } : undefined,
    page: whole(params.get('page'), 1, Number.MAX_SAFE_INTEGER),
    pageSize: whole(params.get('pageSize'), PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/** The address for a query, leaving defaults out. */
export function issueQueryParams(q: Partial<IssueQuery>): URLSearchParams {
  const p = new URLSearchParams();
  if (q.view && q.view !== 'open') p.set('view', q.view);
  if (q.projectId) p.set('projectId', q.projectId);
  if (q.trade) p.set('trade', q.trade);
  if (q.location?.trim()) p.set('location', q.location.trim());
  if (q.company?.trim()) p.set('company', q.company.trim());
  if (q.verification) p.set('verification', q.verification);
  if (q.sort) { p.set('sort', q.sort.key); p.set('direction', q.sort.direction); }
  if (q.page && q.page > 1) p.set('page', String(q.page));
  if (q.pageSize && q.pageSize !== PAGE_SIZE) p.set('pageSize', String(q.pageSize));
  return p;
}

export const isOverdueIssue = (i: Issue, day: string): boolean => isActiveIssue(i) && /^\d{4}-\d{2}-\d{2}$/.test(i.targetDate) && i.targetDate < day;
export const isNotReviewedIssue = (i: Issue): boolean => isActiveIssue(i) && i.confirmation === 'provisional';
export const isDisputedIssue = (i: Issue): boolean => isActiveIssue(i) && i.confirmation === 'disputed';

export function verificationOf(i: Issue): Verification | undefined {
  if (i.work === 'closed') return 'verified';
  if (!isActiveIssue(i)) return undefined; // withdrawn
  return i.work === 'awaiting_verification' ? 'awaiting' : 'not_put_forward';
}

const words = (value: string): string[] => value.toLowerCase().split(/\s+/).filter(Boolean);
/** Every word of the search appears in the field, so "riser 2" finds "Level 3, Riser 2". */
export function matchesWords(field: string, search: string | undefined): boolean {
  if (!search?.trim()) return true;
  const haystack = words(field).join(' ');
  return words(search).every(w => haystack.includes(w));
}

/** The trade the issue is for: the affected trade, or the reporter's where none was named. */
const tradeOf = (i: Issue): string | undefined => i.affectedTrade ?? i.reporterTrade;

export interface QueryContext {
  day: string;
  projectName?: (projectId: string) => string;
  /** Whether the project uses report review; "not reviewed" means nothing where it does not. All do when not given. */
  reviewOn?: (projectId: string) => boolean;
  /** Closures this person put forward, which they cannot verify. */
  mine?: (issue: Issue) => boolean;
}

export function queryIssues(all: readonly Issue[], q: IssueQuery, context: QueryContext): IssuePage {
  const { day } = context;
  const reviewOn = context.reviewOn ?? (() => true);
  const views: Record<IssueView, (i: Issue) => boolean> = {
    open: isActiveIssue, overdue: i => isOverdueIssue(i, day), verify: isVerify, unassigned: isUnassigned,
    // Issues stay provisional where nobody reviews reports, so only projects using review count.
    notReviewed: i => isNotReviewedIssue(i) && reviewOn(i.projectId), disputed: isDisputedIssue, closed: i => !isActiveIssue(i), all: () => true,
  };
  const scoped = all.filter(i => (!q.projectId || i.projectId === q.projectId)
    && (!q.trade || tradeOf(i) === q.trade)
    && matchesWords(i.location, q.location)
    && matchesWords(i.owner, q.company)
    && (!q.verification || verificationOf(i) === q.verification));
  const counts = Object.fromEntries(ISSUE_VIEWS.map(v => [v, scoped.filter(views[v]).length])) as Record<IssueView, number>;
  const matching = scoped.filter(views[q.view]);

  const name = context.projectName ?? ((id: string) => id);
  const value = (i: Issue, key: IssueSort): string => ({ reference: i.reference, issue: i.description, project: name(i.projectId), raised: i.raisedAt, owner: i.owner.trim() || 'Unassigned', target: i.targetDate || '', work: i.work, confirmation: i.confirmation })[key];
  const rank = (i: Issue) => isOverdueIssue(i, day) ? 0 : isDisputedIssue(i) ? 1 : isVerify(i) ? 2 : isUnassigned(i) ? 3 : 4;
  const sort = q.sort;
  const ordered = sort
    ? sortTableRows(matching, sort.direction, i => value(i, sort.key), i => i.reference)
    // Priority: overdue, disputed, ready to verify, unassigned; then earliest target, newest raised, and reference so pages never overlap.
    : matching.sort((a, b) => rank(a) - rank(b) || (a.targetDate || '9999').localeCompare(b.targetDate || '9999') || b.raisedAt.localeCompare(a.raisedAt) || a.reference.localeCompare(b.reference) || a.id.localeCompare(b.id));

  const pages = Math.max(1, Math.ceil(ordered.length / q.pageSize));
  const page = Math.min(q.page, pages);
  // One suggestion per company, however its case was typed; the first spelling seen is kept.
  const owners = [...new Map(all.map(i => i.owner.trim().replace(/\s+/g, ' ')).filter(Boolean).reverse().map(o => [o.toLowerCase(), o] as const)).values()].sort((a, b) => a.localeCompare(b));
  const mine = context.mine ?? (() => false);
  const oldestToVerify = scoped.filter(i => isVerify(i) && !mine(i)).sort((a, b) => a.raisedAt.localeCompare(b.raisedAt) || a.reference.localeCompare(b.reference))[0];
  return { oldestToVerify, issues: ordered.slice((page - 1) * q.pageSize, page * q.pageSize), total: ordered.length, page, pageSize: q.pageSize, pages, counts, owners };
}
