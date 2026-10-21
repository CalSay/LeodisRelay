import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { getNote, markNote } from '@/lib/siteNoteStore';
import { noteProject } from '@/lib/siteNoteRoute';

export const dynamic = 'force-dynamic';

/** Mark a note done with (`{ done: true }`) or put it back (`{ done: false }`). Any role on the note's project. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.done !== 'boolean') return NextResponse.json({ reason: 'Invalid note action.' }, { status: 422 });
  const note = getNote(id);
  if (!note) return NextResponse.json({ reason: 'No such note.' }, { status: 404 });
  const found = await noteProject(guard.principal, note.projectId);
  if ('response' in found) return found.response;
  const outcome = markNote(id, body.done, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
