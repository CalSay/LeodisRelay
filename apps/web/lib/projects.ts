import { createHash } from 'node:crypto';
import { FIXTURE_PROJECTS, type FixtureProject } from './fixtures';
import { atomic, getRecord, putRecord, records } from './storage';
import { OPERATIONS, pilotItemIds, sharePointMode } from './sharepoint/config';
import { graph, type Column } from './sharepoint/graph';

export interface ConnectedProject extends FixtureProject {
  source?: { siteId: string; listId: string; itemId: string };
  refreshedAt?: string;
  tombstoned?: boolean;
}
export function projectIdentity(itemId: string): string {
  return 'sp-' + createHash('sha256').update(`${OPERATIONS.site}/${OPERATIONS.projects}/${itemId}`).digest('hex').slice(0, 32);
}
export function columnName(columns: Column[], displayName: string): string {
  const matches = columns.filter(c => c.displayName === displayName);
  if (matches.length !== 1) throw new Error(`SharePoint column '${displayName}' is missing or ambiguous.`);
  return matches[0]!.name;
}
export function cachedProjects(): ConnectedProject[] {
  return sharePointMode() === 'off' ? FIXTURE_PROJECTS : records<ConnectedProject>('projects');
}
export function cachedProject(id: string): ConnectedProject | undefined {
  return cachedProjects().find(p => p.id === id);
}
export function reportableProject(p: ConnectedProject): boolean {
  const allowed = pilotItemIds();
  return !p.tombstoned && !!p.projectNumber && ['4. Active', '5. Defects Liability'].includes(p.status) &&
    (!p.source || allowed.includes(p.source.itemId));
}
let refreshing: Promise<ConnectedProject[]> | undefined;
export async function refreshProjects(force = false): Promise<ConnectedProject[]> {
  if (sharePointMode() === 'off') return FIXTURE_PROJECTS;
  const stamp = getRecord<{ id: string; at: number }>('sharepoint-status', 'projects');
  if (!force && stamp && Date.now() - stamp.at < 60000) return cachedProjects();
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const [columns, clientColumns, items, clients] = await Promise.all([
      graph.columns(OPERATIONS.projects), graph.columns(OPERATIONS.clients), graph.items(OPERATIONS.projects), graph.items(OPERATIONS.clients),
    ]);
    const names = { number: columnName(columns, 'Project Number'), status: columnName(columns, 'Status'),
      division: columnName(columns, 'Trading Name'), client: columnName(columns, 'Client'), manager: columnName(columns, 'Project Manager') };
    const clientColumn = columns.find(c => c.name === names.client)!;
    if (clientColumn.lookup?.listId.toLowerCase() !== OPERATIONS.clients.toLowerCase()) throw new Error('Project Client lookup points to an unexpected list.');
    const account = columnName(clientColumns, 'Account Number');
    const { sitePeople } = await import('./sharepoint/people');
    const people = await sitePeople();
    const text = (v: unknown) => typeof v === 'string' ? v : '';
    const now = new Date().toISOString();
    const next: ConnectedProject[] = items.filter(item => ['4. Active', '5. Defects Liability'].includes(text(item.fields[names.status]))).map(item => {
      const client = clients.find(c => c.id === String(item.fields[names.client + 'LookupId']));
      if (!client) throw new Error(`Project item ${item.id} has an unresolved Client lookup.`);
      const manager = people.find(p => p.id === String(item.fields[names.manager + 'LookupId']));
      return { id: projectIdentity(item.id), projectNumber: text(item.fields[names.number]), projectName: text(item.fields.Title),
        clientName: text(client.fields.Title) || `Client ${client.id}`, clientAccountNumber: text(client.fields[account]),
        division: text(item.fields[names.division]), status: text(item.fields[names.status]),
        projectManager: manager?.name ?? '', projectManagerEmail: manager?.email ?? '', reviewRequired: false,
        source: { siteId: OPERATIONS.site, listId: OPERATIONS.projects, itemId: item.id }, refreshedAt: now };
    });
    atomic(() => {
      for (const old of records<ConnectedProject>('projects')) if (!next.some(p => p.id === old.id)) putRecord('projects', { ...old, tombstoned: true });
      for (const p of next) putRecord('projects', p);
      putRecord('sharepoint-status', { id: 'projects', at: Date.now() });
    });
    return cachedProjects();
  })();
  try { return await refreshing; } finally { refreshing = undefined; }
}
