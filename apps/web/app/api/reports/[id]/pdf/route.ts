import { NextResponse } from "next/server";
import { archiveFileName, sanitiseFileName } from "@relay/contracts";

import { getReport } from "@/lib/serverStore";
import { requireSession } from "@/lib/auth/guard";
import { ensurePdf, readPdf } from '@/lib/pdfArtifacts';
import { FIXTURE_PROJECTS } from '@/lib/fixtures';
import { getRecord } from '@/lib/storage';
import type { Report } from '@/lib/types';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Render the document on the server.
 *
 * Built from what the server holds, not from anything the client sends. The
 * device could otherwise submit one thing and have another rendered, which is
 * why the real design renders from a frozen submitted revision.
 *
 * A draft renders too, so layout can be judged before approval, but it is
 * stamped "not issued" in the title block and on every page footer: a PDF
 * existing is not a report having been issued.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const report = getReport(id);
  if (!report) {
    return NextResponse.json({ reason: "No such report." }, { status: 404 });
  }

  // A draft document is the author's until it is sent.
  if (report.state !== "submitted" && report.author !== guard.principal.name) {
    return NextResponse.json({ reason: "This draft belongs to someone else." }, { status: 403 });
  }

  const snapshot = report.state === 'submitted' ? getRecord<Report>('snapshots',id) ?? report : report;
  const buffer = report.state === 'submitted' ? await readPdf(snapshot) : await ensurePdf(snapshot);
  if (!buffer) return NextResponse.json({ reason:'PDF is queued for preparation. Try again shortly.' },{ status:409, headers:{ 'retry-after':'3' } });

  const fileName = archiveFileName({
    projectNumber: FIXTURE_PROJECTS.find(p => p.id === report.projectId)?.projectNumber || "UNKNOWN",
    reportNumber: sanitiseFileName(report.reference),
    revision: report.revision,
    visitDate: report.visitDate,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
