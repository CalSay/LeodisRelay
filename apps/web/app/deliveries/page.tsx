import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { DeliveriesPage } from '@/components/DeliveriesPage';
import './deliveries.css';

export const metadata: Metadata = { title: 'Deliveries' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: engineers record deliveries on site, and the office reads them and marks a problem sorted. */
export default async function Deliveries({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/deliveries${kept.size ? `?${kept}` : ''}`)}`);
  return <DeliveriesPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
