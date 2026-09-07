import { NextResponse } from "next/server";
import { safeReturnTo, stateMatches } from "@relay/platform";

import { resolveProvider } from "@/lib/auth/provider";
import { createSession, takeSignInState } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = (path:string) => new NextResponse(null,{status:307,headers:{location:path}});

  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) {
    return redirect(`/signin?error=${encodeURIComponent(error)}`);
  }

  const { state: expected, returnTo } = await takeSignInState();
  const actual = url.searchParams.get("state") ?? undefined;

  // Checked before the code is exchanged: a callback that fails this did not
  // come from a sign-in this browser started.
  if (!stateMatches(expected, actual)) {
    return redirect(
      `/signin?error=${encodeURIComponent("That sign-in link has expired. Please try again.")}`,
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirect(
      `/signin?error=${encodeURIComponent("Microsoft did not return a sign-in code.")}`,
    );
  }

  try {
    const { provider } = resolveProvider();
    await createSession(await provider.complete({ code }));
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Sign-in could not be completed.";
    return redirect(`/signin?error=${encodeURIComponent(reason)}`);
  }

  return redirect(safeReturnTo(returnTo));
}
