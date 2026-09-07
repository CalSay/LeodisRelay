/**
 * How a failed transfer is retried.
 *
 * The governing rule is that a device never throws work away to make an error
 * go away. Failures fall into three kinds and only one of them stops:
 *
 *   transient   retry with backoff and jitter
 *   throttled   retry, but obey the interval the service asked for
 *   permanent   stop and surface it; retrying cannot fix this
 *
 * An authentication failure is deliberately none of the above: it pauses
 * transfer and keeps everything, because the fix is a sign-in, not a retry and
 * not a discard (blueprint 0.7).
 */

export type FailureKind = "transient" | "throttled" | "permanent" | "auth";

export interface FailureClassification {
  readonly kind: FailureKind;
  /** Seconds the service asked us to wait, where it said so. */
  readonly retryAfterSeconds?: number;
}

/**
 * Classify by HTTP status.
 *
 * 409 is a revision conflict: a person must resolve it, so retrying the same
 * payload is pointless. 422 covers domain validation and idempotency-key misuse
 * (decision DP-7) — also not retryable. 429 and 503 are the service asking for
 * patience. 5xx otherwise is transient.
 */
export function classifyFailure(
  status: number,
  retryAfterSeconds?: number,
): FailureClassification {
  if (status === 401 || status === 403) return { kind: "auth" };
  if (status === 429 || status === 503) {
    return retryAfterSeconds === undefined
      ? { kind: "throttled" }
      : { kind: "throttled", retryAfterSeconds };
  }
  if (status >= 500) return { kind: "transient" };
  if (status === 408) return { kind: "transient" };
  // 400, 404, 409, 413, 422 and friends: retrying the same request changes nothing.
  return { kind: "permanent" };
}

export interface BackoffPolicy {
  readonly baseSeconds: number;
  readonly maxSeconds: number;
  /** Proportion of the delay that is randomised, to avoid a synchronised herd. */
  readonly jitterRatio: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseSeconds: 2,
  maxSeconds: 300,
  jitterRatio: 0.25,
};

/**
 * Exponential backoff, capped, with jitter applied as a band around the delay.
 *
 * `random` is injected so the schedule is testable; production passes
 * Math.random. Jitter matters more than it looks here: a site team reconnecting
 * together as they leave a basement would otherwise retry in lockstep.
 */
export function backoffSeconds(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const exponential = policy.baseSeconds * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(exponential, policy.maxSeconds);
  const jitter = capped * policy.jitterRatio;
  const offset = (random() * 2 - 1) * jitter;
  return Math.max(0, capped + offset);
}

/**
 * When the next attempt may be made.
 *
 * A service-supplied interval always wins over our own backoff: if SharePoint
 * or Graph asks for 30 seconds, retrying sooner is both rude and
 * counterproductive.
 */
export function nextAttemptDelay(
  failure: FailureClassification,
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number | null {
  switch (failure.kind) {
    case "permanent":
    case "auth":
      return null;
    case "throttled":
      return failure.retryAfterSeconds ?? backoffSeconds(attempt, policy, random);
    case "transient":
      return backoffSeconds(attempt, policy, random);
  }
}

/**
 * Whether to keep trying automatically.
 *
 * After the budget is exhausted the envelope is blocked rather than deleted:
 * it stops consuming battery and bandwidth, and it appears in the "needs
 * attention" count for a person to look at.
 */
export const MAX_AUTOMATIC_ATTEMPTS = 8;

export function shouldRetryAutomatically(
  failure: FailureClassification,
  attempt: number,
): boolean {
  if (failure.kind === "permanent" || failure.kind === "auth") return false;
  return attempt < MAX_AUTOMATIC_ATTEMPTS;
}
