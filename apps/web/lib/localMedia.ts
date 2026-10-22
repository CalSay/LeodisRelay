import type { Photo } from './types';
import { clientId } from './clientId';
import { MEDIA_LIMIT, mediaId, mediaUrl } from './media';
import { failure } from './failure';

/**
 * The server would not take a photograph (not one it can read, say). Every
 * save that carries it is refused the same way, so the screen names the card
 * it is on and asks for it to be removed and taken again.
 */
export class PhotoRefused extends Error {
  /** A definite answer: the save carrying it is not replayed as it was (lib/saveRequest.ts). */
  readonly refused = true;
  constructor(readonly photoId: string, readonly reason: string) {
    super(`A photograph was not accepted: ${reason ? reason[0]!.toLowerCase() + reason.slice(1) : 'RELAY would not take it.'} Remove it and take it again. Everything else is kept on this phone.`);
  }
}

// Binary objects live separately: typing never clones all the photographs.
async function storage<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('relay-media', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('blobs');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('blobs', mode);
      const request = action(tx.objectStore('blobs'));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Photo could not be stored on this device.')); };
    };
  });
}

export function localBlob(id: string): Promise<Blob | undefined> {
  return storage('readonly', store => store.get(id));
}
export async function localPreview(id:string):Promise<Blob | undefined> {
  return await storage<Blob | undefined>('readonly',store => store.get(`thumb:${id}`)) ?? localBlob(id);
}

/**
 * A photograph that was not added, with why in a few words ("is larger than
 * 20 MB"), so a screen adding several can list them in one sentence.
 */
export class PhotoNotAdded extends Error {
  constructor(readonly fileName: string, readonly why: string, readonly advice: string) {
    super(`${fileName} ${why}, so it was not added. ${advice}`);
  }
}

/**
 * "1 photograph added. drawing.gif is not a JPEG, PNG or WebP photograph, and
 * huge.jpg is larger than 20 MB, so they were not added." Then what to do.
 */
export function notAdded(added: number, refused: readonly { name: string; why: string; advice: string }[]): string {
  const start = added ? `${added} photograph${added === 1 ? '' : 's'} added. ` : '';
  if (refused.length === 1) return `${start}${refused[0]!.name} ${refused[0]!.why}, so it was not added. ${refused[0]!.advice}`;
  const said = refused.map(r => `${r.name} ${r.why}`);
  const advice = [...new Set(refused.map(r => r.advice))].join(' ');
  return `${start}${said.slice(0, -1).join(', ')} and ${said.at(-1)}, so they were not added. ${advice}`;
}

export async function capturePhoto(file: File): Promise<Photo> {
  const name = file.name || 'That file';
  if (!['image/jpeg', 'image/png','image/webp'].includes(file.type)) {
    throw new PhotoNotAdded(name, 'is not a JPEG, PNG or WebP photograph', 'Take it with the camera, or choose a JPEG, PNG or WebP copy.');
  }
  if (file.size > MEDIA_LIMIT) throw new PhotoNotAdded(name, 'is larger than 20 MB', 'Take it again, or choose a smaller copy.');
  const id = clientId();
  try { await storage('readwrite', store => store.put(file, id)); }
  catch { throw new PhotoNotAdded(name, 'could not be kept on this phone, whose storage may be full', 'Free some space, then add it again.'); }
  // A thumbnail is a disposable display copy; failure must not discard the original.
  if (typeof createImageBitmap === 'function') {
    let bitmap:ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1,480/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width*scale));
      canvas.height = Math.max(1,Math.round(bitmap.height*scale));
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle='#ffffff'; context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const thumbnail = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,'image/jpeg',0.78));
        if (thumbnail) await storage('readwrite',store => store.put(thumbnail,`thumb:${id}`));
      }
    } catch { /* The original remains available for preview and upload. */ }
    finally { bitmap?.close(); }
  }
  return { id, dataUrl: mediaUrl(id), caption: '', capturedAt: new Date().toISOString() };
}

const uploads = new Map<string, Promise<void>>();
/** Photographs whose bytes are being sent right now, so the editor can say "Uploading". */
const sending = new Set<string>();
const listeners = new Set<() => void>();
export function uploadingPhotos(): ReadonlySet<string> { return new Set(sending); }
export function onPhotoUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const changed = () => { for (const listener of listeners) listener(); };
export async function uploadPhotos(photos: readonly Photo[], scope: { reportId: string } | { issueId: string }): Promise<void> {
  // Bounded upload memory and connection usage on phones. Repeated saves share an upload.
  for (const photo of photos) {
    const id = mediaId(photo.dataUrl);
    if (!id) continue;
    if (await storage('readonly', store => store.get(`uploaded:${id}`))) continue;
    let upload = uploads.get(id);
    if (!upload) {
      upload = (async () => {
        const blob = await localBlob(id);
        if (blob) { sending.add(id); changed(); }
        if (!blob) return; // Already acknowledged by the media endpoint.
        const response = await fetch(`${mediaUrl(id)}?${new URLSearchParams(scope)}`, {
          method: 'PUT', headers: { 'content-type': blob.type }, body: blob,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          // Only a refusal of the photograph itself (unreadable, too big) asks for it to be taken again;
          // anything else (signed out, the report sent elsewhere) is not the photograph's fault.
          if (response.status !== 422 && response.status !== 413) throw failure(response.status, body, 'A photograph could not be sent.');
          throw new PhotoRefused(id, typeof body.reason === 'string' ? body.reason : '');
        }
        // Keep local evidence for offline viewing. A small acknowledgement avoids retransmission.
        await storage('readwrite', store => store.put(true, `uploaded:${id}`));
      })();
      uploads.set(id, upload);
      upload.catch(() => uploads.delete(id)).finally(() => { if (sending.delete(id)) changed(); });
    }
    await upload;
    uploads.delete(id);
  }
}
