import { NextResponse } from "next/server";
import { renderReportPdf, type DocReport } from "@relay/documents";
import { archiveFileName, sanitiseFileName } from "@relay/contracts";

import { getReport } from "@/lib/serverStore";
import { requireSession } from "@/lib/auth/guard";
import { FIXTURE_PROJECTS, OBSERVATION_TYPES } from "@/lib/fixtures";

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

  const project = FIXTURE_PROJECTS.find((p) => p.id === report.projectId);

  const doc: DocReport = {
    reference: report.reference,
    projectName: project?.projectName ?? report.projectId,
    projectNumber: project?.projectNumber ?? "",
    clientName: project?.clientName ?? "",
    clientAccountNumber: project?.clientAccountNumber ?? "",
    visitDate: report.visitDate,
    author: report.author,
    revision: report.revision,
    approved: report.review === "approved",
    observations: report.observations.map((o) => {
      const kind = OBSERVATION_TYPES.find((t) => t.value === o.type);
      return {
      id: o.id,
      typeLabel: kind?.label ?? o.type,
      tone: kind?.tone ?? "neutral",
      location: o.location,
      whatHappened: o.whatHappened,
      actionNeeded: o.actionNeeded,
      owner: o.owner,
      photos: o.photos,
      };
    }),
    ...(report.signature ? { signature: report.signature } : {}),
  };

  const buffer = await renderReportPdf(doc);

  const fileName = archiveFileName({
    projectNumber: doc.projectNumber || "UNKNOWN",
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
