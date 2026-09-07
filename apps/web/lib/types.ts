import type { ObservationType } from "./fixtures";

export interface Photo {
  id: string;
  dataUrl: string;
  caption: string;
  capturedAt: string;
}

export interface Observation {
  id: string;
  type: ObservationType;
  location: string;
  whatHappened: string;
  actionNeeded: string;
  owner: string;
  photos: Photo[];
  /**
   * Set when this observation is a further sighting of an issue already raised.
   * Recognising the same real defect on a later visit adds to its history
   * rather than creating a second record of the same thing.
   */
  linkedIssueId?: string;
}

export type ReportState = "draft" | "submitted";

/**
 * Review is a separate dimension from capture.
 *
 * A returned report goes back to draft rather than being superseded: it was
 * never issued, so there is no original for a correction to link to. Supersede
 * applies to something already sent to a client, which is a different act with
 * a different audit trail.
 */
export type ReviewState = "not_required" | "pending" | "approved" | "returned";

export interface Report {
  id: string;
  projectId: string;
  reference: string;
  visitDate: string;
  author: string;
  state: ReportState;
  revision: number;
  observations: Observation[];
  review: ReviewState;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Why it was returned. Required on return, so nobody has to guess. */
  reviewNote?: string;
  /** Set by the server on submission. Never set by a client. */
  serverAcknowledgedAt?: string;
  /** Last time the server accepted a draft save, for office draft visibility. */
  lastSavedAt?: string;
  /** Captured at the point of sending. The drawn image is optional. */
  signature?: { dataUrl?: string; name: string; signedAt: string };
  /**
   * Who received this and when, per proposal 6.2. Kept whether delivery
   * succeeded or failed: a delivery that failed silently is indistinguishable
   * from one that never happened.
   */
  issued?: {
    records: {
      revisionId: string;
      revision: number;
      method: "email" | "filed";
      recipient: { name: string; address: string; role: string };
      at: string;
      failure?: string;
    }[];
    unaddressed: string[];
    transport: string;
    location?: string;
  };
}

export interface ReviewFinding {
  observationId: string;
  field: string;
  message: string;
  blocking: boolean;
}

/**
 * A persistent issue.
 *
 * The point of the whole system, and the thing a report alone cannot do: a
 * defect outlives the visit that found it, gathers evidence across visits, and
 * is closed by someone other than whoever did the work.
 *
 * Confirmation and work status are independent axes (decision DP-5), so an
 * issue raised before its report was reviewed can be repaired, disputed, or
 * both, without either fact overwriting the other.
 */
export type Confirmation = "provisional" | "confirmed" | "disputed" | "withdrawn";
export type WorkStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "awaiting_verification"
  | "closed";

export type IssueEventKind =
  | "raised"
  | "progress"
  | "closure_submitted"
  | "verified"
  | "reopened"
  | "confirmation"
  | "assigned";

export interface IssueEvent {
  at: string;
  actor: string;
  kind: IssueEventKind;
  note: string;
  photos: Photo[];
}

export interface Issue {
  id: string;
  reference: string;
  projectId: string;
  location: string;
  description: string;
  confirmation: Confirmation;
  work: WorkStatus;
  owner: string;
  targetDate: string;
  /** Who put the work forward as complete; independence is measured against this. */
  closureSubmittedBy?: string;
  raisedByReport: string;
  raisedAt: string;
  events: IssueEvent[];
}
