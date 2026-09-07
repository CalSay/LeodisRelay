import { NextResponse } from "next/server";
import { createReport, listReports, officeView } from "@/lib/serverStore";
import { redactDrafts, requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  if (url.searchParams.get("view") === "office") {
    return NextResponse.json(officeView());
  }
  const projectId = url.searchParams.get("projectId") ?? undefined;
  // Draft content belongs to its author; others get existence only.
  return NextResponse.json({ reports: redactDrafts(guard.principal, listReports(projectId)) });
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
