import { NextResponse } from "next/server";
import { createReport, reportsFor, startedReport } from "@/lib/serverStore";
import { isClientKey, visitDateProblem } from '@/lib/offlineStart';
import { requireSession } from "@/lib/auth/guard";
import { canManage } from '@/lib/auth/access';
import { cachedProject, refreshProjects, reportableProject } from '@/lib/projects';
import { sharePointMode } from '@/lib/sharepoint/config';
import { isReportType } from '@/lib/reportTypes';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ reason:'Invalid page.' },{ status:400 });
  if (url.searchParams.get("view") === "office") {
    if (!canManage(guard.principal)) return NextResponse.json({reason:'Manager access required.'},{status:403});
    const page = reportsFor(guard.principal,undefined,offset);
    return NextResponse.json({
      awaitingReview:page.items.filter(r => r.state === 'submitted' && r.review === 'pending'),
      submitted:page.items.filter(r => r.state === 'submitted' && r.review !== 'pending'),
      drafts:page.items.filter(r => r.state === 'draft'),next:page.next,
    });
  }
  const projectId = url.searchParams.get("projectId") ?? undefined;
  // Draft content belongs to its author; others get existence only.
  const page = reportsFor(guard.principal,projectId,offset);
  return NextResponse.json({ reports:page.items, next:page.next });
}

export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;

  const body = (await request.json()) as { projectId?: string; reportType?: unknown; clientKey?: unknown; visitDate?: unknown };
  if (!body.projectId) {
    return NextResponse.json({ reason: "projectId is required." }, { status: 400 });
  }
  if (body.reportType !== undefined && !isReportType(body.reportType)) return NextResponse.json({ reason: 'Unknown report type.' }, { status: 422 });
  // A report started on a phone with no connection carries its own key and
  // visit date. Both or neither: a date alone would let any start backdate.
  if ((body.clientKey === undefined) !== (body.visitDate === undefined)) return NextResponse.json({ reason: 'A report started offline needs both its key and its visit date.' }, { status: 422 });
  if (body.clientKey !== undefined && !isClientKey(body.clientKey)) return NextResponse.json({ reason: 'Invalid report key.' }, { status: 422 });
  if (body.clientKey !== undefined) {
    // Already started on an earlier try whose answer was lost: the same report,
    // even if the project has closed since.
    const previous = startedReport(principal.id, body.clientKey as string);
    if (previous) return previous.projectId !== body.projectId ? NextResponse.json({ reason: 'A report key was reused for another project.' }, { status: 422 })
      : (previous.reportType ?? 'progress') !== (body.reportType ?? 'progress') ? NextResponse.json({ reason: 'A report key was reused for another kind of report.' }, { status: 422 })
      : NextResponse.json(previous);
    const problem = visitDateProblem(body.visitDate);
    if (problem) return NextResponse.json({ reason: problem }, { status: 422 });
  }

  // Authorship comes from the session. A client-supplied author is not an
  // author, and the review rules depend on knowing who actually wrote this.
  if (sharePointMode() === 'read') return NextResponse.json({reason:'Report capture is disabled while the connection is read-only.'},{status:409});
  try { await refreshProjects(); } catch { return NextResponse.json({reason:'SharePoint projects could not be refreshed. Please retry.'},{status:503}); }
  const project = cachedProject(body.projectId);
  if (!project || !reportableProject(project)) {
    return NextResponse.json({reason:'This project is not open for reporting.'},{status:422});
  }
  return NextResponse.json(createReport(body.projectId, principal.name, principal, body.reportType ?? 'progress',
    body.clientKey !== undefined ? { clientKey: body.clientKey as string, visitDate: body.visitDate as string } : undefined), { status: 201 });
}
