import { NextResponse } from 'next/server';
import { safetyRecordsRefusal } from '@/lib/features';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { noteProject } from '@/lib/siteNoteRoute';
import { deliveriesAcross, deliveriesFor, recordDelivery } from '@/lib/deliveryStore';
import { DELIVERY_COLUMNS, deliveryRows, deliverySuppliers, isDeliveryCondition } from '@/lib/deliveries';
import { registerFileName, toCsv } from '@/lib/sheet';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/**
 * Deliveries to site. With `project`, that project's deliveries (any role on
 * it); `summary=1` gives the figures only, for the site home's row;
 * `format=csv` the whole record as a spreadsheet, withdrawn ones included and
 * marked. Without `project`, the deliveries still to sort on every live
 * project open to the person, for the office's Needs attention. Nothing is
 * sent anywhere.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  // Behind the office's switch, off by default (lib/featureSwitch.ts).
  const off = safetyRecordsRefusal();
  if (off) return off;
  const params = new URL(request.url).searchParams;
  const projectId = params.get('project');
  if (projectId === null) {
    let projects;
    try { projects = await refreshProjects(); }
    catch { return NextResponse.json({ reason: 'SharePoint could not be reached, so the project list might be out of date. Please retry.' }, { status: 503 }); }
    return NextResponse.json(deliveriesAcross(projects.filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id))));
  }
  const found = await noteProject(guard.principal, projectId);
  if ('response' in found) return found.response;
  const all = deliveriesFor(projectId);
  if (params.get('format') === 'csv') {
    const csv = toCsv([[...DELIVERY_COLUMNS], ...deliveryRows(all.deliveries, found.project)]);
    const name = registerFileName('deliveries', londonDay(new Date()), found.project.projectNumber);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  }
  if (params.get('summary') === '1') return NextResponse.json({ projectId, summary: all.summary });
  return NextResponse.json({ ...all, today: londonDay(new Date()), suppliers: deliverySuppliers(all.deliveries), live: reportableProject(found.project) });
}

/** Record a delivery on a live project. Any role on the project. */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  // Behind the office's switch, off by default (lib/featureSwitch.ts).
  const off = safetyRecordsRefusal();
  if (off) return off;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const optional = (v: unknown, max: number) => v === undefined || text(v, max);
  if (!body || typeof body.project !== 'string' || typeof body.requestId !== 'string' || !isDeliveryCondition(body.condition) || !text(body.supplier, 1000)
    || !text(body.items, 2000) || !text(body.receivedBy, 1000) || !text(body.day, 20)
    || !optional(body.noteNumber, 1000) || !optional(body.storedAt, 1000) || !optional(body.problem, 2000)) {
    return NextResponse.json({ reason: 'Invalid delivery.' }, { status: 422 });
  }
  const found = await noteProject(guard.principal, body.project);
  if ('response' in found) return found.response;
  if (!reportableProject(found.project)) return NextResponse.json({ reason: 'This project is closed, so it takes no new deliveries.' }, { status: 409 });
  const outcome = recordDelivery({
    projectId: body.project, requestId: body.requestId, supplier: body.supplier as string, items: body.items as string, day: body.day as string,
    receivedBy: body.receivedBy as string, condition: body.condition,
    ...(typeof body.noteNumber === 'string' ? { noteNumber: body.noteNumber } : {}), ...(typeof body.storedAt === 'string' ? { storedAt: body.storedAt } : {}),
    ...(typeof body.problem === 'string' ? { problem: body.problem } : {}),
  }, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
