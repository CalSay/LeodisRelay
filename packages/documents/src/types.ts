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

export interface DocObservation {
  id: string;
  typeLabel: string;
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
  observations: DocObservation[];
}
