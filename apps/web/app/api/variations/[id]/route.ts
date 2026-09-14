import { NextResponse } from 'next/server';
import { applyVariationCommand, getVariation, type VariationCommand } from '@/lib/variationStore';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canVariationCommand } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

export async function GET(_r: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const variation = getVariation(id);
  if (variation && !canAccessProject(guard.principal, variation.projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });
  return variation ? NextResponse.json(variation) : NextResponse.json({ reason: 'No such variation.' }, { status: 404 });
}

const str = (v: unknown): v is string | undefined => v === undefined || typeof v === 'string';
const obj = (v: unknown): v is Record<string, unknown> | undefined => v === undefined || (!!v && typeof v === 'object' && !Array.isArray(v));

/** One variation command, attributed by the server to whoever is signed in. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;
  const variation = getVariation(id);
  if (!variation) return NextResponse.json({ reason: 'No such variation.' }, { status: 404 });
  if (!canAccessProject(principal, variation.projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Partial<VariationCommand> | null;
  const d = body?.details, i = body?.instruction;
  if (!body || typeof body.kind !== 'string' || typeof body.note !== 'string' || body.note.length > 4000 || !obj(d) || !obj(i) || !obj(body.costing) ||
      (d && (!str(d.description) || !str(d.location) || !str(d.trade) || !str(d.reason) || (d.workDone !== undefined && typeof d.workDone !== 'boolean'))) ||
      (i && (!str(i.reference) || !str(i.by) || !str(i.on) || !str(i.signedInstruction) || (i.value !== undefined && typeof i.value !== 'number' && typeof i.value !== 'string')))) {
    return NextResponse.json({ reason: 'Invalid variation action.' }, { status: 422 });
  }
  if (!canVariationCommand(principal, body.kind)) return NextResponse.json({ reason: 'You cannot perform this variation action.' }, { status: 403 });
  // Attribution is the session's, not the client's.
  const outcome = applyVariationCommand(id, { kind: body.kind as VariationCommand['kind'], note: body.note, actor: principal.name, actorId: principal.id,
    ...(d ? { details: d as VariationCommand['details'] } : {}), ...(body.costing !== undefined ? { costing: body.costing } : {}), ...(i ? { instruction: i as VariationCommand['instruction'] } : {}) });
  return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
