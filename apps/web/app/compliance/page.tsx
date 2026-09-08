import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';
export const dynamic = 'force-dynamic';
/**
 * Selecting Compliance Management on the hub lands here. Managers and Admins go
 * to the office portfolio; Engineers go to the site view. Same role rules as
 * Developments, decided by the Microsoft assignment, never by which company
 * was selected.
 */
export default async function ComplianceHome() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin?returnTo=%2Fcompliance');
  redirect(canManage(p) ? '/compliance/office' : '/compliance/engineer');
}
