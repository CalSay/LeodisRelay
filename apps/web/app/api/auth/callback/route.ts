import { NextResponse } from "next/server";
import { safeReturnTo, stateMatches } from "@relay/platform";

import { resolveProvider } from "@/lib/auth/provider";
import { createSession, takeSignInState } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(error)}`);
  }

  const { state: expected, returnTo } = await takeSignInState();
  const actual = url.searchParams.get("state") ?? undefined;

  // Checked before the code is exchanged: a callback that fails this did not
  // come from a sign-in this browser started.
  if (!stateMatches(expected, actual)) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent("That sign-in link has expired. Please try again.")}`,
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent("Microsoft did not return a sign-in code.")}`,
    );
  }

  try {
    const { provider } = resolveProvider();
    await createSession(await provider.complete({ code }));
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Sign-in could not be completed.";
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(reason)}`);
  }

  return NextResponse.redirect(`${origin}${safeReturnTo(returnTo)}`);
}
