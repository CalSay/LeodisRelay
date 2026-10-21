import { NextResponse } from "next/server";
import { safeReturnTo, stateMatches } from "@relay/platform";

import { resolveProvider } from "@/lib/auth/provider";
import { createSession, takeSignInState } from "@/lib/auth/session";
import { SignInRefused, signInErrorPath } from "@/lib/auth/signInErrors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = (path:string) => new NextResponse(null,{status:307,headers:{location:path}});

  // Microsoft's own words are not repeated: anyone can put any text in this
  // address. Only its AADSTS number is passed on (signInErrors.ts).
  if (url.searchParams.has("error")) {
    return redirect(signInErrorPath("microsoft", url.searchParams.get("error_description")));
  }

  const { state: expected, returnTo } = await takeSignInState();
  const actual = url.searchParams.get("state") ?? undefined;

  // Checked before the code is exchanged: a callback that fails this did not
  // come from a sign-in this browser started.
  if (!stateMatches(expected, actual)) {
    return redirect(signInErrorPath("expired"));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirect(signInErrorPath("no-code"));
  }

  try {
    const { provider } = resolveProvider();
    await createSession(await provider.complete({ code }));
  } catch (e) {
    // The screen says only that it failed; the server log keeps why, for whoever looks after RELAY.
    if (!(e instanceof SignInRefused)) console.error("Sign-in failed:", e instanceof Error ? e.message : e);
    return redirect(signInErrorPath(e instanceof SignInRefused ? e.code : "failed"));
  }

  return redirect(safeReturnTo(returnTo));
}
