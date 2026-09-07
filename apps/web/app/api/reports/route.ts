import { NextResponse } from "next/server";
import { createReport, listReports, officeView } from "@/lib/serverStore";

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
  const body = (await request.json()) as { projectId?: string; author?: string };
  if (!body.projectId) {
    return NextResponse.json({ reason: "projectId is required." }, { status: 400 });
  }
  return NextResponse.json(createReport(body.projectId, body.author ?? "You"), { status: 201 });
}
