import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/jsonResponse';
import { listVariations, raiseOfficeVariation } from '@/lib/variationStore';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canRaiseVariation } from '@/lib/auth/access';
import { refreshVariations } from '@/lib/sharepoint/variations';

export const dynamic = 'force-dynamic';

/** The variation register, optionally for one project. Every role on the project may read it. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try { await refreshVariations(); } catch { return NextResponse.json({reason:'SharePoint variations could not be refreshed. Please retry.'},{status:503}); }
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  return jsonResponse(request, { variations: listVariations(projectId).filter(v => canAccessProject(guard.principal, v.projectId)) });
}

const str = (v: unknown): v is string | undefined => v === undefined || typeof v === 'string';

/** A variation raised by the office, attributed by the server to whoever is signed in. */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;
  if (!canRaiseVariation(principal)) return NextResponse.json({ reason: 'Only the office can add a variation to the register.' }, { status: 403 });
  try { await refreshVariations(true); } catch { return NextResponse.json({reason:'SharePoint variations could not be refreshed. Please retry.'},{status:503}); }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.requestId !== 'string' || typeof body.projectId !== 'string' || typeof body.description !== 'string' ||
      !str(body.location) || !str(body.trade) || !str(body.reason) || !str(body.askedBy) || !str(body.note) || (body.workDone !== undefined && typeof body.workDone !== 'boolean')) {
    return NextResponse.json({ reason: 'Invalid variation.' }, { status: 422 });
  }
  if (!canAccessProject(principal, body.projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });
  // Canonical fields only. A caller cannot supply authorship, state, pricing or reference.
  const outcome = await raiseOfficeVariation(principal, { requestId: body.requestId, projectId: body.projectId, description: body.description,
    location: body.location, trade: body.trade, reason: body.reason, workDone: body.workDone, askedBy: body.askedBy, note: body.note });
  return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
