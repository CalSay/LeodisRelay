import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage, isAdmin } from '@/lib/auth/access';
export const dynamic='force-dynamic';
export default async function DevelopmentsHome() {
  const p=await currentPrincipal();
  if(!p) redirect('/signin?returnTo=%2Fdevelopments');
  if(isAdmin(p)) redirect('/admin');
  if(canManage(p)) redirect('/office');
  redirect('/engineer');
}
