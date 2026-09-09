import type { ReportSummary } from "./types";
type Report = Omit<ReportSummary,'observationCount' | 'photoCount' | 'defectCount'>;

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

/**
 * What happened after submission. The email is a notification to the project
 * manager that a report came in; the report itself is on file the moment it
 * is received. So a notification that has not gone is stated quietly, and only
 * a processing failure carries alert weight.
 */
export function deliveryStatus(report: Report): StatusLine | null {
  if (report.delivery === 'pending') return { label:'PDF queued', tone:'draft' };
  if (report.delivery === 'rendered') return { label:'PDF ready', tone:'draft' };
  if (report.delivery === 'failed') return { label:'Processing needs attention', tone:'alert' };
  if (report.delivery === 'outbox' || report.issued?.transport === 'outbox') return { label:'PM not notified', tone:'draft' };
  const records = report.issued?.records ?? [];
  if (records.length === 0) {
    return report.state === "submitted" ? { label: "PM not notified", tone: "draft" } : null;
  }
  const failed = records.filter((r) => r.failure).length;
  if (failed > 0) return { label: `Notification failed (${failed})`, tone: "alert" };
  return { label: "PM notified", tone: "sent" };
}

/** Whether a person in the office has said they read it. Only meaningful once submitted. */
export function acknowledgementStatus(report: Report): StatusLine | null {
  if (report.state !== "submitted") return null;
  return report.acknowledged
    ? { label: `Read by ${report.acknowledged.by}`, tone: "sent" }
    : { label: "Not yet read by the office", tone: "draft" };
}

/** A returned report is the engineer's to act on; a correction supersedes it. */
export function correctionStatus(report: Pick<Report, 'corrects' | 'revision' | 'state'>): StatusLine | null {
  if (!report.corrects) return null;
  return report.state === 'draft'
    ? { label: `Correction in progress · rev ${report.revision}`, tone: 'draft' }
    : { label: `Rev ${report.revision} · supersedes rev ${report.revision - 1}`, tone: 'sent' };
}

export function toneClass(tone: Tone): string {
  return tone === "sent" ? "tag tag-sent" : tone === "alert" ? "tag tag-alert" : "tag tag-draft";
}
