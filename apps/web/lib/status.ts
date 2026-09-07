import type { Report } from "./types";

/**
 * One place that turns a report's state into words.
 *
 * The office view previously treated every non-pending submission as approved
 * and labelled anything else "Returned", so a report on a project that does not
 * require review was shown as returned. Two screens each deciding their own
 * wording is how that happens; there is now one mapping.
 *
 * Receipt, review and delivery are separate facts and are reported separately.
 * An internal receipt must never imply that anything was sent or issued.
 */

export type Tone = "sent" | "draft" | "alert";

export interface StatusLine {
  label: string;
  tone: Tone;
}

export function receiptStatus(report: Report): StatusLine {
  return report.state === "submitted"
    ? { label: "Received", tone: "sent" }
    : { label: "Draft", tone: "draft" };
}

export function reviewStatus(report: Report): StatusLine | null {
  switch (report.review) {
    case "approved":
      return { label: "Approved", tone: "sent" };
    case "returned":
      return { label: "Returned for changes", tone: "alert" };
    case "pending":
      return { label: "Awaiting review", tone: "draft" };
    case "not_required":
      // Stated rather than omitted: "no review" is a fact about the project,
      // not an absence of information.
      return { label: "No review required", tone: "draft" };
    default:
      return null;
  }
}

export function deliveryStatus(report: Report): StatusLine | null {
  const records = report.issued?.records ?? [];
  if (records.length === 0) {
    return report.state === "submitted" ? { label: "Not sent", tone: "draft" } : null;
  }
  const failed = records.filter((r) => r.failure).length;
  if (failed > 0) return { label: `Delivery failed (${failed})`, tone: "alert" };
  return { label: `Sent to ${records.length}`, tone: "sent" };
}

export function toneClass(tone: Tone): string {
  return tone === "sent" ? "tag tag-sent" : tone === "alert" ? "tag tag-alert" : "tag tag-draft";
}
