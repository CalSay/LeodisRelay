import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defectKey, heldDefectsToSend, readHeldDefect, readReceipt, receiptKey, sendHeldDefect, type HeldDefect } from '../lib/heldDefect';

/** A stand-in for localStorage, with key() and length like the real one. */
function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() { return items.size; },
    items,
  };
}

const photo = { id: '11111111-1111-4111-8111-111111111111', dataUrl: '/api/media/11111111-1111-4111-8111-111111111111', caption: '', capturedAt: '2026-10-21T09:00:00Z' };
const defect = (over: Partial<HeldDefect> = {}): HeldDefect => ({ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', projectId: 'proj-1', description: 'Cracked tile', location: 'Flat 4 kitchen', affectedTrade: 'Electrical', photos: [photo], pending: true, ...over });
const blob = async () => new Blob(['jpeg']);
const issue = { id: 'iss-1', reference: 'TH-ISS-001', projectId: 'proj-1' };

/** A server that, like defectStore.ts, keeps one issue per request id. */
function server(script: (call: number) => Response | 'offline' = () => new Response(JSON.stringify(issue), { status: 201 })) {
  const ids: string[] = [];
  let calls = 0;
  const fetcher = (async (_url: string, init: RequestInit) => {
    const call = ++calls;
    const answer = script(call);
    if (answer === 'offline') throw new TypeError('Failed to fetch');
    ids.push(JSON.parse(String((init.body as FormData).get('defect'))).requestId);
    return answer;
  }) as unknown as typeof fetch;
  return { fetcher, ids, calls: () => calls };
}

/** One holder at a time per name, as the Web Locks API gives across tabs. */
function locks() {
  const chains = new Map<string, Promise<unknown>>();
  return { request: ((name: string, run: () => Promise<unknown>) => {
    const next = (chains.get(name) ?? Promise.resolve()).then(run, run);
    chains.set(name, next.catch(() => undefined));
    return next;
  }) as unknown as LockManager['request'] };
}

test('a held defect is read back only if RELAY wrote it for this project', () => {
  assert.equal(readHeldDefect(JSON.stringify(defect()), 'proj-1')?.pending, true);
  assert.equal(readHeldDefect(JSON.stringify(defect()), 'proj-2'), null);
  assert.equal(readHeldDefect(JSON.stringify(defect({ photos: [{ ...photo, dataUrl: 'data:image/png;base64,x' }] })), 'proj-1'), null);
  assert.equal(readHeldDefect('not json', 'proj-1'), null);
  assert.equal(readHeldDefect(null, 'proj-1'), null);
});

test('only defects this person tapped Send on are sent by themselves', () => {
  const s = memory({
    [defectKey('sam', 'proj-1')]: JSON.stringify(defect()),
    [defectKey('sam', 'proj-2')]: JSON.stringify(defect({ projectId: 'proj-2', pending: false })),
    [defectKey('jo', 'proj-1')]: JSON.stringify(defect()),
    'relay-send-on-signal': '[]',
  });
  assert.deepEqual(heldDefectsToSend('sam', s).map(d => d.key), [defectKey('sam', 'proj-1')]);
  assert.deepEqual(heldDefectsToSend('jo', s).map(d => d.key), [defectKey('jo', 'proj-1')], 'another person on a shared phone sends only their own');
});

test('sent by itself: one issue, and the phone lets go of it', async () => {
  const key = defectKey('sam', 'proj-1'), s = memory({ [key]: JSON.stringify(defect()) }), api = server();
  const result = await sendHeldDefect(key, defect(), true, { store: s, fetch: api.fetcher, blob, locks: locks() });
  assert.equal(result.kind, 'sent');
  assert.equal(s.items.has(key), false);
  assert.deepEqual(readReceipt(s.getItem(receiptKey(key)), defect().requestId), { id: 'iss-1', reference: 'TH-ISS-001' }, 'its receipt is left for another tab showing it');
  assert.equal(readReceipt(s.getItem(receiptKey(key)), 'another-request'), null);
  assert.equal(receiptKey(key), 'relay-defect-receipt:sam:proj-1');
  assert.deepEqual(heldDefectsToSend('sam', s), [], 'a receipt is not a defect to send');
  // Sending by itself again (a timer, the online event, a second tab) finds nothing held.
  assert.equal((await sendHeldDefect(key, defect(), true, { store: s, fetch: api.fetcher, blob, locks: locks() })).kind, 'skipped');
  assert.equal(api.calls(), 1);
});

test('no signal keeps it held and frozen; it goes when signal returns', async () => {
  const key = defectKey('sam', 'proj-1'), s = memory({ [key]: JSON.stringify(defect()) });
  let online = false;
  const api = server(() => online ? new Response(JSON.stringify(issue), { status: 201 }) : 'offline');
  const deps = { store: s, fetch: api.fetcher, blob, locks: locks() };
  assert.equal((await sendHeldDefect(key, defect(), true, deps)).kind, 'waiting');
  assert.equal(readHeldDefect(s.getItem(key), 'proj-1')?.pending, true);
  online = true;
  assert.equal((await sendHeldDefect(key, defect(), true, deps)).kind, 'sent');
  assert.deepEqual(api.ids, [defect().requestId]);
});

test('a timer, the online event and a tap at once: one post', async () => {
  const key = defectKey('sam', 'proj-1'), s = memory({ [key]: JSON.stringify(defect()) }), api = server(), shared = locks();
  const deps = { store: s, fetch: api.fetcher, blob, locks: shared };
  const results = await Promise.all([sendHeldDefect(key, defect(), true, deps), sendHeldDefect(key, defect(), true, deps), sendHeldDefect(key, defect(), true, deps)]);
  assert.deepEqual(results.map(r => r.kind), ['sent', 'sent', 'sent'], 'sends from one page share one answer');
  assert.equal(api.calls(), 1);
});

test('without Web Locks, a tap during a send from the same page shares its answer', async () => {
  const key = defectKey('sam', 'proj-1'), s = memory({ [key]: JSON.stringify(defect()) }), api = server();
  const deps = { store: s, fetch: api.fetcher, blob, locks: null };
  const results = await Promise.all([sendHeldDefect(key, defect(), true, deps), sendHeldDefect(key, defect(), false, deps)]);
  assert.deepEqual(results.map(r => r.kind), ['sent', 'sent']);
  assert.equal(api.calls(), 1);
});

test('two tabs at once: the second waits its turn and finds it gone', async () => {
  const key = defectKey('sam', 'proj-1'), s = memory({ [key]: JSON.stringify(defect()) }), api = server(), shared = locks();
  const first = sendHeldDefect(key, defect(), true, { store: s, fetch: api.fetcher, blob, locks: shared });
  // Another tab is another page: its own copy of the defect, so not the same in-page send.
  const second = shared.request('relay-defect-send:' + defect().requestId, async () => {
    const { readHeldDefect: read } = await import('../lib/heldDefect');
    return read(s.getItem(key), 'proj-1');
  });
  assert.equal((await first).kind, 'sent');
  assert.equal(await second, null, 'by the time the other tab holds the lock, the phone has let go of it');
  assert.equal(api.calls(), 1);
});

test('a tap after another tab sent it asks again for the same request, and gets the same issue', async () => {
  const key = defectKey('sam', 'proj-1'), s = memory(), api = server();
  const result = await sendHeldDefect(key, defect(), false, { store: s, fetch: api.fetcher, blob, locks: locks() });
  assert.equal(result.kind, 'sent');
  assert.deepEqual(api.ids, [defect().requestId], 'same request id, so the server answers with the issue it already has');
});

test('a newer defect started after this one went is left alone', async () => {
  const key = defectKey('sam', 'proj-1'), newer = defect({ requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pending: false, description: 'Next one' });
  const s = memory({ [key]: JSON.stringify(newer) }), api = server();
  assert.equal((await sendHeldDefect(key, defect(), true, { store: s, fetch: api.fetcher, blob, locks: locks() })).kind, 'skipped');
  assert.equal((await sendHeldDefect(key, defect(), false, { store: s, fetch: api.fetcher, blob, locks: locks() })).kind, 'sent');
  assert.equal(readHeldDefect(s.getItem(key), 'proj-1')?.description, 'Next one');
});

test('signed out, a server fault or a cut-short upload waits; a refusal does not', async () => {
  const key = defectKey('sam', 'proj-1');
  for (const status of [401, 500, 503, 400]) {
    const s = memory({ [key]: JSON.stringify(defect()) });
    const api = server(() => new Response(JSON.stringify({ reason: 'x' }), { status }));
    assert.equal((await sendHeldDefect(key, defect(), true, { store: s, fetch: api.fetcher, blob, locks: locks() })).kind, 'waiting', `status ${status}`);
    assert.equal(readHeldDefect(s.getItem(key), 'proj-1')?.pending, true);
  }
  // Each its own request: a refusal is remembered for the rest of the page.
  const editable = defect({ requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }), kept = defect({ requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
  const s = memory({ [key]: JSON.stringify(editable) });
  const refusedEdit = await sendHeldDefect(key, editable, true, { store: s, blob, locks: locks(), fetch: server(() => new Response(JSON.stringify({ reason: 'Add a location in 1–300 characters.' }), { status: 422 })).fetcher });
  assert.deepEqual(refusedEdit, { kind: 'refused', reason: 'Add a location in 1–300 characters.', editable: true });
  assert.equal(readHeldDefect(s.getItem(key), 'proj-1')?.pending, false, 'unfrozen to change, so it does not go as it is');
  const t = memory({ [key]: JSON.stringify(kept) });
  const refused = await sendHeldDefect(key, kept, true, { store: t, blob, locks: locks(), fetch: server(() => new Response(JSON.stringify({ reason: 'You cannot report on this project.' }), { status: 403 })).fetcher });
  assert.equal(refused.kind, 'refused');
  assert.equal(readHeldDefect(t.getItem(key), 'proj-1')?.pending, true, 'kept as it is for Try again');
  const again = server();
  assert.equal((await sendHeldDefect(key, kept, true, { store: t, blob, locks: locks(), fetch: again.fetcher })).kind, 'skipped', 'not sent again by itself');
  assert.equal((await sendHeldDefect(key, kept, false, { store: t, blob, locks: locks(), fetch: again.fetcher })).kind, 'sent', '"Try again" still sends it');
  assert.equal(again.calls(), 1);
});

test('a refusal, then "Try again" with no signal: it goes by itself again', async () => {
  const key = defectKey('sam', 'proj-1'), d = defect({ requestId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }), s = memory({ [key]: JSON.stringify(d) });
  const deps = (fetcher: typeof fetch) => ({ store: s, blob, locks: locks(), fetch: fetcher });
  assert.equal((await sendHeldDefect(key, d, true, deps(server(() => new Response(JSON.stringify({ reason: 'Read-only for now.' }), { status: 409 })).fetcher))).kind, 'refused');
  assert.equal((await sendHeldDefect(key, d, false, deps(server(() => 'offline').fetcher))).kind, 'waiting');
  assert.equal((await sendHeldDefect(key, d, true, deps(server().fetcher))).kind, 'sent', 'the screen says it goes by itself, so it does');
});

test('a photograph missing from the phone is not sent', async () => {
  const missing = defect({ requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });
  const key = defectKey('sam', 'proj-1'), s = memory({ [key]: JSON.stringify(missing) }), api = server();
  const result = await sendHeldDefect(key, missing, true, { store: s, fetch: api.fetcher, blob: async () => undefined, locks: locks() });
  assert.equal(result.kind, 'refused');
  assert.equal(api.calls(), 0);
});
