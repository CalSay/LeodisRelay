import { NextResponse, type NextRequest } from "next/server";

/**
 * Require a session for everything except sign-in itself.
 *
 * Only the presence of the cookie is checked here — middleware runs on the edge
 * runtime and cannot read the session store. That is deliberate and not a gap:
 * this exists to redirect signed-out people to the sign-in screen, while the
 * routes themselves establish who the person actually is. A cookie is a hint;
 * it is never taken as proof.
 */
const PUBLIC = ["/signin", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (request.cookies.get("relay_session")) return NextResponse.next();

  // An API call gets a status it can act on; a page gets sent to sign in.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ reason: "Please sign in again." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets and the icon are excluded; everything else passes through.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
