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

  const body = (await request.json()) as {
    observations?: Report["observations"];
    expectedVersion?: number;
  };
  // Casts do not validate. A malformed body must be refused rather than
  // reaching the store as undefined.
  if (!Array.isArray(body.observations)) {
    return NextResponse.json({ reason: "observations must be provided." }, { status: 422 });
  }

  const outcome = saveDraft(
    id,
    { ...existing, observations: body.observations },
    body.expectedVersion,
  );
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
      // Passed through unchanged. Coercing anything that is not "return" into
      // "approve" meant a malformed decision approved the report before the
      // domain rule could refuse it — the adapter undoing the rule again.
      body.decision ?? "",
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
