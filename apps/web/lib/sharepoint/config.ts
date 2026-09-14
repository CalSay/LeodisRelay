/** Server-only configuration. Enabling reads never enables writes. */
export function sharePointMode(): 'off' | 'read' | 'write' {
  const mode = process.env.RELAY_SHAREPOINT_MODE ?? 'off';
  if (!['off', 'read', 'write'].includes(mode)) throw new Error('Invalid RELAY_SHAREPOINT_MODE.');
  return mode as 'off' | 'read' | 'write';
}
export const OPERATIONS = {
  site: 'leodisdevelopments.sharepoint.com,7fc89dbf-9b60-4018-bb49-1bcdb28a5fd6,5213073c-845c-4e0f-aac1-a3e7e1bcfa9e',
  projects: '3e2035e6-3d28-4fe4-9e24-888ffd8e9ef4',
  clients: '9174b22f-a49a-4a0f-9be0-ce9d70be5287',
  reports: 'f916d018-d7a7-4703-a9cc-b722fa20b430',
  issues: '4b49efb5-df01-4097-ab64-dae248d5c114',
} as const;
function itemIds(value: string | undefined): string[] {
  const ids = (value ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (ids.some(id => !/^\d+$/.test(id))) throw new Error('Use SharePoint project item IDs, not project numbers.');
  return ids;
}
/** Optional read scope. Blank means every project with a reportable SharePoint status. */
export function readableProjectItemIds(): string[] | null {
  const ids = itemIds(process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS);
  return ids.length ? ids : null;
}
/** Writes always require an explicit item-ID allowlist. The old name remains a safe migration fallback. */
export function writableProjectItemIds(): string[] {
  return itemIds(process.env.RELAY_SHAREPOINT_WRITE_PROJECT_IDS ?? process.env.RELAY_SHAREPOINT_PROJECT_IDS);
}
export function assertProjectWrite(itemId: string): void {
  if (sharePointMode() !== 'write' || !writableProjectItemIds().includes(itemId)) {
    throw new Error('SharePoint writes are not enabled for this project.');
  }
}
export interface ArchiveFolder { driveId: string; itemId: string }
export function archiveFolder(projectItemId: string): ArchiveFolder {
  const entries = JSON.parse(process.env.RELAY_SHAREPOINT_ARCHIVE_FOLDERS ?? '{}') as Record<string, ArchiveFolder>;
  const folder = entries[projectItemId];
  if (!folder || !folder.driveId || !folder.itemId) throw new Error('No verified report folder is configured for this project.');
  return folder;
}
