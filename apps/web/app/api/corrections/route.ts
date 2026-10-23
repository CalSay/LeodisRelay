import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { canAccessProject, canCorrectReport } from '@/lib/auth/access';
import { applyCorrection, listCorrections, readCorrectionInput } from '@/lib/corrections';
import { getReport } from '@/lib/serverStore';
import { refreshIssues } from '@/lib/sharepoint/issues';
import { refreshVariations } from '@/lib/sharepoint/variations';

export const dynamic = 'force-dynamic';

/** Office corrections recorded against a report (`?reportId=`) or against an engineer (`?engineerId=`), newest last. */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canCorrectReport(guard.principal)) return NextResponse.json({ reason: 'You cannot view office corrections.' }, { status: 403 });
  const url = new URL(request.url);
  const reportId = url.searchParams.get('reportId') ?? '', engineerId = url.searchParams.get('engineerId') ?? '';
  if (!reportId && !engineerId) return NextResponse.json({ reason: 'Say which report or engineer.' }, { status: 400 });
  if (reportId) {
    const report = getReport(reportId);
    if (!report) return NextResponse.json({ reason: 'No such report.' }, { status: 404 });
    if (!canAccessProject(guard.principal, report.projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });
  }
  const corrections = listCorrections({ ...(reportId ? { reportId } : {}), ...(engineerId ? { engineerId } : {}) })
    .filter(c => canAccessProject(guard.principal, c.projectId));
  return NextResponse.json({ corrections });
}

/** One office correction, attributed by the server to whoever is signed in. */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;
  if (!canCorrectReport(principal)) return NextResponse.json({ reason: 'You cannot correct a report.' }, { status: 403 });
  const read = readCorrectionInput(await request.json().catch(() => null));
  if (!read.ok) return NextResponse.json({ reason: read.reason }, { status: 400 });
  const input = read.value;
  // Refresh first, as the issue and variation routes do, so the change is made against the current SharePoint record.
  try {
    if (input.targetType === 'issue') await refreshIssues(true);
    if (input.targetType === 'variation') await refreshVariations(true);
  } catch {
    return NextResponse.json({ reason: `SharePoint ${input.targetType === 'issue' ? 'issues' : 'variations'} could not be refreshed. Please retry.` }, { status: 503 });
  }
  const report = getReport(input.reportId);
  if (!report) return NextResponse.json({ reason: 'No such report.' }, { status: 404 });
  if (!canAccessProject(principal, report.projectId)) return NextResponse.json({ reason: 'Project access required.' }, { status: 403 });
  let outcome;
  try { outcome = applyCorrection(input, { name: principal.name, id: principal.id }); }
  catch { return NextResponse.json({ reason: 'The correction could not be queued for SharePoint.' }, { status: 409 }); }
  return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
