import { randomUUID } from 'node:crypto';
import type { Issue } from '../types';
import { atomic, database, enqueue, getRecord, putRecord, records } from '../storage';
import { cachedProject, projectIdentity, refreshProjects, reportableProject } from '../projects';
import { assertProjectWrite, OPERATIONS, sharePointMode, writableProjectItemIds } from './config';
import { graph, GraphError, type ListItem } from './graph';
import { personLookup, principalForPerson, sitePeople } from './people';

const CONFIRMATION = { provisional: 'Provisional', confirmed: 'Confirmed', disputed: 'Disputed', withdrawn: 'Withdrawn' } as const;
const WORK = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_verification: 'Awaiting verification', closed: 'Closed' } as const;
export interface IssueSync { status: 'pending' | 'synced' | 'conflict' | 'failed'; itemId?: string | undefined; etag?: string | undefined; operationId?: string; error?: string; evidenceUrl?: string }
export interface IssueOperation { issue: Issue; baseEtag?: string | undefined; itemId?: string | undefined }
export class IssueSyncError extends Error {}

/** Add filed-report evidence links to report-raised issues created before links were synchronized. */
export function queueIssueSourceLinkBackfill(): void {
  if (sharePointMode() !== 'write') return;
  const allowed = new Set(writableProjectItemIds());
  atomic(() => {
    for (const issue of records<Issue>('issues')) {
      if (!issue.raisedByReport || issue.sync?.status !== 'synced') continue;
      const project = cachedProject(issue.projectId);
      const receipt = getRecord<{webUrl:string}>('sharepoint-files', issue.raisedByReport);
      if (project?.source && allowed.has(project.source.itemId) && receipt?.webUrl && issue.sync.evidenceUrl !== receipt.webUrl) saveIssue(issue);
    }
  });
}

/** Local edits are explicitly pending until the authoritative List acknowledges them. */
export function saveIssue(issue: Issue): void {
  if (sharePointMode() === 'off') { putRecord('issues', issue); return; }
  if (sharePointMode() === 'read') throw new IssueSyncError('Issue updates are disabled while SharePoint is read-only.');
  const project = cachedProject(issue.projectId);
  if (!project?.source) throw new IssueSyncError('This example issue cannot be sent to SharePoint.');
  assertProjectWrite(project.source.itemId);
  const old = getRecord<Issue>('issues', issue.id);
  if (old?.sync?.status === 'synced' && old.sync.etag && issue.sync?.etag !== old.sync.etag) throw new IssueSyncError('This issue changed while the action was being prepared.');
  if (old?.sync && old.sync.status !== 'synced') throw new IssueSyncError('This issue has an outstanding SharePoint operation. Resolve it before making another change.');
  const operationId = `sharepoint-issue:${randomUUID()}`;
  const sync: IssueSync = { status: 'pending', operationId, itemId: old?.sync?.itemId, etag: old?.sync?.etag };
  issue.sync = sync;
  putRecord('issues', issue);
  enqueue(operationId, 'sharepoint-issue', { issue, baseEtag: old?.sync?.etag, itemId: old?.sync?.itemId } satisfies IssueOperation);
}
export async function issueFields(issue: Issue): Promise<Record<string, unknown>> {
  const project = cachedProject(issue.projectId);
  if (!project?.source) throw new Error('The issue has no SharePoint project identity.');
  assertProjectWrite(project.source.itemId);
  const verified = [...issue.events].reverse().find(e => e.kind === 'verified');
  const receipt = issue.raisedByReport ? getRecord<{webUrl:string}>('sharepoint-files', issue.raisedByReport) : undefined;
  let origin = 'https://app.relaybyleodis.com';
  try { origin = new URL(process.env.ENTRA_REDIRECT_URI ?? origin).origin; } catch { /* retain the production origin */ }
  if (issue.work === 'closed' && !verified) throw new Error('Closure verification is missing from this issue history.');
  return {
    Title: issue.reference, RELAY_x0020_Issue_x0020_ID: issue.id, ProjectLookupId: project.source.itemId,
    Confirmation_x0020_Status: CONFIRMATION[issue.confirmation], Work_x0020_Status: WORK[issue.work],
    Description: issue.description, Location: issue.location, Required_x0020_Action: issue.actionNeeded,
    Reporting_x0020_Trade: issue.reporterTrade ?? 'Not specified',
    Affected_x0020_Trade: issue.affectedTrade === 'Other / non-Leodis' ? 'Other' : issue.affectedTrade ?? issue.reporterTrade ?? 'Not specified',
    External_x0020_Owner: issue.owner, Target_x0020_Date: issue.targetDate || null,
    Raised_x0020_ByLookupId: await personLookup(issue.reportedById ?? issue.events[0]?.actorId), Raised_x0020_At: issue.raisedAt,
    Source_x0020_Report_x0020_ID: issue.raisedByReport || '',
    Evidence_x0020_Link: receipt?.webUrl ?? null,
    RELAY_x0020_Link: `${origin}/issues/${encodeURIComponent(issue.id)}`,
    ...(issue.closureSubmittedById ? { Closure_x0020_Submitted_x0020_ByLookupId: await personLookup(issue.closureSubmittedById) } : {}),
    ...(issue.work === 'closed' && verified ? { Verified_x0020_ByLookupId: await personLookup(verified.actorId), Verified_x0020_At: verified.at } : {}),
  };
}
function enumKey<T extends string>(values: Record<T, string>, value: unknown): T {
  const entry = Object.entries(values).find(([, text]) => text === value);
  if (!entry) throw new Error('SharePoint contains an unsupported issue status.');
  return entry[0] as T;
}
export function fieldsEqual(actual: Record<string, unknown>, desired: Record<string, unknown>): boolean {
  return Object.entries(desired).every(([key, value]) => {
    let other = actual[key];
    if (other && typeof other === 'object' && ('Url' in other || 'url' in other)) other = (other as {Url?:string;url?:string}).Url ?? (other as {url?:string}).url;
    if (value === null || value === '') return other === undefined || other === null || other === '';
    if (key.endsWith('LookupId')) return String(other) === String(value);
    if (['Target_x0020_Date','VisitDate'].includes(key)) return siteDate(other) === siteDate(value);
    if (key.endsWith('_At') || ['ReceivedAt','ReviewedAt'].includes(key)) {
      return Math.trunc(Date.parse(String(other)) / 1000) === Math.trunc(Date.parse(String(value)) / 1000);
    }
    return other === value;
  });
}
function siteDate(value: unknown): string {
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(valuePart => valuePart.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export async function sendIssueOperation(operation: IssueOperation, operationId: string): Promise<void> {
  const fields = await issueFields(operation.issue);
  let remote = await graph.byKey(OPERATIONS.issues, 'RELAY_x0020_Issue_x0020_ID', operation.issue.id);
  if (remote && String(remote.fields.ProjectLookupId) !== String(fields.ProjectLookupId)) throw new GraphError(412);
  if (!remote && operation.itemId) throw new GraphError(412); // A deleted item must never be silently recreated.
  if (!remote) {
    try {
      remote = await graph.request<ListItem>(`${graph.listPath(OPERATIONS.issues)}/items`, { method: 'POST', body: JSON.stringify({ fields }) });
    } catch (error) {
      // Unique/indexed RELAY ID prevents a second item after a lost receipt.
      if (!(error instanceof GraphError) || ![400, 409].includes(error.status)) throw error;
      remote = await graph.byKey(OPERATIONS.issues, 'RELAY_x0020_Issue_x0020_ID', operation.issue.id);
      if (!remote || !fieldsEqual(remote.fields, fields)) throw error;
    }
  } else if (!fieldsEqual(remote.fields, fields)) {
    if (!operation.baseEtag || remote.eTag !== operation.baseEtag) throw new GraphError(412);
    await graph.request(`${graph.listPath(OPERATIONS.issues)}/items/${encodeURIComponent(remote.id)}/fields`, {
      method: 'PATCH', headers: { 'If-Match': operation.baseEtag }, body: JSON.stringify(fields),
    });
  }
  // Read back independently; an HTTP success alone is not synchronization evidence.
  const saved = await graph.byKey(OPERATIONS.issues, 'RELAY_x0020_Issue_x0020_ID', operation.issue.id);
  if (!saved || !fieldsEqual(saved.fields, fields)) throw new GraphError(412);
  atomic(() => {
    const current = getRecord<Issue>('issues', operation.issue.id);
    const evidenceUrl = typeof fields.Evidence_x0020_Link === 'string' ? fields.Evidence_x0020_Link : undefined;
    if (current?.sync?.operationId === operationId) putRecord('issues', { ...current, sync: { status: 'synced', itemId: saved.id, etag: saved.eTag, ...(evidenceUrl ? {evidenceUrl}: {}) } });
  });
}
let refreshing: Promise<void> | undefined;
export async function refreshIssues(): Promise<void> {
  if (sharePointMode() === 'off') return;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    await refreshProjects();
    const [rows, people] = await Promise.all([graph.items(OPERATIONS.issues), sitePeople()]);
    const seen = new Set<string>();
    const next: Issue[] = [];
    for (const row of rows) {
      const f = row.fields;
      const projectId = projectIdentity(String(f.ProjectLookupId));
      const project = cachedProject(projectId);
      if (!project || !reportableProject(project)) continue;
      const id = String(f.RELAY_x0020_Issue_x0020_ID ?? '');
      if (!id) throw new Error('A SharePoint issue has no RELAY identity.');
      if (seen.has(id)) throw new Error('Duplicate issue identity in SharePoint.');
      seen.add(id);
      const local = getRecord<Issue>('issues', id);
      if (local?.sync && local.sync.status !== 'synced') continue;
      const by = people.find(p => p.id === String(f.Raised_x0020_ByLookupId));
      const closure = people.find(p => p.id === String(f.Closure_x0020_Submitted_x0020_ByLookupId));
      const text = (v: unknown) => typeof v === 'string' ? v : '';
      const affected = text(f.Affected_x0020_Trade);
      const reporting = text(f.Reporting_x0020_Trade);
      const work = enumKey(WORK, f.Work_x0020_Status);
      const closedWithoutIndependentVerification = work === 'closed' && (!f.Verified_x0020_ByLookupId || !f.Closure_x0020_Submitted_x0020_ByLookupId || String(f.Verified_x0020_ByLookupId) === String(f.Closure_x0020_Submitted_x0020_ByLookupId));
      next.push({ ...local, id, reference: text(f.Title), projectId,
        description: text(f.Description), location: text(f.Location), actionNeeded: text(f.Required_x0020_Action),
        confirmation: enumKey(CONFIRMATION, f.Confirmation_x0020_Status), work,
        owner: text(f.External_x0020_Owner) || people.find(p => p.id === String(f.Assigned_x0020_ToLookupId))?.name || '',
        targetDate: text(f.Target_x0020_Date).slice(0, 10), raisedAt: text(f.Raised_x0020_At),
        raisedByReport: text(f.Source_x0020_Report_x0020_ID), reportedBy: by?.name,
        reportedById: by ? principalForPerson(by) : undefined,
        closureSubmittedBy: closure?.name, closureSubmittedById: closure ? principalForPerson(closure) : undefined,
        reporterTrade: ['Electrical', 'HVAC', 'P&H'].includes(reporting) ? reporting as Issue['reporterTrade'] : undefined,
        affectedTrade: affected === 'Other' ? 'Other / non-Leodis' : ['Electrical', 'HVAC', 'P&H'].includes(affected) ? affected as Issue['affectedTrade'] : undefined,
        events: local?.events ?? [], sync: closedWithoutIndependentVerification
          ? {status:'conflict', itemId:row.id, etag:row.eTag, error:'SharePoint closure lacks independent verification. Review the source item before continuing.'}
          : { status: 'synced', itemId: row.id, etag: row.eTag,
              ...(typeof f.Evidence_x0020_Link === 'object' && f.Evidence_x0020_Link
                ? {evidenceUrl:String((f.Evidence_x0020_Link as {Url?:string}).Url ?? '')}
                : text(f.Evidence_x0020_Link) ? {evidenceUrl:text(f.Evidence_x0020_Link)} : {}) },
      });
    }
    atomic(() => {
      for (const issue of next) {
        const current = getRecord<Issue>('issues', issue.id);
        if (!current?.sync || current.sync.status === 'synced') putRecord('issues', { ...issue, events: current?.events ?? issue.events });
      }
      // Keep history after deletion, but never continue presenting a deleted row as current.
      for (const old of records<Issue>('issues')) if (old.sync?.status === 'synced' && !seen.has(old.id)) {
        putRecord('issues', { ...old, sync: { ...old.sync, status: 'conflict', error: 'The SharePoint item was deleted or moved outside the connected project scope.' } });
      }
    });
  })();
  try { await refreshing; } finally { refreshing = undefined; }
}
export function failIssueOperation(operation: IssueOperation, error: unknown, operationId: string): void {
  const issue = getRecord<Issue>('issues', operation.issue.id);
  if (issue?.sync?.operationId === operationId) putRecord('issues', { ...issue, sync: { ...issue.sync,
    status: error instanceof GraphError && error.status === 412 ? 'conflict' : 'failed',
    error: error instanceof Error ? error.message : 'SharePoint synchronization failed.' } });
}
