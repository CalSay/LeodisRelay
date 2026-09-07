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
