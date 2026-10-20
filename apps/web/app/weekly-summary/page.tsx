import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { WeeklySummaryPage } from '@/components/WeeklySummaryPage';
import './week.css';

export const dynamic = 'force-dynamic';
export default async function WeeklySummary({ searchParams }: { searchParams: Promise<{ project?: string; week?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent('/weekly-summary')}`);
  return <WeeklySummaryPage initialProject={query.project ?? ''} initialWeek={query.week ?? ''} returnTo={query.returnTo} />;
}
