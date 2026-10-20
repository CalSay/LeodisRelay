import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { IssueTrendPage } from '@/components/IssueTrendPage';
import './issue-trend.css';

export const metadata: Metadata = { title: 'Issues over time' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: it counts issues every trade on the project can already read. */
export default async function IssueTrend({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/issue-trend${kept.size ? `?${kept}` : ''}`)}`);
  return <IssueTrendPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
