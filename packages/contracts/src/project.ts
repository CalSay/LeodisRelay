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
 * Which Leodis company owns a project.
 *
 * Sourced from the project list's required `Trading Name` choice column. This
 * is the company authorisation boundary (blueprint 0.8): it decides who may see
 * a project at all, so it is read from the source rather than inferred.
 */
export type TradingName = string;

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
    /** `Project Number` — optional in the source, so optional here. */
    readonly projectNumber?: string;
    /** Resolved through the `Client` lookup. */
    readonly clientName: string;
    /** `Trading Name` — required; the owning Leodis company. */
    readonly tradingName: TradingName;
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
  /**
   * Relay's own client record, pinned to the SharePoint client lookup item.
   * SharePoint owns which clients exist; Relay owns the attributes the
   * application needs, because the source list carries almost none (D1).
   */
  readonly clientId: ClientId;
  readonly origin: ProjectOrigin;
  readonly mapping: ProjectMapping;
  /** Refreshed from source; never rewrites `origin.snapshot`. */
  readonly currentDisplay: {
    readonly projectName: string;
    readonly projectNumber?: string;
    readonly tradingName: TradingName;
    /** `Status` choice value as it currently stands in the source list. */
    readonly status: string;
    readonly refreshedAt: string;
  };
  readonly sourceState: SourceState;
}

/**
 * Status values that represent work Relay may report against.
 *
 * The project list also carries Probability, Contract Value, Cost of Work and
 * Submission Deadline, which means it tracks opportunities and tenders as well
 * as live projects. An engineer must not be offered a bid to report against, so
 * reportability is an explicit allow-list of Status values rather than an
 * assumption that every list item is a live project.
 *
 * Populated from the source list's actual choice values during setup; an
 * unrecognised status is treated as not reportable rather than defaulting open.
 */
export interface ReportableStatusPolicy {
  readonly allowed: readonly string[];
}

export function isReportable(project: Project, policy: ReportableStatusPolicy): boolean {
  return (
    project.sourceState !== "tombstoned" &&
    policy.allowed.includes(project.currentDisplay.status)
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
