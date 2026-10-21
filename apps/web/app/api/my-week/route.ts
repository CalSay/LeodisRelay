import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listReports } from '@/lib/serverStore';
import { listIssues } from '@/lib/issueStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { sharePointMode } from '@/lib/sharepoint/config';
import { myWeek } from '@/lib/myWeek';
import { talksFor } from '@/lib/toolboxTalkStore';
import { permitsFor } from '@/lib/permitStore';
import { deliveriesFor } from '@/lib/deliveryStore';
import { londonDay, weekStart } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/** The signed-in person's own week across every project open to them. Any role: it only ever shows their own records. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  let projects;
  try { [projects] = await Promise.all([refreshProjects(), refreshIssues()]); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so your week might miss recent changes. Please retry.' },{ status:503 }); }
  // The same project rule as the weekly summary.
  const open = projects.filter(p => (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(guard.principal, p.id));
  const today = londonDay(new Date());
  const monday = weekStart(new URL(request.url).searchParams.get('week') ?? undefined, today);
  return jsonResponse(request, myWeek(open, { reports:open.flatMap(p => listReports(p.id)), issues:open.flatMap(p => listIssues(p.id)),
    talks:open.flatMap(p => talksFor(p.id).talks), permits:open.flatMap(p => permitsFor(p.id).permits), deliveries:open.flatMap(p => deliveriesFor(p.id).deliveries) }, guard.principal, monday, today));
}
