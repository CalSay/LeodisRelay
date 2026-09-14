import { NextResponse } from 'next/server';
import { listVariations } from '@/lib/variationStore';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** The variation register, optionally for one project. Every role on the project may read it. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  return NextResponse.json({ variations: listVariations(projectId).filter(v => canAccessProject(guard.principal, v.projectId)) });
}
