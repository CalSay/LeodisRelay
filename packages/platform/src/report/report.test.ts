import { test, describe } from "node:test";
import assert from "node:assert/strict";

import type { MediaId, ReportRevision } from "@relay/contracts";
import {
  verifyManifest,
  uploadProgress,
  retryableMedia,
  type MediaManifest,
  type StoredMediaObject,
} from "./manifest.js";
import {
  saveDraft,
  submit,
  recordValidation,
  review,
  correct,
  canBeginDocumentProduction,
} from "./lifecycle.js";

const id = <T,>(v: string) => v as T;

const manifest: MediaManifest = {
  entries: [
    { mediaId: id<MediaId>("m1"), sha256: "aaa" },
    { mediaId: id<MediaId>("m2"), sha256: "bbb" },
  ],
};

const good = (mediaId: string, sha256: string): StoredMediaObject => ({
  mediaId: id<MediaId>(mediaId),
  uploadComplete: true,
  verifiedSha256: sha256,
  permitted: true,
});

function revision(over: Partial<ReportRevision> = {}): ReportRevision {
  return {
    id: id("rev1"),
    reportId: id("rep1"),
    visitId: id("v1"),
    revision: 3,
    templateVersionId: id("tpl1"),
    author: id("engineer-1"),
    capture: "draft",
    receipt: "none",
    validation: "pending",
    review: "pending",
    currency: "current",
    ...over,
  } as ReportRevision;
}

describe("manifest verification", () => {
  test("a complete, verified, permitted set passes", () => {
    const result = verifyManifest(manifest, [good("m1", "aaa"), good("m2", "bbb")]);
    assert.equal(result.kind, "complete");
  });

  test("uploaded bytes alone do not make a submission receivable", () => {
    const result = verifyManifest(manifest, [
      good("m1", "aaa"),
      { mediaId: id<MediaId>("m2"), uploadComplete: false, permitted: true },
    ]);
    assert.equal(result.kind, "incomplete");
    assert.deepEqual(result.kind === "incomplete" ? result.shortfall.incomplete : [], ["m2"]);
  });

  test("a hash mismatch is reported rather than accepted", () => {
    const result = verifyManifest(manifest, [good("m1", "aaa"), good("m2", "WRONG")]);
    assert.deepEqual(result.kind === "incomplete" ? result.shortfall.mismatched : [], ["m2"]);
  });

  test("an object this principal may not use is forbidden, not missing", () => {
    const result = verifyManifest(manifest, [
      good("m1", "aaa"),
      { ...good("m2", "bbb"), permitted: false },
    ]);
    assert.deepEqual(result.kind === "incomplete" ? result.shortfall.forbidden : [], ["m2"]);
  });

  test("progress counts usable objects, not merely present ones", () => {
    const progress = uploadProgress(manifest, [
      good("m1", "aaa"),
      { mediaId: id<MediaId>("m2"), uploadComplete: false, permitted: true },
    ]);
    assert.deepEqual(progress, { ready: 1, total: 2 });
  });

  test("forbidden objects are excluded from retry, because retrying loops", () => {
    const retryable = retryableMedia({
      missing: [id<MediaId>("a")],
      incomplete: [id<MediaId>("b")],
      mismatched: [id<MediaId>("c")],
      forbidden: [id<MediaId>("d")],
    });
    assert.deepEqual(retryable, ["a", "b", "c"]);
  });
});

describe("draft editing", () => {
  test("a stale base revision conflicts rather than merging", () => {
    const result = saveDraft(revision({ revision: 5 }), 3);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false ? result.code : "", "revision_conflict");
  });

  test("a submitted revision cannot be edited", () => {
    const result = saveDraft(revision({ capture: "submitted" }), 3);
    assert.equal(result.ok === false ? result.code : "", "revision_frozen");
  });

  test("an in-step edit advances the revision", () => {
    const result = saveDraft(revision({ revision: 3 }), 3);
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.value.revision : 0, 4);
  });
});

describe("submission", () => {
  const stored = [good("m1", "aaa"), good("m2", "bbb")];

  test("a complete submission freezes the revision", () => {
    const result = submit(revision(), manifest, stored, "2026-09-07T11:00:00Z");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.capture, "submitted");
      assert.equal(result.value.receipt, "received");
      assert.equal(result.value.submittedAt, "2026-09-07T11:00:00Z");
    }
  });

  test("outstanding uploads are a normal wait, not an error to fix", () => {
    const result = submit(
      revision(),
      manifest,
      [good("m1", "aaa")],
      "2026-09-07T11:00:00Z",
    );
    assert.equal(result.ok === false ? result.code : "", "media_incomplete");
    assert.match(result.ok === false ? result.reason : "", /automatically/);
  });

  test("a forbidden attachment is distinguished, because retrying will not help", () => {
    const result = submit(
      revision(),
      manifest,
      [good("m1", "aaa"), { ...good("m2", "bbb"), permitted: false }],
      "2026-09-07T11:00:00Z",
    );
    assert.equal(result.ok === false ? result.code : "", "media_forbidden");
  });

  test("submitting twice is refused", () => {
    const result = submit(
      revision({ capture: "submitted" }),
      manifest,
      stored,
      "2026-09-07T11:00:00Z",
    );
    assert.equal(result.ok === false ? result.code : "", "already_submitted");
  });
});

describe("validation and review", () => {
  const submitted = revision({ capture: "submitted", receipt: "received" });

  test("validation requires the complete submission to be held", () => {
    const result = recordValidation(revision({ capture: "submitted", receipt: "partial" }), "validated");
    assert.equal(result.ok === false ? result.code : "", "not_received");
  });

  test("review requires validation to have passed first", () => {
    const result = review(submitted, id("reviewer-1"), "approved", {
      selfReviewPermitted: false,
    });
    assert.equal(result.ok === false ? result.code : "", "not_validated");
  });

  test("an author cannot approve their own report by default", () => {
    const validated = revision({
      capture: "submitted",
      receipt: "received",
      validation: "validated",
      author: id("engineer-1"),
    });
    const result = review(validated, id("engineer-1"), "approved", {
      selfReviewPermitted: false,
    });
    assert.equal(result.ok === false ? result.code : "", "self_review");
  });

  test("self review is allowed where Leodis has expressly permitted it", () => {
    const validated = revision({
      capture: "submitted",
      receipt: "received",
      validation: "validated",
      author: id("engineer-1"),
    });
    const result = review(validated, id("engineer-1"), "approved", {
      selfReviewPermitted: true,
    });
    assert.equal(result.ok, true);
  });
});

describe("corrections", () => {
  const issued = revision({
    capture: "submitted",
    receipt: "received",
    validation: "validated",
    review: "approved",
  });

  test("a correction supersedes the original without editing it", () => {
    const result = correct(issued, id("rev2"), "Attribution of damage was not supported");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.superseded.currency, "superseded");
      assert.equal(result.value.superseded.id, issued.id, "the original keeps its identity");
      assert.equal(result.value.replacement.supersedes?.revisionId, issued.id);
      assert.equal(result.value.replacement.capture, "draft");
      assert.equal(result.value.replacement.review, "pending", "a correction is reviewed again");
    }
  });

  test("a correction must say why", () => {
    const result = correct(issued, id("rev2"), "   ");
    assert.equal(result.ok === false ? result.code : "", "reason_required");
  });

  test("a superseded revision cannot be corrected again", () => {
    const result = correct({ ...issued, currency: "superseded" }, id("rev3"), "reason");
    assert.equal(result.ok === false ? result.code : "", "already_superseded");
  });

  test("a draft is edited, not corrected", () => {
    const result = correct(revision(), id("rev2"), "reason");
    assert.equal(result.ok === false ? result.code : "", "not_submitted");
  });
});

describe("document production gate", () => {
  test("an approved current revision may be rendered", () => {
    assert.equal(
      canBeginDocumentProduction(
        revision({
          capture: "submitted",
          receipt: "received",
          validation: "validated",
          review: "approved",
        }),
      ),
      true,
    );
  });

  test("a superseded revision is never re-rendered", () => {
    assert.equal(
      canBeginDocumentProduction(
        revision({
          capture: "submitted",
          receipt: "received",
          validation: "validated",
          review: "approved",
          currency: "superseded",
        }),
      ),
      false,
    );
  });
});
