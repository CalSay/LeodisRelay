/**
 * What a document needs in order to be rendered.
 *
 * Declared here rather than imported from the web app, so the renderer depends
 * on a contract rather than on whatever shape the prototype currently keeps in
 * its store. When rendering moves to the worker — where blueprint 0.3 puts it —
 * nothing about this package changes.
 */

export interface DocPhoto {
  id: string;
  dataUrl: string;
  caption: string;
  capturedAt: string;
}

/** Drives the colour a kind of update carries, always alongside its label. */
export type DocTone = "neutral" | "defect" | "variation" | "access";

export interface DocObservation {
  id: string;
  typeLabel: string;
  tone: DocTone;
  location: string;
  whatHappened: string;
  actionNeeded: string;
  owner: string;
  photos: DocPhoto[];
}

export interface DocReport {
  reference: string;
  projectName: string;
  projectNumber: string;
  clientName: string;
  clientAccountNumber: string;
  visitDate: string;
  author: string;
  revision: number;
  /** Approved reports are issuable; anything else is stamped as a draft. */
  approved: boolean;
  /** Submission without mandatory office review is not a draft or an approval. */
  submittedWithoutReview?: boolean;
  observations: DocObservation[];
  /**
   * Signed off at the point of sending.
   *
   * A drawn signature where the engineer provided one; the printed name and
   * date stand on their own either way. The client box is deliberately left
   * blank for a wet signature — a typed name is not evidence of acceptance
   * (proposal 6.1), so the document must not offer somewhere to type one.
   */
  signature?: {
    dataUrl?: string;
    name: string;
    signedAt: string;
  };
}
