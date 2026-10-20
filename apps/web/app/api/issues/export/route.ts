import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canManage } from '@/lib/auth/access';
import { issueRegister, reviewOnFor } from '@/lib/issueStore';
import { parseIssueQuery } from '@/lib/issueQuery';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { cachedProject, refreshProjects } from '@/lib/projects';
import { getReport } from '@/lib/serverStore';
import { exportFileName, issueRows, toCsv } from '@/lib/registerExport';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/**
 * The issue register's current search as a spreadsheet: the same filters and
 * order as the register (`/api/issues?register=1`), every page of it. An
 * office download, so Managers and Admins only. Nothing is sent anywhere.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.principal)) return NextResponse.json({ reason: 'Manager access required.' }, { status: 403 });
  try { await refreshProjects(); await refreshIssues(); }
  catch { return NextResponse.json({ reason: 'SharePoint could not be reached, so the issues might be out of date. Please retry.' }, { status: 503 }); }
  const day = londonDay(new Date());
  const query = parseIssueQuery(new URL(request.url).searchParams);
  // One page holding the whole search, so the file never stops at what the screen shows.
  const all = issueRegister(guard.principal, { ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER }, day);
  const csv = toCsv(issueRows(all.issues, { day, project: cachedProject, reviewOn: reviewOnFor, reportReference: id => getReport(id)?.reference }));
  const name = exportFileName('issues', day, query.projectId ? cachedProject(query.projectId)?.projectNumber : undefined);
  return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
}
