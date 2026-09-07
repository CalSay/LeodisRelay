import { NextResponse } from "next/server";
import { listIssues, openIssues } from "@/lib/issueStore";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const only = url.searchParams.get("only");
  if (projectId && only === "open") {
    return NextResponse.json({ issues: openIssues(projectId) });
  }
  return NextResponse.json({ issues: listIssues(projectId) });
}
