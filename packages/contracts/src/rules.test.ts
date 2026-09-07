import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { effectKey, classify, type ProcessedEffect } from "./effects.js";
import {
  isMutable,
  isReadyForProcessing,
  isApprovedForRender,
  type ReportRevision,
} from "./report.js";
import { canClose, onSourceRevisionRejected, isActionable, type Issue } from "./issue.js";
import { nextStage, mustReuseArtifact, isIssuable, type DocumentJob } from "./document.js";
import {
  resolveDisplayName,
  isRemap,
  isReportable,
  DEFAULT_REPORTABLE_STATUSES,
  projectCode,
  type Project,
} from "./project.js";
import { resolveClientLabel, type Client } from "./client.js";

const id = <T,>(v: string) => v as T;

const ARTIFACT = {
  bytesRef: "blob://signed",
  sha256: "abc123",
  signedAt: "2026-09-07T10:00:00Z",
  signingIdentity: "Leodis Group",
};

function revision(over: Partial<ReportRevision> = {}): ReportRevision {
  return {
    id: id("r1"),
    reportId: id("rep1"),
    visitId: id("v1"),
    revision: 1,
    templateVersionId: id("t1"),
    author: id("p1"),
    capture: "submitted",
    receipt: "received",
    validation: "validated",
    review: "approved",
    currency: "current",
    ...over,
  } as ReportRevision;
}

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: id("i1"),
    projectId: id("proj1"),
    confirmation: "provisional",
    work: "open",
    raisedByRevision: id("r1"),
    ...over,
  } as Issue;
}

function job(over: Partial<DocumentJob> = {}): DocumentJob {
  return { id: id("j1"), revisionId: id("r1"), stages: [], ...over } as DocumentJob;
}

const done = (...stages: string[]) =>
  stages.map((stage) => ({ stage, status: "complete", attempts: 1 })) as DocumentJob["stages"];

describe("report state dimensions", () => {
  test("a submitted revision is frozen", () => {
    assert.equal(isMutable(revision({ capture: "draft" })), true);
    assert.equal(isMutable(revision({ capture: "submitted" })), false);
  });

  test("partial media receipt does not permit processing", () => {
    assert.equal(isReadyForProcessing(revision({ receipt: "partial" })), false);
    assert.equal(isReadyForProcessing(revision({ receipt: "received" })), true);
  });

  test("a validated report still needs review before rendering", () => {
    assert.equal(isApprovedForRender(revision({ review: "pending" })), false);
    assert.equal(isApprovedForRender(revision({ review: "changes_requested" })), false);
    assert.equal(isApprovedForRender(revision({ review: "approved" })), true);
  });

  test("a draft never reaches rendering however complete it looks", () => {
    const draft = revision({ capture: "draft", receipt: "received", validation: "validated" });
    assert.equal(isApprovedForRender(draft), false);
  });
});

describe("issue confirmation and work are independent", () => {
  test("rejecting the source revision disputes a provisional issue", () => {
    assert.equal(onSourceRevisionRejected(issue({ confirmation: "provisional" })), "disputed");
  });

  test("rejecting the source revision leaves a confirmed issue alone", () => {
    assert.equal(onSourceRevisionRejected(issue({ confirmation: "confirmed" })), "confirmed");
  });

  test("a disputed issue whose repair is already done keeps its work state", () => {
    const repaired = issue({ confirmation: "provisional", work: "closed" });
    assert.equal(onSourceRevisionRejected(repaired), "disputed");
    assert.equal(repaired.work, "closed", "review must not reverse completed work");
  });

  test("closure needs a verifier who is not the owner", () => {
    const awaiting = issue({ work: "awaiting_verification", owner: id("p1") });
    assert.equal(canClose(awaiting, id("p2")), true);
    assert.equal(canClose(awaiting, id("p1")), false, "self-verification is not verification");
  });

  test("closure is not available before verification is requested", () => {
    assert.equal(canClose(issue({ work: "in_progress" }), id("p2")), false);
  });

  test("withdrawn or closed issues stop being actionable", () => {
    assert.equal(isActionable(issue({ confirmation: "withdrawn" })), false);
    assert.equal(isActionable(issue({ work: "closed" })), false);
    assert.equal(isActionable(issue()), true);
  });
});

describe("document pipeline order", () => {
  test("render comes first", () => {
    assert.equal(nextStage(job()), "render");
  });

  test("signing follows rendering and precedes hashing", () => {
    assert.equal(nextStage(job({ stages: done("render") })), "sign");
    assert.equal(nextStage(job({ stages: done("render", "sign") })), "verify");
    assert.equal(nextStage(job({ stages: done("render", "sign", "verify") })), "hash");
  });

  test("a failed stage is retried, never skipped", () => {
    const failed = job({
      stages: [
        { stage: "render", status: "complete", attempts: 1 },
        { stage: "sign", status: "failed", attempts: 3, lastError: "provider timeout" },
      ],
    });
    assert.equal(nextStage(failed), "sign", "must not fall through to an unsigned issue");
  });

  test("existing signed bytes are reused rather than re-signed", () => {
    assert.equal(mustReuseArtifact(job()), false);
    assert.equal(mustReuseArtifact(job({ artifact: ARTIFACT })), true);
  });

  test("rendered is not filed, and filed is not issued", () => {
    const rendered = job({
      stages: done("render", "sign", "verify", "hash"),
      artifact: ARTIFACT,
    });
    assert.equal(isIssuable(rendered), false, "no archive yet");

    const filed = job({
      stages: done("render", "sign", "verify", "hash", "archive"),
      artifact: ARTIFACT,
      archived: { driveId: "d1", itemId: "i1" },
    });
    assert.equal(isIssuable(filed), true);
  });
});

describe("idempotency", () => {
  const existing: ProcessedEffect = { key: "k", payloadHash: "h1", completedAt: "t" };

  test("keys are deterministic and distinguish effect types", () => {
    const a = effectKey(id("r1"), "create_issue", "target");
    assert.equal(a, effectKey(id("r1"), "create_issue", "target"));
    assert.notEqual(a, effectKey(id("r1"), "archive_document", "target"));
  });

  test("same key and payload is a replay", () => {
    assert.equal(classify("k", "h1", existing).kind, "replay");
  });

  test("same key with different payload is a conflict, not a replay", () => {
    assert.equal(classify("k", "h2", existing).kind, "conflict");
  });

  test("an unseen key is fresh", () => {
    assert.equal(classify("k", "h1", undefined).kind, "fresh");
  });
});

describe("project pinning", () => {
  const project = (over: Partial<Project> = {}): Project => ({
    id: id("proj1"),
    company: "leodis-developments",
    clientId: id("c1"),
    origin: {
      source: { siteId: "s", listId: "l", itemId: "1" },
      snapshot: {
        projectName: "Kirkstall Gate",
        projectNumber: "011LME",
        clientName: "Acme Developments",
        division: "Leodis M&E",
      },
      clientLookupItemId: "42",
      clientAccountNumber: "ACME001",
      projectManager: id("pm1"),
      pinnedAt: "2026-01-01T00:00:00Z",
      pinnedBy: id("p1"),
    },
    mapping: {
      version: 1,
      source: { siteId: "s", listId: "l", itemId: "1" },
      archiveDestination: { driveId: "d", itemId: "f" },
      effectiveFrom: "2026-01-01T00:00:00Z",
      changedBy: id("p1"),
      reason: "initial",
    },
    currentDisplay: {
      projectName: "Kirkstall Gate Phase 2",
      projectNumber: "011LME",
      division: "Leodis M&E",
      status: "4. Active",
      refreshedAt: "2026-09-01T00:00:00Z",
    },
    sourceState: "active",
    ...over,
  });

  const policy = DEFAULT_REPORTABLE_STATUSES;

  test("a live project shows its current name", () => {
    assert.equal(resolveDisplayName(project()), "Kirkstall Gate Phase 2");
  });

  test("a deleted source falls back to the pinned snapshot rather than orphaning", () => {
    assert.equal(resolveDisplayName(project({ sourceState: "tombstoned" })), "Kirkstall Gate");
  });

  test("a move to a different list is a remap, not a new project", () => {
    const p = project();
    assert.equal(isRemap(p.mapping, { siteId: "s", listId: "l2", itemId: "1" }), true);
    assert.equal(isRemap(p.mapping, { siteId: "s", listId: "l", itemId: "1" }), false);
  });

  const withStatus = (status: string) =>
    project({ currentDisplay: { ...project().currentDisplay, status } });

  test("only active and defects liability projects are reportable", () => {
    assert.equal(isReportable(withStatus("4. Active"), policy), true);
    assert.equal(isReportable(withStatus("5. Defects Liability"), policy), true);
  });

  test("a tender is not reportable, however complete its record looks", () => {
    assert.equal(isReportable(withStatus("1. Tender"), policy), false);
  });

  test("an unrecognised status fails closed rather than defaulting open", () => {
    assert.equal(isReportable(withStatus("6. Complete"), policy), false);
    assert.equal(isReportable(withStatus("Something New"), policy), false);
  });

  test("a tombstoned project is never reportable even with an allowed status", () => {
    assert.equal(isReportable(project({ sourceState: "tombstoned" }), policy), false);
  });

  // exactOptionalPropertyTypes distinguishes an absent key from an explicit
  // undefined, and "the flow has not populated it yet" means absent.
  const withoutCode = <T extends { projectNumber?: string }>(source: T): T => {
    const { projectNumber: _omitted, ...rest } = source;
    return rest as T;
  };

  test("an active project without a code is not reportable", () => {
    const base = project();
    const noCode = project({
      origin: { ...base.origin, snapshot: withoutCode(base.origin.snapshot) },
      currentDisplay: withoutCode(base.currentDisplay),
    });
    assert.equal(projectCode(noCode), null);
    assert.equal(
      isReportable(noCode, policy),
      false,
      "filing verifies the folder against the code, so there is nowhere safe to file",
    );
  });

  test("the code falls back to the pinned snapshot if the refresh dropped it", () => {
    const base = project();
    const stale = project({ currentDisplay: withoutCode(base.currentDisplay) });
    assert.equal(projectCode(stale), "011LME");
  });
});

describe("client identity", () => {
  const client = (over: Partial<Client> = {}): Client => ({
    id: id("c1"),
    origin: {
      source: { siteId: "s", listId: "clients", itemId: "42" },
      snapshot: { name: "Acme Developments", accountNumber: "ACME001" },
      pinnedAt: "2026-01-01T00:00:00Z",
      pinnedBy: id("p1"),
    },
    current: {
      name: "Acme Developments Ltd",
      accountNumber: "ACME001",
      refreshedAt: "2026-09-01T00:00:00Z",
    },
    sourceState: "active",
    ...over,
  });

  test("a live client shows its current name", () => {
    assert.equal(resolveClientLabel(client()), "Acme Developments Ltd");
  });

  test("a deleted source falls back to the pinned snapshot", () => {
    assert.equal(resolveClientLabel(client({ sourceState: "tombstoned" })), "Acme Developments");
  });

  test("an unnamed client falls back to account number, never an empty label", () => {
    const unnamed = client({
      current: { accountNumber: "ACME001", refreshedAt: "2026-09-01T00:00:00Z" },
    });
    assert.equal(resolveClientLabel(unnamed), "ACME001");
  });

  test("a client with no name and no account number is still identifiable", () => {
    const bare = client({ current: { refreshedAt: "2026-09-01T00:00:00Z" } });
    assert.equal(resolveClientLabel(bare), "Client 42 (unnamed in source)");
  });
});
