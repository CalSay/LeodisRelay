/**
 * Report lifecycle commands.
 *
 * The contracts package defines what the states mean; this defines which moves
 * between them are legal and who may make them. Every command returns an
 * outcome rather than throwing, because most rejections here are ordinary
 * business situations — a stale device, a report already submitted, a reviewer
 * without the right permission — and each needs a message someone can act on.
 */

import type { PrincipalId, ReportRevision, ReportRevisionId } from "@relay/contracts";
import { isMutable, isApprovedForRender } from "@relay/contracts";
import { verifyManifest, type MediaManifest, type StoredMediaObject } from "./manifest.js";

export type CommandResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly reason: string };

function reject<T>(code: string, reason: string): CommandResult<T> {
  return { ok: false, code, reason };
}

function accept<T>(value: T): CommandResult<T> {
  return { ok: true, value };
}

/**
 * Save a draft change.
 *
 * Rejects a stale base revision rather than merging. Two devices editing one
 * draft is unusual but not impossible — an engineer who signs in on a
 * replacement phone mid-visit — and silently taking the later write would lose
 * observations without anyone noticing.
 */
export function saveDraft(
  revision: ReportRevision,
  baseRevision: number,
): CommandResult<ReportRevision> {
  if (!isMutable(revision)) {
    return reject(
      "revision_frozen",
      "This report has been submitted. Changes create a correction, not an edit.",
    );
  }
  if (baseRevision !== revision.revision) {
    return reject(
      "revision_conflict",
      `This draft has changed since you opened it (expected revision ${baseRevision}, ` +
        `current is ${revision.revision}). Both versions are kept; choose which to keep.`,
    );
  }
  return accept({ ...revision, revision: revision.revision + 1 });
}

/**
 * Submit a draft for processing.
 *
 * Freezes the revision only when the media it depends on is genuinely in place.
 * An incomplete manifest is a normal offline situation, not an error: the
 * device keeps uploading and submits again.
 */
export function submit(
  revision: ReportRevision,
  manifest: MediaManifest,
  stored: readonly StoredMediaObject[],
  submittedAt: string,
): CommandResult<ReportRevision> {
  if (!isMutable(revision)) {
    return reject("already_submitted", "This report has already been submitted.");
  }

  const verification = verifyManifest(manifest, stored);
  if (verification.kind === "incomplete") {
    const { missing, incomplete, mismatched, forbidden } = verification.shortfall;
    if (forbidden.length > 0) {
      return reject(
        "media_forbidden",
        `${forbidden.length} attached item(s) cannot be used on this report. This needs support.`,
      );
    }
    const outstanding = missing.length + incomplete.length + mismatched.length;
    return reject(
      "media_incomplete",
      `${outstanding} photograph(s) have not finished uploading. The report will submit ` +
        "automatically once they have.",
    );
  }

  return accept({
    ...revision,
    capture: "submitted" as const,
    receipt: "received" as const,
    validation: "pending" as const,
    submittedAt,
  });
}

/** Server-side validation of permissions, required answers and template version. */
export function recordValidation(
  revision: ReportRevision,
  outcome: "validated" | "rejected",
): CommandResult<ReportRevision> {
  if (revision.capture !== "submitted") {
    return reject("not_submitted", "Only a submitted revision can be validated.");
  }
  if (revision.receipt !== "received") {
    return reject(
      "not_received",
      "The server does not yet hold the complete submission. Validation would be premature.",
    );
  }
  return accept({ ...revision, validation: outcome });
}

/**
 * Human review.
 *
 * A reviewer may not approve their own report unless Leodis has expressly
 * permitted the roles to be combined, which is a configuration decision rather
 * than something this function assumes either way.
 */
export function review(
  revision: ReportRevision,
  reviewer: PrincipalId,
  outcome: "approved" | "changes_requested",
  options: { readonly selfReviewPermitted: boolean },
): CommandResult<ReportRevision> {
  if (revision.validation !== "validated") {
    return reject(
      "not_validated",
      "This report has not passed validation, so there is nothing settled to review.",
    );
  }
  if (revision.author === reviewer && !options.selfReviewPermitted) {
    return reject(
      "self_review",
      "The author cannot review their own report under the current configuration.",
    );
  }
  return accept({ ...revision, review: outcome });
}

/**
 * Create a correction.
 *
 * The original is never edited and never deleted. It is marked superseded and
 * the replacement links back to it with a reason, so an issued document can
 * always be traced to what replaced it and why.
 */
export function correct(
  original: ReportRevision,
  newRevisionId: ReportRevisionId,
  reason: string,
): CommandResult<{
  readonly superseded: ReportRevision;
  readonly replacement: ReportRevision;
}> {
  if (original.capture !== "submitted") {
    return reject(
      "not_submitted",
      "A draft is changed by editing it. Corrections apply only to submitted revisions.",
    );
  }
  if (original.currency === "superseded") {
    return reject(
      "already_superseded",
      "This revision has already been superseded. Correct the current revision instead.",
    );
  }
  if (reason.trim().length === 0) {
    return reject("reason_required", "A correction must record why it was made.");
  }

  return accept({
    superseded: { ...original, currency: "superseded" as const },
    replacement: {
      ...original,
      id: newRevisionId,
      revision: original.revision + 1,
      capture: "draft" as const,
      receipt: "none" as const,
      validation: "pending" as const,
      review: "pending" as const,
      currency: "current" as const,
      supersedes: { revisionId: original.id, reason },
    },
  });
}

/**
 * Whether document production may begin.
 *
 * Delegates to the contract rather than restating the condition, so there is
 * one definition of "approved for render" and not two that can drift.
 */
export function canBeginDocumentProduction(revision: ReportRevision): boolean {
  return isApprovedForRender(revision) && revision.currency === "current";
}
