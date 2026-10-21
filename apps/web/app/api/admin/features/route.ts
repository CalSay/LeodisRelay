import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/auth/access';
import { featureSettings, setSafetyRecords } from '@/lib/features';

export const dynamic = 'force-dynamic';

/** The feature switches. Anyone signed in may read them (pages hide what is off); only the Admin changes them. */
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(featureSettings());
}

export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({ reason: 'Admin access required.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { safetyRecords?: unknown } | null;
  if (typeof body?.safetyRecords !== 'boolean') return NextResponse.json({ reason: 'Say whether to turn it on or off.' }, { status: 422 });
  return NextResponse.json(setSafetyRecords(guard.principal, body.safetyRecords));
}
