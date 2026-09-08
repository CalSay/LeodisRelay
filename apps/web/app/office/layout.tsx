import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage } from '@/lib/auth/access';
export default async function OfficeLayout({children}: {children:React.ReactNode}) {
  const p = await currentPrincipal();
  if (!p) redirect('/signin');
  if (!canManage(p)) redirect('/');
  return children;
}
