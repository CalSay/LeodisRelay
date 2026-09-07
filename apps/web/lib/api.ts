/**
 * Client side of the prototype API.
 *
 * Shaped like the endpoints in blueprint B2 so the screens are written against
 * the contract they will eventually use. Saving and sending are separate verbs
 * against the same resource, because they are separate acts: PUT saves a draft,
 * POST sends it to the office.
 */

import { FIXTURE_PROJECTS, type FixtureProject } from "./fixtures";
import type { Observation, Photo, Report } from "./types";

const REPORTABLE_STATUSES = ["4. Active", "5. Defects Liability"];

export class ApiError extends Error {}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { reason?: string };
    throw new ApiError(body.reason ?? `Request failed (${response.status}).`);
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
    await fetch(`/api/reports?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
  );
  return data.reports;
}

export async function getReport(reportId: string): Promise<Report | undefined> {
  const response = await fetch(`/api/reports/${reportId}`, { cache: "no-store" });
  if (response.status === 404) return undefined;
  return parse<Report>(response);
}

export async function createReport(projectId: string, author: string): Promise<Report> {
  return parse<Report>(
    await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, author }),
    }),
  );
}

export async function saveReport(report: Report): Promise<Report> {
  return parse<Report>(
    await fetch(`/api/reports/${report.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    }),
  );
}

export async function submitReport(report: Report): Promise<Report> {
  return parse<Report>(await fetch(`/api/reports/${report.id}`, { method: "POST" }));
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
  submitted: Report[];
  drafts: OfficeDraftSummary[];
}> {
  return parse(await fetch("/api/reports?view=office", { cache: "no-store" }));
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
export type { Observation, Photo, Report, ReportState, ReviewFinding } from "./types";
export { reviewReport } from "./review";
