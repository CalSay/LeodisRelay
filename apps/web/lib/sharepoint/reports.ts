import { createHash } from 'node:crypto';
import type { Report } from '../types';
import { cachedProject } from '../projects';
import { atomic, getRecord, putRecord, records } from '../storage';
import { readPdf } from '../pdfArtifacts';
import { archiveFolder, assertProjectWrite, OPERATIONS } from './config';
import { graph, GraphError, type ListItem } from './graph';
import { personLookup } from './people';
import { fieldsEqual } from './issues';

interface DriveItem { id: string; name: string; size: number; webUrl: string; folder?: unknown; parentReference?: { id?: string; driveId?: string }; '@microsoft.graph.downloadUrl'?: string }
interface FilingReceipt { id: string; driveId: string; itemId: string; webUrl: string; digest: string }
/** A lost create acknowledgement may leave the exact pre-filing row behind. */
export function recoverablePendingReport(actual: Record<string, unknown>, desired: Record<string, unknown>): boolean {
  const pending: Record<string, unknown> = { ...desired, FilingStatus: 'Pending' };
  delete pending.RelayPdfUrl;
  return fieldsEqual(actual, pending) && fieldsEqual({ RelayPdfUrl: actual.RelayPdfUrl }, { RelayPdfUrl: '' });
}
/** One immutable revision, one deterministic file; a retry cannot replace an existing file. */
export async function fileReport(report: Report): Promise<FilingReceipt> {
  const project = report.projectSnapshot ?? cachedProject(report.projectId);
  if (!project?.source) throw new Error('Report has no SharePoint project mapping.');
  assertProjectWrite(project.source.itemId);
  const folder = archiveFolder(project.source.itemId);
  const bytes = await readPdf(report);
  if (!bytes) throw new Error('The stored PDF is not ready.');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const base = `/drives/${encodeURIComponent(folder.driveId)}/items/${encodeURIComponent(folder.itemId)}`;
  const destination = await graph.request<DriveItem>(base);
  if (!destination.folder) throw new Error('Configured report destination is not a folder.');
  const safe = report.reference.replace(/[^A-Za-z0-9._-]/g, '_');
  const name = `${safe}-r${report.revision}-${report.id}.pdf`;
  const path = `${base}:/${encodeURIComponent(name)}`;
  let item: DriveItem | undefined;
  try { item = await graph.request<DriveItem>(path); }
  catch (error) { if (!(error instanceof GraphError) || error.status !== 404) throw error; }
  if (!item) {
    // SharePoint already defaults new upload sessions to fail on a name conflict.
    // Sending the optional uploadable-properties body causes some document
    // libraries to reject an otherwise valid path-based request with HTTP 400.
    const session = await graph.request<{ uploadUrl: string }>(`${path}:/createUploadSession`, { method: 'POST' });
    const chunk = 10 * 320 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      const part = bytes.subarray(offset, Math.min(bytes.length, offset + chunk));
      await graph.transfer(session.uploadUrl, { method: 'PUT',
        headers: { 'Content-Length': String(part.length), 'Content-Range': `bytes ${offset}-${offset + part.length - 1}/${bytes.length}` },
        body: new Uint8Array(part),
      });
    }
    item = await graph.request<DriveItem>(path);
  }
  if (item.size !== bytes.length || !item['@microsoft.graph.downloadUrl']) throw new Error('Filed PDF could not be verified.');
  const downloaded = await graph.transfer(item['@microsoft.graph.downloadUrl']);
  const remoteDigest = createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex');
  if (remoteDigest !== digest) throw new Error('A different PDF already occupies the revision filename. Nothing was overwritten.');
  const receipt: FilingReceipt = { id: report.id, driveId: folder.driveId, itemId: item.id, webUrl: item.webUrl, digest };
  putRecord('sharepoint-files', receipt);
  return receipt;
}
/** Report register content comes from the immutable snapshot; workflow status comes from the server. */
export async function registerReport(snapshot: Report): Promise<void> {
  const project = snapshot.projectSnapshot ?? cachedProject(snapshot.projectId);
  if (!project?.source) throw new Error('Report has no SharePoint project identity.');
  assertProjectWrite(project.source.itemId);
  const report = getRecord<Report>('reports', snapshot.id)!;
  const receipt = getRecord<FilingReceipt>('sharepoint-files', snapshot.id);
  const superseded = records<Report>('reports', snapshot.projectId).some(r => r.state === 'submitted' && r.corrects === snapshot.id);
  const fields: Record<string, unknown> = {
    Title: snapshot.reference, RelayReportId: snapshot.id, ProjectLookupId: project.source.itemId,
    Revision: snapshot.revision, VisitDate: snapshot.visitDate, ReceivedAt: snapshot.serverAcknowledgedAt,
    SubmittedByLookupId: await personLookup(snapshot.authorId),
    ReviewStatus: { not_required: 'Not required', pending: 'Pending', approved: 'Approved', returned: 'Returned' }[report.review],
    FilingStatus: receipt ? 'Filed' : 'Pending',
    PreviousReportId: snapshot.corrects ?? '', ReportingTrade: snapshot.authorTrade ?? 'Not specified',
    Revision_x0020_Status: superseded ? 'Superseded' : 'Current',
    ...(report.reviewedById ? { ReviewedByLookupId: await personLookup(report.reviewedById), ReviewedAt: report.reviewedAt, ReviewComments: report.reviewNote ?? '' } : {}),
    ...(receipt ? { RelayPdfUrl: receipt.webUrl } : {}),
  };
  let remote = await graph.byKey(OPERATIONS.reports, 'RelayReportId', snapshot.id);
  const previous = getRecord<{ id: string; etag: string }>('sharepoint-reports', snapshot.id);
  if (!remote) {
    if (previous) throw new GraphError(412);
    try { await graph.request(`${graph.listPath(OPERATIONS.reports)}/items`, { method: 'POST', body: JSON.stringify({ fields: { ...fields, EmailStatus: 'Not requested' } }) }); }
    catch (error) {
      if (!(error instanceof GraphError) || ![400, 409].includes(error.status)) throw error;
      remote = await graph.byKey(OPERATIONS.reports, 'RelayReportId', snapshot.id);
      if (!remote || !fieldsEqual(remote.fields, fields)) throw error;
    }
  } else if (!fieldsEqual(remote.fields, fields)) {
    const recoveredPending = !!receipt && !previous && recoverablePendingReport(remote.fields, fields);
    if ((!previous && !recoveredPending) || (previous && previous.etag !== remote.eTag)) throw new GraphError(412);
    await graph.request(`${graph.listPath(OPERATIONS.reports)}/items/${encodeURIComponent(remote.id)}/fields`, {
      method: 'PATCH', headers: { 'If-Match': previous?.etag ?? remote.eTag }, body: JSON.stringify(fields),
    });
  }
  const saved = await graph.byKey(OPERATIONS.reports, 'RelayReportId', snapshot.id);
  if (!saved || !fieldsEqual(saved.fields, fields)) throw new GraphError(412);
  atomic(() => {
    putRecord('sharepoint-reports', { id: snapshot.id, itemId: saved.id, etag: saved.eTag });
    const current = getRecord<Report>('reports', snapshot.id)!;
    putRecord('reports', { ...current, sharepoint: { status: receipt ? 'filed' : 'registered', url: receipt?.webUrl, itemId: saved.id } });
  });
}
