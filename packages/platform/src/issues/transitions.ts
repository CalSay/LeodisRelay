/**
 * Issue transition mechanics.
 *
 * Ownership split from blueprint 0.2: this module owns issue storage and the
 * shape of the state graph. The owning domain owns the rule that permits a
 * given move. Hub cannot bypass a domain rule by writing an issue record
 * itself, because there is no path to a transition that does not pass through
 * the injected policy.
 *
 * The two axes stay independent throughout (decision DP-5). Confirming or
 * disputing an issue never moves its work state, and finishing the work never
 * confirms the observation.
 */

import type { ConfirmationState, Issue, PrincipalId, WorkState } from "@relay/contracts";
import { canClose } from "@relay/contracts";

export type TransitionCommand =
  | { readonly axis: "work"; readonly to: WorkState; readonly actor: PrincipalId }
  | {
      readonly axis: "confirmation";
      readonly to: ConfirmationState;
      readonly actor: PrincipalId;
      readonly reason: string;
    };

/**
 * Supplied by the owning domain. Developments and Compliance have genuinely
 * different rules about who may verify a closure and what priority means, so
 * neither is hard-coded here.
 */
export interface IssuePolicy {
  readonly permits: (issue: Issue, command: TransitionCommand) => boolean;
  /** Whether closure requires a separate verifier, or the owner may close. */
  readonly requiresIndependentVerification: boolean;
}

export type TransitionOutcome =
  | { readonly ok: true; readonly issue: Issue }
  | { readonly ok: false; readonly code: string; readonly reason: string };

/**
 * Legal moves on the work axis. Reopening is permitted; skipping ahead is not.
 *
 * `open -> awaiting_verification` is deliberately allowed. Finding a defect and
 * rectifying it on the same visit is ordinary site behaviour, and forcing an
 * intermediate "in progress" click for work that is already done is bureaucracy
 * rather than a control. Verification is still required: that is enforced by
 * the domain policy below, not by lengthening this path.
 */
const WORK_GRAPH: Record<WorkState, readonly WorkState[]> = {
  open: ["assigned", "in_progress", "awaiting_verification", "closed"],
  assigned: ["in_progress", "awaiting_verification", "open"],
  in_progress: ["awaiting_verification", "assigned"],
  awaiting_verification: ["closed", "in_progress"],
  closed: ["open"],
};

/**
 * Legal moves on the confirmation axis.
 *
 * `withdrawn` is terminal: an observation retracted by review should not
 * quietly come back. Raising it again means raising a new issue, which leaves a
 * visible record of both decisions.
 */
const CONFIRMATION_GRAPH: Record<ConfirmationState, readonly ConfirmationState[]> = {
  provisional: ["confirmed", "disputed", "withdrawn"],
  disputed: ["confirmed", "withdrawn", "provisional"],
  confirmed: ["disputed"],
  withdrawn: [],
};

export function transition(
  issue: Issue,
  command: TransitionCommand,
  policy: IssuePolicy,
): TransitionOutcome {
  if (command.axis === "work") {
    const legal = WORK_GRAPH[issue.work];
    if (!legal.includes(command.to)) {
      return {
        ok: false,
        code: "illegal_work_transition",
        reason: `An issue cannot move from ${issue.work} to ${command.to}.`,
      };
    }

    if (issue.confirmation === "withdrawn") {
      return {
        ok: false,
        code: "issue_withdrawn",
        reason: "This issue was withdrawn. Raise a new issue rather than reviving it.",
      };
    }

    if (
      command.to === "closed" &&
      policy.requiresIndependentVerification &&
      !canClose(issue, command.actor)
    ) {
      return {
        ok: false,
        code: "verification_required",
        reason:
          issue.work === "awaiting_verification"
            ? "Closure must be verified by someone other than the person who did the work."
            : "Closure evidence must be submitted for verification first.",
      };
    }

    if (!policy.permits(issue, command)) {
      return {
        ok: false,
        code: "not_permitted",
        reason: "You do not have permission to make this change on this issue.",
      };
    }

    // Record who put the work forward, so the verification check has something
    // to be independent of even when nobody was ever assigned.
    return {
      ok: true,
      issue:
        command.to === "awaiting_verification"
          ? { ...issue, work: command.to, closureSubmittedBy: command.actor }
          : { ...issue, work: command.to },
    };
  }

  const legal = CONFIRMATION_GRAPH[issue.confirmation];
  if (!legal.includes(command.to)) {
    return {
      ok: false,
      code: "illegal_confirmation_transition",
      reason:
        issue.confirmation === "withdrawn"
          ? "A withdrawn issue is closed to further change. Raise a new issue instead."
          : `Confirmation cannot move from ${issue.confirmation} to ${command.to}.`,
    };
  }

  if (command.reason.trim().length === 0) {
    return {
      ok: false,
      code: "reason_required",
      reason: "Changing whether an issue is confirmed must record why.",
    };
  }

  if (!policy.permits(issue, command)) {
    return {
      ok: false,
      code: "not_permitted",
      reason: "You do not have permission to confirm or dispute this issue.",
    };
  }

  // Note the work state is carried through untouched: disputing an observation
  // does not undo a repair someone has already carried out.
  return { ok: true, issue: { ...issue, confirmation: command.to } };
}

/**
 * Applied when a report revision is returned for correction.
 *
 * Provisional issues from that revision move to disputed for triage. Issues a
 * reviewer had already confirmed are untouched, and no work state changes: an
 * engineer may already have been dispatched, and in some cases the defect is
 * already repaired.
 */
export function onRevisionRejected(issues: readonly Issue[]): readonly Issue[] {
  return issues.map((issue) =>
    issue.confirmation === "provisional" ? { ...issue, confirmation: "disputed" as const } : issue,
  );
}

/**
 * Issues needing a human decision before they can progress. Drives the triage
 * queue, so a returned report does not leave provisional work drifting.
 */
export function needsTriage(issues: readonly Issue[]): readonly Issue[] {
  return issues.filter((issue) => issue.confirmation === "disputed");
}
