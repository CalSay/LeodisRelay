import type { FixtureProject, ObservationType } from '@/lib/fixtures';
import type { Issue, ReportSummary } from '@/lib/types';
import type { Tone } from '@/lib/status';

/**
 * What the office desk derives from the records it loads. Pure functions over
 * report summaries and issues, so the screens stay layout and the rules stay
 * testable. Nothing here invents a figure the store cannot answer.
 */

export interface Snapshot { reports: ReportSummary[]; drafts: ReportSummary[]; issues: Issue[]; loadedAt: string }

/** Today in the office's calendar, as YYYY-MM-DD, so target dates compare as strings. */
export const today = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

export const isActive = (i: Issue): boolean => i.work !== 'closed' && i.confirmation !== 'withdrawn';
export const isOverdue = (i: Issue, day: string): boolean => isActive(i) && /^\d{4}-\d{2}-\d{2}$/.test(i.targetDate) && i.targetDate < day;
export const isVerify = (i: Issue): boolean => isActive(i) && i.work === 'awaiting_verification';
export const isUnassigned = (i: Issue): boolean => isActive(i) && i.owner.trim() === '';
export const isNotReviewed = (i: Issue): boolean => isActive(i) && i.confirmation === 'provisional';
export const isDisputed = (i: Issue): boolean => isActive(i) && i.confirmation === 'disputed';
export const isClosed = (i: Issue): boolean => i.work === 'closed';

/** The notification email to the project manager has not gone. A quiet fact: the report is on file regardless. */
export const notNotified = (r: ReportSummary): boolean => r.state === 'submitted' && (r.delivery === 'outbox' || r.issued?.transport === 'outbox' || (!!r.issued && r.issued.records.length === 0));
/** The worker could not process it. This one does need a person. */
export const processingFailed = (r: ReportSummary): boolean => r.state === 'submitted' && (r.delivery === 'failed' || (r.issued?.records ?? []).some(x => x.failure));
export const notAcknowledged = (r: ReportSummary): boolean => r.state === 'submitted' && !r.acknowledged;
export const awaitingReview = (r: ReportSummary): boolean => r.state === 'submitted' && r.review === 'pending';
export const returned = (r: ReportSummary): boolean => r.state === 'submitted' && r.review === 'returned';

/** Closed, awaiting verification, overdue, and the rest of the open ones. Four counts, one bar. */
export interface Rollup { total: number; closed: number; verify: number; overdue: number; open: number }
export function rollup(issues: Issue[], day: string): Rollup {
  const live = issues.filter(i => i.confirmation !== 'withdrawn');
  const closed = live.filter(isClosed).length;
  const overdue = live.filter(i => isOverdue(i, day)).length;
  const verify = live.filter(i => isVerify(i) && !isOverdue(i, day)).length;
  return { total: live.length, closed, verify, overdue, open: live.length - closed - overdue - verify };
}

export interface ProjectStats {
  project: FixtureProject;
  code: string;
  issues: Issue[];
  active: Issue[];
  overdue: Issue[];
  verify: Issue[];
  unassigned: Issue[];
  notReviewed: Issue[];
  disputed: Issue[];
  /** Submitted, newest first. */
  reports: ReportSummary[];
  /** Other people's draft summaries and the office's own drafts. */
  drafts: ReportSummary[];
  notNotified: ReportSummary[];
  failed: ReportSummary[];
  pendingReview: ReportSummary[];
  returned: ReportSummary[];
  rollup: Rollup;
  needsAction: number;
}
export function projectStats(project: FixtureProject, snap: Snapshot, day: string): ProjectStats {
  const issues = snap.issues.filter(i => i.projectId === project.id);
  const reports = snap.reports.filter(r => r.projectId === project.id).sort(byReceived);
  const drafts = snap.drafts.filter(r => r.projectId === project.id);
  const s: ProjectStats = {
    project, code: project.projectNumber, issues,
    active: issues.filter(isActive),
    overdue: issues.filter(i => isOverdue(i, day)),
    verify: issues.filter(isVerify),
    unassigned: issues.filter(isUnassigned),
    notReviewed: issues.filter(isNotReviewed),
    disputed: issues.filter(isDisputed),
    reports, drafts,
    notNotified: reports.filter(notNotified),
    failed: reports.filter(processingFailed),
    pendingReview: reports.filter(awaitingReview),
    returned: reports.filter(returned),
    rollup: rollup(issues, day),
    needsAction: 0,
  };
  s.needsAction = new Set([...s.overdue, ...s.verify, ...s.unassigned, ...s.disputed].map(i => i.id)).size + s.failed.length + s.pendingReview.length;
  return s;
}

export const byReceived = (a: ReportSummary, b: ReportSummary): number => (b.serverAcknowledgedAt ?? b.lastSavedAt ?? '').localeCompare(a.serverAcknowledgedAt ?? a.lastSavedAt ?? '');

/** What a visit found, by kind. Summaries written before kind counts existed fall back to the issue-raising count. */
export function found(r: ReportSummary): { kind: ObservationType; n: number }[] {
  if (r.kindCounts) {
    return (['defect', 'instruction', 'access', 'update'] as ObservationType[]).map(kind => ({ kind, n: r.kindCounts![kind] ?? 0 })).filter(f => f.n > 0);
  }
  const out: { kind: ObservationType; n: number }[] = [];
  if (r.defectCount > 0) out.push({ kind: 'defect', n: r.defectCount });
  if (r.observationCount - r.defectCount > 0) out.push({ kind: 'update', n: r.observationCount - r.defectCount });
  return out;
}
export const KIND: Record<ObservationType, { one: string; many: string; tone: string }> = {
  defect: { one: 'defect', many: 'defects', tone: 'tone-defect' },
  instruction: { one: 'variation', many: 'variations', tone: 'tone-variation' },
  access: { one: 'access', many: 'access', tone: 'tone-access' },
  update: { one: 'progress', many: 'progress', tone: 'tone-neutral' },
};

export const WORK_LABEL: Record<Issue['work'], string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_verification: 'Verify', closed: 'Closed' };
export const CONFIRM_LABEL: Record<Issue['confirmation'], string> = { provisional: 'Not reviewed', confirmed: 'Confirmed', disputed: 'Disputed', withdrawn: 'Withdrawn' };
export function workTag(i: Issue, day: string): { label: string; cls: string } {
  if (i.confirmation === 'withdrawn') return { label: 'Withdrawn', cls: 'tag-quiet' };
  if (i.work === 'closed') return { label: 'Closed', cls: 'tag-ok' };
  if (isOverdue(i, day)) return { label: `${daysLate(i.targetDate, day)}d overdue`, cls: 'tag-alert' };
  if (i.work === 'awaiting_verification') return { label: 'Verify', cls: 'tag-caution' };
  return { label: WORK_LABEL[i.work], cls: i.work === 'open' ? 'tag-quiet' : 'tag-acc' };
}
export function confirmTag(i: Issue): { label: string; cls: string } {
  return { label: CONFIRM_LABEL[i.confirmation], cls: i.confirmation === 'confirmed' ? 'tag-ok' : i.confirmation === 'disputed' ? 'tag-alert' : 'tag-quiet' };
}
export const toneTag = (tone: Tone): string => tone === 'sent' ? 'tag-ok' : tone === 'alert' ? 'tag-alert' : 'tag-quiet';

/** Whole days between two YYYY-MM-DD dates. */
export function daysLate(target: string, day: string): number {
  return Math.round((Date.parse(day) - Date.parse(target)) / 86400000);
}
export function daysSince(iso: string | undefined, now = Date.now()): number {
  return iso ? Math.floor((now - Date.parse(iso)) / 86400000) : 0;
}

const LONDON = { timeZone: 'Europe/London' } as const;
export function fmtWhen(iso?: string): string {
  return iso ? new Date(iso).toLocaleString('en-GB', { ...LONDON, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
}
export function fmtDay(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { ...LONDON, day: '2-digit', month: 'short' }) : '—';
}
export function fmtDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { ...LONDON, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Not recorded';
}
/** "011LME-SPR-014" → "SPR-014": the project is already known in its column. */
export const shortRef = (reference: string): string => reference.split('-').slice(1).join('-') || reference;

/** Everything that needs a person, across the portfolio, most urgent first. */
export interface AttentionItem { key: string; title: string; sub: string; tag: { label: string; cls: string }; go: string; action?: { label: string; primary?: boolean; kind: 'retry' | 'verify' | 'assign' | 'triage' | 'review' | 'chase' | 'confirm'; issue?: Issue; report?: ReportSummary } }
export function attention(stats: ProjectStats[], day: string): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const s of stats) {
    for (const r of s.failed) out.push({ key: `ne-${r.id}`, title: 'Report could not be processed', sub: `${r.reference} · ${r.author} · received ${fmtDay(r.serverAcknowledgedAt)}. ${r.deliveryError ?? 'The worker gave up on it.'}`, tag: { label: 'Processing', cls: 'tag-alert' }, go: `#/projects/${s.code}/report/${r.id}` });
    for (const r of s.pendingReview) out.push({ key: `rv-${r.id}`, title: 'Report awaiting review', sub: `${r.reference} · ${r.author} · received ${fmtDay(r.serverAcknowledgedAt)}`, tag: { label: 'Review', cls: 'tag-caution' }, go: `#/projects/${s.code}/report/${r.id}`, action: { label: 'Review', kind: 'review', report: r } });
    for (const i of s.overdue) out.push({ key: `od-${i.id}`, title: i.description, sub: `${s.project.projectName} · ${i.owner || 'unassigned'} · target ${i.targetDate}`, tag: { label: `${daysLate(i.targetDate, day)}d overdue`, cls: 'tag-alert' }, go: `#/projects/${s.code}/issue/${i.id}` });
    for (const i of s.verify) out.push({ key: `vf-${i.id}`, title: i.description, sub: `${s.project.projectName} · closure by ${i.closureSubmittedBy ?? 'unknown'} · waiting ${daysSince(i.events.at(-1)?.at)} days`, tag: { label: 'Verify', cls: 'tag-caution' }, go: `#/projects/${s.code}/issue/${i.id}`, action: { label: 'Verify', kind: 'verify', primary: true, issue: i } });
    for (const i of s.unassigned) out.push({ key: `ua-${i.id}`, title: i.description, sub: `${s.project.projectName} · nobody owns it · raised ${fmtDay(i.raisedAt)}`, tag: { label: 'Unassigned', cls: 'tag-caution' }, go: `#/projects/${s.code}/issue/${i.id}`, action: { label: 'Assign', kind: 'assign', primary: true, issue: i } });
    for (const i of s.disputed) out.push({ key: `dp-${i.id}`, title: i.description, sub: `${s.project.projectName} · the report that raised it was returned · needs a decision`, tag: { label: 'Disputed', cls: 'tag-alert' }, go: `#/projects/${s.code}/issue/${i.id}`, action: { label: 'Triage', kind: 'triage', issue: i } });
  }
  const rank = (t: AttentionItem) => t.key.startsWith('ne') ? 0 : t.key.startsWith('od') ? 1 : t.key.startsWith('rv') ? 2 : t.key.startsWith('dp') ? 3 : t.key.startsWith('vf') ? 4 : 5;
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Owners already used on a project, for the assignment dialog's suggestions. */
export function knownOwners(issues: Issue[]): string[] {
  return [...new Set(issues.map(i => i.owner.trim()).filter(Boolean))].sort();
}
