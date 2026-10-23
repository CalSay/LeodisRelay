import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRESH_MS, STALE_MS, recentRead } from '../lib/sharepoint/recentRead';

function setUp() {
  let now = 1_000_000, reads = 0, release: (() => void) | undefined;
  const refresh = recentRead(() => { reads++; return new Promise<void>(r => { release = r; }); }, () => now);
  return { refresh, reads: () => reads, finish: async () => { release?.(); release = undefined; await new Promise(r => setImmediate(r)); }, wait: (ms: number) => { now += ms; } };
}

test('the first read is waited for; pages straight after reuse it without asking SharePoint', async () => {
  const s = setUp();
  let done = false;
  const first = s.refresh().then(() => { done = true; });
  await new Promise(r => setImmediate(r));
  assert.equal(done, false, 'nothing stored yet, so the page waits');
  await s.finish(); await first;
  s.wait(FRESH_MS - 1);
  await s.refresh(); await s.refresh();
  assert.equal(s.reads(), 1);
});

test('an older copy answers at once while a new read starts behind it, once', async () => {
  const s = setUp();
  const first = s.refresh(); await s.finish(); await first;
  s.wait(FRESH_MS + 1);
  await s.refresh();
  await s.refresh();
  assert.equal(s.reads(), 2, 'one background read, shared');
  await s.finish();
  s.wait(FRESH_MS - 1);
  await s.refresh();
  assert.equal(s.reads(), 2, 'the background read counts as fresh');
});

test('past ten minutes, or when about to change a record, the page waits for a new read', async () => {
  const s = setUp();
  const first = s.refresh(); await s.finish(); await first;
  s.wait(STALE_MS);
  let done = false;
  const late = s.refresh().then(() => { done = true; });
  await new Promise(r => setImmediate(r));
  assert.equal(done, false);
  await s.finish(); await late;
  done = false;
  const forced = s.refresh(true).then(() => { done = true; });
  await new Promise(r => setImmediate(r));
  assert.equal(done, false, 'force waits even straight after a read');
  await s.finish(); await forced;
  assert.equal(s.reads(), 3);
});

test('a failed first read reaches the page; a failed background read does not', async () => {
  let now = 0, fail = false, reads = 0;
  const refresh = recentRead(async () => { reads++; if (fail) throw new Error('SharePoint down'); }, () => now);
  await refresh();
  fail = true; now += FRESH_MS + 1;
  await refresh();
  await new Promise(r => setImmediate(r));
  assert.equal(reads, 2);
  now += STALE_MS;
  await assert.rejects(refresh(), /SharePoint down/);
});
