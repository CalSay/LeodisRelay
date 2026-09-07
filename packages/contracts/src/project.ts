/**
 * Project identity and its SharePoint mapping.
 *
 * Decision DP-1. SharePoint is master for project reference data because the
 * office monitors projects there (CI-2). The application therefore holds a
 * permanent Relay id of its own, plus an immutable record of the source identity
 * as it stood at first use, plus a CURRENT mapping that may legitimately change
 * when the office moves a list or library.
 *
 * The distinction that matters: `origin` never changes, so a report can always
 * render its own project context even if the source record is deleted. `mapping`
 * may be re-pointed under audit, so a genuine move does not have to masquerade
 * as a new project.
 */

import type { ClientId, PrincipalId, ProjectId } from "./ids.js";

/** Where a SharePoint list item lives. Item ids are only unique within a list. */
export interface SharePointListItemRef {
  readonly siteId: string;
  readonly listId: string;
  readonly itemId: string;
}

/**
 * Where a file is filed. Drive item ids survive moves and renames within a
 * drive, so both parts are stored — an item id alone is not addressable.
 */
export interface SharePointDriveItemRef {
  readonly driveId: string;
  readonly itemId: string;
}

/**
 * Which Leodis company a project belongs to.
 *
 * This is the company authorisation boundary (blueprint 0.8). It is NOT a
 * column on the project item: it is determined by which source list the project
 * came from. The Operations site's project list belongs to Leodis Developments;
 * Compliance Management will have its own source when it is introduced.
 *
 * Deriving company from configured source rather than from item content means a
 * mis-keyed field can never widen access across companies.
 */
export type Company = "leodis-developments" | "leodis-compliance-management";

/**
 * Operating division within a company.
 *
 * Sourced from the project list's required `Trading Name` choice column —
 * currently Leodis M&E and Leodis Commercial Plumbing, both within Leodis
 * Developments.
 *
 * This is a business attribute, not a permission boundary. It is used for
 * filtering and sensible defaults in the interface. Do not build access control
 * on it unless Leodis asks for engineers to be siloed by division: that would
 * add a permission dimension needing ongoing maintenance, and it is easy to add
 * later and awkward to remove.
 */
export type Division = string;

/** Captured once, at first use. Never rewritten. */
export interface ProjectOrigin {
  readonly source: SharePointListItemRef;
  /**
   * Display values as they stood at pin time, mapped to the project list
   * columns. `Project Number` is not a required column, so it may be absent and
   * cannot be used as a key.
   */
  readonly snapshot: {
    /** `Title` — required. */
    readonly projectName: string;
    /**
     * `Project Number`. Not flagged Required on the list because Power Automate
     * populates it after item creation, not because it is optional in practice.
     * Leodis confirm no project reaches Active without one.
     *
     * Optional here only to represent the window between item creation and the
     * generating flow completing. Code that needs it uses `requireProjectCode`
     * rather than assuming presence.
     */
    readonly projectNumber?: string;
    /** Resolved through the `Client` lookup. */
    readonly clientName: string;
    /** `Trading Name` — required; the operating division. */
    readonly division: Division;
  };
  /**
   * The `Client` lookup item id. The lookup is required on the project list, so
   * this is always present: the SharePoint client list is the client identity
   * registry even though it carries almost no attributes of its own (D1).
   */
  readonly clientLookupItemId: string;
  /**
   * `Client: Account Number`, projected through the lookup. The accounting
   * reference recommended in D1 already exists in the source and is read rather
   * than separately maintained.
   */
  readonly clientAccountNumber?: string;
  /** `Project Manager` — a Person or Group column, resolved to a principal. */
  readonly projectManager?: PrincipalId;
  readonly pinnedAt: string;
  readonly pinnedBy: PrincipalId;
}

/** May be re-pointed when the office legitimately moves a list or library. */
export interface ProjectMapping {
  readonly version: number;
  readonly source: SharePointListItemRef;
  readonly archiveDestination: SharePointDriveItemRef;
  readonly effectiveFrom: string;
  readonly changedBy: PrincipalId;
  readonly reason: string;
}

export type SourceState = "active" | "stale" | "tombstoned";

export interface Project {
  readonly id: ProjectId;
  /** Derived from the configured source list, never from item content. */
  readonly company: Company;
  /** Pinned to the SharePoint client lookup item; see `client.ts`. */
  readonly clientId: ClientId;
  readonly origin: ProjectOrigin;
  readonly mapping: ProjectMapping;
  /** Refreshed from source; never rewrites `origin.snapshot`. */
  readonly currentDisplay: {
    readonly projectName: string;
    readonly projectNumber?: string;
    readonly division: Division;
    /** `Status` choice value as it currently stands in the source list. */
    readonly status: string;
    readonly refreshedAt: string;
  };
  readonly sourceState: SourceState;
}

/**
 * The project code, where the guarantee holds.
 *
 * Returns null rather than throwing, so a caller can surface a missing code as
 * a data anomaly for repair. An active project without a code means the
 * generating flow did not complete — that is worth reporting, not crashing on
 * and not quietly working around.
 */
export function projectCode(project: Project): string | null {
  const code = project.currentDisplay.projectNumber ?? project.origin.snapshot.projectNumber;
  return code !== undefined && code.length > 0 ? code : null;
}

/**
 * Status values that represent work Relay may report against.
 *
 * The project list also carries Probability, Contract Value, Cost of Work and
 * Submission Deadline, so it tracks tenders as well as live work. An engineer
 * must never be offered a bid to report against, so reportability is an
 * explicit allow-list rather than an assumption that every list item is live.
 *
 * An unrecognised status is not reportable. New statuses added to the source
 * list therefore fail closed, which is the safe direction: a project that should
 * be reportable and is not gets noticed immediately, whereas a tender that
 * becomes reportable by accident may not.
 */
export interface ReportableStatusPolicy {
  readonly allowed: readonly string[];
}

/**
 * Confirmed with Leodis: only these two statuses carry site work. Defects
 * liability is included because rectification work continues through it, which
 * is exactly when the defect and snagging workflows are in use.
 */
export const DEFAULT_REPORTABLE_STATUSES: ReportableStatusPolicy = {
  allowed: ["4. Active", "5. Defects Liability"],
};

/**
 * Reportability also requires a project code, because filing depends on it:
 * the archive folder check in `archive.ts` matches the linked folder against
 * this code, and without one a report cannot be filed to a verified
 * destination. Since no project reaches Active without a code, a reportable
 * project missing one is an anomaly rather than a normal state.
 */
export function isReportable(project: Project, policy: ReportableStatusPolicy): boolean {
  return (
    project.sourceState !== "tombstoned" &&
    policy.allowed.includes(project.currentDisplay.status) &&
    projectCode(project) !== null
  );
}

/**
 * Display values follow the source while it is reachable; once the source is
 * gone, the pinned snapshot is what remains. A tombstoned project still renders
 * rather than becoming an orphan — that is the whole point of pinning.
 */
export function resolveDisplayName(project: Project): string {
  return project.sourceState === "tombstoned"
    ? project.origin.snapshot.projectName
    : project.currentDisplay.projectName;
}

/** A remap is only meaningful if it actually points somewhere new. */
export function isRemap(current: ProjectMapping, next: SharePointListItemRef): boolean {
  return (
    current.source.siteId !== next.siteId ||
    current.source.listId !== next.listId ||
    current.source.itemId !== next.itemId
  );
}
