/**
 * The offline mutation journal.
 *
 * Every change made on a device becomes an envelope in an ordered local journal
 * before it is anything else. The journal is the record of intent; the server
 * revision is the record of truth. Nothing is discarded from the journal until
 * the server has acknowledged it (blueprint 0.7).
 *
 * This module is pure. Durable storage is an adapter concern — IndexedDB on the
 * web, something else in a native client — and both must satisfy the same
 * behaviour proven here.
 */

import type { ClientOperationId, PrincipalId } from "@relay/contracts";

/**
 * The protocol version an envelope was written under.
 *
 * A released client must keep syncing after the server moves on, so the server
 * supports a window of previous versions rather than telling a device to clear
 * its storage. An envelope written by an older client is upgraded on read, not
 * deleted.
 */
export type SchemaVersion = number;

export type EnvelopeState =
  /** Written locally, not yet attempted. */
  | "pending"
  /** Sent, no response yet. May or may not have been applied server-side. */
  | "in_flight"
  /** Server confirmed. Safe to drop once retention allows. */
  | "acknowledged"
  /** Rejected in a way retrying cannot fix; needs a person. */
  | "blocked";

export interface MutationEnvelope<TPayload = unknown> {
  /** Idempotency key. Generated on device, echoed by the server. */
  readonly operationId: ClientOperationId;
  /** The resource this mutation applies to, so envelopes can be ordered per resource. */
  readonly resourceId: string;
  /**
   * The revision the device believed it was editing. A mismatch is resolved
   * explicitly rather than by last-writer-wins — inspection content and issued
   * documents must never be silently overwritten.
   */
  readonly baseRevision: number;
  readonly schemaVersion: SchemaVersion;
  readonly capturedAt: string;
  readonly capturedBy: PrincipalId;
  /**
   * True when captured against reference data older than the freshness
   * threshold. Capture is never blocked for staleness (decision DP-4); the fact
   * travels with the work so a reviewer can see it.
   */
  readonly capturedUnderStaleAuthority: boolean;
  readonly state: EnvelopeState;
  readonly attempts: number;
  readonly lastError?: string;
  readonly payload: TPayload;
}

/**
 * Drain order.
 *
 * Mutations against one resource must be applied in the order they were made,
 * or a later edit can be overwritten by an earlier one arriving second.
 * Different resources are independent, so one blocked resource must not stall
 * the rest of the queue — an engineer with one bad report should still get
 * their other six uploaded.
 */
export function drainOrder<T>(
  envelopes: readonly MutationEnvelope<T>[],
): readonly MutationEnvelope<T>[] {
  const blockedResources = new Set(
    envelopes.filter((e) => e.state === "blocked").map((e) => e.resourceId),
  );

  const sendable = envelopes.filter(
    (e) => (e.state === "pending" || e.state === "in_flight") && !blockedResources.has(e.resourceId),
  );

  return [...sendable].sort((a, b) => {
    if (a.resourceId !== b.resourceId) return a.resourceId < b.resourceId ? -1 : 1;
    return a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0;
  });
}

/** Work still owed to the server. Drives the "unsent items" count in the UI. */
export function unsentCount(envelopes: readonly MutationEnvelope[]): number {
  return envelopes.filter((e) => e.state !== "acknowledged").length;
}

/**
 * Whether anything needs a person's attention. Distinguished from unsent work
 * so the interface can say "3 waiting to upload" and "1 needs attention"
 * separately rather than merging them into one alarming number.
 */
export function blockedCount(envelopes: readonly MutationEnvelope[]): number {
  return envelopes.filter((e) => e.state === "blocked").length;
}

/**
 * An in-flight envelope whose response was lost is retried, not abandoned. The
 * operation id makes that safe: the server returns the original result rather
 * than applying the mutation twice.
 */
export function resumable<T>(
  envelopes: readonly MutationEnvelope<T>[],
): readonly MutationEnvelope<T>[] {
  return envelopes.filter((e) => e.state === "in_flight");
}

/**
 * Signing out, switching account or reauthenticating must never destroy
 * unsent work. Envelopes belong to the principal who captured them and are
 * retained for that principal to recover.
 */
export function retainedForPrincipal<T>(
  envelopes: readonly MutationEnvelope<T>[],
  principal: PrincipalId,
): readonly MutationEnvelope<T>[] {
  return envelopes.filter((e) => e.capturedBy === principal && e.state !== "acknowledged");
}

/**
 * What another device can see.
 *
 * Nothing. A local envelope has no server presence until acknowledged, so an
 * office view of "drafts" can only ever show server-backed ones. This exists to
 * make that explicit at the type level rather than leaving it to a comment: any
 * caller reaching for a cross-device draft list must go through the server.
 */
export function isVisibleToOtherDevices(envelope: MutationEnvelope): boolean {
  return envelope.state === "acknowledged";
}
