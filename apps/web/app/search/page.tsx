import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { SearchPage } from '@/components/SearchPage';

export const metadata: Metadata = { title: 'Search' };

export const dynamic = 'force-dynamic';
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string; project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent('/search')}`);
  return <SearchPage initialQuery={query.q ?? ''} initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
