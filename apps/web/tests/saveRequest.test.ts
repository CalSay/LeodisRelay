import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveWithJournal, type SaveRequest, type SaveJournal } from '../lib/saveRequest';
import type { Report } from '../lib/types';

test('a lost receipt is retried unchanged before newer edits, using the acknowledged version',async () => {
  let pending:SaveRequest | undefined;
  const journal:SaveJournal = {
    claim:async request => pending ??= structuredClone(request),
    acknowledge:async id => { if (pending?.requestId === id) pending=undefined; },
  };
  const report = {id:'report',version:1,observations:[]} as unknown as Report;
  let first:SaveRequest | undefined;
  await assert.rejects(saveWithJournal(report,1,journal,async request => {first=structuredClone(request);throw new Error('Response lost');}));
  assert.deepEqual(pending,first);
  const changed = {...report,observations:[{id:'obs',whatHappened:'Later edit'}]} as Report;
  const requests:SaveRequest[] = [];
  const result = await saveWithJournal(changed,1,journal,async request => {
    requests.push(structuredClone(request));
    return {...report,observations:request.observations,version:request.expectedVersion+1};
  });
  assert.deepEqual(requests[0],first,'The original ID, base and body survive a retry');
  assert.equal(requests[1]?.expectedVersion,2);
  assert.notEqual(requests[1]?.requestId,first?.requestId);
  assert.equal(result.version,3);
  assert.equal(pending,undefined);
});

test('conflicts retain the exact unsent request',async () => {
  let pending:SaveRequest | undefined;
  const journal:SaveJournal = {claim:async request => pending ??= request,acknowledge:async () => {pending=undefined;}};
  await assert.rejects(saveWithJournal({observations:[]} as unknown as Report,4,journal,async () => {throw new Error('Conflict');}));
  assert.equal(pending?.expectedVersion,4);
});

test('a refused save is not replayed: once the engineer puts it right, the next save goes',async () => {
  let pending:SaveRequest | undefined;
  const journal:SaveJournal = {
    claim:async request => pending ??= structuredClone(request),
    acknowledge:async id => { if (pending?.requestId === id) pending=undefined; },
    discard:async id => { if (pending?.requestId === id) pending=undefined; },
  };
  const report = {id:'report',version:1,observations:[{id:'obs',whatHappened:'x'.repeat(10_001)}]} as unknown as Report;
  // A box too long: the server's definite "no".
  const tooLong = Object.assign(new Error('The card has a box over 10,000 characters, so it was not saved.'),{refused:true});
  await assert.rejects(saveWithJournal(report,1,journal,async () => { throw tooLong; }),tooLong);
  assert.equal(pending,undefined,'the refused request is not kept to replay');
  const shortened = {...report,observations:[{id:'obs',whatHappened:'Shorter'}]} as unknown as Report;
  const sent:SaveRequest[] = [];
  const saved = await saveWithJournal(shortened,1,journal,async request => { sent.push(request); return {...shortened,version:2}; });
  assert.equal(sent.length,1);
  assert.equal(sent[0]!.observations[0]!.whatHappened,'Shorter');
  assert.equal(saved.version,2);
  // No answer at all is still kept and replayed, unchanged.
  await assert.rejects(saveWithJournal(shortened,2,journal,async () => { throw new TypeError('fetch failed'); }));
  assert.notEqual(pending,undefined);
});
