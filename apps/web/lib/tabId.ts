import { clientId } from './clientId';

let fallback: string | undefined;

/**
 * This browser tab, across reloads: sessionStorage belongs to one tab and
 * survives a reload, so a save left uncertain by a crash is replayed by the
 * same tab and never by another one open on the same draft.
 */
export function tabId(): string {
  try {
    const known = sessionStorage.getItem('relay-tab');
    if (known) return known;
    const made = clientId();
    sessionStorage.setItem('relay-tab', made);
    return made;
  } catch {
    return fallback ??= clientId();
  }
}

/** Another tab already uses this tab's id (a duplicated tab copies sessionStorage), so take a new one. */
export function renewTabId(): string {
  const made = clientId();
  try { sessionStorage.setItem('relay-tab', made); } catch { fallback = made; }
  return made;
}
