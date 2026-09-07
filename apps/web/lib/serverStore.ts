import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Report } from "./types";
import { reviewReport } from "./review";
import { FIXTURE_PROJECTS } from "./fixtures";
import { raiseFromReport } from "./issueStore";

/**
 * DISPOSABLE prototype store.
 *
 * A JSON file on disk, held by the dev server process. This is what makes the
 * prototype a shared thing rather than a private one: a report sent from a
 * phone is visible to the office view on a laptop, which is the only way to
 * test the question of what the office should actually see.
 *
 * It is not a database and must not grow into one. No concurrency control, no
 * migrations, no indexing. When the real API lands, this goes.
 */

const DATA_FILE = join(process.cwd(), ".relay-prototype", "reports.json");

interface StoreShape {
  reports: Report[];
}

function load(): StoreShape {
  try {
    if (!existsSync(DATA_FILE)) return { reports: [] };
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as StoreShape;
  } catch {
    // A corrupt prototype file should not stop the prototype starting.
    return { reports: [] };
  }
}

function save(store: StoreShape): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function listReports(projectId?: string): Report[] {
  const { reports } = load();
  return projectId ? reports.filter((r) => r.projectId === projectId) : reports;
}

export function getReport(reportId: string): Report | undefined {
  return load().reports.find((r) => r.id === reportId);
}

export function createReport(projectId: string, author: string): Report {
  const store = load();
  const project = FIXTURE_PROJECTS.find((p) => p.id === projectId);
  const sequence = store.reports.filter((r) => r.projectId === projectId).length + 1;

  const report: Report = {
    id: uid("rep"),
    projectId,
    reference: `${project?.projectNumber ?? "UNKNOWN"}-SPR-${String(sequence).padStart(3, "0")}`,
    visitDate: new Date().toISOString().slice(0, 10),
    author,
    state: "draft",
    revision: 1,
    observations: [],
    lastSavedAt: new Date().toISOString(),
  };

  store.reports.push(report);
  save(store);
  return report;
}

export type StoreOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; reason: string };

/**
 * Saving a draft. A submitted report is frozen: the client should never offer
 * an edit, and the server refuses one regardless of what the client offers.
 */
export function saveDraft(reportId: string, incoming: Report): StoreOutcome<Report> {
  const store = load();
  const index = store.reports.findIndex((r) => r.id === reportId);
  if (index === -1) return { ok: false, status: 404, reason: "No such report." };

  const existing = store.reports[index]!;
  if (existing.state === "submitted") {
    return {
      ok: false,
      status: 409,
      reason: "This report has been sent and can no longer be edited.",
    };
  }

  const saved: Report = {
    ...existing,
    observations: incoming.observations,
    revision: existing.revision + 1,
    lastSavedAt: new Date().toISOString(),
  };
  store.reports[index] = saved;
  save(store);
  return { ok: true, value: saved };
}

/**
 * Submission is checked server-side as well as on the device. The device
 * check is there to give fast, specific feedback; this one is there because a
 * client check is not a control.
 */
export function submitReport(reportId: string): StoreOutcome<Report> {
  const store = load();
  const index = store.reports.findIndex((r) => r.id === reportId);
  if (index === -1) return { ok: false, status: 404, reason: "No such report." };

  const existing = store.reports[index]!;
  if (existing.state === "submitted") {
    return { ok: false, status: 409, reason: "This report has already been sent." };
  }

  const blocking = reviewReport(existing).filter((f) => f.blocking);
  if (blocking.length > 0) {
    return {
      ok: false,
      status: 422,
      reason: `${blocking.length} item(s) must be completed before sending.`,
    };
  }

  const submitted: Report = {
    ...existing,
    state: "submitted",
    serverAcknowledgedAt: new Date().toISOString(),
  };
  store.reports[index] = submitted;
  save(store);

  // Raised at submission rather than at approval, so urgent work is not held
  // behind document review (blueprint 0.6).
  raiseFromReport(submitted);

  return { ok: true, value: submitted };
}

/**
 * What the office is allowed to see, per decision Q2.
 *
 * Submitted reports come back in full. Drafts return existence only — who,
 * which project, when it was last saved — and never their content. The
 * filtering happens here rather than in the view, because hiding fields on a
 * screen is not access control.
 *
 * Deliberately omitted: any "draft open for N days" figure. That turns work
 * visibility into a productivity measure, which is a different thing needing a
 * different conversation.
 */
export interface OfficeDraftSummary {
  id: string;
  projectId: string;
  reference: string;
  author: string;
  visitDate: string;
  lastSavedAt?: string;
  observationCount: number;
}

export interface OfficeView {
  submitted: Report[];
  drafts: OfficeDraftSummary[];
}

export function officeView(): OfficeView {
  const { reports } = load();
  return {
    submitted: reports
      .filter((r) => r.state === "submitted")
      .sort((a, b) => (a.serverAcknowledgedAt ?? "") < (b.serverAcknowledgedAt ?? "") ? 1 : -1),
    drafts: reports
      .filter((r) => r.state === "draft")
      .map((r) => ({
        id: r.id,
        projectId: r.projectId,
        reference: r.reference,
        author: r.author,
        visitDate: r.visitDate,
        ...(r.lastSavedAt !== undefined ? { lastSavedAt: r.lastSavedAt } : {}),
        observationCount: r.observations.length,
      })),
  };
}
