import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';
import { engineerForTrade } from '@/lib/compliance/model';
import { EngineerMobile } from '@/components/compliance/EngineerMobile';
export const dynamic = 'force-dynamic';
/**
 * Compliance engineer view. An Engineer sees the sample engineer matching their
 * Relay trade; Managers and Admins can switch between sample engineers to test.
 */
export default async function ComplianceEngineerPage() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin?returnTo=%2Fcompliance%2Fengineer');
  return <EngineerMobile userName={p.name} initialEngineer={engineerForTrade(p.trade)} canSwitch={canManage(p)} />;
}
