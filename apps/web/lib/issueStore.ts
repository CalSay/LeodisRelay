import { atomic, database, getRecord, putRecord, records } from './storage';

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
 * SQLite is the current prototype store. Deployment will use SharePoint Lists
 * as the authority, with SQLite holding a cache and pending operations.
 */

function fromReport(reportId:string): Issue[] {
  return database().prepare("SELECT data FROM records WHERE kind='issues' AND json_extract(data,'$.raisedByReport')=?").all(reportId).map(row => JSON.parse(row.data as string));
}

/**
 * Developments policy for the shared issue mechanics.
 *
 * API guards authorize each role/command before this trusted store boundary.
 * Shared transitions enforce state changes and independent verification using
 * stable actor IDs; display names remain in the event history for readability.
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
    ...(issue.closureSubmittedBy ? { closureSubmittedBy: issue.closureSubmittedById ?? issue.closureSubmittedBy } : {}),
    raisedByRevision: issue.raisedByReport,
  } as ContractIssue;
}

export function listIssues(projectId?: string): Issue[] {
  return records<Issue>('issues',projectId);
}

export function getIssue(issueId: string): Issue | undefined {
  return getRecord('issues',issueId);
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
  return atomic(() => raiseIssues(report));
}
function raiseIssues(report: Report): Issue[] {
  let sequence = Number(database().prepare("SELECT count(*) AS n FROM records WHERE kind='issues' AND project=?").get(report.projectId)!.n);
  const project = FIXTURE_PROJECTS.find((p) => p.id === report.projectId);
  const raised: Issue[] = [];

  for (const observation of report.observations) {
    if (observation.type !== "defect" && observation.type !== "access") continue;

    if (observation.linkedIssueId) {
      const existing = getIssue(observation.linkedIssueId);
      if (existing && existing.projectId === report.projectId) {
        existing.events.push({
          at: new Date().toISOString(),
          actor: report.author,
          ...(report.authorId ? {actorId:report.authorId}:{}),
          kind: "progress",
          note: observation.whatHappened,
          photos: observation.photos,
        });
        putRecord('issues',existing);
        continue;
      }
    }

    // Counted from the store alone. Newly raised issues are already pushed to
    // it, so adding raised.length again skipped numbers and would eventually
    // repeat a reference.
    sequence++;

    const issue: Issue = {
      id: `iss-${Math.random().toString(36).slice(2, 10)}`,
      reference: `${project?.projectNumber ?? "UNKNOWN"}-ISS-${String(sequence).padStart(3, "0")}`,
      projectId: report.projectId,
      source: 'report',
      reportedBy: report.author,
      ...(report.authorId ? {reportedById:report.authorId}:{}),
      ...(report.authorTrade ? {reporterTrade:report.authorTrade}:{}),
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
          ...(report.authorId ? {actorId:report.authorId}:{}),
          kind: "raised",
          note: observation.whatHappened,
          photos: observation.photos,
        },
      ],
    };
    putRecord('issues',issue);
    raised.push(issue);
  }

  return raised;
}

/**
 * A report returned for correction disputes its provisional issues for triage.
 *
 * It never reverses work: an engineer may already have been sent, and the
 * defect may already be repaired. Confirmation and work are separate axes for
 * exactly this reason.
 */
export function disputeIssuesFromReport(reportId: string, actor: string, actorId?:string): void {
  atomic(() => disputeIssues(reportId,actor,actorId));
}
function disputeIssues(reportId: string, actor: string, actorId?:string): void {
  for (const issue of fromReport(reportId)) {
    if (issue.raisedByReport === reportId && issue.confirmation === "provisional") {
      issue.confirmation = "disputed";
      issue.events.push({
        at: new Date().toISOString(),
        actor,
        kind: "confirmation",
        note: "Source report returned for correction — needs triage.",
        ...(actorId ? {actorId}:{}),
        photos: [],
      });
      putRecord('issues',issue);
    }
  }
}

/**
 * A report approved at review confirms the observations it raised.
 *
 * Only provisional ones: an issue a reviewer had already disputed is not
 * silently reinstated by approving a later report, and a withdrawn one stays
 * withdrawn.
 */
export function confirmIssuesFromReport(reportId: string, actor: string, actorId?:string): void {
  atomic(() => confirmIssues(reportId,actor,actorId));
}
function confirmIssues(reportId: string, actor: string, actorId?:string): void {
  for (const issue of fromReport(reportId)) {
    if (issue.raisedByReport === reportId && issue.confirmation === "provisional") {
      issue.confirmation = "confirmed";
      issue.events.push({
        at: new Date().toISOString(),
        actor,
        kind: "confirmation",
        note: "Confirmed at report review.",
        ...(actorId ? {actorId}:{}),
        photos: [],
      });
      putRecord('issues',issue);
    }
  }
}

export type IssueOutcome =
  | { ok: true; value: Issue }
  | { ok: false; status: number; reason: string };

export interface IssueCommand {
  actorId?: string;
  kind: "progress" | "submit_closure" | "verify" | "reopen" | "confirm" | "withdraw" | "assign";
  actor: string;
  note: string;
  photos?: Photo[];
  owner?: string;
  targetDate?: string;
}

/** Map a user-facing command onto the platform's transition vocabulary. */
export function applyCommand(issueId: string, command: IssueCommand): IssueOutcome {
  return atomic(() => applyIssueCommand(issueId,command));
}
function applyIssueCommand(issueId: string, command: IssueCommand): IssueOutcome {
  const issue = getIssue(issueId);
  if (!issue) return { ok: false, status: 404, reason: "No such issue." };
  const event: IssueEvent = {
    at: new Date().toISOString(),
    actor: command.actor,
    ...(command.actorId ? {actorId:command.actorId}:{}),
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
          { axis: "work", to: "in_progress", actor: (command.actorId ?? command.actor) as never },
          DEVELOPMENTS_POLICY,
        );
        if (moved.ok) next.work = moved.issue.work as typeof next.work;
      }
      break;

    case "assign": {
      const moved = transition(
        toContract(issue),
        { axis: "work", to: "assigned", actor: (command.actorId ?? command.actor) as never },
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
        { axis: "work", to: "awaiting_verification", actor: (command.actorId ?? command.actor) as never },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.work = moved.issue.work as typeof next.work;
      next.closureSubmittedBy = command.actor;
      if (command.actorId) next.closureSubmittedById = command.actorId;
      event.kind = "closure_submitted";
      break;
    }

    case "verify": {
      if (issue.closureSubmittedById ? issue.closureSubmittedById === command.actorId : issue.closureSubmittedBy === command.actor) {
        return {ok:false,status:422,reason:'The person who completed the work cannot verify it.'};
      }
      // The platform rule refuses closure by the person who did the work.
      const moved = transition(
        toContract(issue),
        { axis: "work", to: "closed", actor: (command.actorId ?? command.actor) as never },
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
        { axis: "work", to: "open", actor: (command.actorId ?? command.actor) as never },
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
        { axis: "confirmation", to, actor: (command.actorId ?? command.actor) as never, reason: command.note },
        DEVELOPMENTS_POLICY,
      );
      if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
      next.confirmation = moved.issue.confirmation as typeof next.confirmation;
      event.kind = "confirmation";
      break;
    }
  }

  next = { ...next, events: [...issue.events, event] };
  putRecord('issues',next);
  return { ok: true, value: next };
}
