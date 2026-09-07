import { test, describe } from "node:test";
import assert from "node:assert/strict";

import type { Issue } from "@relay/contracts";
import {
  transition,
  onRevisionRejected,
  needsTriage,
  type IssuePolicy,
} from "./transitions.js";

const id = <T,>(v: string) => v as T;

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: id("i1"),
    projectId: id("proj1"),
    confirmation: "provisional",
    work: "open",
    raisedByRevision: id("rev1"),
    ...over,
  } as Issue;
}

const permissive: IssuePolicy = {
  permits: () => true,
  requiresIndependentVerification: true,
};

const restrictive: IssuePolicy = {
  permits: () => false,
  requiresIndependentVerification: true,
};

const noVerificationNeeded: IssuePolicy = {
  permits: () => true,
  requiresIndependentVerification: false,
};

describe("work axis", () => {
  test("an ordinary progression is allowed", () => {
    const result = transition(
      issue({ work: "assigned" }),
      { axis: "work", to: "in_progress", actor: id("e1") },
      permissive,
    );
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.issue.work : "", "in_progress");
  });

  test("skipping straight from in progress to closed is refused", () => {
    const result = transition(
      issue({ work: "in_progress" }),
      { axis: "work", to: "closed", actor: id("e1") },
      permissive,
    );
    assert.equal(result.ok === false ? result.code : "", "illegal_work_transition");
  });

  test("closure requires someone other than the owner", () => {
    const awaiting = issue({ work: "awaiting_verification", owner: id("e1") });
    const bySelf = transition(
      awaiting,
      { axis: "work", to: "closed", actor: id("e1") },
      permissive,
    );
    assert.equal(bySelf.ok === false ? bySelf.code : "", "verification_required");

    const byOther = transition(
      awaiting,
      { axis: "work", to: "closed", actor: id("e2") },
      permissive,
    );
    assert.equal(byOther.ok, true);
  });

  test("a domain that does not require independent verification may self-close", () => {
    const awaiting = issue({ work: "awaiting_verification", owner: id("e1") });
    const result = transition(
      awaiting,
      { axis: "work", to: "closed", actor: id("e1") },
      noVerificationNeeded,
    );
    assert.equal(result.ok, true);
  });

  test("a closed issue can be reopened", () => {
    const result = transition(
      issue({ work: "closed" }),
      { axis: "work", to: "open", actor: id("e1") },
      permissive,
    );
    assert.equal(result.ok, true);
  });

  test("domain policy can refuse a structurally legal move", () => {
    const result = transition(
      issue({ work: "open" }),
      { axis: "work", to: "assigned", actor: id("e1") },
      restrictive,
    );
    assert.equal(result.ok === false ? result.code : "", "not_permitted");
  });

  test("a withdrawn issue accepts no further work", () => {
    const result = transition(
      issue({ confirmation: "withdrawn", work: "open" }),
      { axis: "work", to: "assigned", actor: id("e1") },
      permissive,
    );
    assert.equal(result.ok === false ? result.code : "", "issue_withdrawn");
  });
});

describe("confirmation axis", () => {
  test("a provisional issue can be confirmed with a reason", () => {
    const result = transition(
      issue(),
      { axis: "confirmation", to: "confirmed", actor: id("r1"), reason: "Verified on site" },
      permissive,
    );
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.issue.confirmation : "", "confirmed");
  });

  test("changing confirmation must record why", () => {
    const result = transition(
      issue(),
      { axis: "confirmation", to: "disputed", actor: id("r1"), reason: "  " },
      permissive,
    );
    assert.equal(result.ok === false ? result.code : "", "reason_required");
  });

  test("withdrawal is terminal, so a retraction cannot quietly return", () => {
    const result = transition(
      issue({ confirmation: "withdrawn" }),
      { axis: "confirmation", to: "confirmed", actor: id("r1"), reason: "changed my mind" },
      permissive,
    );
    assert.equal(result.ok === false ? result.code : "", "illegal_confirmation_transition");
    assert.match(result.ok === false ? result.reason : "", /Raise a new issue/);
  });
});

describe("the two axes stay independent", () => {
  test("disputing an issue does not undo a repair already carried out", () => {
    const repaired = issue({ confirmation: "provisional", work: "closed" });
    const result = transition(
      repaired,
      {
        axis: "confirmation",
        to: "disputed",
        actor: id("r1"),
        reason: "Report returned for correction",
      },
      permissive,
    );
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.issue.work : "", "closed", "work state is untouched");
  });

  test("completing the work does not confirm the observation", () => {
    const result = transition(
      issue({ confirmation: "provisional", work: "awaiting_verification", owner: id("e1") }),
      { axis: "work", to: "closed", actor: id("e2") },
      permissive,
    );
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.issue.confirmation : "", "provisional");
  });
});

describe("report rejection triage", () => {
  const issues = [
    issue({ id: id("provisional-open"), confirmation: "provisional", work: "open" }),
    issue({ id: id("provisional-done"), confirmation: "provisional", work: "closed" }),
    issue({ id: id("already-confirmed"), confirmation: "confirmed", work: "in_progress" }),
  ];

  test("provisional issues go to triage, confirmed ones are left alone", () => {
    const after = onRevisionRejected(issues);
    assert.equal(after[0]?.confirmation, "disputed");
    assert.equal(after[1]?.confirmation, "disputed");
    assert.equal(after[2]?.confirmation, "confirmed");
  });

  test("no work state changes, because an engineer may already have been sent", () => {
    const after = onRevisionRejected(issues);
    assert.deepEqual(
      after.map((i) => i.work),
      ["open", "closed", "in_progress"],
    );
  });

  test("the triage queue surfaces exactly what needs a decision", () => {
    const after = onRevisionRejected(issues);
    assert.deepEqual(
      needsTriage(after).map((i) => i.id),
      ["provisional-open", "provisional-done"],
    );
  });
});
