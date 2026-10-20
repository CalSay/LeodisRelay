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
  if (report.sharepoint?.status === 'failed') return {label:'SharePoint needs attention',tone:'alert'};
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

/**
 * The steps a sent report goes through, each with its own state, so "the PDF
 * is ready" never reads as "the project manager has it". In order: received
 * by Relay, reviewed (only where the project asks for review), PDF prepared,
 * delivered (filed in SharePoint, or emailed), and read by the office.
 *
 * Delivery is stated from what actually happened. A notification written to
 * the pilot's local outbox is a file on the server, not an email, so it is
 * "Not emailed" whatever the job's own status says.
 */
export type StageKey = 'received' | 'review' | 'pdf' | 'delivery' | 'read';

export interface Stage extends StatusLine {
  key: StageKey;
  title: string;
  /** One plain sentence on what this state means, or why it stopped. */
  detail?: string;
  at?: string;
}

/** Whether this report failed while the PDF was being made. */
function pdfFailed(report: Report): boolean {
  if (report.delivery !== 'failed') return false;
  // Older records have no stage: a failure with nothing issued happened
  // before notification was attempted.
  return report.deliveryErrorStage ? report.deliveryErrorStage === 'pdf' : !report.issued;
}

function pdfStage(report: Report): Stage {
  const base = { key: 'pdf' as const, title: 'PDF' };
  if (report.delivery === 'pending') return { ...base, label: 'Being prepared', tone: 'draft', detail: 'Relay is making the PDF of the report.' };
  if (pdfFailed(report)) {
    // Without a recorded stage the failure could also be a notification
    // that never started, so it is not called a PDF failure outright.
    return report.deliveryErrorStage
      ? { ...base, label: 'Could not be prepared', tone: 'alert', detail: report.deliveryError ?? 'The PDF could not be made.' }
      : { ...base, label: 'Processing needs attention', tone: 'alert', detail: report.deliveryError ?? 'Relay could not finish processing this report.' };
  }
  if (report.delivery || report.issued) return { ...base, label: 'Ready', tone: 'sent' };
  return { ...base, label: 'Not started', tone: 'draft' };
}

function deliveryStage(report: Report, pdf: Stage): Stage {
  const base = { key: 'delivery' as const, title: 'Delivery' };
  if (report.sharepoint?.status === 'failed') return { ...base, label: 'SharePoint needs attention', tone: 'alert', detail: report.sharepoint.error ?? 'Filing in SharePoint failed.' };
  if (pdf.label !== 'Ready') return { ...base, label: 'Waiting for the PDF', tone: 'draft' };
  // Projects from SharePoint are filed there; Relay does not email for them.
  if (report.projectSnapshot?.source) {
    return report.delivery === 'filed' || report.sharepoint?.status === 'filed'
      ? { ...base, label: 'Filed in SharePoint', tone: 'sent', detail: 'The project manager is not emailed from Relay yet.' }
      : { ...base, label: 'Waiting to file in SharePoint', tone: 'draft' };
  }
  const issued = report.issued;
  // Attempts are appended, so a retry that worked leaves the failed attempt
  // behind it. Each recipient is judged by their latest attempt.
  const latest = new Map<string, NonNullable<Report['issued']>['records'][number]>();
  for (const r of issued?.records ?? []) latest.set(`${r.method}:${r.recipient.address}`, r);
  const records = [...latest.values()];
  const failed = records.filter(r => r.failure);
  if (failed.length) return { ...base, label: failed.length === 1 ? 'Email failed' : `Email failed (${failed.length})`, tone: 'alert', detail: failed[0]!.failure };
  if (issued?.unaddressed.length) return { ...base, label: 'No email address', tone: 'alert', detail: 'The project has no email address for its project manager.' };
  if (report.delivery === 'failed') return { ...base, label: 'Could not be sent', tone: 'alert', detail: report.deliveryError ?? 'Notification failed.' };
  const sent = records.filter(r => !r.failure);
  if (issued?.transport === 'graph' && sent.length) {
    const last = sent.at(-1)!;
    return { ...base, label: `Emailed to ${last.recipient.name || last.recipient.address}`, tone: 'sent', at: last.at };
  }
  if (report.delivery === 'outbox' || issued) return { ...base, label: 'Not emailed', tone: 'draft', detail: 'The pilot holds notification emails in a local outbox. Nothing has been sent.' };
  return { ...base, label: 'Waiting to send', tone: 'draft' };
}

export function submissionStages(report: Report): Stage[] {
  if (report.state !== 'submitted') return [];
  const stages: Stage[] = [{ key: 'received', title: 'Received', label: 'Received', tone: 'sent', detail: 'On file in Relay.', at: report.serverAcknowledgedAt }];
  const review = reviewStatus(report);
  if (review && report.review !== 'not_required') {
    stages.push({ key: 'review', title: 'Review', ...review, ...(report.reviewedBy ? { detail: `By ${report.reviewedBy}` } : {}), at: report.reviewedAt });
  }
  const pdf = pdfStage(report);
  stages.push(pdf, deliveryStage(report, pdf));
  stages.push(report.acknowledged
    ? { key: 'read', title: 'Read', label: `Read by ${report.acknowledged.by}`, tone: 'sent', at: report.acknowledged.at, ...(report.acknowledged.note ? { detail: report.acknowledged.note } : {}) }
    : { key: 'read', title: 'Read', label: 'Not yet read', tone: 'draft', detail: 'Nobody in the office has marked it as read.' });
  return stages;
}

export function toneClass(tone: Tone): string {
  return tone === "sent" ? "tag tag-sent" : tone === "alert" ? "tag tag-alert" : "tag tag-draft";
}
