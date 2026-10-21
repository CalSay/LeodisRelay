import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canManage } from '@/lib/auth/access';
import { listReports } from '@/lib/serverStore';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { fortnightStart, siteCoverage } from '@/lib/siteCoverage';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/** Which days each reportable project had a report from site over a fortnight. An office view: Managers and Admins. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.principal)) return NextResponse.json({ reason:'Manager access required.' },{ status:403 });
  let projects;
  try { projects = await refreshProjects(); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the project list might be out of date. Please retry.' },{ status:503 }); }
  // The same project rule as the office project list.
  const open = projects.filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id));
  const today = londonDay(new Date());
  const start = fortnightStart(new URL(request.url).searchParams.get('start') ?? undefined, today);
  return jsonResponse(request, siteCoverage(open, open.flatMap(p => listReports(p.id)), guard.principal, start, today));
}
