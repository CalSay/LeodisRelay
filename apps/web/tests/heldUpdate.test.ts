import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftSignatureToSend, sendWaitingUpdate, updateSendSettled, updateSending, withUpdateLock } from '../lib/heldUpdate';
import type { Report } from '../lib/types';

const report = (draftSignature?: Report['draftSignature']) => ({ author: 'Sam Signal', ...(draftSignature ? { draftSignature } : {}) }) as Report;

test('a site update sent by itself is signed as the Send button signs it', () => {
  assert.deepEqual(draftSignatureToSend(report()), { name: 'Sam Signal' }, 'no signature touched: the author’s name');
  assert.deepEqual(draftSignatureToSend(report({ name: '  ' })), { name: 'Sam Signal' }, 'an emptied name box: the author’s name');
  assert.deepEqual(draftSignatureToSend(report({ name: 'S. Signal ', dataUrl: 'data:image/png;base64,AA==' })), { name: 'S. Signal', dataUrl: 'data:image/png;base64,AA==' });
  assert.deepEqual(draftSignatureToSend(report({ name: ' Sam Signal ', typed: true })), { name: 'Sam Signal', typed: true }, 'typed: the name as typed, never filled in');
});

test('one send of a report at a time across tabs', async () => {
  // A stand-in for navigator.locks: one holder per name, the rest queue.
  const held = new Map<string, Promise<unknown>>();
  const locks = { request: (name: string, work: () => Promise<unknown>) => {
    const run = (held.get(name) ?? Promise.resolve()).then(work, work);
    held.set(name, run.catch(() => undefined));
    return run;
  } } as unknown as Pick<LockManager, 'request'>;
  const order: string[] = [];
  let release!: () => void;
  const first = withUpdateLock('rep-1', async () => { order.push('first in'); await new Promise<void>(r => { release = r; }); order.push('first out'); }, { locks });
  const second = withUpdateLock('rep-1', async () => { order.push('second'); }, { locks });
  const other = withUpdateLock('rep-2', async () => { order.push('other report'); }, { locks });
  await other;
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(order, ['first in', 'other report'], 'the same report waits; another does not');
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first in', 'other report', 'first out', 'second']);
});

test('nothing waiting on the phone: nothing is sent, and the report page need not wait', async () => {
  // No localStorage here, so no waiting line: skipped before any request.
  const result = sendWaitingUpdate('rep-1', 'sam', { locks: null });
  assert.equal(updateSending('rep-1'), true, 'the report page would wait for it');
  assert.equal(sendWaitingUpdate('rep-1', 'sam', { locks: null }), result, 'a second call while one runs shares it');
  assert.deepEqual(await result, { kind: 'skipped' });
  await updateSendSettled('rep-1');
  assert.equal(updateSending('rep-1'), false);
});
