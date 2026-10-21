import { NextResponse } from 'next/server';
import { safetyRecordsRefusal } from '@/lib/features';
import { requireSession } from '@/lib/auth/guard';
import { reportableProject } from '@/lib/projects';
import { noteProject } from '@/lib/siteNoteRoute';
import { recordTalk, talksFor } from '@/lib/toolboxTalkStore';
import { TALK_COLUMNS, talkRows, topicStarters } from '@/lib/toolboxTalks';
import { registerFileName, toCsv } from '@/lib/sheet';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

/**
 * One project's toolbox talks. Any role on the project. `summary=1` gives the
 * figures only, for the site home's row; `format=csv` the whole record as a
 * spreadsheet, withdrawn talks included and marked. Nothing is sent anywhere.
 */
export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  // Behind the office's switch, off by default (lib/featureSwitch.ts).
  const off = safetyRecordsRefusal();
  if (off) return off;
  const params = new URL(request.url).searchParams;
  const projectId = params.get('project') ?? '';
  const found = await noteProject(guard.principal, projectId);
  if ('response' in found) return found.response;
  const all = talksFor(projectId);
  if (params.get('format') === 'csv') {
    const csv = toCsv([[...TALK_COLUMNS], ...talkRows(all.talks, found.project)]);
    const name = registerFileName('toolbox-talks', londonDay(new Date()), found.project.projectNumber);
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  }
  if (params.get('summary') === '1') return NextResponse.json({ projectId, summary: all.summary });
  return NextResponse.json({ ...all, starters: topicStarters(all.talks), live: reportableProject(found.project) });
}

/** Record a talk on a live project. Any role on the project: a site manager in the office may give one too. */
export async function POST(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  // Behind the office's switch, off by default (lib/featureSwitch.ts).
  const off = safetyRecordsRefusal();
  if (off) return off;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  if (!body || typeof body.project !== 'string' || typeof body.requestId !== 'string' || !text(body.day, 20) || !text(body.topic, 1000) || !text(body.givenBy, 1000)
    || (body.notes !== undefined && !text(body.notes, 8000)) || !Array.isArray(body.attendees) || body.attendees.length > 500 || !body.attendees.every(n => text(n, 1000))) {
    return NextResponse.json({ reason: 'Invalid toolbox talk.' }, { status: 422 });
  }
  const found = await noteProject(guard.principal, body.project);
  if ('response' in found) return found.response;
  if (!reportableProject(found.project)) return NextResponse.json({ reason: 'This project is closed, so it takes no new toolbox talks.' }, { status: 409 });
  const outcome = recordTalk({
    projectId: body.project, requestId: body.requestId, day: body.day as string, topic: body.topic as string, givenBy: body.givenBy as string,
    attendees: body.attendees as string[], ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
  }, guard.principal);
  return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
