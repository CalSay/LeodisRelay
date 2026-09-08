import { NextResponse } from "next/server";
import { createReport, reportsFor } from "@/lib/serverStore";
import { requireSession } from "@/lib/auth/guard";
import { canManage } from '@/lib/auth/access';
import { FIXTURE_PROJECTS } from '@/lib/fixtures';

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

  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) {
    return NextResponse.json({ reason: "projectId is required." }, { status: 400 });
  }

  // Authorship comes from the session. A client-supplied author is not an
  // author, and the review rules depend on knowing who actually wrote this.
  const project = FIXTURE_PROJECTS.find(p => p.id === body.projectId);
  if (!project || !['4. Active','5. Defects Liability'].includes(project.status)) {
    return NextResponse.json({reason:'This project is not open for reporting.'},{status:422});
  }
  return NextResponse.json(createReport(body.projectId, principal.name, principal), { status: 201 });
}
