import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { ReportDocument } from "./ReportDocument.js";
import { stampFooter } from "./footer.js";
import type { DocReport } from "./types.js";

export type { DocReport, DocObservation, DocPhoto } from "./types.js";
export { BRANDING, type Branding } from "./branding.js";
export { ReportDocument } from "./ReportDocument.js";

export { FOOTER_HEIGHT } from "./footer.js";

/**
 * Render an issued report to PDF bytes.
 *
 * Two passes: the document itself, then the page footer stamped onto every
 * page. The second pass knows the page count, which is what makes "Page 1 of 4"
 * straightforward rather than dependent on a layout callback.
 */
export async function renderReportPdf(report: DocReport): Promise<Uint8Array> {
  const rendered = await renderToBuffer(
    createElement(ReportDocument, { report }) as ReactElement<DocumentProps>,
  );

  return stampFooter(new Uint8Array(rendered), {
    left:
      `${report.reference} · Revision ${report.revision} · ` +
      (report.approved ? "Approved for issue" : report.submittedWithoutReview ? "Submitted — review not required" : "Draft — not issued"),
  });
}
