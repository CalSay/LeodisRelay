import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listIssues } from '@/lib/issueStore';
import { listVariations } from '@/lib/variationStore';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { refreshVariations } from '@/lib/sharepoint/variations';
import { cameBack } from '@/lib/cameBack';

export const dynamic = 'force-dynamic';

/**
 * The engineer home's "Came back from the office" for one project: the
 * engineer's latest issues and variations, and the open issue count. The same
 * records and access rules as /api/issues and /api/variations, without
 * sending the phone every record on the project.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try { await Promise.all([refreshIssues(), refreshVariations()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached. Please retry.' },{ status:503 }); }
  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';
  if (!projectId) return NextResponse.json({ reason:'projectId is required.' },{ status:400 });
  const issues = listIssues(projectId).filter(i => canAccessProject(guard.principal, i.projectId));
  const variations = listVariations(projectId).filter(v => canAccessProject(guard.principal, v.projectId));
  return jsonResponse(request, cameBack(issues, variations, guard.principal.id));
}
