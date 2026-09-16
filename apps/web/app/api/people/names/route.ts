import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { relayNamesById } from '@/lib/people';

export const dynamic = 'force-dynamic';

/** Names set in Relay, keyed by account id. Any signed-in person may read them. */
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ names: relayNamesById() });
}
