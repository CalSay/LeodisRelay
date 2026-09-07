import { NextResponse } from "next/server";
import { createReport, listReports, officeView } from "@/lib/serverStore";
import { currentPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "office") {
    return NextResponse.json(officeView());
  }
  const projectId = url.searchParams.get("projectId") ?? undefined;
  return NextResponse.json({ reports: listReports(projectId) });
}

export async function POST(request: Request) {
  const principal = await currentPrincipal();
  if (!principal) {
    return NextResponse.json({ reason: "Please sign in again." }, { status: 401 });
  }

  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) {
    return NextResponse.json({ reason: "projectId is required." }, { status: 400 });
  }

  // Authorship comes from the session. A client-supplied author is not an
  // author, and the review rules depend on knowing who actually wrote this.
  return NextResponse.json(createReport(body.projectId, principal.name), { status: 201 });
}
