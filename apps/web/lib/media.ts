/** Shared reference format; legacy inline photos remain readable during migration. */
export const MEDIA_LIMIT = 20 * 1024 * 1024;
export function mediaUrl(id: string): string {
  return `/api/media/${id}`;
}
export function mediaId(url: string): string | null {
  return /^\/api\/media\/([a-f0-9-]{36})$/.exec(url)?.[1] ?? null;
}
