import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import ProjectsPage from '@/components/ProjectsPage';

export const metadata: Metadata = { title: 'Projects' };
export default async function Projects() {
  if (!await currentPrincipal()) redirect('/signin');
  return <ProjectsPage />;
}
