/**
 * Telling whether RELAY's home screen icon opened the app or only a browser tab.
 *
 * The icon opens "/?open=app" (app/manifest.ts). middleware.ts marks that visit
 * with a short-lived cookie, because the address is gone by the time a page
 * shows: "/" sends the person on to their company, or to sign in first. A page
 * that finds the mark but is not running full screen was opened by an icon
 * the phone saved as a plain shortcut to the web address, which is why there
 * is a bar with the address at the top. The fix is on the phone (add RELAY
 * again as an app), so all RELAY can do is say so, once per launch.
 */
export const ICON_LAUNCH_COOKIE = 'relay-icon-launch';

/** Long enough to survive a Microsoft sign-in on the way in, short enough not to stick to a later visit. */
export const ICON_LAUNCH_SECONDS = 300;

/** True when the address is the one the home screen icon opens. */
export function isIconLaunch(pathname: string, search: URLSearchParams): boolean {
  return pathname === '/' && search.get('open') === 'app';
}

/** True when `cookieHeader` (document.cookie) carries the mark set by middleware.ts. */
export function hasIconLaunch(cookieHeader: string): boolean {
  return cookieHeader.split(';').some(part => part.trim() === `${ICON_LAUNCH_COOKIE}=1`);
}

/** Full screen, as an installed app: no address bar. `minimal-ui` keeps a small one, so it does not count. */
export const APP_DISPLAY_MODES = ['standalone', 'fullscreen'] as const;

