import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listIssues } from '@/lib/issueStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { sharePointMode } from '@/lib/sharepoint/config';
import { issueTrend } from '@/lib/issueTrend';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/** One project's issues week by week. Every role on the project may read it; it changes nothing. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';
  let projects;
  try { [projects] = await Promise.all([refreshProjects(), refreshIssues()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so these figures might miss recent changes. Please retry.' },{ status:503 }); }
  // The same project rule as Before handover and the weekly summary.
  const project = projects.find(p => p.id === projectId && (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(guard.principal, p.id));
  if (!project) return NextResponse.json({ reason:'This project is not open to you.' },{ status:404 });
  return NextResponse.json(issueTrend(listIssues(projectId), projectId, londonDay(new Date())));
}
