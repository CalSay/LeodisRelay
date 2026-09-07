import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { getReport } from "@/lib/serverStore";
import { FIXTURE_PROJECTS } from "@/lib/fixtures";
import { ReportDocument } from "@/lib/pdf/ReportDocument";
import { archiveFileName, sanitiseFileName } from "@relay/contracts";

export const dynamic = "force-dynamic";
// react-pdf needs Node APIs; the edge runtime cannot render it.
export const runtime = "nodejs";

/**
 * Render the document on the server.
 *
 * Deliberately generated from what the server holds, not from anything the
 * client sends. The device could otherwise submit one thing and have another
 * rendered, which is the whole reason the real design renders from a frozen
 * submitted snapshot.
 *
 * A draft renders too, so layout can be judged before approval — but it is
 * stamped "not issued" throughout, because a PDF existing is not a report
 * having been issued.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = getReport(id);
  if (!report) {
    return NextResponse.json({ reason: "No such report." }, { status: 404 });
  }

  const project = FIXTURE_PROJECTS.find((p) => p.id === report.projectId);

  const buffer = await renderToBuffer(
    ReportDocument({ report, project }) as React.ReactElement<DocumentProps>,
  );

  const fileName = archiveFileName({
    projectNumber: project?.projectNumber ?? "UNKNOWN",
    reportNumber: sanitiseFileName(report.reference),
    revision: report.revision,
    visitDate: report.visitDate,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      // inline so it opens in the browser rather than downloading blind
      "content-disposition": `inline; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
