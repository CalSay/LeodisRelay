/**
 * Headers sent with every page and API answer.
 *
 * None of these changes what a page does; each closes off a way RELAY could be
 * misused from somewhere else:
 * - frame-ancestors / X-Frame-Options: no other site can show RELAY inside a
 *   frame and trick someone into pressing Send or Sign out under a disguise.
 * - nosniff: a photograph is only ever treated as a photograph.
 * - form-action, base-uri, object-src: a form only posts to RELAY, and links
 *   and plugins cannot be pointed elsewhere by injected markup.
 * - Referrer-Policy: report and issue addresses are not handed to other sites
 *   when someone opens a link out (a SharePoint signed copy, Directions).
 * - Permissions-Policy: RELAY uses the camera through the photo picker only;
 *   nothing else on the device is asked for.
 * - Strict-Transport-Security: once a phone has reached RELAY over https it
 *   will not drop to http. Browsers ignore it on a plain-http test address.
 *
 * A full script Content-Security-Policy is not set: Next.js and the theme
 * script run inline, and a policy that allows those adds little. See
 * docs/security-review-2026-10-21.md.
 */
export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];
