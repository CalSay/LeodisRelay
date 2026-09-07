import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  drainOrder,
  unsentCount,
  blockedCount,
  resumable,
  retainedForPrincipal,
  isVisibleToOtherDevices,
  type MutationEnvelope,
} from "./journal.js";
import {
  classifyFailure,
  backoffSeconds,
  nextAttemptDelay,
  shouldRetryAutomatically,
  DEFAULT_BACKOFF,
  MAX_AUTOMATIC_ATTEMPTS,
} from "./retry.js";
import {
  freshness,
  canCapture,
  canShowSensitiveCachedData,
  admitSubmission,
  PROVISIONAL_FRESHNESS,
  type ReferenceBundle,
} from "./bundle.js";

const id = <T,>(v: string) => v as T;

function envelope(over: Partial<MutationEnvelope> = {}): MutationEnvelope {
  return {
    operationId: id("op1"),
    resourceId: "report-a",
    baseRevision: 1,
    schemaVersion: 1,
    capturedAt: "2026-09-07T09:00:00Z",
    capturedBy: id("engineer-1"),
    capturedUnderStaleAuthority: false,
    state: "pending",
    attempts: 0,
    payload: {},
    ...over,
  } as MutationEnvelope;
}

describe("journal drain order", () => {
  test("mutations on one resource keep their capture order", () => {
    const out = drainOrder([
      envelope({ operationId: id("b"), capturedAt: "2026-09-07T10:00:00Z" }),
      envelope({ operationId: id("a"), capturedAt: "2026-09-07T09:00:00Z" }),
    ]);
    assert.deepEqual(
      out.map((e) => e.operationId),
      ["a", "b"],
      "a later edit must not be overwritten by an earlier one arriving second",
    );
  });

  test("one blocked resource does not stall the rest of the queue", () => {
    const out = drainOrder([
      envelope({ operationId: id("stuck"), resourceId: "report-a", state: "blocked" }),
      envelope({ operationId: id("alsoStuck"), resourceId: "report-a", state: "pending" }),
      envelope({ operationId: id("fine"), resourceId: "report-b", state: "pending" }),
    ]);
    assert.deepEqual(
      out.map((e) => e.operationId),
      ["fine"],
      "an engineer with one bad report should still get their others uploaded",
    );
  });

  test("acknowledged envelopes are not resent", () => {
    const out = drainOrder([envelope({ state: "acknowledged" })]);
    assert.equal(out.length, 0);
  });

  test("in-flight envelopes are included, because the response may have been lost", () => {
    const out = drainOrder([envelope({ state: "in_flight" })]);
    assert.equal(out.length, 1);
    assert.equal(resumable([envelope({ state: "in_flight" })]).length, 1);
  });
});

describe("journal counts", () => {
  const queue = [
    envelope({ state: "pending" }),
    envelope({ state: "in_flight" }),
    envelope({ state: "blocked" }),
    envelope({ state: "acknowledged" }),
  ];

  test("unsent work counts everything the server has not confirmed", () => {
    assert.equal(unsentCount(queue), 3);
  });

  test("items needing attention are counted separately from items still uploading", () => {
    assert.equal(blockedCount(queue), 1);
  });
});

describe("journal retention", () => {
  test("unsent work survives sign-out and is retained for its author", () => {
    const queue = [
      envelope({ operationId: id("mine"), capturedBy: id("engineer-1"), state: "pending" }),
      envelope({ operationId: id("theirs"), capturedBy: id("engineer-2"), state: "pending" }),
      envelope({ operationId: id("done"), capturedBy: id("engineer-1"), state: "acknowledged" }),
    ];
    assert.deepEqual(
      retainedForPrincipal(queue, id("engineer-1")).map((e) => e.operationId),
      ["mine"],
    );
  });

  test("a local envelope is invisible to other devices until acknowledged", () => {
    assert.equal(isVisibleToOtherDevices(envelope({ state: "pending" })), false);
    assert.equal(isVisibleToOtherDevices(envelope({ state: "in_flight" })), false);
    assert.equal(
      isVisibleToOtherDevices(envelope({ state: "acknowledged" })),
      true,
      "the office can only ever see server-backed drafts",
    );
  });
});

describe("failure classification", () => {
  test("authentication failures pause transfer rather than retrying or discarding", () => {
    assert.equal(classifyFailure(401).kind, "auth");
    assert.equal(classifyFailure(403).kind, "auth");
    assert.equal(nextAttemptDelay(classifyFailure(401), 1), null);
    assert.equal(shouldRetryAutomatically(classifyFailure(401), 1), false);
  });

  test("a revision conflict is permanent, because a person must resolve it", () => {
    assert.equal(classifyFailure(409).kind, "permanent");
    assert.equal(shouldRetryAutomatically(classifyFailure(409), 1), false);
  });

  test("domain validation and idempotency misuse are not retryable", () => {
    assert.equal(classifyFailure(422).kind, "permanent");
  });

  test("server errors and timeouts are transient", () => {
    assert.equal(classifyFailure(500).kind, "transient");
    assert.equal(classifyFailure(502).kind, "transient");
    assert.equal(classifyFailure(408).kind, "transient");
  });

  test("throttling is honoured at the interval the service asked for", () => {
    const throttled = classifyFailure(429, 30);
    assert.equal(throttled.kind, "throttled");
    assert.equal(nextAttemptDelay(throttled, 1), 30, "our backoff must not undercut the service");
  });

  test("throttling without an interval falls back to our own backoff", () => {
    const delay = nextAttemptDelay(classifyFailure(503), 1, DEFAULT_BACKOFF, () => 0.5);
    assert.ok(delay !== null && delay > 0);
  });
});

describe("backoff", () => {
  const noJitter = () => 0.5;

  test("delay grows exponentially from the base", () => {
    assert.equal(backoffSeconds(1, DEFAULT_BACKOFF, noJitter), 2);
    assert.equal(backoffSeconds(2, DEFAULT_BACKOFF, noJitter), 4);
    assert.equal(backoffSeconds(3, DEFAULT_BACKOFF, noJitter), 8);
  });

  test("delay is capped", () => {
    assert.equal(backoffSeconds(30, DEFAULT_BACKOFF, noJitter), DEFAULT_BACKOFF.maxSeconds);
  });

  test("jitter spreads a reconnecting site team rather than syncing them", () => {
    const earliest = backoffSeconds(3, DEFAULT_BACKOFF, () => 0);
    const latest = backoffSeconds(3, DEFAULT_BACKOFF, () => 1);
    assert.equal(earliest, 6);
    assert.equal(latest, 10);
  });

  test("delay is never negative", () => {
    assert.ok(backoffSeconds(1, { ...DEFAULT_BACKOFF, jitterRatio: 5 }, () => 0) >= 0);
  });

  test("automatic retry stops at the budget and the item blocks instead", () => {
    const transient = classifyFailure(500);
    assert.equal(shouldRetryAutomatically(transient, MAX_AUTOMATIC_ATTEMPTS - 1), true);
    assert.equal(shouldRetryAutomatically(transient, MAX_AUTOMATIC_ATTEMPTS), false);
  });
});

describe("bundle freshness never blocks capture", () => {
  const bundle: ReferenceBundle = {
    scopeId: "project-1",
    preparedAt: "2026-09-01T08:00:00Z",
    templateVersionIds: ["tpl-1"],
  };

  test("a bundle within the threshold is fresh", () => {
    assert.equal(freshness(bundle, new Date("2026-09-05T08:00:00Z")), "fresh");
  });

  test("a bundle past the threshold is stale", () => {
    assert.equal(freshness(bundle, new Date("2026-09-20T08:00:00Z")), "stale");
  });

  test("capture is permitted regardless of how stale the bundle is", () => {
    assert.equal(canCapture(), true);
  });

  test("access codes expire separately and much sooner than the bundle", () => {
    assert.equal(
      canShowSensitiveCachedData(bundle, new Date("2026-09-01T20:00:00Z")),
      true,
    );
    assert.equal(
      canShowSensitiveCachedData(bundle, new Date("2026-09-04T08:00:00Z")),
      false,
      "gate codes should not sit in a cache for days",
    );
    assert.ok(
      PROVISIONAL_FRESHNESS.sensitiveDataMaxAgeDays < PROVISIONAL_FRESHNESS.warnAfterDays,
    );
  });
});

describe("submission admission on reconnect", () => {
  const base = {
    principalStillAuthorised: true,
    templateStillAcceptable: true,
    capturedUnderStaleAuthority: false,
  };

  test("ordinary work is accepted", () => {
    assert.equal(admitSubmission(base).kind, "accept");
  });

  test("stale capture is accepted but held for review", () => {
    const out = admitSubmission({ ...base, capturedUnderStaleAuthority: true });
    assert.equal(out.kind, "accept_with_review");
  });

  test("a revoked user is refused even when nothing else is wrong", () => {
    const out = admitSubmission({ ...base, principalStillAuthorised: false });
    assert.equal(out.kind, "refuse");
  });

  test("revocation outranks stale-authority review, which cannot readmit them", () => {
    const out = admitSubmission({
      principalStillAuthorised: false,
      templateStillAcceptable: true,
      capturedUnderStaleAuthority: true,
    });
    assert.equal(
      out.kind,
      "refuse",
      "no reviewer acknowledgement may readmit a revoked principal",
    );
  });

  test("a superseded template returns work for review rather than re-scoring it", () => {
    const out = admitSubmission({ ...base, templateStillAcceptable: false });
    assert.equal(out.kind, "accept_with_review");
    assert.match(out.kind === "accept_with_review" ? out.reason : "", /re-scored/);
  });
});
