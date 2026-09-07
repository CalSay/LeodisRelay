/**
 * Idempotency.
 *
 * Blueprint 0.1: an acknowledged write is durably committed, and a lost
 * acknowledgement followed by a retry must not create a second business effect.
 * Every externally-visible effect is keyed so that repeating it is safe.
 */

import type { ClientOperationId, ReportRevisionId } from "./ids.js";

export type EffectType =
  | "create_issue"
  | "update_issue"
  | "render_document"
  | "archive_document"
  | "record_issue_of_document";

/**
 * Deterministic key for one effect against one target. Two attempts at the same
 * effect produce the same key; two genuinely different effects never collide.
 */
export function effectKey(
  revisionId: ReportRevisionId,
  effect: EffectType,
  targetId: string,
): string {
  return `${revisionId}:${effect}:${targetId}`;
}

export interface ProcessedEffect {
  readonly key: string;
  readonly payloadHash: string;
  readonly completedAt: string;
}

export type IdempotencyOutcome =
  | { readonly kind: "fresh" }
  | { readonly kind: "replay"; readonly of: ProcessedEffect }
  | { readonly kind: "conflict"; readonly reason: string };

/**
 * Same key and same payload is a replay: return the original result. Same key
 * and DIFFERENT payload is a client bug, and is reported as such rather than
 * being folded into the revision-conflict path (decision DP-7).
 */
export function classify(
  key: string,
  payloadHash: string,
  existing: ProcessedEffect | undefined,
): IdempotencyOutcome {
  if (existing === undefined) return { kind: "fresh" };
  if (existing.payloadHash === payloadHash) return { kind: "replay", of: existing };
  return {
    kind: "conflict",
    reason: `Operation ${key} was already applied with different content`,
  };
}

/** Client operation ids are supplied by the device and must be echoed back. */
export interface Command {
  readonly operationId: ClientOperationId;
  readonly expectedRevision?: number;
}
