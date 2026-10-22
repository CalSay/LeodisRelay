'use client';

import { useEffect, useState } from 'react';
import { APP_DISPLAY_MODES, ICON_LAUNCH_COOKIE, hasIconLaunch } from '@/lib/homeScreen';

const SHOWN_KEY = 'relay-icon-opens-browser';

function fullScreen(): boolean {
  return APP_DISPLAY_MODES.some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPadOS asks for the desktop site, so it says Macintosh: a Mac with a touch screen is an iPad. */
function iPhoneOrIPad(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * Said when RELAY's home screen icon opened a browser tab rather than the app,
 * which is what puts a bar with the web address at the top (lib/homeScreen.ts).
 *
 * Only the phone can fix it, by adding RELAY again as an app, so this says how
 * and gets out of the way. It stays through a Microsoft sign-in on the way in
 * (this tab's session storage) until "Got it", and comes back the next time the
 * icon opens a browser tab.
 */
export function IconOpensBrowser() {
  const [shown, setShown] = useState(false);
  const [iPhone, setIPhone] = useState(false);
  useEffect(() => {
    setIPhone(iPhoneOrIPad());
    if (hasIconLaunch(document.cookie)) {
      // Read once: a later visit typed into the browser is not a launch from the icon.
      document.cookie = `${ICON_LAUNCH_COOKIE}=; path=/; max-age=0`;
      if (fullScreen()) return;
      try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch {}
      setShown(true);
      return;
    }
    try { if (sessionStorage.getItem(SHOWN_KEY) && !fullScreen()) setShown(true); } catch {}
  }, []);
  if (!shown) return null;
  const close = () => { try { sessionStorage.removeItem(SHOWN_KEY); } catch {} setShown(false); };
  return <aside className="icon-browser" aria-labelledby="icon-browser-title">
    <p id="icon-browser-title"><b>Your RELAY icon opened the browser, not the app.</b> That is why the web address shows at the top.</p>
    <p>To open RELAY full screen, remove the RELAY icon from your home screen, then add it again:</p>
    {iPhone
      ? <p>In Safari, tap Share, then <strong>Add to Home Screen</strong>. If you see <strong>Open as Web App</strong>, leave it on. Then tap <strong>Add</strong>.</p>
      : <p>In Chrome, tap <strong>⋮</strong>, then <strong>Install app</strong>. If it asks, choose <strong>Install</strong>, not Create shortcut.</p>}
    <button type="button" className="icon-browser-close" onClick={close}>Got it</button>
  </aside>;
}
