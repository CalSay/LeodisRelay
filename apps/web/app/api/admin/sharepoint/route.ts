import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/auth/access';
import { atomic, database, getRecord, putRecord, records } from '@/lib/storage';
import { sharePointMode, pilotItemIds } from '@/lib/sharepoint/config';
import type { Issue, Report } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({reason:'Admin access required.'},{status:403});
  return NextResponse.json({ mode:sharePointMode(), projectItemIds:pilotItemIds(),
    jobs:database().prepare("SELECT id,kind,status,attempts,error FROM jobs WHERE kind LIKE 'sharepoint-%' AND status!='complete' ORDER BY available,id").all(),
    issues:records<Issue>('issues').filter(i=>i.sync && i.sync.status!=='synced').map(i=>({id:i.id,reference:i.reference,sync:i.sync})),
    reports:records<Report>('reports').filter(r=>r.sharepoint).map(r=>({id:r.id,reference:r.reference,sharepoint:r.sharepoint})),
  });
}
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({reason:'Admin access required.'},{status:403});
  const body = await request.json().catch(()=>null) as {jobId?:string} | null;
  if (!body?.jobId || typeof body.jobId !== 'string' || sharePointMode() !== 'write') return NextResponse.json({reason:'Writes must be enabled and a job selected.'},{status:422});
  const result = atomic(() => {
    const job = database().prepare("SELECT * FROM jobs WHERE id=? AND kind LIKE 'sharepoint-%' AND status='failed'").get(body.jobId!);
    if (!job) return false;
    const payload = JSON.parse(String(job.payload));
    const issue = payload.issue ? getRecord<Issue>('issues',payload.issue.id) : undefined;
    // Retrying retains the original ETag. It never silently accepts/overwrites an external edit.
    if (issue?.sync?.status === 'conflict') return false;
    if (issue?.sync) putRecord('issues',{...issue,sync:{...issue.sync,status:'pending',error:undefined}});
    database().prepare("UPDATE jobs SET status='pending',attempts=0,available=0,error=NULL WHERE id=?").run(body.jobId!);
    putRecord('integration-audit',{id:crypto.randomUUID(),actorId:guard.principal.id,action:'retry',jobId:body.jobId,at:new Date().toISOString()});
    return true;
  });
  return result ? NextResponse.json({ok:true}) : NextResponse.json({reason:'This job is not retryable. SharePoint conflicts require reconciliation.'},{status:409});
}
