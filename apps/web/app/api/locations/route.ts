import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { records } from '@/lib/storage';
import type { Issue, Report, Variation } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The places already typed on a project, newest first.
 *
 * Suggestions, not a catalogue (EXP-4): anything an engineer typed on this job
 * before is offered back, free text is always allowed, and nothing has to
 * match. Drawn from submitted reports, issues and variations, so a location
 * only ever seen in a private draft is not shown to anyone else.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';
  if (!projectId || !canAccessProject(guard.principal, projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });
  const latest = new Map<string, { at: string; text: string }>();
  const note = (location: string, at: string) => {
    const text = location.trim(); const key = text.toLowerCase();
    if (!key) return;
    const prev = latest.get(key);
    if (!prev || prev.at < at) latest.set(key, { at, text });
  };
  for (const r of records<Report>('reports', projectId)) if (r.state === 'submitted') for (const o of r.observations) note(o.location, r.serverAcknowledgedAt ?? '');
  for (const i of records<Issue>('issues', projectId)) note(i.location, i.raisedAt);
  for (const v of records<Variation>('variations', projectId)) note(v.location, v.raisedAt);
  const locations = [...latest.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12).map(x => x.text);
  return NextResponse.json({ locations });
}
