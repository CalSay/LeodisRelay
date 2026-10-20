import type { SiteInfo } from './siteInfo';

/**
 * Fetching site information, with the last copy kept on this device so an
 * engineer who arrives without signal can still see the address, the hours
 * and who to ring. The copy is a convenience, never a source: the page says
 * when it is showing one and how old it is.
 */

export interface SiteInfoAnswer { projectId: string; info: SiteInfo | null; canEdit: boolean }
export interface SiteInfoLoad extends SiteInfoAnswer { offline?: { keptAt: string } }

const key = (projectId: string) => `relay-site-info:${projectId}`;
/** A copy older than this is not shown: it may be out of date, and contact details should not sit on a phone for ever. */
export const KEEP_DAYS = 30;

/** Kept with the project's name so the offline screen can say which site it is. Cleared on sign out. */
export function keepCopy(answer: SiteInfoAnswer, projectName: string): void {
  try { localStorage.setItem(key(answer.projectId), JSON.stringify({ keptAt: new Date().toISOString(), projectName, info: answer.info })); } catch {}
}

export function forgetCopies(): void {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('relay-site-info:')) localStorage.removeItem(k); } catch {}
}

function keptCopy(projectId: string): SiteInfoLoad | null {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    const kept = JSON.parse(raw) as { keptAt?: unknown; info?: SiteInfo | null };
    return typeof kept.keptAt === 'string' && Date.now() - Date.parse(kept.keptAt) < KEEP_DAYS * 86400000 ? { projectId, info: kept.info ?? null, canEdit: false, offline: { keptAt: kept.keptAt } } : null;
  } catch { return null; }
}

export class SiteInfoError extends Error {}

export async function loadSiteInfo(projectId: string, projectName: string): Promise<SiteInfoLoad> {
  let response: Response;
  try { response = await fetch(`/api/site-info?${new URLSearchParams({ projectId })}`, { cache: 'no-store' }); }
  catch {
    const kept = keptCopy(projectId);
    if (kept) return kept;
    throw new SiteInfoError('No connection, and this device has no saved copy yet. Try again when there is signal.');
  }
  const body = await response.json().catch(() => ({})) as SiteInfoAnswer & { reason?: string };
  if (!response.ok) throw new SiteInfoError(body.reason ?? `Site information could not be loaded (${response.status}).`);
  keepCopy(body, projectName);
  return body;
}
