import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';
import { PortfolioOffice } from '@/components/compliance/PortfolioOffice';
export const dynamic = 'force-dynamic';
/** Compliance office: the portfolio browser. Managers and Admins only; Engineers are sent to their own view. */
export default async function ComplianceOfficePage() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin?returnTo=%2Fcompliance%2Foffice');
  if (!canManage(p)) redirect('/compliance/engineer');
  return <PortfolioOffice userName={p.name} roleLabel={p.role === 'Admin' ? 'Admin' : 'Compliance manager'} />;
}
