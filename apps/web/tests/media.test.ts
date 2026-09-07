import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { putMedia, getMedia, mediaBytes, documentPhotoUrl, renditionBytes } from '../lib/mediaStore';
import sharp from 'sharp';
import { mediaUrl } from '../lib/media';
import { validatePhotos } from '../lib/validatePhotos';

test('binary uploads are immutable, retryable, scoped, and renderable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'relay-media-test-'));
  process.env.RELAY_MEDIA_ROOT = root;
  const id = randomUUID();
  const bytes = await sharp({create:{width:2400,height:1800,channels:3,background:'#aa7733'}}).png().toBuffer();
  const record = { ownerId: 'person-1', reportId: 'report-1', mime: 'image/png' };
  try {
    await putMedia(id, record, bytes);
    await putMedia(id, record, bytes);
    assert.deepEqual(await mediaBytes(id), bytes);
    assert.equal((await getMedia(id))?.ownerId, 'person-1');
    await assert.rejects(putMedia(id, { ...record, ownerId: 'person-2' }, bytes));
    await assert.rejects(putMedia(id, record, Buffer.concat([bytes, Buffer.from('changed')])));
    await assert.rejects(putMedia(randomUUID(), record, Buffer.from('not an image')));
    await assert.rejects(putMedia('../escape', record, bytes));
    await assert.rejects(documentPhotoUrl('https://example.com/private'));
    const pdf = await renditionBytes(id,'pdf');
    const thumb = await renditionBytes(id,'thumb');
    assert.equal((await sharp(pdf).metadata()).width,1600);
    assert.equal((await sharp(thumb).metadata()).width,480);
    assert.equal(await documentPhotoUrl(mediaUrl(id)), `data:image/jpeg;base64,${pdf.toString('base64')}`);
    assert.deepEqual(await renditionBytes(id,'pdf'),pdf);
    const broken = randomUUID();
    await assert.rejects(putMedia(broken,record,bytes.subarray(0,40)));
    assert.equal(await getMedia(broken),null,'Broken image is never acknowledged');
    const webpId = randomUUID();
    await putMedia(webpId,{...record,mime:'image/webp'},await sharp(bytes).webp().toBuffer());
    assert.match(await documentPhotoUrl(mediaUrl(webpId)),/^data:image\/jpeg;base64,/);
    const orientedId = randomUUID();
    const oriented = await sharp({create:{width:120,height:80,channels:3,background:'#555555'}}).jpeg().withMetadata({orientation:6}).toBuffer();
    await putMedia(orientedId,{...record,mime:'image/jpeg'},oriented);
    assert.equal((await sharp(await renditionBytes(orientedId,'pdf')).metadata()).width,80,'EXIF rotation is applied');
    const photo = { id, dataUrl: mediaUrl(id), caption: '', capturedAt: new Date().toISOString() };
    assert.equal(await validatePhotos([photo], { reportId: 'report-1' }), null);
    assert.ok(await validatePhotos([photo], { reportId: 'report-2' }));
    assert.ok(await validatePhotos([{ ...photo, id: randomUUID() }], { reportId: 'report-1' }));
    assert.ok(JSON.stringify(photo).length < 250, 'Report metadata contains no photograph bytes');
  } finally {
    delete process.env.RELAY_MEDIA_ROOT;
    await rm(root, { recursive: true, force: true });
  }
});
