import { refreshIssues, IssueSyncError } from '@/lib/sharepoint/issues';
import { NextResponse } from "next/server";
import { applyCommand, getIssue, type IssueCommand } from "@/lib/issueStore";
import { requireSession } from "@/lib/auth/guard";
import { validatePhotos } from '@/lib/validatePhotos';
import { canIssueCommand,canAccessProject } from '@/lib/auth/access';

export const dynamic = "force-dynamic";

export async function GET(_r: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  try { await refreshIssues(); } catch { return NextResponse.json({reason:'SharePoint issues could not be refreshed. Please retry.'},{status:503}); }
  const issue = getIssue(id);
  if(issue && !canAccessProject(guard.principal,issue.projectId))return NextResponse.json({reason:'Project access required.'},{status:403});
  return issue
    ? NextResponse.json(issue)
    : NextResponse.json({ reason: "No such issue." }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;
  try { await refreshIssues(); } catch { return NextResponse.json({reason:'SharePoint issues could not be refreshed. Please retry.'},{status:503}); }
  const issue=getIssue(id);
  if(!issue)return NextResponse.json({reason:'No such issue.'},{status:404});
  if(!canAccessProject(principal,issue.projectId))return NextResponse.json({reason:'Project access required.'},{status:403});

  const command = (await request.json().catch(() => null)) as IssueCommand | null;
  if (!command || typeof command.kind !== 'string' || typeof command.note !== 'string' ||
      (command.owner !== undefined && typeof command.owner !== 'string') ||
      (command.targetDate !== undefined && typeof command.targetDate !== 'string')) {
    return NextResponse.json({reason:'Invalid issue action.'},{status:422});
  }
  if (issue.sync?.etag && command.expectedEtag !== issue.sync.etag) return NextResponse.json({reason:'This issue changed in SharePoint. Refresh and review the current record before applying the action.'},{status:409});
  if (!canIssueCommand(principal,command.kind)) return NextResponse.json({reason:'You cannot perform this issue action.'},{status:403});
  const validation = await validatePhotos(command.photos ?? [], { issueId: id });
  if (validation) return NextResponse.json({ reason: validation }, { status: 422 });
  // Attribution is the session's, not the client's: independent verification
  // means nothing if the actor can be typed in.
  let outcome;
  try { outcome = applyCommand(id, { ...command, actor: principal.name, actorId:principal.id }); }
  catch (error) { return NextResponse.json({reason:error instanceof IssueSyncError ? error.message : 'The issue could not be queued for SharePoint.'},{status:409}); }
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
