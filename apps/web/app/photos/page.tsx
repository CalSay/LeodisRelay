import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { PhotoLibraryPage } from '@/components/PhotoLibraryPage';
import './photos.css';

export const metadata: Metadata = { title: 'Photographs' };

export const dynamic = 'force-dynamic';
export default async function Photos({ searchParams }: { searchParams: Promise<{ project?: string; q?: string; show?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  // Keep the project and filters, so a link shared from site still opens on them after signing in.
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/photos${kept.size ? `?${kept}` : ''}`)}`);
  return <PhotoLibraryPage initialProject={query.project ?? ''} initialFind={query.q ?? ''} initialShow={query.show ?? ''} returnTo={query.returnTo} />;
}
