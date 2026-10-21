import { NextResponse } from 'next/server';
import { safetyRecordsRefusal } from '@/lib/features';
import { requireSession } from '@/lib/auth/guard';
import { noteProject } from '@/lib/siteNoteRoute';
import { getDelivery, sortDelivery, withdrawDelivery } from '@/lib/deliveryStore';

export const dynamic = 'force-dynamic';

/**
 * Mark a delivery's problem sorted (`{ action: 'sort', note }`), anyone on the
 * project, or withdraw one recorded by mistake (`{ action: 'withdraw', reason }`),
 * whoever recorded it or the office.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  // Behind the office's switch, off by default (lib/featureSwitch.ts).
  const off = safetyRecordsRefusal();
  if (off) return off;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const sort = body?.action === 'sort' && typeof body.note === 'string' && body.note.length <= 2000;
  const withdraw = body?.action === 'withdraw' && typeof body.reason === 'string' && body.reason.length <= 2000;
  if (!body || (!sort && !withdraw)) return NextResponse.json({ reason: 'Invalid change to a delivery.' }, { status: 422 });
  const delivery = getDelivery(id);
  if (!delivery) return NextResponse.json({ reason: 'No such delivery.' }, { status: 404 });
  const found = await noteProject(guard.principal, delivery.projectId);
  if ('response' in found) return found.response;
  const outcome = sort
    ? sortDelivery(id, body.note as string, guard.principal)
    : withdrawDelivery(id, body.reason as string, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
