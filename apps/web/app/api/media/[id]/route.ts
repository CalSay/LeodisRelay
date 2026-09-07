import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { getReport } from '@/lib/serverStore';
import { getIssue } from '@/lib/issueStore';
import { getMedia, mediaBytes, putMedia, renditionBytes } from '@/lib/mediaStore';
import { MEDIA_LIMIT, mediaId } from '@/lib/media';

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
    if (!report || report.author !== guard.principal.name || report.state !== 'draft') {
      return NextResponse.json({ reason: 'This report is not editable by you.' }, { status: 403 });
    }
  } else if (!await getIssue(issueId!)) return NextResponse.json({ reason: 'Issue not found.' }, { status: 404 });
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
  if (record.ownerId !== guard.principal.id && report?.state !== 'submitted' && !issue) {
    return new NextResponse(null, { status: 403 });
  }
  const variant = new URL(_request.url).searchParams.get('variant');
  if (variant && !['thumb','pdf'].includes(variant)) return NextResponse.json({reason:'Unknown image variant.'},{status:400});
  const bytes = variant ? await renditionBytes(id,variant as 'thumb'|'pdf') : await mediaBytes(id);
  return new NextResponse(new Uint8Array(bytes), { headers: {
    'content-type': variant ? 'image/jpeg' : record.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
  } });
}
