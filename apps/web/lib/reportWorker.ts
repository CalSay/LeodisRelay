import { atomic, claimJob, database, enqueue, finishJob, getRecord, putRecord } from './storage';
import { ensurePdf } from './pdfArtifacts';
import type { Report } from './types';

/** One process, one expensive render at a time; web requests only enqueue work. */
export async function runOneJob(): Promise<boolean> {
  const job = claimJob();
  if (!job) return false;
  const { reportId } = JSON.parse(job.payload) as { reportId:string };
  const heartbeat = setInterval(() => {
    database().prepare('UPDATE jobs SET available=? WHERE id=? AND lease=?').run(Date.now()+300000,job.id,job.lease);
  },30000);
  try {
    const snapshot = getRecord<Report>('snapshots',reportId);
    if (!snapshot) throw new Error('The submitted snapshot is missing.');
    if (job.kind === 'pdf') {
      await ensurePdf(snapshot);
      atomic(() => {
        const current = getRecord<Report>('reports',reportId)!;
        const previouslyDelivered = current.issued?.records.some(record => !record.failure);
        putRecord('reports',{ ...current, delivery: previouslyDelivered ? (current.issued?.transport === 'outbox' ? 'outbox' : 'sent') : 'rendered', deliveryError:undefined });
        if (!previouslyDelivered) enqueue('delivery:'+reportId,'delivery',{ reportId });
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
      const current = getRecord<Report>('reports',reportId);
      if (current) putRecord('reports',{ ...current, delivery:'failed', deliveryError:reason });
      finishJob(job,reason);
    });
  } finally { clearInterval(heartbeat); }
  return true;
}
