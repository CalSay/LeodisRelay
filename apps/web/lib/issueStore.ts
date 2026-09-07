import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { transition, type IssuePolicy } from "@relay/platform";
import type { Issue as ContractIssue } from "@relay/contracts";

import type { Issue, IssueEvent, Photo, Report } from "./types";
import { FIXTURE_PROJECTS } from "./fixtures";

/**
 * Issue records for the prototype.
 *
 * The transition rules are NOT reimplemented here. They come from
 * @relay/platform, where the state graph and the two-axis model are tested, so
 * the prototype exercises the real logic rather than a lookalike that can drift
 * from it.
 *
 * Storage is the same disposable JSON file as reports.
 */

const DATA_FILE = join(process.cwd(), ".relay-prototype", "issues.json");

interface StoreShape {
  issues: Issue[];
}

function load(): StoreShape {
  try {
    if (!existsSync(DATA_FILE)) return { issues: [] };
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as StoreShape;
  } catch {
    return { issues: [] };
  }
}

function save(store: StoreShape): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Developments policy for the shared issue mechanics.
 *
 * Closure needs someone other than the person who did the work. Everything else
 * is permitted in the prototype, because there are no real roles yet — the
 * point of injecting a policy is that adding them later changes this object,
 * not the transition rules.
 */
const DEVELOPMENTS_POLICY: IssuePolicy = {
  permits: () => true,
  requiresIndependentVerification: true,
};

/** Bridge the stored shape to the contract type the platform rules expect. */
function toContract(issue: Issue): ContractIssue {
  return {
    id: issue.id,
    projectId: issue.projectId,
    confirmation: issue.confirmation,
    work: issue.work,
    ...(issue.owner ? { owner: issue.owner } : {}),
    ...(issue.targetDate ? { targetDate: issue.targetDate } : {}),
    ...(issue.closureSubmittedBy ? { closureSubmittedBy: issue.closureSubmittedBy } : {}),
    raisedByRevision: issue.raisedByReport,
  } as ContractIssue;
}

export function listIssues(projectId?: string): Issue[] {
  const { issues } = load();
  return projectId ? issues.filter((i) => i.projectId === projectId) : issues;
}

export function getIssue(issueId: string): Issue | undefined {
  return load().issues.find((i) => i.id === issueId);
}

/** Still needing attention: not withdrawn, not closed. */
export function openIssues(projectId: string): Issue[] {
  return listIssues(projectId).filter(
    (i) => i.confirmation !== "withdrawn" && i.work !== "closed",
  );
}

/**
 * Raise issues from a submitted report.
 *
 * Runs at submission rather than at approval, so urgent work is not held behind
 * document review (blueprint 0.6). They are raised `provisional` precisely
 * because nobody has reviewed the observation yet.
 *
 * Observations already linked to an existing issue add an event to it instead
 * of raising a duplicate — the same real defect seen on a later visit is one
 * issue with a history, not five issues with one line each.
 */
export function raiseFromReport(report: Report): Issue[] {
  const store = load();
  const project = FIXTURE_PROJECTS.find((p) => p.id === report.projectId);
  const raised: Issue[] = [];

  for (const observation of report.observations) {
    if (observation.type !== "defect" && observation.type !== "access") continue;

    if (observation.linkedIssueId) {
      const existing = store.issues.find((i) => i.id === observation.linkedIssueId);
      if (existing) {
        existing.events.push({
          at: new Date().toISOString(),
          actor: report.author,
          kind: "progress",
          note: observation.whatHappened,
          photos: observation.photos,
        });
        continue;
      }
    }

    // Counted from the store alone. Newly raised issues are already pushed to
    // it, so adding raised.length again skipped numbers and would eventually
    // repeat a reference.
    const sequence = store.issues.filter((i) => i.projectId === report.projectId).length + 1;

    const issue: Issue = {
      id: `iss-${Math.random().toString(36).slice(2, 10)}`,
      reference: `${project?.projectNumber ?? "UNKNOWN"}-ISS-${String(sequence).padStart(3, "0")}`,
      projectId: report.projectId,
      location: observation.location,
      description: observation.whatHappened,
      // The required action is the clearest instruction on an issue and was
      // being dropped on the way in.
      actionNeeded: observation.actionNeeded,
      confirmation: "provisional",
      work: observation.owner.trim() ? "assigned" : "open",
      owner: observation.owner,
      targetDate: "",
      raisedByReport: report.id,
      raisedAt: new Date().toISOString(),
      events: [
        {
          at: new Date().toISOString(),
          actor: report.author,
          kind: "raised",
          note: observation.whatHappened,
          photos: observation.photos,
        },
      ],
    };
    store.issues.push(issue);
    raised.push(issue);
  }

  save(store);
  return raised;
}

/**
 * A report returned for correction disputes its provisional issues for triage.
 *
 * It never reverses work: an engineer may already have been sent, and the
 * defect may already be repaired. Confirmation and work are separate axes for
 * exactly this reason.
 */
export function disputeIssuesFromReport(reportId: string, actor: string): void {
  const store = load();
  for (const issue of store.issues) {
    if (issue.raisedByReport === reportId && issue.confirmation === "provisional") {
      issue.confirmation = "disputed";
      issue.events.push({
        at: new Date().toISOString(),
        actor,
        kind: "confirmation",
        note: "Source report returned for correction — needs triage.",
        photos: [],
      });
    }
  }
  save(store);
}

/**
 * A report approved at review confirms the observations it raised.
 *
 * Only provisional ones: an issue a reviewer had already disputed is not
 * silently reinstated by approving a later report, and a withdrawn one stays
 * withdrawn.
 */
export function confirmIssuesFromReport(reportId: string, actor: string): void {
  const store = load();
  for (const issue of store.issues) {
    if (issue.raisedByReport === reportId && issue.confirmation === "provisional") {
      issue.confirmation = "confirmed";
      issue.events.push({
        at: new Date().toISOString(),
        actor,
        kind: "confirmation",
        note: "Confirmed at report review.",
        photos: [],
      });
    }
  }
  save(store);
}

export type IssueOutcome =
  | { ok: true; value: Issue }
  | { ok: false; status: number; reason: string };

export interface IssueCommand {
  kind: "progress" | "submit_closure" | "verify" | "reopen" | "confirm" | "withdraw" | "assign";
  actor: string;
  note: string;
  photos?: Photo[];
  owner?: string;
  targetDate?: string;
}

/** Map a user-facing command onto the platform's transition vocabulary. */
export function applyCommand(issueId: string, command: IssueCommand): IssueOutcome {
  const store = load();
  const index = store.issues.findIndex((i) => i.id === issueId);
  if (index === -1) return { ok: false, status: 404, reason: "No such issue." };

  const issue = store.issues[index]!;
  const event: IssueEvent = {
    at: new Date().toISOString(),
    actor: command.actor,
    kind: "progress",
    note: command.note,
    photos: command.photos ?? [],
  };

  let next = { ...issue };

  switch (command.kind) {
    case "progress":
      // A note with no state change still belongs in the history.
      if (issue.work === "open") {
        const moved = transition(
          toContract(issue),
          { axis: "work", to: "in_progress", actor: command.actor as never },
          DEVELOPMENTS_POLICY,
        );
        if (moved.ok) next.work = moved.issue.work as typeof next.work;
      }
      break;

    case "assign": {
      const moved = transition(
        toContract(issue),
        { axis: "work", to: "assigned", actor: command.actor as never },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.work = moved.issue.work as typeof next.work;
      next.owner = command.owner ?? issue.owner;
      next.targetDate = command.targetDate ?? issue.targetDate;
      event.kind = "assigned";
      break;
    }

    case "submit_closure": {
      const moved = transition(
        toContract(issue),
        { axis: "work", to: "awaiting_verification", actor: command.actor as never },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.work = moved.issue.work as typeof next.work;
      next.closureSubmittedBy = command.actor;
      event.kind = "closure_submitted";
      break;
    }

    case "verify": {
      // The platform rule refuses closure by the person who did the work.
      const moved = transition(
        toContract(issue),
        { axis: "work", to: "closed", actor: command.actor as never },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.work = moved.issue.work as typeof next.work;
      event.kind = "verified";
      break;
    }

    case "reopen": {
      const moved = transition(
        toContract(issue),
        { axis: "work", to: "open", actor: command.actor as never },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.work = moved.issue.work as typeof next.work;
      event.kind = "reopened";
      break;
    }

    case "confirm":
    case "withdraw": {
      const to = command.kind === "confirm" ? "confirmed" : "withdrawn";
      const moved = transition(
        toContract(issue),
        { axis: "confirmation", to, actor: command.actor as never, reason: command.note },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.confirmation = moved.issue.confirmation as typeof next.confirmation;
      event.kind = "confirmation";
      break;
    }
  }

  next = { ...next, events: [...issue.events, event] };
  store.issues[index] = next;
  save(store);
  return { ok: true, value: next };
}
