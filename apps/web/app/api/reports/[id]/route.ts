import { NextResponse } from "next/server";
import { getReport, saveDraft, submitReport } from "@/lib/serverStore";
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

/** Send to office. Separate verb from saving, because they are separate acts. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const outcome = submitReport(id);
  return outcome.ok
    ? NextResponse.json(outcome.value)
    : NextResponse.json({ reason: outcome.reason }, { status: outcome.status });
}
