import { NextResponse } from "next/server";
import { getReport, reviewSubmission, saveDraft, submitReport } from "@/lib/serverStore";
import { currentPrincipal } from "@/lib/auth/session";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = getReport(id);
  return report
    ? NextResponse.json(report)
    : NextResponse.json({ reason: "No such report." }, { status: 404 });
}

/** Save a draft. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incoming = (await request.json()) as Report;
  const outcome = saveDraft(id, incoming);
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}

/**
 * Send to office, or record a review decision on it.
 *
 * Both are POSTs to the same resource because both are acts upon the report
 * rather than edits of it; the body distinguishes them.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "review";
    decision?: "approve" | "return";
    reviewer?: string;
    note?: string;
    signature?: { dataUrl?: string; name: string };
  };

  const principal = await currentPrincipal();
  if (!principal) {
    return NextResponse.json({ reason: "Please sign in again." }, { status: 401 });
  }

  if (body.action === "review") {
    const outcome = reviewSubmission(
      id,
      body.decision === "return" ? "return" : "approve",
      // The reviewer is whoever is signed in. Letting the client name the
      // reviewer would make "you cannot review your own report" a suggestion.
      principal.name,
      body.note ?? "",
    );
    return outcome.ok
      ? NextResponse.json(outcome.value)
      : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
  }

  const outcome = submitReport(
    id,
    body.signature ? { ...body.signature, name: body.signature.name || principal.name } : undefined,
  );
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
