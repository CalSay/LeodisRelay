# Security and permissions review — 21 October 2026

A review of `main` at ff78ec4 (PRs #2–#71, none deployed yet) before RELAY's
first deploy. Done by Claude by reading the code and testing it against a
local production build. Not tested: a live Entra tenant, live SharePoint, a
real phone, or the live server behind Caddy.

## Summary

Nothing found lets a signed-in person see or change what their role should not.
Two real problems were found and fixed: the sign-in return address could send
someone to another site, and the sign-in screen showed any text a link put in
it. Four smaller hardening changes were made, and the Next.js and sharp
packages were updated to patched versions.

## What was checked

### Sign-in and roles

- All 35 API routes were read. Every one except sign-in itself and the health
  probe resolves the session against the store (`requireSession`) before doing
  anything; the middleware cookie check is only a redirect.
- Office-only routes (office report list, company issues and chases, site
  coverage, team, spreadsheet export) check `canManage`; Admin routes check
  `isAdmin`. Issue and variation commands are checked per command
  (`canIssueCommand`, `canVariationCommand`): engineers can add progress, ask
  for closure and add notes; verifying, confirming, assigning, pricing and
  instructing are office acts.
- Drafts: only the author reads, edits, signs, renames, corrects or sends
  their own. Every page that gathers reports (search, weekly summary, site
  diary, since last visit, my week, photo library, before handover, safety
  actions, site coverage, suggestions) filters with `canReadReport` or uses
  sent reports only. The office sees a draft exists, not what it says.
- Report, issue and variation ids from the browser are always looked up and
  checked against the person and the project; authorship, reviewer and actor
  always come from the session, never the request.
- Every role can open every project. That is the pilot's decision
  (`canAccessProject`), not a gap; if access is ever narrowed per project, the
  one function to change is `lib/auth/access.ts`, and chase notes (kept per
  company, not per project) would need another look.
- Sign-in: state is checked once and thrown away, the session cookie is
  random, `HttpOnly`, `Secure` in production and `SameSite=Lax`, sessions end
  on the server at sign-out, and local sign-in refuses to run in production
  unless deliberately allowed.

### Free text shown back to people

- No page writes HTML from data: the only `dangerouslySetInnerHTML` is the
  fixed theme script, and the offline page builds everything with
  `textContent`. React escapes everything else. PDFs are drawn by React-PDF,
  which has no scripts. Download file names are built from project numbers and
  dates only.
- React 19 blocks `javascript:` links, and the one free-text link (a
  variation's signed copy) was already refused unless it is https when the
  office records it. See the hardening below for links edited in SharePoint.

### Register spreadsheet downloads

- Already safe: `lib/registerExport.ts` puts an apostrophe before any cell
  starting with `=`, `+`, `-`, `@`, a tab or a carriage return, and writes
  numbers as numbers. Covered by `registerExport.test.ts`.

### Photographs and files

- Uploads are limited to 20 MB each (counted while reading, so a missing or
  false length does not help), checked by their first bytes as JPEG, PNG or
  WebP (not by the name or the header the phone sends), decoded by sharp with
  a pixel limit, and must be one image. Ids are server-checked UUIDs, so a name
  cannot reach a path. Files are written once and never overwritten, and the
  id records who uploaded it and for which report or issue; a photo on a
  report can only be used on that report (or its correction). Photographs are
  served `private, no-store` with `nosniff`.

### Offline capture and signing

- What stays on the phone: drafts and held reports in IndexedDB, the person's
  id and name, their project list and notes for the next visit in local
  storage. The service worker caches only the app's code and the offline page,
  never pages or answers holding report data. Sign-out clears the person,
  projects and notes; held drafts stay on the phone so unsent work is not
  lost, but the offline page shows only the signed-in person's.
- Queued work reaches the server through the same routes as everything else
  (start, save, sign and send), so it gets the same checks. A report started
  offline carries a key tied to the person, cannot be moved to another project
  or type by reusing the key, and its visit date is checked.

### Secrets, tokens and personal data

- No secrets in the repository. The Entra tenant and app ids in the docs are
  identifiers, not secrets. The verify scripts use made-up values.
- The cookie holds only a random id; no tokens reach the browser. The server
  logs nothing about people. `/api/auth/me` returns only the signed-in
  person. The team page (managers) lists work emails from the roster in
  `lib/auth/roster.ts`, which is in the repository by design.

### Dependencies (`npm audit --omit=dev`)

- Next.js 15.5.25 had two moderate cache-poisoning advisories for pages built
  ahead of time (SSG/ISR). RELAY's pages are built per request, so they did
  not apply in practice; updated to 15.5.28 anyway, a patch release.
- sharp 0.35.4 had an advisory in its SVG library. RELAY refuses anything but
  JPEG, PNG and WebP before sharp sees it, but sharp reads every upload, so it
  was updated to 0.35.5.
- PostCSS 8.4.31 (and source-map-js under it) are still flagged. Next.js pins
  that exact version and npm would not override it. It only runs at build
  time on RELAY's own stylesheets, never on anything a person sends, so none
  of its advisories can be reached. It goes away with a later Next.js.

## Fixed in this review

1. **Sign-in could send people to another site.** A return address of
   `/%09/evil.example` passed the check, and browsers drop the tab and read
   `//evil.example`, so a crafted sign-in link took people to another site
   after a genuine Microsoft sign-in. `safeReturnTo` now refuses tabs, line
   breaks, other control characters and backslashes. Tests in
   `packages/platform/src/auth/session.test.ts`; browser check in
   `scripts/verify-role-access.mjs`.
2. **The sign-in screen showed whatever text a link carried.**
   `/signin?error=Your account is locked, ring …` showed those words in the
   red box on RELAY's real address, a ready-made phishing link. The address
   now carries a short code (`role`, `tenant`, `expired` …) and the screen
   uses RELAY's own sentence; Microsoft's AADSTS number is kept for an
   administrator. Unexpected failures are logged on the server.
3. **Changes posted from another site are refused** (`lib/crossSite.ts`, run
   by the middleware). The `SameSite=Lax` cookie already stopped this; this is
   a second lock that also covers other addresses under the same domain. It
   uses the browser's `Sec-Fetch-Site`, or else `Origin` against the address
   used (the forwarded host behind Caddy).
4. **Security headers** on every answer (`apps/web/security-headers.mjs`): no
   framing by other sites, `nosniff`, forms post only to RELAY, a referrer
   policy, a permissions policy and HSTS (without subdomains). The
   `X-Powered-By` header is off. A full script Content-Security-Policy was
   not added: Next.js and the theme script run inline, and a policy loose
   enough for them adds little; it would need nonces through the app.
5. **A signed copy link opens only if it is https**, as shown in the office
   and on the variation page, because the register can also be edited in
   SharePoint where RELAY's check does not run.
6. **Length limits on free text that had none:** each text box on a card or
   check (10,000 characters) and an issue action's note (10,000) and company
   (400). These are far above anything typed on site and stop one save filling
   the server's memory and disk.

## Not changed (larger, or a decision)

- **Request size.** JSON routes read the whole body. A signed-in person could
  send a very large save. Uploads are already bounded. A size limit belongs in
  Caddy (`request_body { max_size 50MB }`), which is a server setting; see
  below.
- **Rate limits.** None. Everyone is a signed-in Leodis employee, so this is
  left until there is a reason.
- **Per-project access.** All roles see all projects (pilot decision).
- **Held drafts on a shared phone** stay in the browser after sign-out so
  unsent work is never lost; they are hidden from the next person. A phone
  given to someone else should be signed out and its RELAY data cleared in the
  browser settings.

## For the deploy

- Nothing in this PR needs a Microsoft Entra or SharePoint change.
- Optional, server setting: add `request_body { max_size 50MB }` to the
  `app.relaybyleodis.com` block in `deploy/Caddyfile` to cap request size at
  the proxy. Not changed here, as it changes the live server's setup.
- After deploying, sign in once and send a test report as a check that the
  cross-site rule accepts RELAY's own address through Caddy (Caddy passes the
  original host, so it should).
- Keep `RELAY_ALLOW_LOCAL_AUTH` unset on the live server.
