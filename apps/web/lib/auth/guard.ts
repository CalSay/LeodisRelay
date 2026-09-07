import { NextResponse } from "next/server";
import type { Principal } from "@relay/platform";

import { currentPrincipal } from "./session";
import type { Report } from "../types";

/**
 * The single place a route establishes who is asking.
 *
 * Middleware checks that a session cookie exists so signed-out people are sent
 * to sign in. That is a routing convenience and nothing more: any value in the
 * cookie satisfies it. Every route must therefore resolve the session itself,
 * against the store, before returning anything.
 *
 * This was got wrong. Read routes relied on middleware alone, so a forged
 * cookie returned fifteen reports and six drafts. The lesson is not "add a
 * check to those routes" but "make the check the only way to reach a
 * handler" — hence a guard that returns the principal or the refusal, so
 * forgetting it is a type error rather than a silent hole.
 */

export type Guarded<T> =
  | { readonly ok: true; readonly principal: Principal }
  | { readonly ok: false; readonly response: NextResponse<T | { reason: string }> };

export async function requireSession<T = unknown>(): Promise<Guarded<T>> {
  const principal = await currentPrincipal();
  if (!principal) {
    return {
      ok: false,
      response: NextResponse.json({ reason: "Please sign in again." }, { status: 401 }),
    };
  }
  return { ok: true, principal };
}

/**
 * What a person may see of a draft.
 *
 * The office view deliberately returns draft existence without content
 * (decision Q2). That split is worthless if the ordinary report endpoints hand
 * the same drafts over in full, which they did — so it is enforced here, on the
 * records themselves, rather than by which endpoint happened to be called.
 *
 * A draft belongs to its author until it is sent. Submitted reports are visible
 * to any signed-in member of staff, which is as far as this can go until there
 * is a project grants model; per-project access is a separate piece of work and
 * is not pretended at here.
 */
export function visibleTo(principal: Principal, report: Report): Report | null {
  if (report.state === "submitted") return report;
  if (report.author === principal.name) return report;

  // Existence, not content: enough for the office to know work is in progress.
  return {
    ...report,
    observations: [],
    ...(report.signature ? { signature: { name: "", signedAt: report.signature.signedAt } } : {}),
  };
}

export function redactDrafts(principal: Principal, reports: readonly Report[]): Report[] {
  return reports
    .map((report) => visibleTo(principal, report))
    .filter((report): report is Report => report !== null);
}
