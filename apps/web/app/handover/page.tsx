import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { BeforeHandoverPage } from '@/components/BeforeHandoverPage';
import './handover.css';

export const metadata: Metadata = { title: 'Before handover' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: it lists issues, reports and variations every trade on the project can already read. */
export default async function BeforeHandover({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/handover${kept.size ? `?${kept}` : ''}`)}`);
  return <BeforeHandoverPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
