import { atomic, claimJob, database, enqueue, finishJob, getRecord, putRecord } from './storage';
import { ensurePdf } from './pdfArtifacts';
import type { Report } from './types';
import { sharePointMode } from './sharepoint/config';
import { GraphError } from './sharepoint/graph';
import { failIssueOperation, sendIssueOperation, type IssueOperation } from './sharepoint/issues';
import { fileReport, registerReport } from './sharepoint/reports';
import { checkSchema } from './sharepoint/preflight';

/** One process, one expensive render at a time; web requests only enqueue work. */
export async function runOneJob(): Promise<boolean> {
  const job = claimJob();
  if (!job) return false;
  if (job.kind.startsWith('sharepoint-') && sharePointMode() !== 'write') {
    database().prepare("UPDATE jobs SET status='pending',attempts=attempts-1,lease=NULL,available=? WHERE id=? AND lease=?").run(Date.now()+60000,job.id,job.lease);
    return true;
  }
  const { reportId } = JSON.parse(job.payload) as { reportId:string };
  const heartbeat = setInterval(() => {
    database().prepare('UPDATE jobs SET available=? WHERE id=? AND lease=?').run(Date.now()+300000,job.id,job.lease);
  },30000);
  try {
    if (job.kind.startsWith('sharepoint-')) {
      if (sharePointMode() !== 'write') throw new Error('SharePoint writes are disabled.');
      await checkSchema();
      if (job.kind === 'sharepoint-issue') {
        await sendIssueOperation(JSON.parse(job.payload) as IssueOperation, job.id);
      } else {
        const submitted = getRecord<Report>('snapshots', reportId);
        if (!submitted) throw new Error('The submitted snapshot is missing.');
        if (job.kind === 'sharepoint-file') {
          await fileReport(submitted);
          await registerReport(submitted);
          atomic(() => {
            const current = getRecord<Report>('reports', reportId)!;
            putRecord('reports', { ...current, delivery: 'filed', deliveryError: undefined });
          });
        } else if (job.kind === 'sharepoint-register') await registerReport(submitted);
        else throw new Error('Unknown SharePoint job kind.');
      }
      finishJob(job);
      return true;
    }
    const snapshot = getRecord<Report>('snapshots',reportId);
    if (!snapshot) throw new Error('The submitted snapshot is missing.');
    if (job.kind === 'pdf') {
      await ensurePdf(snapshot);
      atomic(() => {
        const current = getRecord<Report>('reports',reportId)!;
        const previouslyDelivered = current.issued?.records.some(record => !record.failure);
        putRecord('reports',{ ...current, delivery: previouslyDelivered ? (current.issued?.transport === 'outbox' ? 'outbox' : 'sent') : 'rendered', deliveryError:undefined });
        if (!previouslyDelivered) {
          if (snapshot.projectSnapshot?.source) enqueue('sharepoint-file:'+reportId,'sharepoint-file',{reportId});
          else enqueue('delivery:'+reportId,'delivery',{ reportId });
        }
        finishJob(job);
      });
    } else if (job.kind === 'delivery') {
      // Live delivery must not bypass the required SharePoint filing step.
      if (process.env.RELAY_MAIL_ENABLED === 'yes') throw new Error('Live delivery is blocked until SharePoint filing and mailbox integration are configured.');
      const { issueReport } = await import('./delivery/issueReport');
      const current = getRecord<Report>('reports',reportId)!;
      const outcome = await issueReport(snapshot,current.issued?.records as never ?? [],await ensurePdf(snapshot));
      atomic(() => {
        const latest = getRecord<Report>('reports',reportId)!;
        const failed = outcome.records.some(r => r.failure) || outcome.unaddressed.length > 0;
        putRecord('reports',{ ...latest, delivery: failed ? 'failed' : 'outbox', issued:{ ...outcome, records:[...(latest.issued?.records ?? []),...outcome.records] } });
        finishJob(job,failed ? 'Local delivery failed or the recipient has no address.' : undefined);
      });
    } else throw new Error(`Unknown job kind: ${job.kind}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Report processing failed.';
    atomic(() => {
      if (job.kind.startsWith('sharepoint-')) {
        const permanent = error instanceof GraphError && [400,403,404,409,412,422].includes(error.status);
        if (job.kind === 'sharepoint-issue') {
          if (permanent || job.attempts >= 8) failIssueOperation(JSON.parse(job.payload) as IssueOperation, error, job.id);
        } else {
          const current = getRecord<Report>('reports', reportId);
          if (current) putRecord('reports', { ...current, sharepoint: { ...current.sharepoint, status:'failed', error:reason } });
        }
        finishJob(job, reason, error instanceof GraphError ? error.retryAfterMs : 0);
        if (permanent) database().prepare("UPDATE jobs SET status='failed' WHERE id=? AND status='pending'").run(job.id);
        return;
      }
      const current = getRecord<Report>('reports',reportId);
      if (current) putRecord('reports',{ ...current, delivery:'failed', deliveryError:reason });
      finishJob(job,reason);
    });
  } finally { clearInterval(heartbeat); }
  return true;
}
