import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { SiteNotesPage } from '@/components/SiteNotesPage';
import './site-notes.css';

export const metadata: Metadata = { title: 'Notes for the next visit' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: engineers and the office both leave and read notes. */
export default async function SiteNotes({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/site-notes${kept.size ? `?${kept}` : ''}`)}`);
  return <SiteNotesPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
