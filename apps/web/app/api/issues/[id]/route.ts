import { NextResponse } from "next/server";
import { applyCommand, getIssue, type IssueCommand } from "@/lib/issueStore";

export const dynamic = "force-dynamic";

export async function GET(_r: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const issue = getIssue(id);
  return issue
    ? NextResponse.json(issue)
    : NextResponse.json({ reason: "No such issue." }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const command = (await request.json()) as IssueCommand;
  const outcome = applyCommand(id, command);
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
