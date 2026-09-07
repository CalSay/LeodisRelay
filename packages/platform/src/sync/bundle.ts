/**
 * Offline reference bundles, and what staleness does and does not prevent.
 *
 * Decision DP-4. The original design expired a bundle after one working day and
 * paused capture against stale authority. That fails in exactly the situations
 * this application exists for: the engineer who goes into a plant room on Monday
 * afternoon and surfaces on Tuesday morning without signal cannot work.
 *
 * Freshness and permission are therefore separate policies:
 *
 *   freshness    a warning, recorded on the work; never blocks capture
 *   permission   a hard control, checked by the server on reconnection
 *
 * Stale reference data means the asset list might be out of date. That is worth
 * telling a reviewer about. It is not a reason to stop someone doing their job,
 * and it is not what stops a revoked user — that is the server's business, and
 * no reviewer acknowledgement can override it.
 */

export interface FreshnessPolicy {
  /** Beyond this, capture is marked as made against stale authority. */
  readonly warnAfterDays: number;
  /**
   * Access notes and gate codes cache separately and briefly. They are the one
   * genuinely sensitive part of a bundle, and should not set policy for the
   * rest of it.
   */
  readonly sensitiveDataMaxAgeDays: number;
}

/**
 * Provisional, and explicitly not yet justified by operational evidence. Seven
 * days is a starting point to be confirmed against how engineers actually work,
 * not a rule derived from anything.
 */
export const PROVISIONAL_FRESHNESS: FreshnessPolicy = {
  warnAfterDays: 7,
  sensitiveDataMaxAgeDays: 1,
};

export interface ReferenceBundle {
  readonly scopeId: string;
  readonly preparedAt: string;
  /** Template versions the bundle was built against, for stale-template review. */
  readonly templateVersionIds: readonly string[];
}

export type BundleFreshness = "fresh" | "stale";

function ageInDays(preparedAt: string, now: Date): number {
  const prepared = new Date(preparedAt).getTime();
  return (now.getTime() - prepared) / 86_400_000;
}

export function freshness(
  bundle: ReferenceBundle,
  now: Date,
  policy: FreshnessPolicy = PROVISIONAL_FRESHNESS,
): BundleFreshness {
  return ageInDays(bundle.preparedAt, now) > policy.warnAfterDays ? "stale" : "fresh";
}

/**
 * Capture is always permitted.
 *
 * This function exists to be unambiguous, and to give anyone tempted to add a
 * staleness condition somewhere to read first. If capture ever needs to stop,
 * that is a permission decision made by the server, not a freshness decision
 * made on the device.
 */
export function canCapture(): true {
  return true;
}

/**
 * Whether access notes and gate codes may still be shown from cache.
 *
 * Unlike capture, this genuinely does expire: the sensitive contents of a
 * bundle have their own short life, and going past it hides those fields while
 * leaving everything else usable.
 */
export function canShowSensitiveCachedData(
  bundle: ReferenceBundle,
  now: Date,
  policy: FreshnessPolicy = PROVISIONAL_FRESHNESS,
): boolean {
  return ageInDays(bundle.preparedAt, now) <= policy.sensitiveDataMaxAgeDays;
}

/**
 * Server-side gate on reconnection.
 *
 * Reviewer acknowledgement of stale authority covers the reference data being
 * out of date. It has no bearing on whether the person is still allowed to
 * submit: a revoked principal is refused regardless of what any reviewer has
 * acknowledged, and regardless of how the work was captured.
 */
export interface SubmissionAdmission {
  readonly principalStillAuthorised: boolean;
  readonly templateStillAcceptable: boolean;
  readonly capturedUnderStaleAuthority: boolean;
}

export type AdmissionOutcome =
  | { readonly kind: "accept" }
  /** Held for a reviewer to acknowledge before it proceeds. */
  | { readonly kind: "accept_with_review"; readonly reason: string }
  | { readonly kind: "refuse"; readonly reason: string };

export function admitSubmission(input: SubmissionAdmission): AdmissionOutcome {
  if (!input.principalStillAuthorised) {
    return {
      kind: "refuse",
      reason:
        "Access has been revoked for this user. Recovery of captured work is an " +
        "authorised support action, not an automatic one.",
    };
  }
  if (!input.templateStillAcceptable) {
    return {
      kind: "accept_with_review",
      reason:
        "Captured against a template version that has since been superseded. " +
        "Answers are preserved and returned for explicit review rather than " +
        "re-scored against the new rules.",
    };
  }
  if (input.capturedUnderStaleAuthority) {
    return {
      kind: "accept_with_review",
      reason: "Captured against reference data older than the freshness threshold.",
    };
  }
  return { kind: "accept" };
}
