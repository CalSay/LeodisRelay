import type { Photo } from './types';
import { clientId } from './clientId';
import { MEDIA_LIMIT, mediaId, mediaUrl } from './media';

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

export async function capturePhoto(file: File): Promise<Photo> {
  if (!['image/jpeg', 'image/png','image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP photograph.');
  }
  if (file.size > MEDIA_LIMIT) throw new Error('Choose a photograph smaller than 20 MB.');
  const id = clientId();
  await storage('readwrite', store => store.put(file, id));
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
        if (!blob) return; // Already acknowledged by the media endpoint.
        const response = await fetch(`${mediaUrl(id)}?${new URLSearchParams(scope)}`, {
          method: 'PUT', headers: { 'content-type': blob.type }, body: blob,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.reason ?? 'Photograph upload failed. Your copy is still on this phone.');
        }
        // Keep local evidence for offline viewing. A small acknowledgement avoids retransmission.
        await storage('readwrite', store => store.put(true, `uploaded:${id}`));
      })();
      uploads.set(id, upload);
      upload.catch(() => uploads.delete(id));
    }
    await upload;
    uploads.delete(id);
  }
}
