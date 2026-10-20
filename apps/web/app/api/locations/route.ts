import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { records } from '@/lib/storage';
import { projectSuggestions } from '@/lib/suggestions';
import type { Issue, Report, Variation } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The places and responsible companies already typed on a project, newest
 * first. Suggestions, not a catalogue (EXP-4): the rules are in
 * `lib/suggestions.ts`.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';
  if (!projectId || !canAccessProject(guard.principal, projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });
  return NextResponse.json(projectSuggestions({
    reports: records<Report>('reports', projectId),
    issues: records<Issue>('issues', projectId),
    variations: records<Variation>('variations', projectId),
  }));
}
