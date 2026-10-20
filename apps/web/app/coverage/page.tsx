import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';
import { SiteCoveragePage } from '@/components/SiteCoveragePage';
import './coverage.css';

export const metadata: Metadata = { title: 'Site coverage' };

export const dynamic = 'force-dynamic';
/** Site coverage is an office view: Managers and Admins. Engineers are sent to the hub, as /office does. */
export default async function Coverage({ searchParams }: { searchParams: Promise<{ start?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/coverage${kept.size ? `?${kept}` : ''}`)}`);
  if (!canManage(principal)) redirect('/');
  return <SiteCoveragePage initialStart={query.start ?? ''} returnTo={query.returnTo} />;
}
