import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';
import { CompanyIssuesPage } from '@/components/CompanyIssuesPage';
import './companies.css';

export const metadata: Metadata = { title: 'Issues by company' };

export const dynamic = 'force-dynamic';
/** Open issues by company is an office view: Managers and Admins. Engineers are sent to the hub, as /office does. */
export default async function Companies({ searchParams }: { searchParams: Promise<{ q?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/companies${kept.size ? `?${kept}` : ''}`)}`);
  if (!canManage(principal)) redirect('/');
  return <CompanyIssuesPage initialQuery={query.q ?? ''} returnTo={query.returnTo} />;
}
