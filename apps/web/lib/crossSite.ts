const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * A change (any POST, PUT or DELETE) must come from RELAY's own pages.
 *
 * The session cookie is SameSite=Lax, so another site's form cannot carry it.
 * This is the second lock: a page on another site, or on another address under
 * the same domain, that tries to post to RELAY with a signed-in person's
 * browser is refused before any route reads the body. Requests without these
 * headers (scripts, older browsers) are left to the cookie, as before.
 */
export function crossSiteChange(request: { method: string; headers: Headers }): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  // The browser's own word on where the request came from, when it gives one.
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  // Behind Caddy the address people used is the forwarded host.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]!.trim();
  try { return !host || new URL(origin).host !== host; } catch { return true; }
}
