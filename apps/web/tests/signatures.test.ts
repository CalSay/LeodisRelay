import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {createReport,getReport,reportsFor,saveDraft,submitReport} from '../lib/serverStore';
import {database} from '../lib/storage';
import {saveWithJournal,type SaveJournal,type SaveRequest} from '../lib/saveRequest';
import {invalidSignature} from '../lib/validateSignature';
import type {Observation,Report} from '../lib/types';

const engineer:Principal = {id:'entra:engineer' as never,oid:'engineer',name:'G. Stephenson',email:'g@example.test',role:'Engineer',trade:'Electrical'};
const progress:Observation = {id:'obs-progress',type:'update',location:'L3 riser',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]};
const drawn = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ok = <T,>(outcome:{ok:boolean}) => { assert.equal(outcome.ok,true,JSON.stringify(outcome)); return (outcome as {ok:true;value:T}).value; };

// One store per file: the connection is a module singleton that is not reopened after close.
test('a signature on a draft is saved with it and survives a reload',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-signatures-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    await t.test('saved to the server and read back as it was drawn',() => {
      const draft = createReport('proj-011lme',engineer.name,engineer);
      const saved = ok<Report>(saveDraft(draft.id,{...draft,observations:[progress],draftSignature:{name:'George Stephenson',dataUrl:drawn}},draft.version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
      assert.deepEqual(saved.draftSignature,{name:'George Stephenson',dataUrl:drawn});
      // A reload reads the report fresh from the store.
      assert.deepEqual(getReport(draft.id)?.draftSignature,{name:'George Stephenson',dataUrl:drawn});
    });

    await t.test('a later save without one clears it, and a nothing stale is kept',() => {
      const draft = createReport('proj-011lme',engineer.name,engineer);
      const signed = ok<Report>(saveDraft(draft.id,{...draft,draftSignature:{name:'G. S.',dataUrl:drawn}},draft.version));
      const {draftSignature:_drawn,...unsigned} = signed;
      const cleared = ok<Report>(saveDraft(draft.id,unsigned,signed.version));
      assert.equal(cleared.draftSignature,undefined);
      assert.equal(getReport(draft.id)?.draftSignature,undefined);
    });

    await t.test('a retried request must carry the same signature',() => {
      const draft = createReport('proj-011lme',engineer.name,engineer);
      const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      ok(saveDraft(draft.id,{...draft,draftSignature:{name:'G. S.',dataUrl:drawn}},draft.version,id));
      ok(saveDraft(draft.id,{...draft,draftSignature:{name:'G. S.',dataUrl:drawn}},draft.version,id));
      const changed = saveDraft(draft.id,{...draft,draftSignature:{name:'Someone else'}},draft.version,id);
      assert.equal(changed.ok,false);
    });

    await t.test('the image stays out of list summaries',() => {
      const rows = database().prepare("SELECT summary FROM records WHERE kind='reports'").all();
      assert.ok(rows.length > 0);
      for (const row of rows) assert.doesNotMatch(row.summary as string,/draftSignature|data:image/);
      for (const item of reportsFor(engineer).items) assert.equal('draftSignature' in item,false);
    });

    await t.test('sending turns it into the report signature and drops the draft copy',async () => {
      const draft = createReport('proj-011lme',engineer.name,engineer);
      const saved = ok<Report>(saveDraft(draft.id,{...draft,observations:[progress],draftSignature:{name:'G. S.',dataUrl:drawn}},draft.version));
      const sent = ok<Report>(await submitReport(draft.id,{name:'G. S.',dataUrl:drawn},saved.version));
      assert.equal(sent.signature?.dataUrl,drawn);
      assert.equal(sent.draftSignature,undefined);
      assert.equal(getReport(draft.id)?.draftSignature,undefined);
    });
  } finally {
    database().close();
    rmSync(root,{recursive:true,force:true});
  }
});

test('the save journal sends the signature and resends when only the signature changed',async () => {
  let pending:SaveRequest | undefined;
  const journal:SaveJournal = {claim:async request => pending ??= structuredClone(request),acknowledge:async id => { if (pending?.requestId === id) pending = undefined; }};
  const report = {id:'report',version:1,observations:[]} as unknown as Report;
  // A request journalled unsigned, then the engineer signs before it is acknowledged.
  await assert.rejects(saveWithJournal(report,1,journal,async () => { throw new Error('Response lost'); }));
  const signed = {...report,draftSignature:{name:'G. S.',dataUrl:drawn}};
  const requests:SaveRequest[] = [];
  await saveWithJournal(signed,1,journal,async request => { requests.push(structuredClone(request)); return {...report,version:request.expectedVersion+1}; });
  assert.equal(requests.length,2);
  assert.equal(requests[0]!.signature,null);
  assert.deepEqual(requests[1]!.signature,{name:'G. S.',dataUrl:drawn});
});

test('only a small PNG and a name are accepted as a signature',() => {
  assert.equal(invalidSignature(undefined),null);
  assert.equal(invalidSignature(null),null);
  assert.equal(invalidSignature({name:'G. S.'}),null);
  assert.equal(invalidSignature({name:'G. S.',dataUrl:drawn}),null);
  assert.equal(invalidSignature({name:'G. S.',dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}),'Malformed signature.');
  assert.equal(invalidSignature({name:'G. S.',dataUrl:'javascript:alert(1)'}),'Malformed signature.');
  assert.equal(invalidSignature({name:1}),'Malformed signature.');
  assert.equal(invalidSignature({name:'G. S.',extra:true}),'Malformed signature.');
  assert.equal(invalidSignature('G. S.'),'Malformed signature.');
  assert.equal(invalidSignature({name:'G. S.',dataUrl:'data:image/png;base64,'+'A'.repeat(400_000)}),'That signature is too large to save.');
});
