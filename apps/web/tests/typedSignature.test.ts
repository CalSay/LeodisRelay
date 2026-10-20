import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Principal } from '@relay/platform';
import { createReport, getReport, saveDraft, submitReport } from '../lib/serverStore';
import { CHECKLIST_TYPES, startingCards } from '../lib/reportTypes';
import { reviewReport } from '../lib/review';
import { documentModel } from '../lib/documentModel';
import { invalidSignature } from '../lib/validateSignature';
import { signatureMethod, signs, TYPED_STATEMENT } from '../lib/signature';
import { heldSignature, signedAsIs, signedContent, type SignedOffline } from '../lib/offlineStart';
import type { Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:engineer' as never, oid:'engineer', name:'G. Stephenson', email:'g@example.test', role:'Engineer', trade:'Electrical' };
const drawn = 'data:image/png;base64,iVBORw0KGgo=';
const answered = (cards: Observation[]) => cards.map(o => ({ ...o, check: { ...o.check!, answer: 'ok' as const } }));
const ok = <T,>(outcome: { ok: true; value: T } | { ok: false; reason: string }): T => { assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.reason); return (outcome as { ok: true; value: T }).value; };

test('signing by typing a name, without a store', async t => {
  await t.test('the offline page ticks the same statement as RELAY', () => {
    const source = readFileSync(resolve(__dirname, '../../public/offline.js'), 'utf8');
    const statement = /const TYPED_STATEMENT = '([^']+)'/.exec(source)?.[1];
    assert.equal(statement, TYPED_STATEMENT);
  });

  await t.test('a typed signature signs only with a name; a drawing signs as before', () => {
    assert.equal(signs({ name: 'G. Stephenson', typed: true }), true);
    assert.equal(signs({ name: '  ', typed: true }), false, 'ticked with no name');
    assert.equal(signs({ name: 'G. Stephenson' }), false, 'a name alone');
    assert.equal(signs({ name: '', dataUrl: drawn }), true);
    assert.equal(signs(undefined), false);
    assert.equal(signatureMethod({ typed: true }), 'typed');
    assert.equal(signatureMethod({ dataUrl: drawn }), 'drawn');
    assert.equal(signatureMethod({}), 'name only');
  });

  await t.test('a draft may carry a typed signature, never typed and drawn at once', () => {
    assert.equal(invalidSignature({ name: 'G', typed: true }), null);
    assert.equal(invalidSignature({ name: 'G', dataUrl: drawn }), null);
    assert.equal(invalidSignature({ name: 'G', typed: true, dataUrl: drawn }), 'Malformed signature.');
    assert.equal(invalidSignature({ name: 'G', typed: 'yes' }), 'Malformed signature.');
    assert.equal(invalidSignature({ name: 'G', typed: false }), 'Malformed signature.');
    assert.equal(invalidSignature({ name: 'G', typed: true, statement: 'something else' }), 'Malformed signature.', 'the client never supplies the statement');
  });

  await t.test('every inspection type can be signed by typing, and says so when the name is missing', () => {
    for (const type of CHECKLIST_TYPES) {
      const base = { id:'r', projectId:'p', reference:'X', visitDate:'2026-10-20', author:'G', state:'draft', version:1, revision:1, review:'not_required', reportType: type.id, observations: answered(startingCards(type)) } as Report;
      const blocking = (r: Report) => reviewReport(r).filter(f => f.blocking);
      assert.deepEqual(blocking({ ...base, draftSignature: { name: 'G. Stephenson', typed: true } }), [], type.id);
      assert.deepEqual(blocking({ ...base, draftSignature: { name: 'G. Stephenson', dataUrl: drawn } }), [], `${type.id} drawn`);
      const empty = blocking({ ...base, draftSignature: { name: '', typed: true } });
      assert.equal(empty.length, 1);
      assert.match(empty[0]!.message, /Type your full name/);
      assert.match(blocking({ ...base, draftSignature: { name: 'G' } })[0]!.message, /Sign below/);
    }
  });

  await t.test('signed with no signal by typing: sent only as signed, and as typed', () => {
    const checks = answered(startingCards(CHECKLIST_TYPES[0]!));
    const signed: SignedOffline = { name: 'G. Stephenson', typed: true, signedAt: '2026-10-20T22:00:00.000Z', content: signedContent(checks) };
    assert.equal(signedAsIs({ signed, observations: checks }), true);
    assert.equal(signedAsIs({ signed: { ...signed, name: ' ' }, observations: checks }), false, 'no name');
    assert.equal(signedAsIs({ signed, observations: checks.map((o, i) => i === 0 ? { ...o, whatHappened: 'changed' } : o) }), false, 'changed after signing');
    assert.deepEqual(heldSignature(signed), { name: 'G. Stephenson', typed: true });
    const { typed: _typed, ...rest } = signed;
    assert.deepEqual(heldSignature({ ...rest, dataUrl: drawn }), { name: 'G. Stephenson', dataUrl: drawn });
  });
});

test('a typed signature through the store, the office and the PDF', async t => {
  const root = mkdtempSync(join(tmpdir(), 'relay-typed-signature-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    for (const type of CHECKLIST_TYPES) await t.test(`a ${type.name.toLowerCase()} sent with a typed signature records what was ticked and who was signed in`, async () => {
      const draft = createReport('proj-011lme', engineer.name, engineer, type.id);
      const saved = ok(saveDraft(draft.id, { ...draft, observations: answered(draft.observations), draftSignature: { name: 'George Stephenson', typed: true } }, draft.version));
      assert.deepEqual(getReport(draft.id)?.draftSignature, { name: 'George Stephenson', typed: true }, 'the tick survives a reload');
      assert.equal((await submitReport(draft.id, { name: 'George Stephenson' }, saved.version, engineer.name)).ok, false, 'a name alone does not sign it');
      assert.equal((await submitReport(draft.id, { name: '  ', typed: true }, saved.version, engineer.name)).ok, false, 'nor a tick with no name');
      assert.equal((await submitReport(draft.id, { name: 'G', typed: true, dataUrl: drawn }, saved.version, engineer.name)).ok, false, 'nor both at once');
      const sent = ok(await submitReport(draft.id, { name: ' George Stephenson ', typed: true }, saved.version, engineer.name));
      const signature = sent.signature!;
      assert.equal(signature.name, 'George Stephenson');
      assert.equal(signature.typed, true);
      assert.equal(signature.statement, TYPED_STATEMENT);
      assert.equal(signature.signedInAs, engineer.name);
      assert.equal(signature.dataUrl, undefined);
      assert.ok(Date.parse(signature.signedAt) > 0, 'the server dates it');
      assert.equal(sent.draftSignature, undefined);
      const model = await documentModel(sent);
      assert.equal(model.signature?.typed, true, 'the PDF knows it was typed');
      assert.equal(model.signature?.statement, TYPED_STATEMENT);
    });

    await t.test('a drawn signature is kept as it was, and not marked typed', async () => {
      const type = CHECKLIST_TYPES[0]!;
      const draft = createReport('proj-011lme', engineer.name, engineer, type.id);
      const saved = ok(saveDraft(draft.id, { ...draft, observations: answered(draft.observations), draftSignature: { name: engineer.name, dataUrl: drawn } }, draft.version));
      const sent = ok(await submitReport(draft.id, { name: engineer.name, dataUrl: drawn }, saved.version, engineer.name));
      assert.equal(sent.signature?.dataUrl, drawn);
      assert.equal(sent.signature?.typed, undefined);
      assert.equal(sent.signature?.statement, undefined);
    });

    await t.test('a site update cannot be typed-signed: its name is printed either way', async () => {
      const draft = createReport('proj-011lme', engineer.name, engineer);
      const progress: Observation = { id:'obs-1', type:'update', location:'L3 riser', whatHappened:'Containment complete', actionNeeded:'', owner:'', photos:[] };
      const saved = ok(saveDraft(draft.id, { ...draft, observations: [progress] }, draft.version));
      assert.equal((await submitReport(draft.id, { name: engineer.name, typed: true }, saved.version, engineer.name)).ok, false);
      assert.equal(ok(await submitReport(draft.id, { name: engineer.name }, saved.version, engineer.name)).signature?.typed, undefined);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
