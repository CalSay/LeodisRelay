/**
 * Client side of the prototype API.
 *
 * Shaped like the endpoints in blueprint B2 so the screens are written against
 * the contract they will eventually use. Saving and sending are separate verbs
 * against the same resource, because they are separate acts: PUT saves a draft,
 * POST sends it to the office.
 */

import { FIXTURE_PROJECTS, type FixtureProject } from "./fixtures";
import type { Issue, Observation, Photo, Report } from "./types";

const REPORTABLE_STATUSES = ["4. Active", "5. Defects Liability"];

/**
 * Errors an engineer might see.
 *
 * `offline` is separated from every other failure because it is the only one
 * where nothing is wrong and nothing is lost — the work is on the phone and
 * will go when there is signal. Telling someone that, rather than showing them
 * "NetworkError when attempting to fetch resource", is the difference between
 * a tool that feels reliable in a basement and one that feels broken.
 */
export class ApiError extends Error {
  readonly offline: boolean;
  constructor(message: string, offline = false) {
    super(message);
    this.offline = offline;
  }
}

async function request(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    // fetch rejects on network failure rather than resolving with a status,
    // so this is the only place a lost connection can be caught.
    throw new ApiError("No connection. Your work is on this phone and will send when there is signal.", true);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { reason?: string };
    throw new ApiError(body.reason ?? `That did not go through (${response.status}).`);
  }
  return (await response.json()) as T;
}

/**
 * Only reportable projects are offered. Filtered here in the prototype because
 * projects are still fixtures; in the real system this is a server query, and a
 * tender is never returned to a device at all.
 */
export async function listProjects(): Promise<FixtureProject[]> {
  return FIXTURE_PROJECTS.filter((p) => REPORTABLE_STATUSES.includes(p.status));
}

export function getProject(projectId: string): FixtureProject | undefined {
  return FIXTURE_PROJECTS.find((p) => p.id === projectId);
}

export async function listReports(projectId: string): Promise<Report[]> {
  const data = await parse<{ reports: Report[] }>(
    await request(`/api/reports?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
  );
  return data.reports;
}

export async function getReport(reportId: string): Promise<Report | undefined> {
  const response = await request(`/api/reports/${reportId}`, { cache: "no-store" });
  if (response.status === 404) return undefined;
  return parse<Report>(response);
}

export async function createReport(projectId: string, author: string): Promise<Report> {
  return parse<Report>(
    await request("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, author }),
    }),
  );
}

export async function saveReport(report: Report): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${report.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    }),
  );
}

export async function submitReport(
  report: Report,
  signature?: { dataUrl?: string; name: string },
): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${report.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signature ? { signature } : {}),
    }),
  );
}

export async function reviewReportDecision(
  reportId: string,
  decision: "approve" | "return",
  reviewer: string,
  note: string,
): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${reportId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "review", decision, reviewer, note }),
    }),
  );
}

export interface OfficeDraftSummary {
  id: string;
  projectId: string;
  reference: string;
  author: string;
  visitDate: string;
  lastSavedAt?: string;
  observationCount: number;
}

export async function officeView(): Promise<{
  awaitingReview: Report[];
  submitted: Report[];
  drafts: OfficeDraftSummary[];
}> {
  return parse(await request("/api/reports?view=office", { cache: "no-store" }));
}

export async function openIssues(projectId: string): Promise<Issue[]> {
  const data = await parse<{ issues: Issue[] }>(
    await request(`/api/issues?projectId=${encodeURIComponent(projectId)}&only=open`, {
      cache: "no-store",
    }),
  );
  return data.issues;
}

/** Every issue on a project, filtered in the view rather than the request. */
export async function projectIssues(projectId: string): Promise<Issue[]> {
  const data = await parse<{ issues: Issue[] }>(
    await request(`/api/issues?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
  );
  return data.issues;
}

export function newObservation(): Observation {
  return {
    id: `obs-${Math.random().toString(36).slice(2, 10)}`,
    type: "update",
    location: "",
    whatHappened: "",
    actionNeeded: "",
    owner: "",
    photos: [],
  };
}

export function readPhoto(file: File): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: `media-${Math.random().toString(36).slice(2, 10)}`,
        dataUrl: String(reader.result),
        caption: "",
        capturedAt: new Date().toISOString(),
      });
    reader.onerror = () => reject(new Error("That photograph could not be read."));
    reader.readAsDataURL(file);
  });
}

// Re-exported so screens have one import for the data layer, and so swapping
// this module for the real client does not ripple through every component.
export type { Issue, IssueEvent, Observation, Photo, Report, ReportState, ReviewState, ReviewFinding } from "./types";
export { reviewReport } from "./review";
