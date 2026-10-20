import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listReports } from '@/lib/serverStore';
import { listIssues } from '@/lib/issueStore';
import { listVariations } from '@/lib/variationStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { refreshVariations } from '@/lib/sharepoint/variations';
import { sharePointMode } from '@/lib/sharepoint/config';
import { search } from '@/lib/search';

export const dynamic = 'force-dynamic';

/** Find reports, issues and variations across every project open to the signed-in person. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').slice(0, 200);
  const projectId = url.searchParams.get('projectId') || undefined;
  let projects;
  try { [projects] = await Promise.all([refreshProjects(), refreshIssues(), refreshVariations()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so search might miss recent changes. Please retry.' },{ status:503 }); }
  // The same project rule as the report, issue and variation lists.
  const open = projects.filter(p => (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(guard.principal,p.id));
  const allowed = new Set(open.map(p => p.id));
  const scoped = <T extends { projectId: string }>(rows: T[]) => rows.filter(r => allowed.has(r.projectId));
  return NextResponse.json(search(query, {
    reports:scoped(listReports()), issues:scoped(listIssues()), variations:scoped(listVariations()),
    projects:open.map(p => ({ id:p.id, projectName:p.projectName, projectNumber:p.projectNumber })),
  }, guard.principal, projectId));
}
