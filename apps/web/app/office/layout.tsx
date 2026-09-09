import '../workspace.css';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';

/** Office: Managers and Admins. Engineers are sent to the hub, which routes them to their own view. */
export default async function OfficeLayout({children}: {children:React.ReactNode}) {
  const p = await currentPrincipal();
  if (!p) redirect('/signin?returnTo=%2Foffice');
  if (!canManage(p)) redirect('/');
  return children;
}
