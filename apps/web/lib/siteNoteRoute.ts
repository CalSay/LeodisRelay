import { NextResponse } from 'next/server';
import type { Principal } from '@relay/platform';
import { canAccessProject } from './auth/access';
import { refreshProjects } from './projects';

/** The project, if it exists and this person may open it; otherwise the response to send. */
export async function noteProject(principal: Principal, projectId: string) {
  let projects;
  try { projects = await refreshProjects(); }
  catch { return { response: NextResponse.json({ reason: 'SharePoint could not be reached, so the project list might be out of date. Please retry.' }, { status: 503 }) }; }
  const project = projects.find(p => p.id === projectId);
  if (!project) return { response: NextResponse.json({ reason: 'No such project.' }, { status: 404 }) };
  if (!canAccessProject(principal, projectId)) return { response: NextResponse.json({ reason: 'Project access required.' }, { status: 403 }) };
  return { project };
}

