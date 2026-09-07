import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { imageRenditions } from './imageProcessing';
import { MEDIA_LIMIT, mediaId } from './media';

const root = () => resolve(process.env.RELAY_MEDIA_ROOT ?? join(process.cwd(), '.relay-prototype', 'media'));
export interface MediaRecord {
  ownerId: string;
  reportId?: string;
  issueId?: string;
  mime: string;
  digest: string;
}
function path(id: string, ext: string): string {
  if (!mediaId(`/api/media/${id}`)) throw new Error('Invalid media identifier.');
  return join(root(), `${id}.${ext}`);
}
export async function getMedia(id: string): Promise<MediaRecord | null> {
  try { return JSON.parse(await readFile(path(id, 'json'), 'utf8')) as MediaRecord; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function mediaBytes(id: string): Promise<Buffer> { return readFile(path(id, 'bin')); }
const processing = new Map<string,Promise<void>>();
async function prepare(id:string,bytes:Buffer): Promise<void> {
  const key = path(id,'pdf-v1.jpg');
  const running = processing.get(key);
  if (running) return running;
  const work = (async () => {
    const images = await imageRenditions(bytes);
    await mkdir(root(),{recursive:true});
    for (const variant of ['pdf','thumb'] as const) {
      const target = path(id,`${variant}-v1.jpg`);
      const temporary = `${target}.${randomUUID()}.tmp`;
      try { await writeFile(temporary,images[variant],{flag:'wx'}); await rename(temporary,target); }
      finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }
  })();
  processing.set(key,work);
  try { await work; } finally { processing.delete(key); }
}
export async function renditionBytes(id:string,variant:'pdf'|'thumb'): Promise<Buffer> {
  const target = path(id,`${variant}-v1.jpg`);
  try { return await readFile(target); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await prepare(id,await mediaBytes(id));
  return readFile(target);
}
export async function putMedia(id: string, record: Omit<MediaRecord, 'digest'>, bytes: Buffer): Promise<void> {
  if (!bytes.length || bytes.length > MEDIA_LIMIT) throw new Error('Photograph must be between 1 byte and 20 MB.');
  // Check signatures as well as the untrusted Content-Type header.
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!(record.mime === 'image/jpeg' && jpeg || record.mime === 'image/png' && png || record.mime === 'image/webp' && webp)) {
    throw new Error('The file is not a supported photograph.');
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  const existing = await getMedia(id);
  if (existing) {
    if (existing.ownerId !== record.ownerId || existing.digest !== digest || existing.reportId !== record.reportId || existing.issueId !== record.issueId) {
      throw new Error('This media identifier already belongs to another upload.');
    }
    await renditionBytes(id,'pdf');
    await renditionBytes(id,'thumb');
    return;
  }
  await mkdir(root(), { recursive: true });
  // Immutable binary: retries can never overwrite a completed upload.
  try { await writeFile(path(id, 'bin'), bytes, { flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!bytes.equals(await mediaBytes(id))) throw new Error('Conflicting upload.');
  }
  // Derivatives may only be generated from the immutable bytes claimed above.
  // An invalid decode never gets a metadata/receipt acknowledgement.
  await prepare(id,bytes);
  await writeFile(path(id, 'json'), JSON.stringify({ ...record, digest }), { flag: 'wx' }).catch(async error => {
    if (error.code !== 'EEXIST') throw error;
    const saved = await getMedia(id);
    if (JSON.stringify(saved) !== JSON.stringify({ ...record, digest })) throw new Error('Conflicting upload.');
  });
}

export async function documentPhotoUrl(url: string): Promise<string> {
  const id = mediaId(url);
  if (!id) {
    if (/^data:image\/(jpeg|png|webp);base64,/.test(url)) {
      const bytes = Buffer.from(url.slice(url.indexOf(',')+1),'base64');
      if (bytes.length > MEDIA_LIMIT) throw new Error('Legacy photograph exceeds 20 MB.');
      const key = createHash('sha256').update(bytes).digest('hex');
      // Legacy content hashes live in their own namespace, never in user media IDs.
      const target = join(root(),`legacy-${key}-pdf-v1.jpg`);
      let pdf:Buffer;
      try { pdf = await readFile(target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        pdf = (await imageRenditions(bytes)).pdf;
        await mkdir(root(),{recursive:true});
        const temporary=`${target}.${randomUUID()}.tmp`;
        try {await writeFile(temporary,pdf,{flag:'wx'});await rename(temporary,target);}
        finally {await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
      }
      return `data:image/jpeg;base64,${pdf.toString('base64')}`;
    }
    throw new Error('Unsupported photograph reference.');
  }
  const record = await getMedia(id);
  if (!record) throw new Error('A photograph is missing from storage.');
  return `data:image/jpeg;base64,${(await renditionBytes(id,'pdf')).toString('base64')}`;
}
