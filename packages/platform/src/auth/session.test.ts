import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isExpired,
  expiryFrom,
  stateMatches,
  safeReturnTo,
  principalIdFor,
  PROVISIONAL_SESSION_HOURS,
  type Session,
} from "./session.js";

const session = (over: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    principal: {
      id: "entra:abc" as never,
      oid: "abc",
      name: "D. Hartley",
      email: "d.hartley@example.com",
    },
    issuedAt: "2026-09-07T08:00:00Z",
    expiresAt: "2026-09-07T20:00:00Z",
    ...over,
  }) as Session;

describe("session expiry", () => {
  test("a session inside its window is live", () => {
    assert.equal(isExpired(session(), new Date("2026-09-07T19:59:00Z")), false);
  });

  test("expiry is not a grace period", () => {
    assert.equal(isExpired(session(), new Date("2026-09-07T20:00:00Z")), true);
    assert.equal(isExpired(session(), new Date("2026-09-08T00:00:00Z")), true);
  });

  test("the window runs from issue", () => {
    assert.equal(
      expiryFrom(new Date("2026-09-07T08:00:00Z")),
      new Date(
        Date.parse("2026-09-07T08:00:00Z") + PROVISIONAL_SESSION_HOURS * 3_600_000,
      ).toISOString(),
    );
  });
});

describe("state parameter", () => {
  test("a matching state passes", () => {
    assert.equal(stateMatches("abc123", "abc123"), true);
  });

  test("a different state fails", () => {
    assert.equal(stateMatches("abc123", "abc124"), false);
  });

  test("missing values fail rather than passing trivially", () => {
    assert.equal(stateMatches(undefined, undefined), false);
    assert.equal(stateMatches("", ""), false);
    assert.equal(stateMatches("abc", undefined), false);
    assert.equal(stateMatches(undefined, "abc"), false);
  });
});

describe("return destination", () => {
  test("an in-app path is kept", () => {
    assert.equal(safeReturnTo("/reports/rep-1"), "/reports/rep-1");
  });

  test("an absolute URL is refused", () => {
    assert.equal(safeReturnTo("https://evil.example/steal"), "/");
  });

  test("a protocol-relative URL is refused", () => {
    assert.equal(
      safeReturnTo("//evil.example/steal"),
      "/",
      "a leading double slash is an absolute URL, not a path",
    );
  });

  test("a backslash-prefixed path is refused", () => {
    assert.equal(safeReturnTo("/\\evil.example"), "/");
  });

  test("nothing supplied falls back", () => {
    assert.equal(safeReturnTo(null), "/");
    assert.equal(safeReturnTo(undefined, "/office"), "/office");
  });
});

describe("principal identity", () => {
  test("identity derives from the stable object id, not an address", () => {
    assert.equal(principalIdFor("00000000-1111-2222-3333-444444444444"), "entra:00000000-1111-2222-3333-444444444444");
  });

  test("the same person keeps the same id when their name changes", () => {
    assert.equal(principalIdFor("abc"), principalIdFor("abc"));
  });
});
