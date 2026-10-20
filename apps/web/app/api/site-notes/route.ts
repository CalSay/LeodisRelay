import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { reportableProject } from '@/lib/projects';
import { noteProject } from '@/lib/siteNoteRoute';
import { leaveNote, notesFor } from '@/lib/siteNoteStore';

export const dynamic = 'force-dynamic';

/** One project's notes for the next visit. Any role on the project. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const projectId = new URL(request.url).searchParams.get('project') ?? '';
  const found = await noteProject(guard.principal, projectId);
  if ('response' in found) return found.response;
  return NextResponse.json({ ...notesFor(projectId), live: reportableProject(found.project) });
}

/** Leave a note on a live project. Any role on the project: engineers and the office both pass word on. */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.project !== 'string' || typeof body.text !== 'string' || typeof body.requestId !== 'string' || body.text.length > 4000) {
    return NextResponse.json({ reason: 'Invalid note.' }, { status: 422 });
  }
  const found = await noteProject(guard.principal, body.project);
  if ('response' in found) return found.response;
  if (!reportableProject(found.project)) return NextResponse.json({ reason: 'This project is closed, so it takes no new notes.' }, { status: 409 });
  const outcome = leaveNote({ projectId: body.project, text: body.text, requestId: body.requestId }, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
