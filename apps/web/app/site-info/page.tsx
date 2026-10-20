import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { SiteInfoPage } from '@/components/SiteInfoPage';
import './site.css';

export const dynamic = 'force-dynamic';
export default async function SiteInfo({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/site-info${kept.size ? `?${kept}` : ''}`)}`);
  return <SiteInfoPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
