import { NextResponse } from 'next/server';
import { safetyRecordsRefusal } from '@/lib/features';
import { requireSession } from '@/lib/auth/guard';
import { noteProject } from '@/lib/siteNoteRoute';
import { closePermit, getPermit, withdrawPermit } from '@/lib/permitStore';

export const dynamic = 'force-dynamic';

/**
 * Close a permit (`{ action: 'close', confirmed: true, note? }`), anyone on the
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
  const close = body?.action === 'close' && typeof body.confirmed === 'boolean' && (body.note === undefined || (typeof body.note === 'string' && body.note.length <= 2000));
  const withdraw = body?.action === 'withdraw' && typeof body.reason === 'string' && body.reason.length <= 2000;
  if (!body || (!close && !withdraw)) return NextResponse.json({ reason: 'Invalid change to a permit.' }, { status: 422 });
  const permit = getPermit(id);
  if (!permit) return NextResponse.json({ reason: 'No such permit.' }, { status: 404 });
  const found = await noteProject(guard.principal, permit.projectId);
  if ('response' in found) return found.response;
  const outcome = close
    ? closePermit(id, body.confirmed as boolean, body.note as string | undefined, guard.principal)
    : withdrawPermit(id, body.reason as string, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
