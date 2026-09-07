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
}

export type ReportState = "draft" | "submitted";

export interface Report {
  id: string;
  projectId: string;
  reference: string;
  visitDate: string;
  author: string;
  state: ReportState;
  revision: number;
  observations: Observation[];
  /** Set by the server on submission. Never set by a client. */
  serverAcknowledgedAt?: string;
  /** Last time the server accepted a draft save, for office draft visibility. */
  lastSavedAt?: string;
}

export interface ReviewFinding {
  observationId: string;
  field: string;
  message: string;
  blocking: boolean;
}
