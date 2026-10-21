import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/access';
import { safetyRecordsOn } from '@/lib/features';
import { SwitchedOff } from '@/components/SwitchedOff';
import { ToolboxTalksPage } from '@/components/ToolboxTalksPage';
import './toolbox-talks.css';

export const metadata: Metadata = { title: 'Toolbox talks' };

export const dynamic = 'force-dynamic';
/** Every signed-in role: engineers give talks, and the office reads the record and may give one too. */
export default async function ToolboxTalks({ searchParams }: { searchParams: Promise<{ project?: string; returnTo?: string }> }) {
  const principal = await currentPrincipal();
  const query = await searchParams;
  const kept = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'));
  if (!principal) redirect(`/signin?returnTo=${encodeURIComponent(`/toolbox-talks${kept.size ? `?${kept}` : ''}`)}`);
  // Behind the office's switch, off by default (lib/featureSwitch.ts).
  if (!safetyRecordsOn()) return <SwitchedOff page="Toolbox talks" returnTo={query.returnTo} admin={isAdmin(principal)} />;
  return <ToolboxTalksPage initialProject={query.project ?? ''} returnTo={query.returnTo} />;
}
