/**
 * Document production pipeline.
 *
 * Decision AD-1 and section 03 of the agreed baseline. The order is fixed:
 *
 *   approve -> render -> sign -> verify -> hash -> archive -> issue
 *
 * Two consequences drive the design. The hash is taken over the SIGNED bytes,
 * not the rendered ones, or it compares against an artifact that was never
 * filed. And a retry reuses the stored signed bytes rather than re-signing —
 * signing again produces different bytes and invalidates the stored hash.
 */

import type { JobId, PrincipalId, ReportRevisionId } from "./ids.js";
import type { SharePointDriveItemRef } from "./project.js";

export const DOCUMENT_STAGES = [
  "render",
  "sign",
  "verify",
  "hash",
  "archive",
  "issue",
] as const;

export type DocumentStage = (typeof DOCUMENT_STAGES)[number];

export type StageStatus = "pending" | "in_progress" | "complete" | "failed";

export interface StageRecord {
  readonly stage: DocumentStage;
  readonly status: StageStatus;
  readonly attempts: number;
  readonly lastError?: string;
  readonly completedAt?: string;
}

/**
 * The rendered artifact, once signed. `bytesRef` is the durable location of the
 * exact signed bytes; every retry downstream reads from here rather than
 * re-rendering or re-signing.
 */
export interface SignedArtifact {
  readonly bytesRef: string;
  readonly sha256: string;
  readonly signedAt: string;
  /** Organisational identity — Leodis as origin. Authorship is recorded separately. */
  readonly signingIdentity: string;
}

export interface DocumentJob {
  readonly id: JobId;
  readonly revisionId: ReportRevisionId;
  readonly stages: readonly StageRecord[];
  readonly artifact?: SignedArtifact;
  readonly archived?: SharePointDriveItemRef;
  readonly issuedTo?: {
    readonly recipient: string;
    readonly method: string;
    readonly at: string;
    readonly by: PrincipalId;
  };
}

function stageStatus(job: DocumentJob, stage: DocumentStage): StageStatus {
  return job.stages.find((s) => s.stage === stage)?.status ?? "pending";
}

/**
 * A stage may start only when every preceding stage is complete. Signing is not
 * optional where signing is required: a failure here must stop the pipeline
 * rather than falling through to an unsigned issue.
 */
export function nextStage(job: DocumentJob): DocumentStage | null {
  for (const stage of DOCUMENT_STAGES) {
    const status = stageStatus(job, stage);
    if (status === "complete") continue;
    if (status === "failed") return stage; // retry the failed stage, never skip it
    return stage;
  }
  return null;
}

/**
 * Retry safety: once signed bytes exist they are reused verbatim. Re-signing
 * would produce a different file with a different hash, leaving the archive and
 * the recorded hash permanently disagreeing.
 */
export function mustReuseArtifact(job: DocumentJob): boolean {
  return job.artifact !== undefined;
}

/** Rendered is not filed, and filed is not issued. Each is asserted separately. */
export function isIssuable(job: DocumentJob): boolean {
  return (
    stageStatus(job, "archive") === "complete" &&
    job.artifact !== undefined &&
    job.archived !== undefined
  );
}
