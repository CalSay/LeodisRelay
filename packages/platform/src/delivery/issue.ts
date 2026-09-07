/**
 * Issuing a report.
 *
 * Distribution is the last step of the document pipeline and the only one with
 * an effect outside Leodis, so the rules about when it may happen live here and
 * are tested, rather than being implied by the order of some calls.
 *
 * Proposal 6.2 requires the recipient, method, time and issued revision to be
 * recorded. That is not paperwork: without it there is no answer to "who has
 * this, and which version did they get" when a client acts on an old figure.
 */

import type { ReportRevisionId } from "@relay/contracts";

export type DeliveryMethod = "email" | "filed";

export interface Recipient {
  readonly name: string;
  readonly address: string;
  readonly role: "project_manager" | "client_contact" | "other";
}

export interface IssueRecord {
  readonly revisionId: ReportRevisionId;
  readonly revision: number;
  readonly method: DeliveryMethod;
  readonly recipient: Recipient;
  readonly at: string;
  /** Set when delivery failed; the record is kept either way. */
  readonly failure?: string;
}

export type IssueDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export interface IssuePrecondition {
  readonly approved: boolean;
  readonly documentFiled: boolean;
  readonly superseded: boolean;
}

/**
 * Whether a report may be sent.
 *
 * Approval is the gate. A report that has been rendered is not a report that
 * anyone has agreed to send, and the entire review step exists to put a person
 * between capture and distribution.
 *
 * Filing comes before sending so that what a recipient receives is the same
 * artefact the archive holds. Sending first would leave a copy in the world
 * that Leodis cannot produce on request.
 */
export function canIssue(pre: IssuePrecondition): IssueDecision {
  if (!pre.approved) {
    return { ok: false, reason: "This report has not been approved for issue." };
  }
  if (pre.superseded) {
    return { ok: false, reason: "This revision has been superseded. Issue the current one." };
  }
  if (!pre.documentFiled) {
    return {
      ok: false,
      reason: "The document has not been filed yet. It is filed before it is sent.",
    };
  }
  return { ok: true };
}

/**
 * Deterministic key for one delivery.
 *
 * Keyed on the revision, the method and the address, so a retry after a lost
 * response finds the existing record instead of sending a second copy — and so
 * a genuinely new revision to the same person is a different delivery rather
 * than a duplicate.
 */
export function deliveryKey(
  revisionId: ReportRevisionId,
  method: DeliveryMethod,
  address: string,
): string {
  return `${revisionId}:${method}:${address.trim().toLowerCase()}`;
}

/** Whether this exact delivery has already happened successfully. */
export function alreadyDelivered(
  records: readonly IssueRecord[],
  revisionId: ReportRevisionId,
  method: DeliveryMethod,
  address: string,
): boolean {
  const key = deliveryKey(revisionId, method, address);
  return records.some(
    (r) => r.failure === undefined && deliveryKey(r.revisionId, r.method, r.recipient.address) === key,
  );
}

/**
 * Who a report goes to.
 *
 * Recipients without an address are dropped rather than guessed at. A project
 * manager recorded only as a name is a gap in the source data, and inventing
 * an address from it would send a client's report to whoever happens to own
 * that mailbox.
 */
export function resolveRecipients(candidates: readonly Partial<Recipient>[]): {
  readonly send: readonly Recipient[];
  readonly unaddressed: readonly string[];
} {
  const send: Recipient[] = [];
  const unaddressed: string[] = [];

  for (const candidate of candidates) {
    const address = candidate.address?.trim();
    const name = candidate.name?.trim();
    if (!name) continue;
    if (!address || !address.includes("@")) {
      unaddressed.push(name);
      continue;
    }
    send.push({ name, address, role: candidate.role ?? "other" });
  }

  return { send, unaddressed };
}
