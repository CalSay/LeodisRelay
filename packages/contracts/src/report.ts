/**
 * Report state.
 *
 * Blueprint invariant 0.1: a saved draft is not a submitted report, and a
 * generated PDF is not an issued report. These are therefore separate
 * dimensions rather than one enum — collapsing them is precisely how a local
 * save comes to look like safe delivery.
 */

import type {
  PrincipalId,
  ReportId,
  ReportRevisionId,
  TemplateVersionId,
  VisitId,
} from "./ids.js";

/** Where the work physically is. Local-only until the server acknowledges. */
export type CaptureState = "draft" | "submitted";

/** Whether the server holds the complete submission, including all media. */
export type ReceiptState = "none" | "partial" | "received";

/** Server-side check of permissions, required answers and template version. */
export type ValidationState = "pending" | "validated" | "rejected";

/** Human review of content. Distinct from validation, which is mechanical. */
export type ReviewState = "not_required" | "pending" | "approved" | "changes_requested";

/** Whether this revision has been superseded by a correction. */
export type CurrencyState = "current" | "superseded";

export interface ReportRevision {
  readonly id: ReportRevisionId;
  readonly reportId: ReportId;
  readonly visitId: VisitId;
  readonly revision: number;
  readonly templateVersionId: TemplateVersionId;
  readonly author: PrincipalId;
  readonly capture: CaptureState;
  readonly receipt: ReceiptState;
  readonly validation: ValidationState;
  readonly review: ReviewState;
  readonly currency: CurrencyState;
  /** Set once the revision is frozen. A submitted snapshot is immutable. */
  readonly submittedAt?: string;
  readonly receivedAt?: string;
  /** Present only on a correction; links back to what this replaces. */
  readonly supersedes?: {
    readonly revisionId: ReportRevisionId;
    readonly reason: string;
  };
}

/**
 * A submitted revision is frozen. Editing one is not a supported operation —
 * corrections create a new revision that links to the original.
 */
export function isMutable(revision: ReportRevision): boolean {
  return revision.capture === "draft";
}

/**
 * Document processing may only begin once the server holds everything it needs.
 * Uploading photograph bytes does not by itself constitute a receipt: the
 * manifest must be complete (blueprint 0.7).
 */
export function isReadyForProcessing(revision: ReportRevision): boolean {
  return (
    revision.capture === "submitted" &&
    revision.receipt === "received" &&
    revision.validation === "validated"
  );
}

/**
 * Rendering is gated on review, not merely on receipt. A validated report that
 * nobody has approved is not a client deliverable.
 */
export function isApprovedForRender(revision: ReportRevision): boolean {
  return (
    isReadyForProcessing(revision) &&
    (revision.review === "approved" || revision.review === "not_required")
  );
}
