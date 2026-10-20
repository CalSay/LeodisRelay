import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Line endings are normalised, so a Windows checkout hashes the same as Linux.
const publicFile = (name: string) => readFileSync(resolve(__dirname, '../../public', name), 'utf8').replace(/\r\n/g, '\n');

/*
 * The service worker serves offline.js from its cache before the network, so a
 * phone keeps the old offline page until the cache name changes. PR #39 changed
 * offline.js under the same name and no test noticed. This pins the offline
 * files to the cache name: change either file, bump CACHE in public/sw.js and
 * record the new name and digest here.
 */
const RECORDED = { cache: 'relay-public-v8', digest: 'd0a184f367cb9ecaede04a2651e041cf930f93959f7a62e7303376fb34586aed' };

test('the offline files have not changed under the same service worker cache name', () => {
  const cache = /const CACHE = '([^']+)'/.exec(publicFile('sw.js'))?.[1];
  const digest = createHash('sha256').update(publicFile('offline.js') + publicFile('offline.html')).digest('hex');
  assert.equal(cache, RECORDED.cache, 'public/sw.js has a new cache name: record it and the digest below in this test.');
  assert.equal(digest, RECORDED.digest, `offline.js or offline.html changed: bump CACHE in public/sw.js, then record it with digest ${digest} in this test.`);
});
