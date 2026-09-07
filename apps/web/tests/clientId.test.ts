import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientId } from '../lib/clientId';
test('LAN-safe IDs use random bytes and produce distinct version-4 UUIDs',()=>{
  const ids=Array.from({length:100},clientId);
  assert.equal(new Set(ids).size,100);
  for(const id of ids) assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
