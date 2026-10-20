import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { SafetyActionsPage } from '@/components/SafetyActionsPage';
import './safety-actions.css';

export const metadata: Metadata = { title: 'Safety actions' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: the inspections behind it are sent reports, which every trade can read. */
export default async function SafetyActions({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/safety-actions${kept.size ? `?${kept}` : ''}`)}`);
  return <SafetyActionsPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
