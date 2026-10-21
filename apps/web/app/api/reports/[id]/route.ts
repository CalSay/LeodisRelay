import { NextResponse } from "next/server";
import { acknowledgeReport, correctReport, getReport, renameInspected, reviewSubmission, saveDraft, submitReport } from "@/lib/serverStore";
import { requireSession, visibleTo } from "@/lib/auth/guard";
import type { DraftSignature, Report } from "@/lib/types";
import { validateObservations } from '@/lib/validatePhotos';
import { invalidSignature } from '@/lib/validateSignature';
import { canManage, ownsReport } from '@/lib/auth/access';
import { IssueSyncError } from '@/lib/sharepoint/issues';
import { inspectedName, invalidShape, reportTypeOf } from '@/lib/reportTypes';

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
    signature?: DraftSignature | null;
  };
  // Casts do not validate. A malformed body must be refused rather than
  // reaching the store as undefined.
  if (!Array.isArray(body.observations)) {
    return NextResponse.json({ reason: "observations must be provided." }, { status: 422 });
  }

  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.requestId))) {
    return NextResponse.json({reason:'Invalid save request ID.'},{status:422});
  }
  const validation = await validateObservations(body.observations, id, existing.observations, existing.corrects);
  if (validation) return NextResponse.json({ reason: validation }, { status: 422 });
  const shape = invalidShape(existing, body.observations);
  if (shape) return NextResponse.json({ reason: shape }, { status: 422 });
  const signatureProblem = invalidSignature(body.signature);
  if (signatureProblem) return NextResponse.json({ reason: signatureProblem }, { status: 422 });

  // Absent leaves the saved signature alone (older clients); null clears it.
  const { draftSignature: saved, ...rest } = existing;
  const draftSignature = body.signature === undefined ? saved : body.signature;
  const outcome = saveDraft(
    id,
    { ...rest, observations: body.observations, ...(draftSignature ? { draftSignature } : {}) },
    body.expectedVersion,
    body.requestId,
  );
  // A lost race returns the draft as it now stands, to its author only, so
  // the two versions can be compared rather than one quietly replacing the other.
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason, ...(outcome.current ? { current: outcome.current } : {}) }, { status: outcome.status });
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
    action?: "review" | "correct" | "acknowledge" | "rename";
    inspected?: unknown;
    decision?: "approve" | "return";
    reviewer?: string;
    note?: string;
    reason?: string;
    signature?: { dataUrl?: string; name: string; typed?: true };
    expectedVersion?: number;
  };

  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const principal = guard.principal;
  if (body.action !== undefined && !['review','correct','acknowledge','rename'].includes(body.action)) return NextResponse.json({reason:'Unknown report action.'},{status:422});
  if (body.note !== undefined && typeof body.note !== 'string') return NextResponse.json({reason:'Review note must be text.'},{status:422});

  try {
  // The office has read it. A manager's act, recorded against the session.
  if (body.action === 'acknowledge') {
    if (!canManage(principal)) return NextResponse.json({reason:'Manager access required.'},{status:403});
    const outcome = acknowledgeReport(id, principal, body.note ?? '');
    return outcome.ok ? NextResponse.json(outcome.value) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
  }

  // The author renames what their draft inspection is about.
  if (body.action === 'rename') {
    const draft = getReport(id);
    if (!draft || !ownsReport(principal,draft)) return NextResponse.json({ reason: 'Only the author can rename what was inspected.' }, { status: 403 });
    const name = inspectedName(reportTypeOf(draft), body.inspected);
    if (!name.ok || name.value === undefined) return NextResponse.json({ reason: name.ok ? 'This report does not name one thing inspected.' : name.reason }, { status: 422 });
    const outcome = renameInspected(id, name.value);
    return outcome.ok ? NextResponse.json(outcome.value)
      : NextResponse.json({ reason: outcome.reason, ...(outcome.current ? { current: outcome.current } : {}) }, { status: outcome.status });
  }

  // A new revision, by the author, of a report already sent. The sent one is
  // never edited; the correction is a draft that supersedes it once sent.
  if (body.action === 'correct') {
    if (typeof body.reason !== 'string') return NextResponse.json({reason:'Say why this correction is needed.'},{status:422});
    const original = getReport(id);
    if (!original || !ownsReport(principal,original)) return NextResponse.json({ reason: 'Only the author can correct a report.' }, { status: 403 });
    const outcome = correctReport(id, body.reason);
    return outcome.ok ? NextResponse.json(outcome.value, { status: 201 }) : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
  }
  if (body.signature !== undefined && (!body.signature || typeof body.signature.name !== 'string' ||
      (body.signature.dataUrl !== undefined && (typeof body.signature.dataUrl !== 'string' ||
       body.signature.dataUrl.length > 1000000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.signature.dataUrl))) ||
      (body.signature.typed !== undefined && (body.signature.typed !== true || body.signature.dataUrl !== undefined)) ||
      Object.keys(body.signature).some(key => !['name','dataUrl','typed'].includes(key)))) {
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
    // A typed signature is the name as typed: never filled in for the person.
    body.signature ? { ...body.signature, name: body.signature.typed ? body.signature.name : body.signature.name || principal.name } : undefined,
    body.expectedVersion,
    principal.name,
  );
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
  } catch (error) {
    if (error instanceof IssueSyncError) return NextResponse.json({ reason: error.message }, { status: 409 });
    throw error;
  }
}

