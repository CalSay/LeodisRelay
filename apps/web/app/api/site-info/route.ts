import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canManage } from '@/lib/auth/access';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { sharePointMode } from '@/lib/sharepoint/config';
import { readSiteInfoInput } from '@/lib/siteInfo';
import { getSiteInfo, saveSiteInfo } from '@/lib/siteInfoStore';

export const dynamic = 'force-dynamic';

/** The same project rule as the weekly summary: a project open to this person for reporting. */
async function openProject(projectId: string, principal: Parameters<typeof canAccessProject>[0]) {
  const projects = await refreshProjects();
  return projects.find(p => p.id === projectId && (sharePointMode() === 'off' || reportableProject(p)) && canAccessProject(principal, p.id));
}

/** One project's site information. Everyone on the project may read it. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';
  let project;
  try { project = await openProject(projectId, guard.principal); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the project list might be out of date. Please retry.' },{ status:503 }); }
  if (!project) return NextResponse.json({ reason:'This project is not open to you.' },{ status:404 });
  return NextResponse.json({ projectId, info: getSiteInfo(projectId) ?? null, canEdit: canManage(guard.principal) });
}

/** The office keeps it: Managers and Admins. The save names the version it was made from. */
export async function PUT(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.principal)) return NextResponse.json({ reason:'Only the office can change site information.' },{ status:403 });
  const body = await request.json().catch(() => null) as { projectId?: unknown; version?: unknown } | null;
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  const version = body?.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return NextResponse.json({ reason:'Reload the page and try again.' },{ status:422 });
  let project;
  try { project = await openProject(projectId, guard.principal); }
  catch { return NextResponse.json({ reason:'SharePoint could not be reached, so the project list might be out of date. Please retry.' },{ status:503 }); }
  if (!project) return NextResponse.json({ reason:'This project is not open to you.' },{ status:404 });
  const input = readSiteInfoInput(body);
  if (!input.ok) return NextResponse.json({ reason:input.reason },{ status:422 });
  const saved = saveSiteInfo(projectId, input.value, version, { name: guard.principal.name, id: guard.principal.id });
  if (!saved.ok) return NextResponse.json({ reason:`${saved.current?.updatedBy ?? 'Someone'} saved a newer copy while you were editing.`, current: saved.current ?? null },{ status:409 });
  return NextResponse.json({ projectId, info: saved.value ?? null, canEdit: true });
}
