import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  archiveTarget,
  canFile,
  validateResolvedFolder,
  sanitiseFileName,
  archiveFileName,
  archiveEffectTarget,
  DEFAULT_ARCHIVE_CONVENTION,
  type ArchiveResolution,
} from "./archive.js";

const id = <T,>(v: string) => v as T;

function resolution(over: Partial<ArchiveResolution> = {}): ArchiveResolution {
  return {
    projectId: id("proj1"),
    anchorUrl: "https://leodisdevelopments.sharepoint.com/.../011LME%20-%20Tetley%20Hall",
    anchor: { driveId: "d1", itemId: "projectFolder" },
    anchorFolderName: "011LME - Tetley Hall - Block E",
    convention: DEFAULT_ARCHIVE_CONVENTION,
    outcome: { kind: "found", target: { driveId: "d1", itemId: "reportsFolder" } },
    resolvedAt: "2026-09-07T09:00:00Z",
    resolvedBy: id("p1"),
    ...over,
  } as ArchiveResolution;
}

describe("archive destination", () => {
  test("the convention is only the two segments below the project folder", () => {
    assert.deepEqual(DEFAULT_ARCHIVE_CONVENTION.relativeSegments, [
      "04 - On-Site",
      "05 - Reports",
    ]);
  });

  test("a found or created folder is filable", () => {
    assert.equal(canFile(resolution()), true);
    assert.equal(
      canFile(
        resolution({
          outcome: { kind: "created", target: { driveId: "d1", itemId: "made" } },
        }),
      ),
      true,
    );
  });

  test("an unresolved anchor blocks filing rather than guessing a path", () => {
    const broken = resolution({
      outcome: { kind: "unresolved", reason: "Documents hyperlink is empty" },
    });
    assert.equal(canFile(broken), false);
    assert.equal(archiveTarget(broken), null);
  });
});

describe("linked folder validation", () => {
  test("a folder whose name starts with the project code is accepted", () => {
    assert.deepEqual(validateResolvedFolder("011LME - Tetley Hall - Block E", "011LME"), {
      ok: true,
    });
  });

  test("a hyperlink pointing at another project is rejected", () => {
    const result = validateResolvedFolder("012LCP - Somewhere Else", "011LME");
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.reason : "", /another project/);
  });

  test("a missing project code is reported as a flow failure, not worked around", () => {
    const result = validateResolvedFolder("011LME - Tetley Hall - Block E", undefined);
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.reason : "", /did not complete/);
  });

  test("an empty project code is treated as missing", () => {
    assert.equal(validateResolvedFolder("anything", "").ok, false);
  });
});

describe("file naming", () => {
  test("ampersands survive, because client names contain them", () => {
    assert.equal(sanitiseFileName("C&AJ Marshall Builders Ltd"), "C&AJ Marshall Builders Ltd");
  });

  test("spaces and hyphens are preserved", () => {
    assert.equal(sanitiseFileName("011LME - Tetley Hall - Block E"), "011LME - Tetley Hall - Block E");
  });

  test("characters SharePoint rejects are replaced", () => {
    assert.equal(sanitiseFileName('Block E: "north" wing?'), "Block E- -north- wing-");
  });

  test("path separators cannot survive into a file name", () => {
    assert.equal(sanitiseFileName("a/b\\c"), "a-b-c");
  });

  test("trailing periods and surrounding space are removed", () => {
    assert.equal(sanitiseFileName("  Block E...  "), "Block E");
  });

  test("a name that sanitises away still produces something filable", () => {
    assert.equal(sanitiseFileName("///"), "untitled");
  });

  test("a filed document names its revision so corrections sit alongside", () => {
    const v1 = archiveFileName({
      projectNumber: "011LME",
      reportNumber: "SPR-0042",
      revision: 1,
      visitDate: "2026-09-07",
    });
    const v2 = archiveFileName({
      projectNumber: "011LME",
      reportNumber: "SPR-0042",
      revision: 2,
      visitDate: "2026-09-07",
    });
    assert.equal(v1, "011LME - SPR-0042 - 2026-09-07 - Rev 1.pdf");
    assert.notEqual(v1, v2, "a correction must not overwrite the original");
  });
});

describe("filing idempotency", () => {
  test("the same revision and file name retry to the same target", () => {
    const a = archiveEffectTarget(id("rev1"), "011LME - SPR-0042 - Rev 1.pdf");
    assert.equal(a, archiveEffectTarget(id("rev1"), "011LME - SPR-0042 - Rev 1.pdf"));
  });

  test("a new revision is a different filing effect", () => {
    assert.notEqual(
      archiveEffectTarget(id("rev1"), "x - Rev 1.pdf"),
      archiveEffectTarget(id("rev2"), "x - Rev 2.pdf"),
    );
  });
});
