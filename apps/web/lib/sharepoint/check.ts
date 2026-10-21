import { GraphClient, GraphError, type Column } from './graph';
import { OPERATIONS, sharePointMode, type ArchiveFolder } from './config';

/**
 * The read-only connection check behind Admin > Processing and SharePoint.
 * Mirrors scripts/check-sharepoint-read.cjs: every call is a GET, nothing is
 * created or changed, and results carry a short reason, never a token or a
 * record's contents.
 */
export interface ConnectionCheck { label: string; ok: boolean; detail?: string }
export interface ConnectionReport { mode: 'off' | 'read' | 'write'; checkedAt: string; checks: ConnectionCheck[] }

/** Identities the read script pins; the app has no configuration for them. */
const EXPECTED_TENANT = '1431dac1-21c1-4c06-959a-9a437f51401c';
const EXPECTED_CLIENT = '495fc6e5-eae8-4fab-9b37-abd5f7e96601';
export const PILOT = { itemId: '102', title: 'Tetley Hall - Block E' } as const;

export const CHECK_LABELS = ['App authentication', 'Operations site', 'Project Tracker records', 'Client Database records', 'Report Register records', 'Issue Tracker records', 'Filed PDF column', `Tetley pilot item ${PILOT.itemId}`, 'Documents library', 'Reports folder'] as const;

/** A short, non-secret reason for a failed call. */
export function failureDetail(error: unknown): string {
  if (error instanceof GraphError) return `HTTP ${error.status}`;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'Timed out';
  return 'Network error or invalid response';
}

/** Whether the Report Register's filed PDF column is still a text column. */
export function filedPdfColumnIsText(columns: Pick<Column, 'name' | 'text'>[]): boolean {
  return columns.some(c => c.name === 'RelayPdfUrl' && !!c.text);
}

/** The configured report folder for the pilot project, or why there is none. */
export function pilotFolder(raw = process.env.RELAY_SHAREPOINT_ARCHIVE_FOLDERS): ArchiveFolder | string {
  let entries: Record<string, Partial<ArchiveFolder>>;
  try { entries = JSON.parse(raw || '{}'); } catch { return 'Folder configuration is invalid'; }
  const folder = entries?.[PILOT.itemId];
  return folder?.driveId && folder.itemId ? { driveId: folder.driveId, itemId: folder.itemId } : `No folder configured for item ${PILOT.itemId}`;
}

export async function runReadChecks(fetcher: typeof fetch = fetch, now = () => new Date()): Promise<ConnectionReport> {
  const mode = sharePointMode();
  const report = (checks: ConnectionCheck[]): ConnectionReport => ({ mode, checkedAt: now().toISOString(), checks });
  if (mode === 'off') return report([{ label: 'SharePoint connection', ok: false, detail: 'SharePoint is not enabled for Relay' }]);
  const env = process.env;
  if (!env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID || !env.ENTRA_CLIENT_SECRET) return report([{ label: 'SharePoint connection', ok: false, detail: 'Server Entra credentials are not configured' }]);

  // Every Graph and token call: 30 seconds, no redirects, GET only past the token.
  let tokenStatus = 0;
  const client = new GraphClient((async (input, init) => {
    const response = await fetcher(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (String(input instanceof Request ? input.url : input).startsWith('https://login.microsoftonline.com/')) tokenStatus = response.status;
    return response;
  }) as typeof fetch);

  const [authLabel, ...rest] = CHECK_LABELS;
  const skipped = (detail: string) => report([{ label: authLabel, ok: false, detail }, ...rest.map(label => ({ label, ok: false, detail: 'Not checked' }))]);
  if (env.ENTRA_TENANT_ID !== EXPECTED_TENANT) return skipped('Tenant differs from the Leodis tenant');
  if (env.ENTRA_CLIENT_ID !== EXPECTED_CLIENT) return skipped('Client differs from the app granted access');

  const site = `/sites/${encodeURIComponent(OPERATIONS.site)}`;
  const first = async <T>(path: string, test?: (data: T) => string | null): Promise<string | null> => {
    try { const data = await client.request<T>(path); return test ? test(data) : null; }
    catch (error) { return failureDetail(error); }
  };
  const siteResult = await first(`${site}?$select=id`);
  if (tokenStatus !== 200) return skipped(tokenStatus ? `HTTP ${tokenStatus}` : siteResult ?? 'No token returned');

  const folder = pilotFolder();
  const drive = typeof folder === 'string' ? null : `/drives/${encodeURIComponent(folder.driveId)}`;
  const records = (list: string) => first(`${client.listPath(list)}/items?$top=1&$select=id`);
  const results: (string | null)[] = [
    null,
    siteResult,
    await records(OPERATIONS.projects),
    await records(OPERATIONS.clients),
    await records(OPERATIONS.reports),
    await records(OPERATIONS.issues),
    await first<{ value?: Column[] }>(`${client.listPath(OPERATIONS.reports)}/columns`, d => filedPdfColumnIsText(d.value ?? []) ? null : 'Not a text column'),
    await first<{ fields?: { Title?: unknown } }>(`${client.listPath(OPERATIONS.projects)}/items/${PILOT.itemId}?$expand=fields($select=Title)`, d => d.fields?.Title === PILOT.title ? null : 'Project identity changed'),
    drive ? await first(`${drive}?$select=id`) : folder as string,
    drive && typeof folder !== 'string' ? await first<{ folder?: unknown }>(`${drive}/items/${encodeURIComponent(folder.itemId)}?$select=id,folder`, d => d.folder ? null : 'Expected a folder') : folder as string,
  ];
  return report(CHECK_LABELS.map((label, i) => results[i] ? { label, ok: false, detail: results[i]! } : { label, ok: true }));
}
