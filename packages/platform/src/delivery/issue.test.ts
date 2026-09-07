import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  canIssue,
  deliveryKey,
  alreadyDelivered,
  resolveRecipients,
  type IssueRecord,
} from "./issue.js";

const id = <T,>(v: string) => v as T;

describe("when a report may be issued", () => {
  const ready = { approved: true, documentFiled: true, superseded: false };

  test("an approved, filed, current revision may be issued", () => {
    assert.deepEqual(canIssue(ready), { ok: true });
  });

  test("an unapproved report is never sent", () => {
    const result = canIssue({ ...ready, approved: false });
    assert.equal(result.ok, false);
    assert.match(
      result.ok === false ? result.reason : "",
      /not been approved/,
      "rendering is not agreement to send",
    );
  });

  test("a superseded revision is not sent", () => {
    assert.equal(canIssue({ ...ready, superseded: true }).ok, false);
  });

  test("filing comes before sending", () => {
    const result = canIssue({ ...ready, documentFiled: false });
    assert.equal(
      result.ok,
      false,
      "a copy in the world that the archive cannot produce is worse than a delay",
    );
  });
});

describe("delivery keys", () => {
  test("the same delivery produces the same key", () => {
    assert.equal(
      deliveryKey(id("rev1"), "email", "a.whitfield@example.com"),
      deliveryKey(id("rev1"), "email", "a.whitfield@example.com"),
    );
  });

  test("addresses are compared without case or padding", () => {
    assert.equal(
      deliveryKey(id("rev1"), "email", "  A.Whitfield@Example.com "),
      deliveryKey(id("rev1"), "email", "a.whitfield@example.com"),
    );
  });

  test("a new revision to the same person is a different delivery", () => {
    assert.notEqual(
      deliveryKey(id("rev1"), "email", "a@b.com"),
      deliveryKey(id("rev2"), "email", "a@b.com"),
    );
  });

  test("filing and emailing the same revision are different deliveries", () => {
    assert.notEqual(
      deliveryKey(id("rev1"), "email", "a@b.com"),
      deliveryKey(id("rev1"), "filed", "a@b.com"),
    );
  });
});

describe("not sending twice", () => {
  const sent: IssueRecord[] = [
    {
      revisionId: id("rev1"),
      revision: 1,
      method: "email",
      recipient: { name: "A. Whitfield", address: "a.whitfield@example.com", role: "project_manager" },
      at: "2026-09-07T10:00:00Z",
    },
  ];

  test("a completed delivery is not repeated", () => {
    assert.equal(alreadyDelivered(sent, id("rev1"), "email", "a.whitfield@example.com"), true);
  });

  test("a failed delivery is retried", () => {
    const failed: IssueRecord[] = [{ ...sent[0]!, failure: "Mailbox unavailable" }];
    assert.equal(
      alreadyDelivered(failed, id("rev1"), "email", "a.whitfield@example.com"),
      false,
      "a failure is a record of an attempt, not of a delivery",
    );
  });

  test("a different recipient still gets it", () => {
    assert.equal(alreadyDelivered(sent, id("rev1"), "email", "someone.else@example.com"), false);
  });
});

describe("resolving recipients", () => {
  test("a named person with an address is sent to", () => {
    const { send } = resolveRecipients([
      { name: "A. Whitfield", address: "a.whitfield@example.com", role: "project_manager" },
    ]);
    assert.equal(send.length, 1);
    assert.equal(send[0]?.role, "project_manager");
  });

  test("a person with no address is reported, never guessed at", () => {
    const { send, unaddressed } = resolveRecipients([{ name: "A. Whitfield" }]);
    assert.deepEqual(send, []);
    assert.deepEqual(
      unaddressed,
      ["A. Whitfield"],
      "inventing an address would send a client's report to whoever owns that mailbox",
    );
  });

  test("something that is not an address is treated as missing", () => {
    const { send, unaddressed } = resolveRecipients([{ name: "A. Whitfield", address: "ask the office" }]);
    assert.deepEqual(send, []);
    assert.deepEqual(unaddressed, ["A. Whitfield"]);
  });

  test("an entry with no name at all is ignored", () => {
    const { send, unaddressed } = resolveRecipients([{ address: "orphan@example.com" }]);
    assert.deepEqual(send, []);
    assert.deepEqual(unaddressed, []);
  });
});
