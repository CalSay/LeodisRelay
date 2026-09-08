import { NextResponse } from "next/server";
import { getReport, reviewSubmission, saveDraft, submitReport } from "@/lib/serverStore";
import { requireSession, visibleTo } from "@/lib/auth/guard";
import type { Report } from "@/lib/types";
import { validateObservations } from '@/lib/validatePhotos';
import { canManage, ownsReport } from '@/lib/auth/access';

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const report = getReport(id);
  if (!report) return NextResponse.json({ reason: "No such report." }, { status: 404 });
  const visible = visibleTo(guard.principal, report);
  return visible ? NextResponse.json(visible) : NextResponse.json({reason:'This draft is private to its author.'},{status:403});
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
  if (!ownsReport(guard.principal,existing)) {
    return NextResponse.json({ reason: "This draft belongs to someone else." }, { status: 403 });
  }

  const body = (await request.json()) as {
    observations?: Report["observations"];
    expectedVersion?: number;
    requestId?: string;
  };
  // Casts do not validate. A malformed body must be refused rather than
  // reaching the store as undefined.
  if (!Array.isArray(body.observations)) {
    return NextResponse.json({ reason: "observations must be provided." }, { status: 422 });
  }

  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.requestId))) {
    return NextResponse.json({reason:'Invalid save request ID.'},{status:422});
  }
  const validation = await validateObservations(body.observations, id, existing.observations);
  if (validation) return NextResponse.json({ reason: validation }, { status: 422 });

  const outcome = saveDraft(
    id,
    { ...existing, observations: body.observations },
    body.expectedVersion,
    body.requestId,
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
    expectedVersion?: number;
  };

  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;
  if (body.action !== undefined && body.action !== 'review') return NextResponse.json({reason:'Unknown report action.'},{status:422});
  if (body.note !== undefined && typeof body.note !== 'string') return NextResponse.json({reason:'Review note must be text.'},{status:422});
  if (body.signature !== undefined && (!body.signature || typeof body.signature.name !== 'string' ||
      (body.signature.dataUrl !== undefined && (typeof body.signature.dataUrl !== 'string' ||
       body.signature.dataUrl.length > 1000000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.signature.dataUrl))))) {
    return NextResponse.json({reason:'Invalid signature.'},{status:422});
  }

  if (body.action === "review") {
    if (!canManage(principal)) return NextResponse.json({reason:'Manager access required.'},{status:403});
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
      principal.id,
    );
    return outcome.ok
      ? NextResponse.json(outcome.value)
      : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
  }

  const existing = getReport(id);
  if (!existing || !ownsReport(principal,existing)) {
    return NextResponse.json({ reason: 'This report belongs to someone else.' }, { status: 403 });
  }
  const outcome = await submitReport(
    id,
    body.signature ? { ...body.signature, name: body.signature.name || principal.name } : undefined,
    body.expectedVersion,
  );
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
