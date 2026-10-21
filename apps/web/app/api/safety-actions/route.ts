import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { listReports } from '@/lib/serverStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { safetyActions } from '@/lib/safetyActions';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/** Actions the safety inspections found, open and recently cleared, on every project open to the person. Any role: sent inspections are read by every trade. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  let projects;
  try { projects = await refreshProjects(); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the project list might be out of date. Please retry.' },{ status:503 }); }
  // The same project rule as site coverage: inspections are of live sites, active or in defects liability.
  // `?project=` narrows it to one project, for the counts on a project's own screens (engineer home).
  const only = new URL(request.url).searchParams.get('project');
  const open = projects.filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id) && (!only || p.id === only));
  return jsonResponse(request, safetyActions(open, open.flatMap(p => listReports(p.id)), guard.principal, londonDay(new Date())));
}
