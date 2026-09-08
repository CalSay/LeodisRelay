import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import ProjectsPage from '@/components/ProjectsPage';
export default async function Projects() {
  if (!await currentPrincipal()) redirect('/signin');
  return <ProjectsPage />;
}
