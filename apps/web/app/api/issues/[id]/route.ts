import { NextResponse } from "next/server";
import { applyCommand, getIssue, type IssueCommand } from "@/lib/issueStore";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(_r: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const issue = getIssue(id);
  return issue
    ? NextResponse.json(issue)
    : NextResponse.json({ reason: "No such issue." }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;

  const command = (await request.json()) as IssueCommand;
  // Attribution is the session's, not the client's: independent verification
  // means nothing if the actor can be typed in.
  const outcome = applyCommand(id, { ...command, actor: principal.name });
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
