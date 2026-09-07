import { NextResponse } from "next/server";
import { createReport, reportPage, officeView } from "@/lib/serverStore";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ reason:'Invalid page.' },{ status:400 });
  if (url.searchParams.get("view") === "office") {
    return NextResponse.json(officeView(offset));
  }
  const projectId = url.searchParams.get("projectId") ?? undefined;
  // Draft content belongs to its author; others get existence only.
  const page = reportPage(projectId,offset);
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
  return NextResponse.json(createReport(body.projectId, principal.name), { status: 201 });
}
