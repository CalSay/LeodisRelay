/**
 * Client identity.
 *
 * Decision D1, revised twice against the actual source. The SharePoint "Client
 * Database" list on the Operations site is a required lookup target from the
 * project list, so it cannot be retired and every project already carries a
 * stable client item id.
 *
 * It also carries more than was first thought: account number, three contact
 * fields and two email addresses. Relay therefore does NOT hold a duplicate set
 * of client attributes — that would create exactly the divergence D1 set out to
 * avoid. Relay holds a durable id and a display cache, and reads the rest.
 *
 * Ownership split:
 *   SharePoint  which clients exist, their identity, contacts and account number
 *   Relay       a permanent id that survives source deletion, plus a cache
 */

import type { ClientId, PrincipalId } from "./ids.js";
import type { SharePointListItemRef } from "./project.js";

/**
 * Fields read from the client list. Nothing on that list is a required column,
 * including Title, so every field here is optional and the application must
 * render sensibly when they are absent rather than assuming a name exists.
 */
export interface ClientSourceFields {
  /** `Title`. Not a required column in the source. */
  readonly name?: string;
  /** `Account Number` — the finance reference. */
  readonly accountNumber?: string;
  readonly mainContact?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly accountsContact?: string;
  readonly accountsEmail?: string;
}

/**
 * Office-maintained metrics on the client list that Relay must never write.
 *
 * `Project Count` and `Lifetime Contracts Value` are the office's own figures.
 * Relay could compute something similar from its own records, and those two
 * numbers would then disagree. Read them for display if useful; do not treat
 * them as authoritative and do not update them.
 */
export const OFFICE_MAINTAINED_CLIENT_FIELDS = [
  "Project Count",
  "Lifetime Contracts Value",
] as const;

export interface Client {
  readonly id: ClientId;
  /** Captured once at first use; never rewritten. */
  readonly origin: {
    readonly source: SharePointListItemRef;
    readonly snapshot: ClientSourceFields;
    readonly pinnedAt: string;
    readonly pinnedBy: PrincipalId;
  };
  /** Refreshed from source; never rewrites `origin.snapshot`. */
  readonly current: ClientSourceFields & { readonly refreshedAt: string };
  readonly sourceState: "active" | "stale" | "tombstoned";
}

/**
 * A client with no Title in the source still has to be identifiable in a list,
 * a report header and an audit entry. Fall back through what exists rather than
 * rendering an empty string, and never invent a name.
 */
export function resolveClientLabel(client: Client): string {
  const source = client.sourceState === "tombstoned" ? client.origin.snapshot : client.current;
  return (
    source.name ??
    source.accountNumber ??
    `Client ${client.origin.source.itemId} (unnamed in source)`
  );
}

/** Relay never writes to the client list; every mutation path is read-only. */
export function isWritableBySystem(): false {
  return false;
}
