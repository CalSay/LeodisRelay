/**
 * Where issued PDFs are filed.
 *
 * The project folder tree looks like this:
 *
 *   <library>
 *     LCA0001 - C&AJ Marshall Builders Ltd      client folder, account number prefix
 *       011LME - Tetley Hall - Block E          project folder, project code prefix
 *         04 - On-Site
 *           05 - Reports                        <- reports are filed here
 *
 * Only the last two segments are treated as a convention, and the client and
 * project folders are never derived by name. Power Automate generates the
 * account and project codes reliably, so the prefixes can be trusted — but a
 * folder name also carries a free-text title that may be edited, and a folder
 * may be moved or renamed at any time. Deriving a path would turn either of
 * those into silent misfiling.
 *
 * The project item's `Documents` hyperlink is therefore the anchor. It is
 * resolved once at pin time to a drive item, the relative path below is
 * traversed from there, and the resulting identifiers are stored. Nothing is
 * addressed by path afterwards (blueprint B4).
 *
 * The codes are used to VALIDATE the resolution rather than to construct it:
 * see `validateResolvedFolder`.
 */

import type { PrincipalId, ProjectId, ReportRevisionId } from "./ids.js";
import type { SharePointDriveItemRef } from "./project.js";

/**
 * Path segments below the project folder. Configuration, not a constant, so a
 * change to the folder template does not require a release.
 */
export interface ArchiveConvention {
  readonly relativeSegments: readonly string[];
}

export const DEFAULT_ARCHIVE_CONVENTION: ArchiveConvention = {
  relativeSegments: ["04 - On-Site", "05 - Reports"],
};

export type ResolutionOutcome =
  /** The conventional folder already existed. */
  | { readonly kind: "found"; readonly target: SharePointDriveItemRef }
  /** It did not exist and was created once, at pin time. */
  | { readonly kind: "created"; readonly target: SharePointDriveItemRef }
  /** The anchor could not be resolved at all; filing must not proceed. */
  | { readonly kind: "unresolved"; readonly reason: string };

/**
 * Recorded so a later dispute about where something was filed can be answered
 * without guessing. Retains the anchor URL as evidence of what was resolved,
 * while the stored identifiers are what filing actually uses.
 */
export interface ArchiveResolution {
  readonly projectId: ProjectId;
  /** The `Documents` hyperlink as it stood when resolved. Evidence, not an address. */
  readonly anchorUrl: string;
  readonly anchor: SharePointDriveItemRef;
  /** Name of the folder the anchor resolved to, for the validation below. */
  readonly anchorFolderName: string;
  readonly convention: ArchiveConvention;
  readonly outcome: ResolutionOutcome;
  readonly resolvedAt: string;
  readonly resolvedBy: PrincipalId;
}

export function archiveTarget(resolution: ArchiveResolution): SharePointDriveItemRef | null {
  const { outcome } = resolution;
  return outcome.kind === "unresolved" ? null : outcome.target;
}

/**
 * Filing may only proceed against a resolved destination. An unresolved anchor
 * surfaces as a repairable error rather than a fallback guess at a path — a
 * wrong folder is worse than a visible failure, because nobody notices it.
 */
export function canFile(resolution: ArchiveResolution): boolean {
  return archiveTarget(resolution) !== null;
}

export type FolderValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Confirms the anchor points at the folder it should.
 *
 * Project folders are named `<project code> - <title>`, and Power Automate
 * guarantees a code on every project that reaches Active. So a hyperlink
 * resolving to a folder whose name does not start with this project's code is
 * evidence of a real problem — most often a link pasted from another project,
 * which would otherwise file this project's reports into someone else's folder
 * with no error at all.
 *
 * This is a check, never a fallback: a failure is reported for repair rather
 * than triggering a search for the "right" folder.
 */
export function validateResolvedFolder(
  folderName: string,
  projectNumber: string | undefined,
): FolderValidation {
  if (projectNumber === undefined || projectNumber.length === 0) {
    return {
      ok: false,
      reason:
        "Project has no project code. Codes are generated on creation, so an " +
        "active project without one indicates the generating flow did not complete.",
    };
  }
  if (!folderName.startsWith(projectNumber)) {
    return {
      ok: false,
      reason:
        `Linked folder "${folderName}" does not begin with project code ` +
        `"${projectNumber}". The Documents hyperlink may point at another project.`,
    };
  }
  return { ok: true };
}

/**
 * Characters SharePoint rejects in file and folder names, plus control
 * characters. `&` is legal and is deliberately kept: client names contain it
 * (C&AJ Marshall Builders Ltd) and stripping it would make filed documents
 * harder to recognise.
 */
// eslint-disable-next-line no-control-regex
const ILLEGAL_NAME_CHARS = /["*:<>?/\\|\u0000-\u001F]/g;

/**
 * SharePoint also rejects leading and trailing whitespace, names ending in a
 * period, and the literal names "." and "..".
 */
export function sanitiseFileName(raw: string): string {
  const cleaned = raw.replace(ILLEGAL_NAME_CHARS, "-").trim().replace(/\.+$/, "").trim();
  // A name of only separators is legal but meaningless, and reads as a bug in a
  // folder listing. Require at least one alphanumeric character.
  return /[a-z0-9]/i.test(cleaned) ? cleaned : "untitled";
}

/**
 * A filed document names its revision, so a correction sits alongside the
 * original rather than replacing it (decision AD-1). The revision suffix is
 * what makes "supersedes revision 1" visible in the folder as well as in the
 * document.
 */
export function archiveFileName(input: {
  readonly projectNumber: string;
  readonly reportNumber: string;
  readonly revision: number;
  readonly visitDate: string;
}): string {
  const parts = [
    sanitiseFileName(input.projectNumber),
    sanitiseFileName(input.reportNumber),
    input.visitDate,
    `Rev ${input.revision}`,
  ];
  return `${parts.join(" - ")}.pdf`;
}

/**
 * Deterministic identity for one filing attempt, so a retry after a lost
 * response finds and verifies the existing object instead of writing a second
 * copy (blueprint 0.6).
 */
export function archiveEffectTarget(revisionId: ReportRevisionId, fileName: string): string {
  return `${revisionId}:${fileName}`;
}
