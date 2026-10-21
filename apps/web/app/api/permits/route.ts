import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { noteProject } from '@/lib/siteNoteRoute';
import { permitsAcross, permitsFor, recordPermit } from '@/lib/permitStore';
import { PERMIT_COLUMNS, isPermitKind, londonMinute, permitRepeats, permitRows } from '@/lib/permits';
import { registerFileName, toCsv } from '@/lib/sheet';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/**
 * Permits to work. With `project`, that project's permits (any role on it);
 * `summary=1` gives the figures only, for the site home's row; `format=csv`
 * the whole record as a spreadsheet, withdrawn ones included and marked.
 * Without `project`, the open permits past their end time on every live
 * project open to the person, for the office's Needs attention. Nothing is
 * sent anywhere.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const projectId = params.get('project');
  if (projectId === null) {
    let projects;
    try { projects = await refreshProjects(); }
    catch { return NextResponse.json({ reason: 'SharePoint could not be reached, so the project list might be out of date. Please retry.' }, { status: 503 }); }
    return NextResponse.json(permitsAcross(projects.filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id))));
  }
  const found = await noteProject(guard.principal, projectId);
  if ('response' in found) return found.response;
  const all = permitsFor(projectId);
  if (params.get('format') === 'csv') {
    const csv = toCsv([[...PERMIT_COLUMNS], ...permitRows(all.permits, londonMinute(new Date()), found.project)]);
    const name = registerFileName('permits', londonDay(new Date()), found.project.projectNumber);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  }
  if (params.get('summary') === '1') return NextResponse.json({ projectId, summary: all.summary });
  return NextResponse.json({ ...all, now: londonMinute(new Date()), repeats: permitRepeats(all.permits), live: reportableProject(found.project) });
}

/** Record a permit on a live project. Any role on the project. */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const optional = (v: unknown, max: number) => v === undefined || text(v, max);
  if (!body || typeof body.project !== 'string' || typeof body.requestId !== 'string' || !isPermitKind(body.kind) || !text(body.work, 2000)
    || !text(body.issuedBy, 1000) || !text(body.heldBy, 1000) || !text(body.day, 20) || !text(body.ends, 30)
    || !optional(body.reference, 1000) || !optional(body.notes, 8000)) {
    return NextResponse.json({ reason: 'Invalid permit.' }, { status: 422 });
  }
  const found = await noteProject(guard.principal, body.project);
  if ('response' in found) return found.response;
  if (!reportableProject(found.project)) return NextResponse.json({ reason: 'This project is closed, so it takes no new permits.' }, { status: 409 });
  const outcome = recordPermit({
    projectId: body.project, requestId: body.requestId, kind: body.kind, work: body.work as string, issuedBy: body.issuedBy as string,
    heldBy: body.heldBy as string, day: body.day as string, ends: body.ends as string,
    ...(typeof body.reference === 'string' ? { reference: body.reference } : {}), ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
  }, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
