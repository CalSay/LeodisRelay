import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { canAccessProject } from '@/lib/auth/access';
import { FIXTURE_PROJECTS } from '@/lib/fixtures';
import { database } from '@/lib/storage';
import type { ReportSummary } from '@/lib/types';
import { EngineerWorkspace } from '@/components/EngineerWorkspace';

export const dynamic = 'force-dynamic';
export default async function EngineerPage({ searchParams }: {
  searchParams: Promise<{ project?: string; view?: string }>;
}) {
  const principal = await currentPrincipal();
  if (!principal) redirect('/signin');
  const query = await searchParams;
  const projects = FIXTURE_PROJECTS.filter(p =>
    ['4. Active','5. Defects Liability'].includes(p.status) && canAccessProject(principal,p.id));
  // Only the signed-in author's drafts, even when an Admin tests this workspace.
  const drafts = database().prepare("SELECT summary FROM records WHERE kind='reports' AND state='draft' AND json_extract(data,'$.authorId')=? ORDER BY updated DESC,id DESC")
    .all(principal.id).map(row => JSON.parse(row.summary as string) as ReportSummary)
    .filter(r => projects.some(p => p.id === r.projectId));
  return <EngineerWorkspace projects={projects} drafts={drafts} initialProject={query.project} initialView={query.view} />;
}
