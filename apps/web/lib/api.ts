/**
 * Client side of the prototype API.
 *
 * Shaped like the endpoints in blueprint B2 so the screens are written against
 * the contract they will eventually use. Saving and sending are separate verbs
 * against the same resource, because they are separate acts: PUT saves a draft,
 * POST sends it to the office.
 */

import { FIXTURE_PROJECTS, type FixtureProject } from "./fixtures";
import type { Issue, Observation, Photo, Report, ReportSummary } from "./types";
import { capturePhoto, uploadPhotos } from './localMedia';
import { localSaveJournal } from './localSaveJournal';
import { saveWithJournal, type SaveRequest } from './saveRequest';

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

export async function listReports(projectId: string, offset = 0): Promise<{ reports: ReportSummary[]; next:number | null }> {
  return parse(
    await request(`/api/reports?projectId=${encodeURIComponent(projectId)}&offset=${offset}`, { cache: "no-store" }),
  );
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

/**
 * Save a draft against the version it was built on.
 *
 * The server refuses a write whose base version has moved, so two saves racing
 * cannot silently overwrite one another.
 */
export async function saveReport(report: Report, expectedVersion?: number,principalId?:string): Promise<Report> {
  const send = async (body:SaveRequest) => {
    try { await uploadPhotos(body.observations.flatMap(o => o.photos), { reportId: report.id }); }
    catch (error) { if (error instanceof TypeError) throw new ApiError('No connection. Photographs remain on this phone.',true); throw error; }
    return parse<Report>(await request(`/api/reports/${report.id}`, {
      method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body),
    }));
  };
  if (!principalId) throw new ApiError('Sign in before saving.');
  return saveWithJournal(report,expectedVersion ?? 0,localSaveJournal(report.id,principalId),send);
}

export async function submitReport(
  report: Report,
  signature?: { dataUrl?: string; name: string },
): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${report.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature, expectedVersion: report.version }),
    }),
  );
}

/** The reviewer is the signed-in person; the server ignores anything sent. */
export async function reviewReportDecision(
  reportId: string,
  decision: "approve" | "return",
  note: string,
): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${reportId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "review", decision, note }),
    }),
  );
}

/** A new revision of a sent report, by its author. Returns the draft to edit. */
export async function correctReport(reportId: string, reason: string): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${reportId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "correct", reason }),
    }),
  );
}

/** The office has read it. Managers and Admins only; the server records who. */
export async function acknowledgeReport(reportId: string, note = ""): Promise<Report> {
  return parse<Report>(
    await request(`/api/reports/${reportId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "acknowledge", note }),
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

export async function officeView(offset = 0): Promise<{
  awaitingReview: ReportSummary[];
  submitted: ReportSummary[];
  /** Other people's drafts arrive allowlisted: reference, author, trade, counts, last saved. Never contents. */
  drafts: ReportSummary[];
  next:number | null;
}> {
  return parse(await request(`/api/reports?view=office&offset=${offset}`, { cache: "no-store" }));
}

/** Every submitted report and every draft summary the office may see, across all pages. */
export async function officeAll(): Promise<{ reports: ReportSummary[]; drafts: ReportSummary[] }> {
  const reports: ReportSummary[] = [], drafts: ReportSummary[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await officeView(offset);
    reports.push(...page.awaitingReview, ...page.submitted); drafts.push(...page.drafts);
    offset = page.next;
  }
  const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(i => [i.id, i])).values()];
  return { reports: unique(reports), drafts: unique(drafts) };
}

export async function allIssues(): Promise<Issue[]> {
  const data = await parse<{ issues: Issue[] }>(await request('/api/issues', { cache: 'no-store' }));
  return data.issues;
}

/** One issue command, attributed by the server to whoever is signed in. */
export async function issueCommand(issueId: string, body: { kind: string; note: string; owner?: string; targetDate?: string }): Promise<Issue> {
  return parse<Issue>(await request(`/api/issues/${issueId}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
}

export interface TeamMember {
  email: string; assignment: string; name?: string; role?: string; trade?: string;
  lastSignedIn?: string; session: 'active' | 'expired' | 'never'; id?: string; onChecklist: boolean;
}
export interface OfficeTeam {
  members: TeamMember[];
  legacyDrafts?: { id: string; reference: string; author: string; lastSavedAt?: string }[];
  processing?: {
    mail: 'live' | 'outbox';
    jobs: { kind: string; status: string; count: number }[];
    outbox: { id: string; reference: string; projectId: string; delivery?: string; error?: string; since?: string }[];
  };
}
export async function officeTeam(): Promise<OfficeTeam> {
  return parse<OfficeTeam>(await request('/api/office/team', { cache: 'no-store' }));
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
  return capturePhoto(file);
}

// Re-exported so screens have one import for the data layer, and so swapping
// this module for the real client does not ripple through every component.
export type { Issue, IssueEvent, Observation, Photo, Report, ReportState, ReviewState, ReviewFinding } from "./types";
export { reviewReport } from "./review";
