import type { Photo, Observation } from './types';
import { mediaId } from './media';
import { getMedia } from './mediaStore';

export async function validatePhotos(photos: unknown, scope: { reportId: string } | { issueId: string }, legacy: readonly Photo[] = []): Promise<string | null> {
  if (!Array.isArray(photos) || photos.length > 100) return 'Photographs must be a list of up to 100 items.';
  for (const p of photos) {
    if (!p || typeof p.id !== 'string' || typeof p.dataUrl !== 'string' || typeof p.caption !== 'string' || typeof p.capturedAt !== 'string') return 'Malformed photograph.';
    const id = mediaId(p.dataUrl);
    if (!id) {
      // Existing legacy bytes may be retained, but new inline files must use the upload API.
      if (!legacy.some(old => old.id === p.id && old.dataUrl === p.dataUrl)) return 'Upload photographs before saving.';
      continue;
    }
    if (id !== p.id) return 'Photograph ID does not match its reference.';
    const record = await getMedia(id);
    if (!record || ('reportId' in scope ? record.reportId !== scope.reportId : record.issueId !== scope.issueId)) return 'Photograph has not been uploaded for this record.';
  }
  return null;
}

export async function validateObservations(value: unknown, reportId: string, existing: readonly Observation[]): Promise<string | null> {
  if (!Array.isArray(value) || value.length > 200) return 'Updates must be a list of up to 200 items.';
  const ids = new Set<string>();
  for (const o of value) {
    if (!o || ['id','type','location','whatHappened','actionNeeded','owner'].some(k => typeof o[k] !== 'string')) return 'Malformed update.';
    if (!['update','defect','instruction','access'].includes(o.type)) return 'Unknown update type.';
    if (!o.id || ids.has(o.id)) return 'Update IDs must be unique.';
    ids.add(o.id);
    const error = await validatePhotos(o.photos, { reportId }, existing.flatMap(item => item.photos));
    if (error) return error;
  }
  return null;
}
