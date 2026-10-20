import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { HelpPage } from '@/components/HelpPage';
import { readTab } from '@/lib/helpGuide';
import './help.css';

export const metadata: Metadata = { title: 'Help' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: it shows no records, only how RELAY works and what is new. */
export default async function Help({ searchParams }: { searchParams: Promise<{ for?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/help${kept.size ? `?${kept}` : ''}`)}`);
  return <HelpPage initialTab={readTab(query.for, principal.role)} returnTo={query.returnTo} />;
}
