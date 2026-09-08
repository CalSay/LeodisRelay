import { NextResponse } from "next/server";
import type { Principal } from "@relay/platform";

import { currentPrincipal } from "./session";
import type { Report } from "../types";
import { canReadReport } from './access';

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
 * Full draft content belongs to its stable author ID until it is sent. Other
 * Managers/Admin get allowlisted summaries through reportsFor, never a redacted
 * full record here. All three roles have all-project access in the pilot.
 */
export function visibleTo(principal: Principal, report: Report): Report | null {
  return canReadReport(principal,report) ? report : null;
}

export function redactDrafts(principal: Principal, reports: readonly Report[]): Report[] {
  return reports
    .map((report) => visibleTo(principal, report))
    .filter((report): report is Report => report !== null);
}
