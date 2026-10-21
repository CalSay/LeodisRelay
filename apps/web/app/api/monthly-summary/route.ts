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
import { londonDay } from '@/lib/weeklySummary';
import { monthOf, monthSummary } from '@/lib/monthSummary';

export const dynamic = 'force-dynamic';

/** One project's calendar month: sent reports, issue and variation movements, standing at the month's end. No health and safety records. Every role on the project may read it. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') ?? '';
  let projects;
  try { [projects] = await Promise.all([refreshProjects(), refreshIssues(), refreshVariations()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the summary might miss recent changes. Please retry.' },{ status:503 }); }
  // The same project rule as the weekly summary.
  const project = projects.find(p => p.id === projectId && (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(guard.principal, p.id));
  if (!project) return NextResponse.json({ reason:'This project is not open to you.' },{ status:404 });
  const today = londonDay(new Date());
  return jsonResponse(request, monthSummary({ reports:listReports(projectId), issues:listIssues(projectId), variations:listVariations(projectId) },
    guard.principal, projectId, monthOf(url.searchParams.get('month') ?? undefined, today), today));
}
