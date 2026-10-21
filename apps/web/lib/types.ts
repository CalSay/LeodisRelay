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
  /**
   * What the office needs beyond the words, asked only where the kind calls
   * for it and never required. A defect names the trade whose work it is; a
   * variation says why it is extra, whether it has already been done on a
   * say-so, who asked, and the engineer's rough size, so the office can price
   * it without a phone call.
   */
  affectedTrade?: 'Electrical' | 'HVAC' | 'P&H' | 'Other / non-Leodis';
  variationReason?: VariationReason;
  workDone?: boolean;
  askedBy?: string;
  roughSize?: RoughSize;
  /** The engineer's estimate of parts, in pounds, if known. */
  partsEstimate?: number;
  /**
   * On an inspection (EXP-5), the check this card answers. The question is
   * kept with the answer, so a sent report says what was asked even if the
   * checklist's wording changes later. Absent on every other card.
   */
  check?: { item: string; question: string; answer?: CheckAnswer };
}
/** Satisfactory, action needed, or not applicable. */
export type CheckAnswer = 'ok' | 'action' | 'na';
/** Half a day, a day, two days, or more: the size an engineer can say without pricing. */
export type RoughSize = 'half-day' | 'day' | 'two-days' | 'more';

export type ReportState = "draft" | "submitted";

/**
 * Review is a separate dimension from capture.
 *
 * Review decisions do not mutate the submitted content snapshot. Corrections
 * require a separate linked draft revision.
 */
export type ReviewState = "not_required" | "pending" | "approved" | "returned";

export interface Report {
  /** What kind of report this is (reportTypes.ts). Absent: a site progress report. */
  reportType?: import('./reportTypes').ReportTypeId;
  /**
   * What the inspection is about, on a type that inspects one thing (a tower
   * inspection names its tower). Named when it is started; the author may
   * rename it while it is a draft.
   */
  inspected?: string;
  projectSnapshot?: import('./projects').ConnectedProject;
  sharepoint?: { status: 'pending' | 'registered' | 'filed' | 'failed'; url?: string; itemId?: string; error?: string };
  delivery?: 'pending' | 'rendered' | 'filed' | 'sent' | 'outbox' | 'failed';
  deliveryError?: string;
  /**
   * Which step `deliveryError` belongs to: making the PDF, or filing or
   * notifying. Without it a failed notification reads as a failed PDF.
   */
  deliveryErrorStage?: 'pdf' | 'delivery';
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
  /**
   * Captured at the point of sending. The drawn image is optional on a site
   * update. An inspection is drawn, or typed (signature.ts): a typed one keeps
   * the statement that was ticked and who was signed in when it was sent.
   */
  signature?: { dataUrl?: string; name: string; signedAt: string; typed?: true; statement?: string; signedInAs?: string };
  /**
   * The name and drawing on a draft, saved like any other edit so a reload or
   * a flat battery does not lose them. Becomes `signature` only on sending.
   */
  draftSignature?: DraftSignature;
  /**
   * Somebody in the office says they have read it. A fourth fact, kept apart
   * from receipt, review and delivery: none of those means a person looked.
   */
  acknowledged?: { by: string; byId?: string; at: string; note?: string };
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

export type ReportSummary = Omit<Report, 'observations' | 'signature' | 'draftSignature'> & {
  observationCount: number; photoCount: number;
  /** Updates that raise an issue: defects and access restrictions. */
  defectCount: number;
  /**
   * What the visit found, by kind, so a register can say "1 defect, 1
   * variation" without loading the report. Absent on summaries written before
   * the field existed; fall back to defectCount.
   */
  kindCounts?: Record<ObservationType, number>;
  /** On an inspection: how many checks were satisfactory, need action, do not apply, or are unanswered. */
  checks?: Record<CheckAnswer | 'open', number>;
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

/**
 * The report revision behind an issue change (FE-6b). A correction is a new
 * report with its own ID and a higher revision, so an event that names both
 * says which version of the record made it, not just which visit.
 */
export interface IssueEventSource {
  reportId: string;
  reference: string;
  revision: number;
  /** The update inside that report; absent for a review decision on the whole report. */
  observationId?: string;
  /** Set when that revision corrects an earlier one: the report it replaces. */
  corrects?: string;
}

export interface IssueEvent {
  actorId?: string;
  at: string;
  actor: string;
  kind: IssueEventKind;
  note: string;
  photos: Photo[];
  /** Absent on changes made on the issue itself, and on events recorded before FE-6b. */
  source?: IssueEventSource;
}

export interface Issue {
  sync?: import('./sharepoint/issues').IssueSync | undefined;
  /** Individual defects have no source report; older report-raised issues retain it. */
  source?: 'individual' | 'report';
  affectedTrade?: 'Electrical' | 'HVAC' | 'P&H' | 'Other / non-Leodis' | undefined;
  reportedBy?: string | undefined;
  reportedById?: string | undefined;
  reporterTrade?: 'Electrical' | 'HVAC' | 'P&H' | undefined;
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
  closureSubmittedBy?: string | undefined;
  closureSubmittedById?: string | undefined;
  raisedByReport: string;
  /**
   * The update inside that report which raised it. A correction of the report
   * carries the same update IDs, so the corrected update can be linked back to
   * this issue instead of raising it a second time.
   */
  raisedByObservation?: string;
  raisedAt: string;
  events: IssueEvent[];
}

/**
 * A variation: work outside the original scope, needing instruction.
 *
 * Raised from a "Variation required" update at submission, in the same
 * breath as issues are raised from defects, and then priced and instructed by
 * the office. Instruction is a single state — pending, instructed, declined —
 * because that is the only question the register answers: has the client
 * told us to do it? The money is kept as the figures the office typed; the
 * derived ones (expected cost, margin) are worked in `variations.ts` so the
 * app and the SharePoint list agree on the arithmetic.
 *
 * `workDone` records EXP-3: work already carried out on a verbal say-so,
 * before any written instruction. It is the commercial risk the register
 * exists to surface, so it is a fact of its own and never inferred.
 */
export type VariationTrade = 'Electrical' | 'HVAC' | 'P&H' | 'Multi';
export type VariationReason = 'Client instruction' | 'Design change' | 'Site condition' | 'Damage by others' | 'Omission' | 'Spec change';
export type Instruction = 'pending' | 'instructed' | 'declined';
export type VariationEventKind = 'raised' | 'details' | 'priced' | 'instructed' | 'declined' | 'reopened' | 'note';
export interface VariationEvent {
  at: string;
  actor: string;
  actorId?: string;
  kind: VariationEventKind;
  note: string;
  photos: Photo[];
}
export interface Variation {
  sync?: import('./sharepoint/variations').VariationSync;
  id: string;
  /** `011LME-VO-001`: the project, then VO, then a sequence per project. */
  reference: string;
  projectId: string;
  description: string;
  location: string;
  trade?: VariationTrade;
  reason?: VariationReason;
  workDone: boolean;
  instruction: Instruction;
  /** The client's reference for the instruction (a CVI number, an email subject), who gave it and when. */
  instructionReference?: string;
  instructedBy?: string;
  instructedOn?: string;
  /** Where the signed copy lives, once there is one. A link, not an upload. */
  signedInstruction?: string;
  labourHours?: number;
  labourRate?: number;
  partsCost?: number;
  plantSubcontract?: number;
  upliftPct?: number;
  quotedValue?: number;
  instructedValue?: number;
  source: 'report' | 'office';
  raisedBy: string;
  raisedById?: string;
  raiserTrade?: 'Electrical' | 'HVAC' | 'P&H';
  raisedAt: string;
  raisedByReport?: string;
  raisedByObservation?: string;
  linkedIssueId?: string;
  /** Who asked for the work on site, as the engineer recorded it. Not an instruction. */
  askedBy?: string;
  events: VariationEvent[];
}

/** A drawing (`dataUrl`), or a typed name with the statement ticked (`typed`), never both. */
export interface DraftSignature { name: string; dataUrl?: string; typed?: true }

/** One of an engineer's own safety or tower inspections still in draft (Safety actions). */
export interface InspectionDraft {
  id: string;
  projectId: string;
  reportType: 'safety-inspection' | 'tower-inspection';
  inspected?: string;
  correction?: true;
}
