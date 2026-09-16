import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/auth/access';
import { addPerson, removePerson, renamePerson, restorePerson, setAssignment, type PeopleResult } from '@/lib/people';

export const dynamic = 'force-dynamic';

/**
 * Admin changes to the people checklist: the name shown in Relay and the role
 * listed. Nothing here grants access; roles still come from Microsoft Entra.
 * Every change is logged on the person and written to the audit record.
 */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({ reason: 'Admin access required.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: unknown; email?: unknown; name?: unknown; assignment?: unknown } | null;
  if (!body || typeof body !== 'object' || typeof body.email !== 'string') return NextResponse.json({ reason: 'Choose a person.' }, { status: 400 });
  const actor = guard.principal;
  let result: PeopleResult;
  switch (body.action) {
    case 'add': result = addPerson(actor, { email: body.email, name: body.name, assignment: body.assignment }); break;
    case 'rename': result = renamePerson(actor, { email: body.email, name: body.name }); break;
    case 'assignment': result = setAssignment(actor, { email: body.email, assignment: body.assignment }); break;
    case 'remove': result = removePerson(actor, { email: body.email }); break;
    case 'restore': result = restorePerson(actor, { email: body.email }); break;
    default: return NextResponse.json({ reason: 'Unknown change.' }, { status: 400 });
  }
  return result.ok ? NextResponse.json({ person: result.person }) : NextResponse.json({ reason: result.reason }, { status: result.status });
}
