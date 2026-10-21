import { useEffect } from 'react';

/**
 * Work waiting to send that the open screen already shows (a defect's own
 * "Waiting for signal", say), so the line at the top of every page
 * (SendOnSignal.tsx) leaves it out rather than saying it twice.
 */
const shown = new Set<string>();
export const SHOWN_HERE_EVENT = 'relay-shown-here';
const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOWN_HERE_EVENT)); };

export const shownHere = (key: string): boolean => shown.has(key);

/** While this screen shows `key` waiting (null: nothing), the line at the top leaves it out. */
export function useShownHere(key: string | null): void {
  useEffect(() => {
    if (!key) return;
    shown.add(key);
    changed();
    return () => { shown.delete(key); changed(); };
  }, [key]);
}
