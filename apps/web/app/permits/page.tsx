import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { PermitsPage } from '@/components/PermitsPage';
import './permits.css';

export const metadata: Metadata = { title: 'Permits to work' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: engineers record and close permits on site, and the office reads them and may close one. */
export default async function Permits({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/permits${kept.size ? `?${kept}` : ''}`)}`);
  return <PermitsPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
