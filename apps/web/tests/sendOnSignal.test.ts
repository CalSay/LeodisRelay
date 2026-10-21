import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEND_ON_SIGNAL_KEY, clearWaitingToSend, isWaitingToSend, markWaitingToSend, waitingLines, waitingToSend } from '../lib/sendOnSignal';

/** A stand-in for localStorage. */
function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
    items,
  };
}

test('reports sent with no signal wait on this phone until sent or taken back', async t => {
  await t.test('marked per person; marking twice keeps one entry', () => {
    const s = memory();
    markWaitingToSend('rep-1', 'sam', '2026-10-21T09:00:00Z', s);
    markWaitingToSend('rep-1', 'sam', '2026-10-21T09:05:00Z', s);
    markWaitingToSend('rep-2', 'jo', '2026-10-21T09:06:00Z', s);
    assert.deepEqual(waitingToSend('sam', s), ['rep-1']);
    assert.deepEqual(waitingToSend('jo', s), ['rep-2']);
    assert.equal(isWaitingToSend('rep-1', 'sam', s), true);
    assert.equal(isWaitingToSend('rep-1', 'jo', s), false, 'another person on a shared phone does not send it');
  });

  await t.test('cleared once sent, changed or taken back; the key goes when nothing waits', () => {
    const s = memory();
    markWaitingToSend('rep-1', 'sam', undefined, s);
    markWaitingToSend('rep-2', 'sam', undefined, s);
    clearWaitingToSend('rep-1', s);
    assert.deepEqual(waitingToSend('sam', s), ['rep-2']);
    clearWaitingToSend('rep-2', s);
    assert.equal(s.items.has(SEND_ON_SIGNAL_KEY), false);
    clearWaitingToSend('rep-3', s);
    assert.deepEqual(waitingToSend('sam', s), []);
  });

  await t.test('anything unreadable counts as nothing waiting', () => {
    assert.deepEqual(waitingToSend('sam', memory({ [SEND_ON_SIGNAL_KEY]: 'not json' })), []);
    assert.deepEqual(waitingToSend('sam', memory({ [SEND_ON_SIGNAL_KEY]: '{"reportId":"rep-1"}' })), []);
    assert.deepEqual(waitingToSend('sam', memory({ [SEND_ON_SIGNAL_KEY]: JSON.stringify([{ reportId: 'rep-1' }, { reportId: 'rep-2', principalId: 'sam', at: 'x' }]) })), ['rep-2']);
  });

  await t.test('storage that throws never stops the page', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
    assert.deepEqual(waitingToSend('sam', broken), []);
    assert.doesNotThrow(() => markWaitingToSend('rep-1', 'sam', undefined, broken));
    assert.doesNotThrow(() => clearWaitingToSend('rep-1', broken));
  });
});

test('a waiting line keeps which held copy was sent, and what it is', () => {
  const s = memory();
  markWaitingToSend('rep-1', 'sam', '2026-10-21T09:00:00Z', s, { seq: 'edit-7', what: 'site update' });
  markWaitingToSend('rep-2', 'sam', '2026-10-21T09:01:00Z', s);
  assert.deepEqual(waitingLines('sam', s), [
    { reportId: 'rep-1', principalId: 'sam', at: '2026-10-21T09:00:00Z', seq: 'edit-7', what: 'site update' },
    { reportId: 'rep-2', principalId: 'sam', at: '2026-10-21T09:01:00Z' },
  ]);
  assert.deepEqual(waitingToSend('sam', s), ['rep-1', 'rep-2']);
  // A line someone else wrote with a number that is not one is left out.
  const odd = memory({ [SEND_ON_SIGNAL_KEY]: JSON.stringify([{ reportId: 'rep-3', principalId: 'sam', at: 'x', seq: { n: 1 } }]) });
  assert.deepEqual(waitingLines('sam', odd), []);
});
