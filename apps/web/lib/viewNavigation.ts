const RETURNABLE_VIEWS = new Set(['/office', '/engineer', '/projects', '/search', '/issues/snag-list', '/weekly-summary', '/photos', '/coverage', '/companies', '/diary', '/my-week', '/safety-actions', '/handover', '/issue-trend', '/site-notes', '/toolbox-talks', '/help']);

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

const VIEW_NAMES: Record<string, string> = {
  '/office': 'Office', '/projects': 'Projects', '/issues/snag-list': 'Snag list', '/weekly-summary': 'Weekly summary',
  '/photos': 'Photographs', '/coverage': 'Site coverage', '/companies': 'Issues by company', '/diary': 'Site diary', '/my-week': 'My week',
  '/safety-actions': 'Safety actions', '/handover': 'Before handover', '/issue-trend': 'Issues over time', '/site-notes': 'Notes for the next visit', '/toolbox-talks': 'Toolbox talks', '/help': 'Help',
};
const ENGINEER_VIEWS: Record<string, string> = { issues: 'Issues', reports: 'Reports', projects: 'Projects', defect: 'Flag a defect' };

/**
 * The name of the page a Back link returns to, in the words its own
 * navigation uses, so "Back" always says where it goes. Undefined for a
 * path that is not a known view.
 */
export function viewName(returnTo: string): string | undefined {
  try {
    const parsed = new URL(returnTo, 'https://relay.invalid');
    if (!RETURNABLE_VIEWS.has(parsed.pathname)) return undefined;
    if (parsed.pathname === '/engineer') return ENGINEER_VIEWS[parsed.searchParams.get('view') ?? ''] ?? 'Site';
    if (parsed.pathname === '/search') return parsed.searchParams.get('q')?.trim() ? 'Search results' : 'Search';
    return VIEW_NAMES[parsed.pathname];
  } catch {
    return undefined;
  }
}

/** "← Back to Site diary": the Back link's words for a return path, with a fallback name. */
export function backLabel(returnTo: string, fallback = 'previous page'): string {
  return `Back to ${viewName(returnTo) ?? fallback}`;
}
