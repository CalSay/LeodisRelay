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

/** Captured once, at first use. Never rewritten. */
export interface ProjectOrigin {
  readonly source: SharePointListItemRef;
  /** Display values as they stood at pin time; used for historic rendering. */
  readonly snapshot: {
    readonly projectCode: string;
    readonly projectName: string;
    readonly clientName: string;
  };
  /**
   * Lookup item id, where the project list references the client list through a
   * lookup column. The client list currently holds no data (decision D1), so
   * this is captured only to preserve the option of mapping later.
   */
  readonly clientLookupItemId?: string;
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
  /** Relay owns the client record; SharePoint's client list is not a source (D1). */
  readonly clientId: ClientId;
  readonly origin: ProjectOrigin;
  readonly mapping: ProjectMapping;
  /** Refreshed from source; never rewrites `origin.snapshot`. */
  readonly currentDisplay: {
    readonly projectCode: string;
    readonly projectName: string;
    readonly refreshedAt: string;
  };
  readonly sourceState: SourceState;
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
