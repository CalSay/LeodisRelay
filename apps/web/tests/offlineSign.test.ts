import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import type {Principal} from '@relay/platform';
import {createReport,getReport,saveDraft,submitReport} from '../lib/serverStore';
import {database} from '../lib/storage';
import {fitStartedChecks,sentLine,signedAsIs,signedContent,startedKey,startedReportId,type SignedOffline} from '../lib/offlineStart';
import {SAFETY_CHECKLIST,invalidShape,reportTypeOf,startingCards} from '../lib/reportTypes';
import {unfinishedReports} from '../lib/unfinishedReports';
import {invalidSignature} from '../lib/validateSignature';
import type {Observation,Report} from '../lib/types';

/*
 * An inspection signed on the offline page (public/offline.js) goes to the
 * office by itself once RELAY reaches the server (lib/heldSend.ts), and only
 * if it is still exactly what was signed.
 */

const engineer:Principal = {id:'entra:offline-signer' as never,oid:'offline-signer',name:'K. Wright',email:'k@example.test',role:'Engineer',trade:'HVAC'};
const drawn = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const project = {projectId:'proj-011lme',projectName:'Tetley Hall - Block E',projectNumber:'011LME'};
/** Every check answered, as the offline page lets it be signed: one action, the rest satisfactory. */
const answered = ():Observation[] => startingCards(reportTypeOf({reportType:'safety-inspection'})).map((o,i) => i === 0
  ? {...o,whatHappened:'Tower missing a toe board',actionNeeded:'Fit toe board',owner:'Scaffolder',check:{...o.check!,answer:'action'}}
  : {...o,check:{...o.check!,answer:'ok'}});
const sign = (observations:Observation[]):SignedOffline => ({name:'K. Wright',dataUrl:drawn,signedAt:'2026-10-20T09:30:00Z',content:signedContent(observations)});

test('the offline page and the app agree on what a signature covers',() => {
  const source = readFileSync(resolve(__dirname,'../../public/offline.js'),'utf8');
  const line = /const signedContent = (observations => .*);\n/.exec(source)?.[1];
  assert.ok(line,'public/offline.js defines signedContent on one line');
  const pageContent = new Function(`return ${line}`)() as (o:unknown[]) => string;
  const sparse = [{id:'x',type:'update',photos:[{id:'p1'}]}];
  for (const observations of [answered(),sparse,[]]) assert.equal(pageContent(observations),signedContent(observations as Observation[]));
});

test('a signature holds only while nothing it covers has changed',() => {
  const checks = answered();
  const signed = sign(checks);
  assert.equal(signedAsIs({signed,observations:checks}),true);
  // The server gives a started report its own card ids: that changes nothing signed.
  assert.equal(signedAsIs({signed,observations:checks.map((o,i) => ({...o,id:`server-${i}`}))}),true);
  const changes:[string,(o:Observation[]) => Observation[]][] = [
    ['an answer',o => o.map((c,i) => i === 1 ? {...c,check:{...c.check!,answer:'na'}} : c)],
    ['the words',o => o.map((c,i) => i === 0 ? {...c,actionNeeded:'Fit toe boards on all lifts'} : c)],
    ['a question',o => o.map((c,i) => i === 2 ? {...c,check:{...c.check!,question:`${c.check!.question}.`}} : c)],
    ['a photo',o => o.map((c,i) => i === 0 ? {...c,photos:[{id:'p1',dataUrl:'/api/media/p1',caption:'',capturedAt:''}]} : c)],
    ['the order',o => [...o].reverse()],
  ];
  for (const [what,change] of changes) assert.equal(signedAsIs({signed,observations:change(checks)}),false,what);
  assert.equal(signedAsIs({observations:checks}),false,'not signed');
  assert.equal(signedAsIs({signed:{...signed,dataUrl:''},observations:checks}),false,'no drawing');
});

test('a checklist reworded on the server since signing breaks the signature',() => {
  const phone = answered();
  const signed = sign(phone);
  const server = startingCards(reportTypeOf({reportType:'safety-inspection'})).map(o => o.check!.item === 'height' ? {...o,check:{...o.check!,question:'Work at height equipment checked'}} : o);
  const fitted = fitStartedChecks(phone,server);
  assert.notEqual(fitted.length,0);
  assert.equal(invalidShape({reportType:'safety-inspection',observations:server} as Report,fitted),null,'the fitted copy still saves');
  assert.equal(signedAsIs({signed,observations:fitted}),false);
  assert.equal(signedAsIs({signed,observations:fitStartedChecks(phone,startingCards(reportTypeOf({reportType:'safety-inspection'})))}),true,'unchanged wording keeps it');
});

test('the note once held work has gone up says what reached the office',() => {
  assert.equal(sentLine([{reference:'LD-SSI-001',started:true,submitted:true}]),'The inspection you signed on this phone has gone to the office.');
  assert.equal(sentLine([{reference:'a',started:true,submitted:true},{reference:'b',started:true,submitted:true}]),'From this phone: 2 signed inspections sent to the office.');
  assert.equal(sentLine([{reference:'a',started:true,submitted:true},{reference:'b',started:false}]),'From this phone: 1 signed inspection sent to the office; 1 report on the server as a draft until you sign and send.');
  assert.match(sentLine([{reference:'a',started:true}]),/stays a draft until you sign and send/);
});

test('the home screen marks a signed inspection as not sent yet',() => {
  const checks = answered();
  const [row] = unfinishedReports([],[{reportId:startedReportId('55555555-5555-4555-8555-555555555555'),heldAt:'2026-10-20T09:30:00Z',observations:checks,
    started:{clientKey:'55555555-5555-4555-8555-555555555555',...project,visitDate:'2026-10-20',startedAt:'2026-10-20T08:00:00Z',reportType:'safety-inspection'},signed:sign(checks)}],[{id:project.projectId,projectName:project.projectName}]);
  assert.equal(row!.signed,true);
  const [plain] = unfinishedReports([],[{reportId:startedReportId('55555555-5555-4555-8555-555555555555'),heldAt:'2026-10-20T09:30:00Z',observations:checks,
    started:{clientKey:'55555555-5555-4555-8555-555555555555',...project,visitDate:'2026-10-20',startedAt:'2026-10-20T08:00:00Z',reportType:'safety-inspection'}}],[{id:project.projectId,projectName:project.projectName}]);
  assert.equal(plain!.signed,undefined);
});

/* ------------------------------------------------------------------------ */
/* The send itself, against the real store, with the phone's store in memory. */

/** Just enough of IndexedDB for lib/localDraft.ts: one object store, requests settle in turn, then the transaction completes. */
function memoryIndexedDB() {
  const databases = new Map<string,Map<string,{keyPath?:string;rows:Map<unknown,unknown>}>>();
  const later = (fn:() => void) => setTimeout(fn,0);
  return {open(name:string) {
    const request:Record<string,unknown> & {result?:unknown} = {};
    later(() => {
      let stores = databases.get(name);
      const fresh = !stores;
      if (!stores) { stores = new Map(); databases.set(name,stores); }
      const db = {
        objectStoreNames:{contains:(n:string) => stores!.has(n)},
        createObjectStore:(n:string,options?:{keyPath?:string}) => { stores!.set(n,{...(options?.keyPath ? {keyPath:options.keyPath} : {}),rows:new Map()}); },
        deleteObjectStore:(n:string) => { stores!.delete(n); },
        close() {},
        transaction(n:string) {
          const store = stores!.get(n)!;
          let open = 0;
          const tx:Record<string,unknown> = {};
          const settle = () => { if (open === 0) later(() => (tx.oncomplete as (() => void) | undefined)?.()); };
          const op = (work:() => unknown) => {
            const r:Record<string,unknown> = {}; open += 1;
            later(() => { r.result = work(); (r.onsuccess as (() => void) | undefined)?.(); open -= 1; settle(); });
            return r;
          };
          tx.objectStore = () => ({
            get:(key:unknown) => op(() => structuredClone(store.rows.get(key))),
            getAll:() => op(() => [...store.rows.values()].map(v => structuredClone(v))),
            put:(value:Record<string,unknown>,key?:unknown) => op(() => { store.rows.set(key ?? value[store.keyPath!],structuredClone(value)); }),
            delete:(key:unknown) => op(() => { store.rows.delete(key); }),
          });
          return tx;
        },
      };
      request.result = db;
      if (fresh) (request.onupgradeneeded as (() => void) | undefined)?.();
      (request.onsuccess as (() => void) | undefined)?.();
    });
    return request;
  }};
}

/** The report routes, as app/api/reports does them, over the real store. `offline` makes every request fail as a lost connection does. */
function fakeServer() {
  const state = {offline:false,offlineSend:false,calls:[] as string[],refuseSend:undefined as string | undefined,failSend:false,dropSendAnswer:false};
  const json = (status:number,value:unknown) => new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  globalThis.fetch = (async (input:string,init?:RequestInit) => {
    if (state.offline) throw new TypeError('fetch failed');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string,unknown> : {};
    state.calls.push(`${method} ${input}`);
    if (input === '/api/reports' && method === 'POST') {
      return json(201,createReport(String(body.projectId),engineer.name,engineer,(body.reportType as never) ?? 'progress',{clientKey:String(body.clientKey),visitDate:String(body.visitDate)}));
    }
    const id = /^\/api\/reports\/([^/?]+)$/.exec(input)?.[1];
    const existing = id ? getReport(id) : undefined;
    if (!id || !existing) return json(404,{reason:'No such report.'});
    if (method === 'PUT') {
      const signatureProblem = invalidSignature(body.signature);
      if (signatureProblem) return json(422,{reason:signatureProblem});
      const observations = body.observations as Observation[];
      const shape = invalidShape(existing,observations);
      if (shape) return json(422,{reason:shape});
      const {draftSignature:saved,...rest} = existing;
      const draftSignature = body.signature === undefined ? saved : body.signature as Report['draftSignature'] | null;
      const outcome = saveDraft(id,{...rest,observations,...(draftSignature ? {draftSignature} : {})},body.expectedVersion as number,body.requestId as string);
      return outcome.ok ? json(200,outcome.value) : json(outcome.status ?? 409,{reason:outcome.reason,...(outcome.current ? {current:outcome.current} : {})});
    }
    if (method === 'POST') {
      if (state.offlineSend) throw new TypeError('fetch failed');
      if (state.failSend) return json(500,{reason:'Something went wrong on the server.'});
      if (state.refuseSend) return json(422,{reason:state.refuseSend});
      const outcome = await submitReport(id,body.signature as {name:string;dataUrl:string},body.expectedVersion as number);
      if (state.dropSendAnswer) { state.dropSendAnswer = false; throw new TypeError('fetch failed'); }
      return outcome.ok ? json(200,outcome.value) : json(outcome.status ?? 409,{reason:outcome.reason});
    }
    return json(405,{reason:'Not here.'});
  }) as typeof fetch;
  return state;
}

// One store per file: the connection is a module singleton that is not reopened after close.
test('a signed inspection goes to the office by itself, only as it was signed',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-offline-sign-'));
  process.env.RELAY_DATA_ROOT = root;
  (globalThis as {indexedDB?:unknown}).indexedDB = memoryIndexedDB();
  const realFetch = globalThis.fetch;
  const server = fakeServer();
  const {sendHeldWork} = await import('../lib/heldSend');
  const {listHeld,update} = await import('../lib/localDraft');
  // Writes a held copy as the offline page does (offline.js startForm, save and its signing).
  const putHeld = (record:Record<string,unknown>) => new Promise<void>(done => {
    const indexed = (globalThis as unknown as {indexedDB:ReturnType<typeof memoryIndexedDB>}).indexedDB;
    const request = indexed.open('relay-drafts') as Record<string,unknown> & {result:{objectStoreNames:{contains:(n:string) => boolean};createObjectStore:(n:string,o:object) => void;transaction:(n:string) => Record<string,unknown>}};
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('unsent')) request.result.createObjectStore('unsent',{keyPath:'key'}); };
    request.onsuccess = () => {
      const tx = request.result.transaction('unsent');
      (tx.objectStore as () => {put:(v:unknown) => unknown})().put(record);
      tx.oncomplete = () => done();
    };
  });
  const keepStarted = (clientKey:string,observations:Observation[],signed?:SignedOffline) => putHeld({key:startedKey(engineer.id,clientKey),reportId:startedReportId(clientKey),principalId:engineer.id,seq:clientKey,observations,heldAt:new Date().toISOString(),
    started:{clientKey,...project,visitDate:new Date().toISOString().slice(0,10),startedAt:new Date().toISOString(),reportType:'safety-inspection'},...(signed ? {signed} : {})});
  try {
    await t.test('signed and unchanged: started, saved and sent, with the signature drawn on the phone',async () => {
      const key = '61111111-1111-4111-8111-111111111111';
      const checks = answered();
      await keepStarted(key,checks,sign(checks));
      const result = await sendHeldWork(engineer.id);
      assert.deepEqual(result.problems,[]);
      assert.equal(result.sent.length,1);
      assert.equal(result.sent[0]!.submitted,true);
      const report = getReport(result.sent[0]!.reportId)!;
      assert.equal(report.state,'submitted');
      assert.equal(report.signature?.dataUrl,drawn);
      assert.equal(report.signature?.name,'K. Wright');
      assert.equal(signedContent(report.observations),signedContent(checks),'what went is what was signed');
      assert.deepEqual(await listHeld(engineer.id),[],'nothing is left on the phone');
    });

    await t.test('changed after signing: it goes up as a draft with no signature, and the engineer is told',async () => {
      const key = '62222222-2222-4222-8222-222222222222';
      const checks = answered();
      const signed = sign(checks);
      await keepStarted(key,checks.map((o,i) => i === 3 ? {...o,check:{...o.check!,answer:'na'}} : o),signed);
      const result = await sendHeldWork(engineer.id);
      assert.equal(result.problems.length,1);
      assert.match(result.problems[0]!.reason,/changed after you signed it, so it was not sent/);
      assert.equal(result.sent.length,1);
      assert.notEqual(result.sent[0]!.submitted,true);
      const report = getReport(result.sent[0]!.reportId)!;
      assert.equal(report.state,'draft');
      assert.equal(report.draftSignature,undefined,'no signature is attached to the changed copy');
      assert.equal(report.signature,undefined);
    });

    await t.test('the answer to sending is lost: next time it is sent without saving again',async () => {
      const key = '63333333-3333-4333-8333-333333333333';
      const checks = answered();
      await keepStarted(key,checks,sign(checks));
      server.calls.length = 0;
      server.dropSendAnswer = true;
      const first = await sendHeldWork(engineer.id);
      assert.deepEqual([first.sent.length,first.problems.length],[0,0],'nothing is claimed while the answer is lost');
      const [kept] = await listHeld(engineer.id);
      assert.equal(Number.isInteger(kept?.signed?.savedVersion),true,'kept on the phone, marked as saved');
      const second = await sendHeldWork(engineer.id);
      assert.equal(second.sent[0]?.submitted,true);
      assert.equal(server.calls.filter(c => c.startsWith('PUT')).length,1,'saved once');
      assert.equal(getReport(second.sent[0]!.reportId)?.state,'submitted');
      assert.deepEqual(await listHeld(engineer.id),[]);
    });

    await t.test('no signal between saving and sending: it stays on the phone, signed and saved, and goes next time',async () => {
      const key = '64444444-4444-4444-8444-444444444444';
      const checks = answered();
      await keepStarted(key,checks,sign(checks));
      server.calls.length = 0;
      server.offlineSend = true;
      const none = await sendHeldWork(engineer.id);
      server.offlineSend = false;
      assert.deepEqual([none.sent.length,none.problems.length],[0,0]);
      const [kept] = await listHeld(engineer.id);
      assert.equal(kept?.signed?.name,'K. Wright');
      assert.equal(Number.isInteger(kept?.signed?.savedVersion),true);
      assert.equal(kept?.report?.draftSignature,undefined,'an editor taking it over shows it unsigned');
      const later = await sendHeldWork(engineer.id);
      assert.equal(later.sent[0]?.submitted,true);
      assert.equal(server.calls.filter(c => c.startsWith('PUT')).length,1,'saved once');
    });

    await t.test('a fault on the server when sending: kept signed, named once, sent next time',async () => {
      const key = '67777777-7777-4777-8777-777777777777';
      const checks = answered();
      await keepStarted(key,checks,sign(checks));
      server.failSend = true;
      const first = await sendHeldWork(engineer.id);
      const again = await sendHeldWork(engineer.id);
      server.failSend = false;
      assert.equal(first.problems.length,1);
      assert.match(first.problems[0]!.reason,/tries again/);
      assert.equal(again.problems.length,0,'named once');
      const [kept] = await listHeld(engineer.id);
      assert.equal(kept?.signed?.name,'K. Wright');
      assert.equal(getReport(kept!.reportId)?.state,'draft');
      const last = await sendHeldWork(engineer.id);
      assert.equal(last.sent[0]?.submitted,true);
      assert.deepEqual(await listHeld(engineer.id),[]);
    });

    await t.test('an inspection changed on the phone after a signature reached the draft goes up unsigned',async () => {
      // The draft holds a signature (from the phone, say, before it was taken back), then the phone changes an answer.
      const draft = createReport(project.projectId,engineer.name,engineer,'safety-inspection');
      const checks = answered().map((o,i) => ({...o,id:draft.observations[i]!.id}));
      const signedDraft = saveDraft(draft.id,{...draft,observations:checks,draftSignature:{name:'K. Wright',dataUrl:drawn}},draft.version);
      assert.equal(signedDraft.ok,true);
      const base = (signedDraft as {ok:true;value:Report}).value;
      const changed = checks.map((o,i) => i === 5 ? {...o,check:{...o.check!,answer:'na' as const}} : o);
      await putHeld({key:`${engineer.id}::${draft.id}`,reportId:draft.id,principalId:engineer.id,seq:'s2',observations:changed,heldAt:new Date().toISOString(),baseVersion:base.version,report:base,heldOffline:true});
      const result = await sendHeldWork(engineer.id);
      assert.equal(result.sent.length,1);
      assert.equal(getReport(draft.id)?.observations[5]?.check?.answer,'na');
      assert.equal(getReport(draft.id)?.draftSignature,undefined,'the old signature does not cover the change');
    });

    await t.test('the server refuses to send it: it stays a draft, its signature cleared, and the engineer is told',async () => {
      const key = '65555555-5555-4555-8555-555555555555';
      const checks = answered();
      await keepStarted(key,checks,sign(checks));
      server.refuseSend = 'This project is no longer open for reporting.';
      const result = await sendHeldWork(engineer.id);
      server.refuseSend = undefined;
      assert.equal(result.problems.length,1);
      assert.match(result.problems[0]!.reason,/saved as a draft\. This project is no longer open for reporting\. Open it/);
      assert.match(result.problems[0]!.headline!,/not sent to the office/);
      const id = result.problems[0]!.reportId!;
      assert.equal(getReport(id)?.state,'draft');
      assert.equal(getReport(id)?.draftSignature,undefined,'a signature left on it could later go with other content');
      assert.deepEqual(await listHeld(engineer.id),[]);
    });

    await t.test('a signed copy whose save is refused is handed to the editor without its signature',async () => {
      // A draft already on the server, signed on the phone, then changed in RELAY elsewhere meanwhile.
      const draft = createReport(project.projectId,engineer.name,engineer,'safety-inspection');
      const checks = answered().map((o,i) => ({...o,id:draft.observations[i]!.id}));
      assert.equal(saveDraft(draft.id,{...draft,observations:draft.observations},draft.version).ok,true);
      await putHeld({key:`${engineer.id}::${draft.id}`,reportId:draft.id,principalId:engineer.id,seq:'s1',observations:checks,heldAt:new Date().toISOString(),
        baseVersion:draft.version,report:{...draft,observations:checks,draftSignature:{name:'K. Wright',dataUrl:drawn}},heldOffline:true,signed:sign(checks)});
      const result = await sendHeldWork(engineer.id);
      assert.equal(result.problems.length,1);
      assert.match(result.problems[0]!.reason,/changed somewhere else too.*signature from the phone was not used/);
      const [kept] = await listHeld(engineer.id);
      assert.equal(kept?.signed,undefined);
      assert.equal(kept?.report?.draftSignature,undefined);
      assert.equal(getReport(draft.id)?.state,'draft');
      assert.equal(getReport(draft.id)?.draftSignature,undefined);
      await update(kept!.key,() => null);
    });
  } finally {
    globalThis.fetch = realFetch;
    database().close();
    rmSync(root,{recursive:true,force:true});
  }
});
