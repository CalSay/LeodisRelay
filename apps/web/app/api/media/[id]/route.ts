import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { getReport } from '@/lib/serverStore';
import { getIssue } from '@/lib/issueStore';
import { getMedia, mediaBytes, putMedia, renditionBytes } from '@/lib/mediaStore';
import { MEDIA_LIMIT, mediaId } from '@/lib/media';
import { ownsReport, canReadReport, canAccessProject } from '@/lib/auth/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  if (!mediaId(`/api/media/${id}`)) return NextResponse.json({ reason: 'Invalid media ID.' }, { status: 422 });
  const url = new URL(request.url);
  const reportId = url.searchParams.get('reportId');
  const issueId = url.searchParams.get('issueId');
  if (Boolean(reportId) === Boolean(issueId)) return NextResponse.json({ reason: 'Choose a report or issue.' }, { status: 422 });
  if (reportId) {
    const report = await getReport(reportId);
    if (!report || !ownsReport(guard.principal,report) || report.state !== 'draft') {
      return NextResponse.json({ reason: 'This report is not editable by you.' }, { status: 403 });
    }
  } else {
    // An issue is not a public pinboard. Without the project check any signed-in
    // person could attach evidence to any issue in any project — including one
    // in a division they have nothing to do with.
    const issue = await getIssue(issueId!);
    if (!issue) return NextResponse.json({ reason: 'Issue not found.' }, { status: 404 });
    if (!canAccessProject(guard.principal, issue.projectId)) {
      return NextResponse.json({ reason: 'This issue is on a project you do not have access to.' }, { status: 403 });
    }
  }
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ reason: 'Photograph required.' }, { status: 422 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MEDIA_LIMIT) { await reader.cancel(); return NextResponse.json({ reason: 'Photograph exceeds 20 MB.' }, { status: 413 }); }
    chunks.push(value);
  }
  try {
    await putMedia(id, { ownerId: guard.principal.id, ...(reportId ? { reportId } : { issueId: issueId! }), mime: request.headers.get('content-type') ?? '' }, Buffer.concat(chunks));
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ reason: error instanceof Error ? error.message : 'Upload failed.' }, { status: 422 });
  }
}

export async function GET(_request: Request, context: Context) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  if (!mediaId(`/api/media/${id}`)) return new NextResponse(null, { status: 404 });
  const record = await getMedia(id);
  if (!record) return new NextResponse(null, { status: 404 });
  const report = record.reportId ? await getReport(record.reportId) : null;
  const issue = record.issueId ? await getIssue(record.issueId) : null;
  // Report media follows the report's own visibility; issue media follows
  // access to the project the issue sits on. Existence alone authorises nothing.
  const allowed = report
    ? canReadReport(guard.principal, report)
    : Boolean(issue) && canAccessProject(guard.principal, issue!.projectId);
  if (!allowed) return new NextResponse(null, { status: 403 });
  const variant = new URL(_request.url).searchParams.get('variant');
  if (variant && !['thumb','pdf'].includes(variant)) return NextResponse.json({reason:'Unknown image variant.'},{status:400});
  const bytes = variant ? await renditionBytes(id,variant as 'thumb'|'pdf') : await mediaBytes(id);
  return new NextResponse(new Uint8Array(bytes), { headers: {
    'content-type': variant ? 'image/jpeg' : record.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
  } });
}
