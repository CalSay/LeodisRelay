import { NextResponse, type NextRequest } from "next/server";
import { crossSiteChange } from "./lib/crossSite";
import { COMPANY_COOKIE } from "./lib/company";
import { ICON_LAUNCH_COOKIE, ICON_LAUNCH_SECONDS, isIconLaunch } from "./lib/homeScreen";

/**
 * Require a session for everything except sign-in itself.
 *
 * Only the presence of the cookie is checked here — middleware runs on the edge
 * runtime and cannot read the session store. That is deliberate and not a gap:
 * this exists to redirect signed-out people to the sign-in screen, while the
 * routes themselves establish who the person actually is. A cookie is a hint;
 * it is never taken as proof.
 */
// The container health probe has no session and must not be redirected to one.
const PUBLIC = ["/signin", "/api/auth", "/api/health"];

export function middleware(request: NextRequest) {
  const response = route(request);
  // Opened from the home screen icon: the page that shows next checks whether
  // it is full screen (lib/homeScreen.ts, components/IconOpensBrowser.tsx).
  if (isIconLaunch(request.nextUrl.pathname, request.nextUrl.searchParams)) {
    response.cookies.set(ICON_LAUNCH_COOKIE, '1', { path: '/', sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: ICON_LAUNCH_SECONDS });
  }
  return response;
}

function route(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (crossSiteChange(request)) {
    // The code lets RELAY's own screens say it in their words (lib/failure.ts); the refusal itself is unchanged.
    return NextResponse.json({ reason: "This change did not come from RELAY, so it was not made.", code: "cross-site" }, { status: 403 });
  }
  if (['/sw.js', '/offline.html', '/offline.js', '/manifest.webmanifest', '/icon', '/icon-192', '/apple-icon'].includes(pathname)) return NextResponse.next();
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (request.cookies.get("relay_session")) {
    // The company picked on the hub, so RELAY's home screen icon (start_url
    // "/?open=app", app/manifest.ts) opens it next time without asking again.
    // Navigation only: each workspace still checks who the person is. A link
    // prefetching the page is not a pick.
    if ((pathname === '/developments' || pathname === '/compliance') && !request.headers.has('next-router-prefetch')) {
      const response = NextResponse.next();
      response.cookies.set(COMPANY_COOKIE, pathname.slice(1), { path: '/', sameSite: 'lax', httpOnly: true, secure: request.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 24 * 400 });
      return response;
    }
    return NextResponse.next();
  }

  // An API call gets a status it can act on; a page gets sent to sign in.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ reason: "Please sign in again." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/signin';
  url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets and the icon are excluded; everything else passes through.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
