import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST, not GET. A sign-out reachable by navigation can be triggered by any
 * page that embeds a link or an image pointing at it.
 */
export async function POST(request: Request) {
  await endSession();
  return NextResponse.redirect(`${new URL(request.url).origin}/signin`, { status: 303 });
}
