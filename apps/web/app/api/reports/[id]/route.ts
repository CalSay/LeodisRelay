import { NextResponse } from "next/server";
import { getReport, reviewSubmission, saveDraft, submitReport } from "@/lib/serverStore";
import { requireSession, visibleTo } from "@/lib/auth/guard";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const report = getReport(id);
  if (!report) return NextResponse.json({ reason: "No such report." }, { status: 404 });
  return NextResponse.json(visibleTo(guard.principal, report));
}

/** Save a draft. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const existing = getReport(id);
  if (!existing) return NextResponse.json({ reason: "No such report." }, { status: 404 });
  // Only the author edits their draft. Without this, any signed-in person can
  // overwrite anyone's work in progress.
  if (existing.author !== guard.principal.name) {
    return NextResponse.json({ reason: "This draft belongs to someone else." }, { status: 403 });
  }

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

  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;

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

  const outcome = await submitReport(
    id,
    body.signature ? { ...body.signature, name: body.signature.name || principal.name } : undefined,
  );
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
