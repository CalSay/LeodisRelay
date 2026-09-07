import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Report } from "./types";
import { reviewReport } from "./review";
import { FIXTURE_PROJECTS } from "./fixtures";
import { confirmIssuesFromReport, disputeIssuesFromReport, raiseFromReport } from "./issueStore";
import { issueReport } from "./delivery/issueReport";

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
    version: 1,
    review: "not_required",
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
/**
 * Save a draft, refusing a write built on a version that has since moved.
 *
 * Compare and swap rather than last-writer-wins. Without it, two saves in
 * flight together are applied in whatever order they arrive, and the earlier
 * one silently wins — which is how observations disappear between a bad
 * connection and a person who has stopped watching.
 *
 * The autosave counter advances here. The document revision does not: what is
 * printed on a client report must not depend on how often somebody paused
 * while typing.
 */
export function saveDraft(
  reportId: string,
  incoming: Report,
  expectedVersion?: number,
): StoreOutcome<Report> {
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

  if (expectedVersion !== undefined && expectedVersion !== existing.version) {
    return {
      ok: false,
      status: 409,
      reason:
        "This report changed since your last save. Your work is held on this device; " +
        "reopen the report to see both versions.",
    };
  }

  const saved: Report = {
    ...existing,
    observations: incoming.observations,
    version: existing.version + 1,
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
export async function submitReport(
  reportId: string,
  signature?: { dataUrl?: string; name: string },
): Promise<StoreOutcome<Report>> {
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
    // Reports do not wait for review unless their project asks for it.
    review: FIXTURE_PROJECTS.find((p) => p.id === existing.projectId)?.reviewRequired
      ? "pending"
      : "not_required",
    serverAcknowledgedAt: new Date().toISOString(),
    // Stamped by the server, not the device: the time a report was signed off
    // is a fact about when it was received, not about a phone's clock.
    ...(signature
      ? {
          signature: {
            ...(signature.dataUrl ? { dataUrl: signature.dataUrl } : {}),
            name: signature.name,
            signedAt: new Date().toISOString(),
          },
        }
      : {}),
  };
  store.reports[index] = submitted;
  save(store);

  // Raised at submission rather than at approval, so urgent work is not held
  // behind document review (blueprint 0.6).
  raiseFromReport(submitted);

  /*
   * Sent to the project manager now rather than after review.
   *
   * Review is optional (see reviewRequired on the project) because the office
   * is small and a control nobody has capacity to operate is worse than none.
   * What makes that safe is the recipient: the project manager is Leodis, so
   * this is internal distribution and the manager reading it is the check.
   * Sending outside Leodis remains a separate act.
   */
  try {
    const outcome = await issueReport(submitted, []);
    const issued: Report = {
      ...submitted,
      issued: {
        records: outcome.records as NonNullable<Report["issued"]>["records"],
        unaddressed: [...outcome.unaddressed],
        transport: outcome.transport,
        ...(outcome.location ? { location: outcome.location } : {}),
      },
    };
    const current = load();
    const at = current.reports.findIndex((r) => r.id === reportId);
    if (at !== -1) {
      current.reports[at] = issued;
      save(current);
    }
    return { ok: true, value: issued };
  } catch {
    // A failure to send must never lose the submission itself.
    return { ok: true, value: submitted };
  }
}

/**
 * Review a submitted report.
 *
 * Approving confirms the observations it raised. Returning sends it back to
 * draft for the engineer to correct and disputes those observations for triage
 * — it never reverses work already done on them, because an engineer may
 * already have been dispatched and the defect may already be repaired
 * (decision DP-5).
 */
export function reviewSubmission(
  reportId: string,
  decision: string,
  reviewer: string,
  note: string,
): StoreOutcome<Report> {
  const store = load();
  const index = store.reports.findIndex((r) => r.id === reportId);
  if (index === -1) return { ok: false, status: 404, reason: "No such report." };

  // An unrecognised decision is refused, never defaulted. Defaulting to
  // approval means a malformed request approves a report.
  if (decision !== "approve" && decision !== "return") {
    return { ok: false, status: 422, reason: "A review decision must be approve or return." };
  }

  const existing = store.reports[index]!;
  if (existing.state !== "submitted") {
    return { ok: false, status: 409, reason: "Only a submitted report can be reviewed." };
  }
  if (existing.review === "approved" || existing.review === "returned") {
    return { ok: false, status: 409, reason: "This report has already been reviewed." };
  }
  if (decision === "return" && note.trim().length === 0) {
    return {
      ok: false,
      status: 422,
      reason: "Returning a report must say what needs changing.",
    };
  }
  if (existing.author === reviewer) {
    return {
      ok: false,
      status: 422,
      reason: "A report cannot be reviewed by the person who wrote it.",
    };
  }

  const reviewed: Report =
    decision === "approve"
      ? {
          ...existing,
          review: "approved",
          reviewedBy: reviewer,
          reviewedAt: new Date().toISOString(),
          ...(note.trim() ? { reviewNote: note.trim() } : {}),
        }
      : {
          ...existing,
          // Never issued, so it returns to draft rather than being superseded.
          state: "draft",
          review: "returned",
          reviewedBy: reviewer,
          reviewedAt: new Date().toISOString(),
          reviewNote: note.trim(),
        };

  store.reports[index] = reviewed;
  save(store);

  if (decision === "approve") confirmIssuesFromReport(reportId, reviewer);
  else disputeIssuesFromReport(reportId, reviewer);

  return { ok: true, value: reviewed };
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
  awaitingReview: Report[];
  submitted: Report[];
  drafts: OfficeDraftSummary[];
}

export function officeView(): OfficeView {
  const { reports } = load();
  const sent = reports.filter((r) => r.state === "submitted");
  return {
    // Only projects that ask for review produce anything here.
    awaitingReview: sent.filter((r) => r.review === "pending"),
    submitted: sent
      .filter((r) => r.review !== "pending")
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
