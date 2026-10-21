import { saveIssue } from './sharepoint/issues';
import { sharePointMode } from './sharepoint/config';
import { atomic, database, getRecord, putRecord, records } from './storage';

import { transition, type IssuePolicy } from "@relay/platform";
import type { Issue as ContractIssue } from "@relay/contracts";

import type { Issue, IssueEvent, IssueEventSource, Observation, Photo, Report } from "./types";
import { cachedProject, cachedProjects, reportableProject } from './projects';
import type { Principal } from '@relay/platform';
import { canAccessProject } from './auth/access';
import { queryIssues, type IssuePage, type IssueQuery } from './issueQuery';
import { raisesIssue, reportTypeOf } from './reportTypes';

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

/** Which report revision, and which update in it, made a change. */
export function sourceOf(report: Pick<Report,'id'|'reference'|'revision'|'corrects'>, observation?: Pick<Observation,'id'>): IssueEventSource {
  return {
    reportId: report.id, reference: report.reference, revision: report.revision,
    ...(observation ? { observationId: observation.id } : {}),
    ...(report.corrects ? { corrects: report.corrects } : {}),
  };
}

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
  const issues = records<Issue>('issues',projectId);
  if (sharePointMode() === 'off') return issues;
  const allowed = cachedProjects().filter(reportableProject).map(project => project.id);
  return issues.filter(i => allowed.includes(i.projectId));
}

/**
 * One page of the issue register this person may see. Filters, counts and
 * order run over the whole authorised register before the page is cut, so a
 * page is never mistaken for the register. In SharePoint mode the register is
 * the list cache that `refreshIssues` has just brought up to date.
 */
export function issueRegister(principal: Principal, query: IssueQuery, day: string): IssuePage {
  const issues = listIssues().filter(i => canAccessProject(principal, i.projectId));
  const waiting = projectsWaitingOnReview();
  return queryIssues(issues, query, {
    day,
    projectName: id => cachedProject(id)?.projectName ?? id,
    reviewOn: id => !!cachedProject(id)?.reviewRequired || waiting.has(id),
    mine: i => i.closureSubmittedById ? i.closureSubmittedById === principal.id : i.closureSubmittedBy === principal.name,
  });
}

/** Review is in use where the project asks for it or a sent report still waits on it (lib/reviewQueue.ts). */
export function reviewOnFor(projectId: string): boolean {
  return reviewOnLookup()(projectId);
}
/** `reviewOnFor` for many issues at once: the reports waiting on review are looked up once, not once per issue. */
export function reviewOnLookup(): (projectId: string) => boolean {
  const waiting = projectsWaitingOnReview();
  return projectId => !!cachedProject(projectId)?.reviewRequired || waiting.has(projectId);
}
// The summary holds the review state without the report's cards, so this reads far less than the full record.
function projectsWaitingOnReview(): Set<string> {
  return new Set(database().prepare("SELECT DISTINCT project FROM records WHERE kind='reports' AND state='submitted' AND json_extract(summary,'$.review')='pending'").all().map(row => String(row.project)));
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
  const project = cachedProject(report.projectId);
  const raised: Issue[] = [];
  const type = reportTypeOf(report);

  for (const observation of report.observations) {
    // A handover inspection's actions are snags in our own work, raised like defects.
    if (observation.type !== "defect" && observation.type !== "access" && !raisesIssue(type, observation)) continue;

    if (observation.linkedIssueId) {
      const existing = getIssue(observation.linkedIssueId);
      if (existing && existing.projectId === report.projectId) {
        existing.events.push({
          at: new Date().toISOString(),
          actor: report.author,
          ...(report.authorId ? {actorId:report.authorId}:{}),
          kind: "progress",
          // A correction says so, so the history does not read as a second visit.
          note: report.corrects ? `Corrected in ${report.reference} rev ${report.revision}: ${observation.whatHappened}` : observation.whatHappened,
          photos: observation.photos,
          source: sourceOf(report, observation),
        });
        saveIssue(existing);
        continue;
      }
    }

    // Counted from the store alone. Newly raised issues are already pushed to
    // it, so adding raised.length again skipped numbers and would eventually
    // repeat a reference.
    sequence++;

    const issue: Issue = {
      id: `iss-${Math.random().toString(36).slice(2, 10)}`,
      reference: `${project?.source ? "DEMO-" : ""}${project?.projectNumber ?? "UNKNOWN"}-ISS-${String(sequence).padStart(3, "0")}`,
      projectId: report.projectId,
      source: 'report',
      reportedBy: report.author,
      ...(report.authorId ? {reportedById:report.authorId}:{}),
      ...(report.authorTrade ? {reporterTrade:report.authorTrade}:{}),
      // The trade whose work it is, named on site; falls back to nothing, not to the reporter's trade.
      ...(observation.affectedTrade ? {affectedTrade:observation.affectedTrade}:{}),
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
      raisedByObservation: observation.id,
      raisedAt: new Date().toISOString(),
      events: [
        {
          at: new Date().toISOString(),
          actor: report.author,
          ...(report.authorId ? {actorId:report.authorId}:{}),
          kind: "raised",
          note: observation.whatHappened,
          photos: observation.photos,
          source: sourceOf(report, observation),
        },
      ],
    };
    saveIssue(issue);
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
/** The reviewed report, as the source of a confirmation decision. */
function reviewedSource(reportId: string): IssueEventSource | undefined {
  const report = getRecord<Report>('reports', reportId);
  return report ? sourceOf(report) : undefined;
}

export function disputeIssuesFromReport(reportId: string, actor: string, actorId?:string): void {
  atomic(() => disputeIssues(reportId,actor,actorId));
}
function disputeIssues(reportId: string, actor: string, actorId?:string): void {
  const source = reviewedSource(reportId);
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
        ...(source ? { source } : {}),
      });
      saveIssue(issue);
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
  const source = reviewedSource(reportId);
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
        ...(source ? { source } : {}),
      });
      saveIssue(issue);
    }
  }
}

export type IssueOutcome =
  | { ok: true; value: Issue }
  | { ok: false; status: number; reason: string };

export interface IssueCommand {
  expectedEtag?: string;
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
      // Reassigning, or giving an already-assigned issue a target date, is
      // not a state change and the state graph rightly refuses one. Only an
      // open issue moves; the rest keep their work status and gain an event.
      if (issue.work === "open") {
        const moved = transition(
          toContract(issue),
          { axis: "work", to: "assigned", actor: (command.actorId ?? command.actor) as never },
          DEVELOPMENTS_POLICY,
        );
        if (!moved.ok) return { ok: false, status: 422, reason: moved.reason };
        next.work = moved.issue.work as typeof next.work;
      } else if (issue.work !== "assigned" && issue.work !== "in_progress") {
        return { ok: false, status: 422, reason: `An issue that is ${issue.work.replaceAll('_', ' ')} cannot be reassigned. Reopen it first.` };
      }
      next.owner = command.owner ?? issue.owner;
      next.owner = next.owner.trim();
      // An assignment with nobody named would mark the issue assigned with no owner.
      if (!next.owner) return { ok: false, status: 422, reason: "Name who is responsible." };
      next.targetDate = command.targetDate ?? issue.targetDate;
      event.kind = "assigned";
      event.to = next.owner;
      if (next.targetDate) event.targetDate = next.targetDate;
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
      if (issue.sync && !issue.closureSubmittedById) return {ok:false,status:422,reason:'The closure submitter must be resolved in SharePoint before verification.'};
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
      // A closure the office is not satisfied with goes back to in progress:
      // the work has an owner and a history, so "open" would be a lie. Only a
      // verified closure reopens fully.
      const moved = transition(
        toContract(issue),
        { axis: "work", to: issue.work === "awaiting_verification" ? "in_progress" : "open", actor: (command.actorId ?? command.actor) as never },
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
  saveIssue(next);
  return { ok: true, value: next };
}
