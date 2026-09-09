import '../workspace.css';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/access';
import { OfficeDesk } from '@/components/developments/office/OfficeDesk';

export const dynamic = 'force-dynamic';

/**
 * Administration is the last tab of the office desk, Admin role only. This
 * route opens the desk on that tab so the hub's Admin destination and older
 * links keep working; the check stays server-side.
 */
export default async function Admin() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin?returnTo=%2Fadmin');
  if (!isAdmin(p)) redirect('/');
  return <OfficeDesk fallback="#/admin" />;
}
