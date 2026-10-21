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
import { londonDay, weekStart, weeklySummary } from '@/lib/weeklySummary';
import { safetyRecordsOn } from '@/lib/features';
import { talksFor } from '@/lib/toolboxTalkStore';
import { permitsFor } from '@/lib/permitStore';
import { deliveriesFor } from '@/lib/deliveryStore';

export const dynamic = 'force-dynamic';

/** One project's week: sent reports, issue and variation movements, toolbox talks, permits and deliveries. Every role on the project may read it. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') ?? '';
  let projects;
  try { [projects] = await Promise.all([refreshProjects(), refreshIssues(), refreshVariations()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the summary might miss recent changes. Please retry.' },{ status:503 }); }
  // The same project rule as the report, issue and variation lists.
  const project = projects.find(p => p.id === projectId && (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(guard.principal, p.id));
  if (!project) return NextResponse.json({ reason:'This project is not open to you.' },{ status:404 });
  const today = londonDay(new Date());
  const monday = weekStart(url.searchParams.get('week') ?? undefined, today);
  return jsonResponse(request, weeklySummary({ reports:listReports(projectId), issues:listIssues(projectId), variations:listVariations(projectId),
    // Talks, permits and deliveries only while the office has them on (featureSwitch.ts).
    ...(safetyRecordsOn() ? { talks:talksFor(projectId).talks, permits:permitsFor(projectId).permits, deliveries:deliveriesFor(projectId).deliveries } : {}) }, guard.principal, projectId, monday, today));
}
