/**
 * DISPOSABLE test backend.
 *
 * This exists so the capture screens can be used, on a real phone, before any
 * of the real infrastructure exists. It is written behind the intended API
 * contract so that replacing it does not mean rewriting the screens — that is
 * the whole point of decision DP-8.
 *
 * What it deliberately does NOT do, and must never be extended to do:
 *
 *  - durable offline storage. Saving here means saving to this fake server.
 *    The prototype must never tell an engineer their work is safe on the phone,
 *    because it is not, and that is precisely the confusion the real design
 *    exists to prevent.
 *  - real authorisation, real media handling, real document production.
 *
 * Remove this module when the real API lands. It has no tests because nothing
 * about it is meant to survive.
 */

import { FIXTURE_PROJECTS, type FixtureProject, type ObservationType } from "./fixtures";

const STORAGE_KEY = "relay-prototype-state-v1";
const REPORTABLE_STATUSES = ["4. Active", "5. Defects Liability"];

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
  /** Set by the fake server on submission. Never set locally. */
  serverAcknowledgedAt?: string;
}

interface State {
  reports: Report[];
}

function read(): State {
  if (typeof window === "undefined") return { reports: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as State) : { reports: [] };
  } catch {
    // A prototype that cannot read its own storage should still open.
    return { reports: [] };
  }
}

function write(state: State): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private browsing. The prototype keeps working in memory.
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Simulated round trip, so the interface has to cope with latency honestly. */
function latency<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Only reportable projects are offered. A tender must never appear as
 * something an engineer can file against.
 */
export async function listProjects(): Promise<FixtureProject[]> {
  return latency(FIXTURE_PROJECTS.filter((p) => REPORTABLE_STATUSES.includes(p.status)));
}

export function getProject(projectId: string): FixtureProject | undefined {
  return FIXTURE_PROJECTS.find((p) => p.id === projectId);
}

export async function listReports(projectId: string): Promise<Report[]> {
  const { reports } = read();
  return latency(reports.filter((r) => r.projectId === projectId));
}

export async function getReport(reportId: string): Promise<Report | undefined> {
  const { reports } = read();
  return latency(reports.find((r) => r.id === reportId));
}

export async function createReport(projectId: string, author: string): Promise<Report> {
  const state = read();
  const project = getProject(projectId);
  const sequence = state.reports.filter((r) => r.projectId === projectId).length + 1;

  const report: Report = {
    id: uid("rep"),
    projectId,
    reference: `${project?.projectNumber ?? "UNKNOWN"}-SPR-${String(sequence).padStart(3, "0")}`,
    visitDate: new Date().toISOString().slice(0, 10),
    author,
    state: "draft",
    revision: 1,
    observations: [],
  };

  state.reports.push(report);
  write(state);
  return latency(report);
}

/**
 * Saves to the fake server. The interface must describe this as saved to the
 * server, never as saved on the device.
 */
export async function saveReport(report: Report): Promise<Report> {
  const state = read();
  const index = state.reports.findIndex((r) => r.id === report.id);
  if (index === -1) throw new Error(`Unknown report ${report.id}`);
  if (state.reports[index]!.state === "submitted") {
    throw new Error("This report has been submitted and can no longer be edited.");
  }

  const saved: Report = { ...report, revision: report.revision + 1 };
  state.reports[index] = saved;
  write(state);
  return latency(saved);
}

export interface ReviewFinding {
  observationId: string;
  field: string;
  message: string;
  blocking: boolean;
}

/**
 * Groups what is missing before submission. Blocking omissions are separated
 * from things worth noticing, so an engineer is not stopped by a caption but is
 * stopped by a defect with no photograph.
 */
export function reviewReport(report: Report): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const observation of report.observations) {
    const label = observation.location || "Unspecified location";

    if (observation.whatHappened.trim().length === 0) {
      findings.push({
        observationId: observation.id,
        field: "whatHappened",
        message: `${label}: no description of what happened`,
        blocking: true,
      });
    }
    if (observation.type === "defect" && observation.photos.length === 0) {
      findings.push({
        observationId: observation.id,
        field: "photos",
        message: `${label}: a defect needs at least one photograph`,
        blocking: true,
      });
    }
    if (observation.actionNeeded.trim().length > 0 && observation.owner.trim().length === 0) {
      findings.push({
        observationId: observation.id,
        field: "owner",
        message: `${label}: action recorded but nobody is named to do it`,
        blocking: false,
      });
    }
    for (const photo of observation.photos) {
      if (photo.caption.trim().length === 0) {
        findings.push({
          observationId: observation.id,
          field: "caption",
          message: `${label}: a photograph has no caption`,
          blocking: false,
        });
      }
    }
  }

  if (report.observations.length === 0) {
    findings.push({
      observationId: "",
      field: "observations",
      message: "Nothing has been recorded on this visit yet",
      blocking: true,
    });
  }

  return findings;
}

export async function submitReport(report: Report): Promise<Report> {
  const blocking = reviewReport(report).filter((f) => f.blocking);
  if (blocking.length > 0) {
    throw new Error(`${blocking.length} item(s) must be completed before submitting.`);
  }

  const state = read();
  const index = state.reports.findIndex((r) => r.id === report.id);
  if (index === -1) throw new Error(`Unknown report ${report.id}`);

  const submitted: Report = {
    ...report,
    state: "submitted",
    serverAcknowledgedAt: new Date().toISOString(),
  };
  state.reports[index] = submitted;
  write(state);
  return latency(submitted, 600);
}

export function newObservation(): Observation {
  return {
    id: uid("obs"),
    type: "update",
    location: "",
    whatHappened: "",
    actionNeeded: "",
    owner: "",
    photos: [],
  };
}

/**
 * Reads a captured file into a data URL. Real media handling uploads bytes
 * independently and verifies them server-side; this is a stand-in that keeps
 * the capture interaction honest while the transfer machinery does not exist.
 */
export function readPhoto(file: File): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: uid("media"),
        dataUrl: String(reader.result),
        caption: "",
        capturedAt: new Date().toISOString(),
      });
    reader.onerror = () => reject(new Error("That photograph could not be read."));
    reader.readAsDataURL(file);
  });
}

export function resetPrototypeData(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
