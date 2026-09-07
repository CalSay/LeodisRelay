import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { dataRoot } from './storage';
import type { Report } from './types';

function artifactPath(report: Report): string {
  // Submitted bytes are keyed to a frozen revision; draft previews to a save version.
  const key = createHash('sha256').update(`${report.id}:${report.state}:${report.state === 'draft' ? report.version : report.revision}`).digest('hex');
  return join(dataRoot(),'pdf',`${key}.pdf`);
}
export async function readPdf(report: Report): Promise<Buffer | undefined> {
  try { return await readFile(artifactPath(report)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
const running = new Map<string,Promise<Buffer>>();
export async function ensurePdf(report: Report, render?: (report: Report) => Promise<Uint8Array>): Promise<Buffer> {
  const path = artifactPath(report);
  const cached = await readPdf(report);
  if (cached) return cached;
  const active = running.get(path);
  if (active) return active;
  const work = (async () => {
    const bytes = Buffer.from(await (render ?? renderDocument)(report));
    await mkdir(join(dataRoot(),'pdf'),{ recursive:true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary,bytes,{ flag:'wx' });
      await rename(temporary,path); // Readers never see a partially written PDF.
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return bytes;
  })();
  running.set(path,work);
  try { return await work; } finally { running.delete(path); }
}
async function renderDocument(report: Report): Promise<Uint8Array> {
  const [{ renderReportPdf }, { documentModel }] = await Promise.all([import('@relay/documents'),import('./documentModel')]);
  return renderReportPdf(await documentModel(report));
}
