'use client';

import { useEffect, useState } from 'react';
import { SIGNED_OUT_EVENT } from '@/lib/failure';

/**
 * Said once, at the top of any page, when the server answers "signed out".
 *
 * Signing in opens in a new tab, so nothing typed on this page is lost on the
 * way: the person signs in there, comes back, and carries on. The prompt goes
 * by itself once this tab can see the new session. Screens that were saving
 * try again on their own (the report editor does when the tab is back in view).
 */
export function SignedOutPrompt() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = () => setShown(true);
    window.addEventListener(SIGNED_OUT_EVENT, show);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, show);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d?.principal) setShown(false); }).catch(() => undefined);
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [shown]);
  if (!shown) return null;
  return <div className="signed-out" role="alert">
    <p><b>You have been signed out.</b> Nothing on this page has been lost.</p>
    <a className="signed-out-go" href="/signin?returnTo=%2Fsigned-in" target="_blank" rel="noopener">Sign in again</a>
    <small>It opens in a new tab. Come back to this one once you are in.</small>
  </div>;
}
