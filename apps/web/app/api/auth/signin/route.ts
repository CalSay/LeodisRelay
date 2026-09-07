import { NextResponse } from "next/server";
import { safeReturnTo } from "@relay/platform";

import { resolveProvider } from "@/lib/auth/provider";
import { beginSignIn, newState } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Attacker-supplied by definition, so it is narrowed to an in-app path.
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  const { provider } = resolveProvider();
  const state = newState();
  await beginSignIn(state, returnTo);

  const target = await provider.authorizeUrl({ state, returnTo });
  // The local provider returns an in-app path; Entra returns an absolute URL.
  // Resolving against this request's origin handles both without the caller
  // needing to know which provider it got.
  // Keep local navigation on the address the phone used, not Next's bind address.
  if (provider.kind === 'local') return new NextResponse(null,{status:307,headers:{location:target}});
  return NextResponse.redirect(new URL(target, url.origin));
}
