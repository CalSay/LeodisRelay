import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/auth/access';
import { atomic, database, getRecord, putRecord, records } from '@/lib/storage';
import { readableProjectItemIds, sharePointMode, writableProjectItemIds } from '@/lib/sharepoint/config';
import type { Issue, Report, Variation } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({reason:'Admin access required.'},{status:403});
  return NextResponse.json({ mode:sharePointMode(), readableProjectItemIds:readableProjectItemIds() ?? 'all-reportable', writableProjectItemIds:writableProjectItemIds(),
    jobs:database().prepare("SELECT id,kind,status,attempts,error FROM jobs WHERE kind LIKE 'sharepoint-%' AND status!='complete' ORDER BY available,id").all(),
    issues:records<Issue>('issues').filter(i=>i.sync && i.sync.status!=='synced').map(i=>({id:i.id,reference:i.reference,sync:i.sync})),
    variations:records<Variation>('variations').filter(v=>v.sync && v.sync.status!=='synced').map(v=>({id:v.id,reference:v.reference,sync:v.sync})),
    reports:records<Report>('reports').filter(r=>r.sharepoint).map(r=>({id:r.id,reference:r.reference,sharepoint:r.sharepoint})),
  });
}
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({reason:'Admin access required.'},{status:403});
  const body = await request.json().catch(()=>null) as {jobId?:string;reportId?:string} | null;
  const selected = typeof body?.jobId === 'string' || typeof body?.reportId === 'string';
  if (!selected || sharePointMode() !== 'write') return NextResponse.json({reason:'Writes must be enabled and a failed job selected.'},{status:422});
  const result = atomic(() => {
    const job = body?.reportId
      ? database().prepare("SELECT * FROM jobs WHERE status='failed' AND kind IN ('sharepoint-file','sharepoint-register') AND json_extract(payload,'$.reportId')=? ORDER BY CASE kind WHEN 'sharepoint-file' THEN 0 ELSE 1 END, available, id LIMIT 1").get(body.reportId)
      : database().prepare("SELECT * FROM jobs WHERE id=? AND kind LIKE 'sharepoint-%' AND status='failed'").get(body!.jobId!);
    if (!job) return false;
    const payload = JSON.parse(String(job.payload));
    const issue = payload.issue ? getRecord<Issue>('issues',payload.issue.id) : undefined;
    const variation = payload.variation ? getRecord<Variation>('variations',payload.variation.id) : undefined;
    const report = payload.reportId ? getRecord<Report>('reports',payload.reportId) : undefined;
    // Retrying retains the original operation and ETag. The worker only
    // acknowledges an existing remote row when its fields match; a genuine
    // external edit therefore returns to conflict without being overwritten.
    if (issue?.sync) putRecord('issues',{...issue,sync:{...issue.sync,status:'pending',error:undefined}});
    if (variation?.sync) putRecord('variations',{...variation,sync:{...variation.sync,status:'pending',error:undefined}});
    if (report?.sharepoint) putRecord('reports',{...report,sharepoint:{...report.sharepoint,status:'pending',error:undefined}});
    database().prepare("UPDATE jobs SET status='pending',attempts=0,available=0,error=NULL WHERE id=?").run(job.id);
    putRecord('integration-audit',{id:crypto.randomUUID(),actorId:guard.principal.id,action:'retry',jobId:String(job.id),at:new Date().toISOString()});
    return String(job.id);
  });
  return result ? NextResponse.json({ok:true,jobId:result}) : NextResponse.json({reason:'No failed SharePoint job is available for this record.'},{status:409});
}
