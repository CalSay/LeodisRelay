import { OPERATIONS, sharePointMode } from './config';

export class GraphError extends Error {
  constructor(readonly status: number, readonly retryAfterMs = 0) {
    super(status === 412 ? 'SharePoint changed this record. Refresh and reconcile before retrying.' : `Microsoft Graph request failed (HTTP ${status}).`);
  }
}
export function retryAfter(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, (Date.parse(value) || now) - now);
}
export interface ListItem { id: string; eTag: string; fields: Record<string, unknown>; webUrl?: string }
export interface Column {
  name: string; displayName: string; required?: boolean; indexed?: boolean; enforceUniqueValues?: boolean;
  text?: unknown; lookup?: { listId: string }; personOrGroup?: unknown; choice?: { choices: string[] };
}
/** Token and paging URLs are confined to Microsoft Graph; no credential-bearing redirects. */
export class GraphClient {
  private token: { value: string; until: number } | undefined;
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  private async accessToken(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const tenant = process.env.ENTRA_TENANT_ID;
    const client = process.env.ENTRA_CLIENT_ID;
    const secret = process.env.ENTRA_CLIENT_SECRET;
    if (!tenant || !client || !secret || !/^[a-f\d-]{36}$/i.test(tenant)) throw new Error('Server Entra application credentials are missing.');
    const response = await this.fetcher(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      body: new URLSearchParams({ client_id: client, client_secret: secret, grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
    });
    if (!response.ok) throw new GraphError(response.status, retryAfter(response.headers.get('retry-after')));
    const result = await response.json() as { access_token: string; expires_in: number };
    if (!result.access_token) throw new Error('Microsoft returned no application token.');
    this.token = { value: result.access_token, until: Date.now() + Math.max(0, result.expires_in - 120) * 1000 };
    return result.access_token;
  }
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path.startsWith('/') ? `https://graph.microsoft.com/v1.0${path}` : path);
    if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/') || url.username || url.password) throw new Error('Refused an untrusted Graph URL.');
    if (init.method && init.method !== 'GET' && sharePointMode() !== 'write') throw new Error('SharePoint is read-only.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await this.accessToken()}`);
    if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await this.fetcher(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) {
      if (response.status === 401) this.token = undefined;
      throw new GraphError(response.status, retryAfter(response.headers.get('retry-after')));
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  async all<T>(path: string): Promise<T[]> {
    const values: T[] = [];
    const seen = new Set<string>();
    let next: string | undefined = path;
    while (next) {
      if (seen.has(next) || seen.size >= 10000) throw new Error('Microsoft returned an invalid pagination sequence.');
      seen.add(next);
      const page: { value: T[]; '@odata.nextLink'?: string } = await this.request(next);
      if (!Array.isArray(page.value)) throw new Error('Microsoft returned an invalid collection.');
      values.push(...page.value); next = page['@odata.nextLink'];
    }
    return values;
  }
  /** Preauthenticated upload/download URLs never receive the Graph bearer token. */
  async transfer(url: string, init: RequestInit = {}): Promise<Response> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'leodisdevelopments.sharepoint.com' || parsed.username || parsed.password) throw new Error('Unexpected SharePoint transfer host.');
    if (init.method && init.method !== 'GET' && sharePointMode() !== 'write') throw new Error('SharePoint is read-only.');
    const response = await this.fetcher(parsed, { ...init, redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new GraphError(response.status, retryAfter(response.headers.get('retry-after')));
    return response;
  }
  listPath(list: string): string { return `/sites/${encodeURIComponent(OPERATIONS.site)}/lists/${encodeURIComponent(list)}`; }
  items(list: string): Promise<ListItem[]> { return this.all(`${this.listPath(list)}/items?$expand=fields&$top=200`); }
  columns(list: string): Promise<Column[]> { return this.all(`${this.listPath(list)}/columns`); }
  async byKey(list: string, field: string, value: string): Promise<ListItem | undefined> {
    if (!/^[A-Za-z_][A-Za-z\d_]*$/.test(field)) throw new Error('Invalid internal column name.');
    const filter = encodeURIComponent(`fields/${field} eq '${value.replaceAll("'", "''")}'`);
    const rows = await this.all<ListItem>(`${this.listPath(list)}/items?$expand=fields&$filter=${filter}`);
    if (rows.length > 1) throw new Error('Duplicate RELAY identity in SharePoint; reconciliation is required.');
    return rows[0];
  }
}
export const graph = new GraphClient();
