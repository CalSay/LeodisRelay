import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { WeeklySummaryPage } from '@/components/WeeklySummaryPage';
import './week.css';

type Query = { project?: string; week?: string; period?: string; month?: string; returnTo?: string };

/** The tab, and the name a saved PDF is given, say which summary it is. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  return { title: (await searchParams).period === 'month' ? 'Monthly summary' : 'Weekly summary' };
}

export const dynamic = 'force-dynamic';
export default async function WeeklySummary({ searchParams }: { searchParams: Promise<Query> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent('/weekly-summary')}`);
  return <WeeklySummaryPage initialProject={query.project ?? ''} initialWeek={query.week ?? ''} initialPeriod={query.period ?? ''} initialMonth={query.month ?? ''} returnTo={query.returnTo} />;
}
