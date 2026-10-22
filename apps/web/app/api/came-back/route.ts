import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listIssues } from '@/lib/issueStore';
import { listVariations } from '@/lib/variationStore';
import { ownSentReports } from '@/lib/serverStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { refreshVariations } from '@/lib/sharepoint/variations';
import { cameBack, cameBackElsewhere } from '@/lib/cameBack';

export const dynamic = 'force-dynamic';

/**
 * The engineer home's "Came back from the office" for one project: the
 * engineer's latest issues and variations, and the open issue count. The same
 * records and access rules as /api/issues and /api/variations, without
 * sending the phone every record on the project.
 *
 * With `elsewhere=1`: what waits on the engineer on every other site they
 * report on (lib/cameBack.ts `cameBackElsewhere`), so the office's question at
 * one site shows while they are at another.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const elsewhere = url.searchParams.get('elsewhere') === '1';
  let projects;
  try { [projects] = await Promise.all([elsewhere ? refreshProjects() : undefined, refreshIssues(), refreshVariations()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached. Please retry.' },{ status:503 }); }
  const projectId = url.searchParams.get('projectId') ?? '';
  if (!projectId) return NextResponse.json({ reason:'projectId is required.' },{ status:400 });
  if (elsewhere) {
    // The same sites as the engineer home lists (app/engineer/page.tsx), less the one they are at.
    const sites = new Set((projects ?? []).filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id) && p.id !== projectId).map(p => p.id));
    return jsonResponse(request, cameBackElsewhere({ issues: listIssues(), variations: listVariations(), reports: ownSentReports(guard.principal.id) }, guard.principal, sites));
  }
  const issues = listIssues(projectId).filter(i => canAccessProject(guard.principal, i.projectId));
  const variations = listVariations(projectId).filter(v => canAccessProject(guard.principal, v.projectId));
  return jsonResponse(request, cameBack(issues, variations, guard.principal.id));
}
