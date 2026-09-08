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
 * Review decisions do not mutate the submitted content snapshot. Corrections
 * require a separate linked draft revision.
 */
export type ReviewState = "not_required" | "pending" | "approved" | "returned";

export interface Report {
  delivery?: 'pending' | 'rendered' | 'filed' | 'sent' | 'outbox' | 'failed';
  deliveryError?: string;
  corrects?: string;
  correctionReason?: string;
  id: string;
  projectId: string;
  reference: string;
  visitDate: string;
  author: string;
  authorId?: string;
  authorTrade?: 'Electrical' | 'HVAC' | 'P&H';
  state: ReportState;
  /**
   * Autosave counter, for optimistic concurrency. Increments on every accepted
   * draft save and is never shown to anyone.
   */
  version: number;
  /**
   * Document revision, printed on the issued report. Starts at 1 and moves only
   * when a correction supersedes an issued document — never because somebody
   * paused while typing. Conflating this with the autosave counter had a client
   * receiving "Revision 47" for a report written in one sitting.
   */
  revision: number;
  observations: Observation[];
  review: ReviewState;
  reviewedBy?: string;
  reviewedById?: string;
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

export type ReportSummary = Omit<Report, 'observations' | 'signature'> & {
  observationCount: number; photoCount: number; defectCount: number;
};
export type IssueSummary = Omit<Issue, 'events'>;

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
  actorId?: string;
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
  /** What has to happen to put it right, carried from the update that raised it. */
  actionNeeded: string;
  confirmation: Confirmation;
  work: WorkStatus;
  owner: string;
  targetDate: string;
  /** Who put the work forward as complete; independence is measured against this. */
  closureSubmittedBy?: string;
  closureSubmittedById?: string;
  raisedByReport: string;
  raisedAt: string;
  events: IssueEvent[];
}
