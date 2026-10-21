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
 * Whether this person has never opened Help on this device: someone new to
 * RELAY, for whom every entry is "new" and the count means nothing. False if
 * storage is blocked, so the count shows as before.
 */
export function newToRelay(principalId: string | undefined): boolean {
  if (!principalId) return false;
  try { return localStorage.getItem(seenKey(principalId)) === null; } catch { return false; }
}

/**
 * How many "What's new" entries this person has not looked at yet, for the
 * links that lead to Help, and whether they are new to RELAY (then the links
 * say "Start here", not "40 new"). Zero and false until the device has been
 * read, so the server render and the first client render agree.
 */
export function useWhatsNew(tab: HelpTab): { count: number; newcomer: boolean } {
  const principal = usePrincipal();
  const [state, setState] = useState({ count: 0, newcomer: false });
  useEffect(() => {
    const update = () => setState({ count: unseen(tab, loadSeen(principal?.id)).length, newcomer: newToRelay(principal?.id) });
    update();
    window.addEventListener('storage', update);
    window.addEventListener(SEEN_EVENT, update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener(SEEN_EVENT, update); };
  }, [tab, principal?.id]);
  return state;
}
