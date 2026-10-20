'use client';
import { useEffect, useState } from 'react';
import { readSeen, seenKey, unseen, type HelpTab } from '@/lib/helpGuide';
import { usePrincipal } from './PrincipalContext';

/** Fired on this tab when Help marks entries seen; `storage` covers other tabs. */
export const SEEN_EVENT = 'relay-help-seen';

/** The stored "seen" ids for the signed-in person, empty if storage is blocked. */
export function loadSeen(principalId: string | undefined): Set<string> {
  if (!principalId) return new Set();
  try { return readSeen(localStorage.getItem(seenKey(principalId))); } catch { return new Set(); }
}

/**
 * How many "What's new" entries this person has not looked at yet, for the
 * links that lead to Help. Zero until the device has been read, so the server
 * render and the first client render agree.
 */
export function useWhatsNewCount(tab: HelpTab): number {
  const principal = usePrincipal();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(unseen(tab, loadSeen(principal?.id)).length);
    update();
    window.addEventListener('storage', update);
    window.addEventListener(SEEN_EVENT, update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener(SEEN_EVENT, update); };
  }, [tab, principal?.id]);
  return count;
}
