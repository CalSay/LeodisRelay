import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listReports } from '@/lib/serverStore';
import { listIssues } from '@/lib/issueStore';
import { listVariations } from '@/lib/variationStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { refreshVariations } from '@/lib/sharepoint/variations';
import { sharePointMode } from '@/lib/sharepoint/config';
import { beforeHandover } from '@/lib/beforeHandover';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/** What one project still has open before handover. Every role on the project may read it; it changes nothing. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';
  let projects;
  try { [projects] = await Promise.all([refreshProjects(), refreshIssues(), refreshVariations()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so this list might miss recent changes. Please retry.' },{ status:503 }); }
  // The same project rule as the weekly summary and the report, issue and variation lists.
  const project = projects.find(p => p.id === projectId && (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(guard.principal, p.id));
  if (!project) return NextResponse.json({ reason:'This project is not open to you.' },{ status:404 });
  return jsonResponse(request, beforeHandover(project, { reports:listReports(projectId), issues:listIssues(projectId), variations:listVariations(projectId) }, guard.principal, londonDay(new Date())));
}
