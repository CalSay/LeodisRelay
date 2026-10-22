'use client';

import { useEffect } from 'react';

/**
 * Carries on from the sign-in screen once the session exists.
 *
 * Microsoft's sign-in is another web address, so a phone shows it with an
 * address bar, and an iPhone may finish it in a separate browser sheet over
 * RELAY. Back on this screen (the sheet closed, or another tab signed in) it
 * would otherwise still say "Sign in" until tapped again.
 */
export function SignedInElsewhere({ destination }: { destination: string }) {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d?.principal) window.location.replace(destination); }).catch(() => undefined);
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [destination]);
  return null;
}
