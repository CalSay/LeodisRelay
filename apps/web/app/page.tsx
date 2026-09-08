import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage, isAdmin } from '@/lib/auth/access';
import EngineerPage from './engineer/page';
export const dynamic = 'force-dynamic';
export default async function Home({searchParams}: {searchParams:Promise<{project?:string;view?:string}>}) {
  const p = await currentPrincipal();
  if (!p) redirect('/signin');
  if (isAdmin(p)) redirect('/admin');
  if (canManage(p)) redirect('/office');
  return <EngineerPage searchParams={searchParams} />;
}
