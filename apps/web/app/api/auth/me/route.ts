import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/auth/provider";
import { currentPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const principal = await currentPrincipal();
  const { provider, missing } = resolveProvider();
  return NextResponse.json({
    principal,
    // Reported so the interface can say plainly whether identity was checked.
    authKind: provider.kind,
    missingSettings: missing,
  });
}
