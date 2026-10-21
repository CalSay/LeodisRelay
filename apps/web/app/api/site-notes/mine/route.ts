import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject } from '@/lib/auth/access';
import { refreshProjects, reportableProject } from '@/lib/projects';
import { notesFor } from '@/lib/siteNoteStore';
import { offlineNote, type OfflineNotes } from '@/lib/offlineNotes';

export const dynamic = 'force-dynamic';

/**
 * The open notes on every project this person reports on, in the shape the
 * phone keeps for reading with no signal (lib/offlineNotes.ts). The same
 * projects as the engineer home and the offline page's project list.
 */
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  let projects;
  try { projects = await refreshProjects(); }
  catch { return NextResponse.json({ reason: 'SharePoint could not be reached, so the project list might be out of date. Please retry.' }, { status: 503 }); }
  const savedAt = new Date().toISOString();
  const body: OfflineNotes = {
    projects: projects.filter(p => reportableProject(p) && canAccessProject(guard.principal, p.id)).map(p => ({
      projectId: p.id, projectNumber: p.projectNumber, projectName: p.projectName, savedAt, open: notesFor(p.id).open.map(offlineNote),
    })),
  };
  return NextResponse.json(body, { headers: { 'cache-control': 'no-store' } });
}
