import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is this container actually able to serve?
 *
 * Deliberately unauthenticated, because the thing asking is a container
 * runtime, not a person. It is also deliberately more than a 200: it opens the
 * record store and counts, so a container that has lost its data volume or has
 * a locked database reports unhealthy instead of cheerfully serving a shell of
 * an application.
 *
 * It answers about this process only. Nothing here reveals project, report or
 * person — a probe that leaks is a probe that has to be authenticated, and an
 * authenticated probe cannot be used by Docker.
 */
export async function GET() {
  try {
    database().prepare('SELECT count(*) AS n FROM records').get();
    return NextResponse.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
