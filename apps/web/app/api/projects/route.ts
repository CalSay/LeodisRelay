import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { refreshProjects, reportableProject } from '@/lib/projects';
export const dynamic = 'force-dynamic';
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const projects = (await refreshProjects()).filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id));
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ reason: 'SharePoint project data could not be refreshed. Please retry.' }, { status: 503 });
  }
}
