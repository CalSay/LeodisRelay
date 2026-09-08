import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
export default async function ProjectsLayout({children}: {children:React.ReactNode}) {
  if (!await currentPrincipal()) redirect('/signin');
  return children;
}
