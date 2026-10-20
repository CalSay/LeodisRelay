import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { MyWeekPage } from '@/components/MyWeekPage';
import './my-week.css';

export const metadata: Metadata = { title: 'My week' };

export const dynamic = 'force-dynamic';
/** Every signed-in person may see their own week; it shows nobody else's records. */
export default async function MyWeek({ searchParams }: { searchParams: Promise<{ week?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/my-week${kept.size ? `?${kept}` : ''}`)}`);
  return <MyWeekPage initialWeek={query.week ?? ''} returnTo={query.returnTo} />;
}
