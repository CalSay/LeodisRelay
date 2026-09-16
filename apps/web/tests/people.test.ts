import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { putRecord, records, getRecord } from '../lib/storage';
import { INITIAL_ROSTER } from '../lib/auth/roster';
import { addPerson, cleanName, peopleChecklist, relayNameForEmail, relayNamesById, removePerson, renamePerson, restorePerson, setAssignment, type Person } from '../lib/people';

process.env.RELAY_DATA_ROOT = mkdtempSync(join(tmpdir(), 'relay-people-'));
const admin: Principal = { id: 'entra:admin' as never, oid: 'admin', name: 'Cal Say', email: 'callum@leodisme.com', role: 'Admin' };

test('names are trimmed and collapsed, and every change is validated', () => {
  assert.equal(cleanName('  Tom   Liddell \t'), 'Tom Liddell');
  assert.deepEqual(addPerson(admin, { email: 'someone@example.com', name: 'Some One', assignment: 'Manager' }), { ok: false, status: 422, reason: 'Use a @leodisme.com work email.' });
  assert.equal((addPerson(admin, { email: 'new.person@leodisme.com', name: ' x ', assignment: 'Manager' }) as { status: number }).status, 422, 'names under 2 characters are refused');
  assert.equal((addPerson(admin, { email: 'new.person@leodisme.com', name: 'y'.repeat(81), assignment: 'Manager' }) as { status: number }).status, 422, 'names over 80 characters are refused');
  assert.equal((addPerson(admin, { email: 'new.person@leodisme.com', name: 'New Person', assignment: 'Owner' }) as { status: number }).status, 422, 'unknown roles are refused');
  assert.equal((addPerson(admin, { email: 'TOM@LeodisME.com', name: 'Tom Liddell', assignment: 'Manager' }) as { status: number }).status, 409, 'people already listed cannot be added twice, whatever the case');
  assert.equal((renamePerson(admin, { email: 'nobody@leodisme.com', name: 'No Body' }) as { status: number }).status, 404);
  assert.equal((setAssignment(admin, { email: 'nobody@leodisme.com', assignment: 'Manager' }) as { status: number }).status, 404);
  assert.equal(records('people').length, 0, 'refused changes write nothing');
});

test('the checklist layers stored changes over the roster', () => {
  const added = addPerson(admin, { email: '  Jane.Doe@LEODISME.com ', name: '  Jane   Doe ', assignment: 'Engineer.HVAC' });
  assert.equal(added.ok, true);
  const person = (added as { person: Person }).person;
  assert.equal(person.id, 'jane.doe@leodisme.com');
  assert.equal(person.relayName, 'Jane Doe');
  assert.equal(person.addedById, admin.id);
  assert.equal((addPerson(admin, { email: 'jane.doe@leodisme.com', name: 'Jane Doe', assignment: 'Manager' }) as { status: number }).status, 409);

  assert.equal(setAssignment(admin, { email: 'danny@leodisme.com', assignment: 'Engineer.PH' }).ok, true);
  assert.equal(removePerson(admin, { email: 'bryony@leodisme.com' }).ok, true);
  assert.equal((removePerson(admin, { email: 'bryony@leodisme.com' }) as { status: number }).status, 409);

  const list = peopleChecklist();
  const find = (email: string) => list.find(e => e.email === email);
  assert.equal(find('danny@leodisme.com')?.assignment, 'Engineer.PH', 'stored assignment overrides the roster');
  assert.equal(find('bryony@leodisme.com'), undefined, 'removed people leave the checklist');
  assert.equal(find('jane.doe@leodisme.com')?.addedByRelay, true, 'people added in Relay join it');
  assert.equal(find('tom@leodisme.com')?.addedByRelay, false);
  assert.equal(list.length, INITIAL_ROSTER.length, 'one added, one removed');

  assert.equal(restorePerson(admin, { email: 'bryony@leodisme.com' }).ok, true);
  assert.equal(peopleChecklist().find(e => e.email === 'bryony@leodisme.com')?.assignment, 'Engineer.Electrical');
  assert.equal(records<{ action: string }>('audit').filter(a => a.action.startsWith('person-')).length, 4, 'each change is audited');
});

test('renames are logged with who made them and apply by email', () => {
  assert.equal(renamePerson(admin, { email: 'tom@leodisme.com', name: 'Tom  Liddel' }).ok, true);
  const renamed = renamePerson(admin, { email: 'Tom@leodisme.com', name: 'Tom Liddell' });
  assert.equal(renamed.ok, true);
  const log = (renamed as { person: Person }).person.log;
  assert.deepEqual(log.map(e => [e.action, e.from, e.to, e.actorId, e.actor]), [
    ['renamed', undefined, 'Tom Liddel', admin.id, 'Cal Say'],
    ['renamed', 'Tom Liddel', 'Tom Liddell', admin.id, 'Cal Say'],
  ]);
  const same = renamePerson(admin, { email: 'tom@leodisme.com', name: 'Tom Liddell' });
  assert.equal((same as { person: Person }).person.log.length, 2, 'an unchanged name adds no entry');
  assert.equal(relayNameForEmail('TOM@leodisme.com'), 'Tom Liddell');
  assert.equal(relayNameForEmail('ollie@leodisme.com'), undefined);
  assert.equal(getRecord<Person>('people', 'tom@leodisme.com')?.assignment, undefined, 'renaming does not pin a roster role');
});

test('Relay names join to account ids through identities', () => {
  putRecord('identities', { id: 'entra:tom', email: 'Tom@LeodisME.com', oid: 'tom', name: 'Tom L | Leodis M&E', microsoftName: 'Tom L | Leodis M&E' });
  putRecord('identities', { id: 'entra:ollie', email: 'ollie@leodisme.com', oid: 'ollie', name: 'Ollie T' });
  putRecord('identities', { id: 'actor', email: 'actor@example.invalid' });
  assert.deepEqual(relayNamesById(), { 'entra:tom': 'Tom Liddell' });
  // Someone who signed in without being listed can still be named.
  putRecord('identities', { id: 'entra:guest', email: 'guest@leodisme.com', oid: 'guest', name: 'Guest' });
  assert.equal(renamePerson(admin, { email: 'guest@leodisme.com', name: 'Guest Engineer' }).ok, true);
  assert.equal(relayNamesById()['entra:guest'], 'Guest Engineer');
  assert.equal(peopleChecklist().some(e => e.email === 'guest@leodisme.com'), false, 'naming does not put them on the checklist');
});
