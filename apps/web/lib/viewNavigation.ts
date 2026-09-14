const RETURNABLE_VIEWS = new Set(['/office', '/engineer', '/projects']);

/** Keep detail-page return links inside RELAY and within a known workspace. */
export function safeViewReturn(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\r\n]/.test(raw)) return fallback;
  try {
    const parsed = new URL(raw, 'https://relay.invalid');
    return RETURNABLE_VIEWS.has(parsed.pathname) ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function withViewReturn(href: string, returnTo: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
}
