import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canManage } from '@/lib/auth/access';
import { listIssues } from '@/lib/issueStore';
import { logChase } from '@/lib/chaseStore';
import { companyKey } from '@/lib/companyIssues';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/**
 * Keep a chase note against a company or person: what was said and, if they
 * gave one, the day they promised. An office action: Managers and Admins.
 * It changes no issue and sends nothing.
 */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.principal)) return NextResponse.json({ reason: 'Manager access required.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.owner !== 'string' || typeof body.note !== 'string' || typeof body.requestId !== 'string' ||
      (body.promisedBy !== undefined && typeof body.promisedBy !== 'string') || body.note.length > 4000 || body.owner.length > 400) {
    return NextResponse.json({ reason: 'Invalid chase.' }, { status: 422 });
  }
  // Only a company named on an issue this person can open, so a note cannot be pinned to a name the page never shows.
  const key = companyKey(body.owner);
  const named = listIssues().some(i => companyKey(i.owner) === key && canAccessProject(guard.principal, i.projectId));
  if (!key || !named) return NextResponse.json({ reason: 'No company or person by that name has issues on your projects.' }, { status: 404 });
  const outcome = logChase({ owner: body.owner, note: body.note, promisedBy: body.promisedBy ?? '', requestId: body.requestId }, guard.principal, londonDay(new Date()));
  return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
