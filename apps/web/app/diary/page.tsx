import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { SiteDiaryPage } from '@/components/SiteDiaryPage';
import './diary.css';

export const dynamic = 'force-dynamic';
export default async function SiteDiary({ searchParams }: { searchParams: Promise<{ project?: string; q?: string; show?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  // Keep the project and filters, so a shared link still opens on them after signing in.
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/diary${kept.size ? `?${kept}` : ''}`)}`);
  return <SiteDiaryPage initialProject={query.project ?? ''} initialFind={query.q ?? ''} initialShow={query.show ?? ''} returnTo={query.returnTo} />;
}
