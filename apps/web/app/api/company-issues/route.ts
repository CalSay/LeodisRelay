import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canManage } from '@/lib/auth/access';
import { listIssues } from '@/lib/issueStore';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { refreshProjects } from '@/lib/projects';
import { companyIssues } from '@/lib/companyIssues';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/** Open issues grouped by the company or person who owns them, across every project. An office view: Managers and Admins. */
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.principal)) return NextResponse.json({ reason:'Manager access required.' },{ status:403 });
  let projects;
  try { projects = await refreshProjects(); await refreshIssues(); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the issues might be out of date. Please retry.' },{ status:503 }); }
  // The same project rule as the issue register: issues on projects this person may open.
  const issues = listIssues().filter(i => canAccessProject(guard.principal, i.projectId));
  return NextResponse.json(companyIssues(issues, projects, londonDay(new Date())));
}
