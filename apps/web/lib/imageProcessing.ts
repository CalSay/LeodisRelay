import sharp from 'sharp';

// Bound CPU and decoded-image memory on the shared VPS.
sharp.concurrency(1);
sharp.cache({ memory:32, files:0, items:20 });
let active = 0;
const waiting: (() => void)[] = [];
export async function imageRenditions(bytes: Buffer) {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try {
    const input = sharp(bytes,{ limitInputPixels:50_000_000, failOn:'warning' });
    const metadata = await input.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) throw new Error('Choose a single JPEG, PNG or WebP photograph.');
    // rotate() applies EXIF orientation. Flatten transparent PNGs against paper.
    const normalized = input.rotate().flatten({ background:'#ffffff' });
    const pdf = await normalized.clone().resize({ width:1600,height:1600,fit:'inside',withoutEnlargement:true }).jpeg({ quality:85,mozjpeg:false }).toBuffer();
    const thumb = await normalized.clone().resize({ width:480,height:480,fit:'inside',withoutEnlargement:true }).jpeg({ quality:78 }).toBuffer();
    return { pdf,thumb };
  } finally {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
}
