import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { noteProject } from '@/lib/siteNoteRoute';
import { getTalk, withdrawTalk } from '@/lib/toolboxTalkStore';

export const dynamic = 'force-dynamic';

/** Withdraw a talk recorded by mistake (`{ reason }`). Whoever recorded it, or the office, on the talk's project. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.reason !== 'string' || body.reason.length > 2000) return NextResponse.json({ reason: 'Invalid withdrawal.' }, { status: 422 });
  const talk = getTalk(id);
  if (!talk) return NextResponse.json({ reason: 'No such toolbox talk.' }, { status: 404 });
  const found = await noteProject(guard.principal, talk.projectId);
  if ('response' in found) return found.response;
  const outcome = withdrawTalk(id, body.reason, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
