/**
 * Issue state, on two independent axes.
 *
 * Decision DP-5. Issues can be created from a validated submission before the
 * client report is approved, so urgent work is not held behind document review
 * (blueprint 0.6). That means an issue may exist, be assigned, and be physically
 * repaired before anyone confirms the observation that produced it.
 *
 * Confirmation and work status are therefore orthogonal. A report returned for
 * correction moves its issues to `disputed` for triage; it does not reverse work
 * that has already happened, and it does not delete history.
 */

import type { IssueId, PrincipalId, ProjectId, ReportRevisionId } from "./ids.js";

/** Whether the underlying observation has been confirmed by review. */
export type ConfirmationState = "provisional" | "confirmed" | "disputed" | "withdrawn";

/** What is actually happening about it on site. */
export type WorkState =
  | "open"
  | "assigned"
  | "in_progress"
  | "awaiting_verification"
  | "closed";

export interface Issue {
  readonly id: IssueId;
  readonly projectId: ProjectId;
  readonly confirmation: ConfirmationState;
  readonly work: WorkState;
  readonly owner?: PrincipalId;
  readonly targetDate?: string;
  /**
   * Who put the work forward as complete.
   *
   * Independence is measured against this, not against the assigned owner.
   * Owners are frequently unknown — the proposal is explicit that an
   * unassigned action is normal and must be shown rather than invented — so
   * checking the owner means an issue with no owner has nobody to be
   * independent of, and self-verification passes silently.
   */
  readonly closureSubmittedBy?: PrincipalId;
  /** The revision that first raised this issue. Later revisions link to it. */
  readonly raisedByRevision: ReportRevisionId;
}

export interface IssueEvent {
  readonly issueId: IssueId;
  readonly at: string;
  readonly actor: PrincipalId;
  readonly change:
    | { readonly kind: "confirmation"; readonly to: ConfirmationState; readonly reason: string }
    | { readonly kind: "work"; readonly to: WorkState }
    | { readonly kind: "assigned"; readonly to: PrincipalId; readonly targetDate?: string }
    | { readonly kind: "evidence"; readonly note: string };
}

/**
 * Closure requires a verifier decision, not merely the person who did the work
 * saying so (proposal section 4). Work reaching `awaiting_verification` is a
 * request, not an outcome.
 *
 * Where nobody is recorded as having submitted the closure, it is refused
 * rather than allowed: an unattributable verification is not a verification,
 * and permitting it would reintroduce the hole this check exists to close.
 */
export function canClose(issue: Issue, verifier: PrincipalId): boolean {
  if (issue.work !== "awaiting_verification") return false;
  const submitter = issue.closureSubmittedBy ?? issue.owner;
  return submitter !== undefined && submitter !== verifier;
}

/**
 * When a report is returned for correction, its provisional issues need triage
 * rather than deletion — someone may already have acted on one. Issues that a
 * reviewer had already confirmed are unaffected by a later correction to a
 * different part of the report.
 */
export function onSourceRevisionRejected(issue: Issue): ConfirmationState {
  return issue.confirmation === "provisional" ? "disputed" : issue.confirmation;
}

/** Withdrawing an issue never rewrites what was done; work state is preserved. */
export function isActionable(issue: Issue): boolean {
  return (
    issue.confirmation !== "withdrawn" &&
    issue.work !== "closed"
  );
}
