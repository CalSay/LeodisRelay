// Browser check for quicker inspections (2026-10-21). On a phone a handover
// inspection opens at its first check still to answer. A first answer of
// Satisfactory or Not applicable opens the next check still to answer by
// itself (focus goes with it), and after the last one Check & sign opens. The
// folded row says the answer in words, one tap on it opens the check again,
// and changing an answer there never moves on. Action needed stays open. Its
// recent places are compact chips (as on a site update card since #107),
// with this inspection's own places first, and a chip fills Where and is saved.
// Light and dark at 390px, dark at 1440px; axe on an open action check; no
// sideways scroll. The tap count for a whole inspection is in docs/progress.md
// (43 taps on main 433691d, 33 after, for 12 checks with three actions).
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-quicker-inspections-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {HANDOVER_CHECKLIST}=require('../apps/web/.test-build/lib/reportTypes.js');
const N=HANDOVER_CHECKLIST.length;
const MIN_TARGET=48;
const engineer={id:'entra:qi-engineer',oid:'qi-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=n=>{const id=randomUUID();putRecord('sessions',{id,principal:{...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const P='proj-011lme';
// Yesterday's site update offers three recent places, newest last.
{
  const r=createReport(P,engineer.name,engineer,'progress');
  const saved=saveDraft(r.id,{...r,observations:['Level 2 corridor','Flat 3.02','Plant room'].map((location,i)=>({id:randomUUID(),type:'update',location,whatHappened:`Work ${i+1}`,actionNeeded:'',owner:'',photos:[]}))},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));
  const yesterday=new Date(Date.now()-86400000).toISOString();
  for(const kind of ['reports','snapshots'])putRecord(kind,{...getRecord(kind,r.id),visitDate:yesterday.slice(0,10),serverAcknowledgedAt:yesterday});
}
const port=4438,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-quicker-inspections',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const measured=[];
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await sleep(500);}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(`${scheme}-${width}`),url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await sleep(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`)});}};
    const card=()=>page.locator(wide?'.eng-card-body:not([hidden]) .eng-card':'.eng-slot.open .eng-card');
    const heading=i=>card().getByRole('heading',{name:HANDOVER_CHECKLIST[i].question,exact:true});
    const row=i=>page.locator('.eng-checkrow').nth(i);
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    // As a thumb would: the target brought to the middle of the screen, away from the action bar, then tapped.
    const tap=async locator=>{await locator.waitFor();await locator.evaluate(e=>e.scrollIntoView({block:'center'}));await sleep(60);if(wide)await locator.click();else await locator.tap();};
    const answer=async(i,words)=>{await heading(i).waitFor();await tap(card().getByRole('button',{name:words,exact:true}));};
    const focused=()=>page.evaluate(()=>{const e=document.activeElement;return e?`${e.id} ${e.getAttribute('data-card-body')??''} ${e.textContent?.slice(0,200)}`:'';});

    // 1. Start one: on a phone too, the first check is open, ready to answer.
    await page.goto(`${base}/engineer?project=${P}`);
    await tap(page.getByRole('button',{name:/Do a handover inspection/}));
    await page.waitForURL(/\/reports\//);
    const id=page.url().match(/\/reports\/([^/?#]+)/)[1];
    await heading(0).waitFor({timeout:10000});
    ok(await heading(0).isVisible(),`${label}: the first check is open on arrival`);
    ok(await card().getByRole('button',{name:'Satisfactory',exact:true}).evaluate(e=>e.getBoundingClientRect().bottom<innerHeight-100),`${label}: its answers are on the first screen`);
    await shot('arrival');

    // 2. Satisfactory moves on, with focus; the folded row says the answer in words.
    await answer(0,'Satisfactory');
    await heading(1).waitFor();ok(true,`${label}: Satisfactory opens the next check`);
    await page.waitForFunction(q=>document.activeElement?.textContent?.includes(q),HANDOVER_CHECKLIST[1].question,{timeout:5000}).catch(()=>{});
    ok((await focused()).includes(HANDOVER_CHECKLIST[1].question),`${label}: focus goes to the next check (${await focused()})`);
    if(!wide)eq(await page.locator('.eng-slot.open').count(),1,`${label}: only one check open`);
    ok(/satisfactory/i.test(await row(0).locator('.kind').innerText()),`${label}: the answered row says Satisfactory`);
    eq(await page.locator('.eng-next-check:visible').count(),0,`${label}: no "Next check" on a check still to answer`);
    await page.evaluate(()=>scrollTo(0,0));await shot('moved-on');

    // 3. A wrong answer: one tap on its row opens it, and changing it there stays put.
    await tap(row(0));await heading(0).waitFor();ok(true,`${label}: one tap on the row opens the answered check`);
    await tap(card().getByRole('button',{name:'Action needed',exact:true}));
    await sleep(300);
    ok(await heading(0).isVisible(),`${label}: Action needed stays open to fill in`);
    const places=()=>card().getByRole('group',{name:'Recent places',exact:true});
    await places().waitFor();
    const chips=async()=>(await places().locator('.eng-chip').allInnerTexts()).map(s=>s.trim());
    assert.deepEqual(await chips(),['Level 2 corridor','Flat 3.02','Plant room'],`${label}: recent places as chips`);checks++;
    eq(await places().locator('.eng-suggestions-head span').count(),1,`${label}: no count beside "Recent places"`);
    const chipRows=await places().locator('.eng-chip').evaluateAll(cs=>new Set(cs.map(c=>Math.round(c.getBoundingClientRect().top))).size);
    ok(chipRows<3,`${label}: chips share a row (${chipRows} rows)`);
    for(const b of await places().getByRole('button').all()){const box=await b.boundingBox();ok(box.height>=MIN_TARGET-0.5,`${label}: chip at least ${MIN_TARGET}px (${Math.round(box.height)})`);}
    const whereToChips=await card().evaluate(c=>{const w=c.querySelector('input[id^="where-"]').getBoundingClientRect(),p=c.querySelector('.eng-suggestions').getBoundingClientRect();return Math.round(p.bottom-w.top);});
    measured.push(`${label}: Where box and its places ${whereToChips}px tall`);
    await tap(places().getByRole('button',{name:'Flat 3.02',exact:true}));
    eq(await card().getByLabel('Where',{exact:true}).inputValue(),'Flat 3.02',`${label}: a chip fills Where`);
    await tap(card().getByLabel('What’s wrong',{exact:true}));await card().getByLabel('What’s wrong',{exact:true}).fill('Tray lid missing');
    await tap(card().getByLabel('What needs doing',{exact:true}));await card().getByLabel('What needs doing',{exact:true}).fill('Fit the lid');
    await tap(card().getByLabel('Who is to do it',{exact:true}));await card().getByLabel('Who is to do it',{exact:true}).fill('Leodis Electrical');
    await page.evaluate(()=>document.activeElement?.blur?.());
    ok(await heading(0).isVisible(),`${label}: still on the action check after filling it in`);
    if(!wide){await card().evaluate(c=>c.scrollIntoView({block:'start'}));await shot('action');}
    if(label==='light 390'||label==='dark 1440'){
      await page.evaluate(axeSource);
      const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));
      ok(!found.length,`${label}: axe finds nothing on an open action check\n  ${found.join('\n  ')}`);
    }
    await page.waitForFunction(async id=>{const r=await (await fetch(`/api/reports/${id}`)).json();const o=(r.report??r).observations[0];return o?.location==='Flat 3.02'&&o.check?.answer==='action'&&o.owner==='Leodis Electrical';},id,{timeout:20000});
    ok(true,`${label}: the action and its place are saved on the server`);

    // 4. On to check 2: this inspection's place is offered first. Changing an answer never moves on.
    await tap(page.locator('.eng-next-check:visible'));
    await answer(1,'Action needed');
    await places().waitFor();
    eq((await chips())[0],'Flat 3.02',`${label}: this inspection's place first`);
    await tap(card().getByRole('button',{name:'Satisfactory',exact:true}));
    await sleep(300);
    ok(await heading(1).isVisible(),`${label}: changing an answer stays on that check`);
    eq(await card().getByLabel('Where',{exact:true}).count(),0,`${label}: Satisfactory takes Where away again`);

    // 5. The rest, one tap each; after the last, Check & sign with focus on it.
    await tap(page.locator('.eng-next-check:visible'));
    for(let i=2;i<N;i++)await answer(i,i===6?'Not applicable':'Satisfactory');
    await page.locator('#report-check').waitFor({timeout:5000});ok(true,`${label}: the last answer opens Check & sign`);
    await page.waitForFunction(()=>document.activeElement?.id==='report-check-title',null,{timeout:5000}).catch(()=>{});
    eq(await page.evaluate(()=>document.activeElement?.id),'report-check-title',`${label}: focus on Check & sign`);
    ok(/#check$/.test(page.url()),`${label}: Back returns to the checks`);
    eq(await overflow(),false,`${label}: no sideways scroll`);
    await shot('check');
    let saved;for(let k=0;k<80;k++){saved=getRecord('reports',id);if(saved.observations.every(o=>o.check?.answer))break;await sleep(250);}
    eq(saved.observations.filter(o=>o.check?.answer).length,N,`${label}: all ${N} answers saved`);
    eq(saved.observations[6].check.answer,'na',`${label}: Not applicable kept`);
    eq(saved.observations[1].check.answer,'ok',`${label}: the changed answer kept`);

    // 6. Back to the checks: every row says its answer in words.
    await page.goBack();await page.locator('.eng-checkrow').first().waitFor();
    const words=await page.locator('.eng-checkrow .kind').allInnerTexts();
    eq(words.filter(w=>/satisfactory/i.test(w)).length,N-2,`${label}: rows say Satisfactory`);
    eq(words.filter(w=>/not applicable/i.test(w)).length,1,`${label}: a row says Not applicable`);
    eq(words.filter(w=>/action needed/i.test(w)).length,1,`${label}: a row says Action needed`);
    eq(await overflow(),false,`${label}: the answered rows have no sideways scroll`);
    if(!wide){await page.evaluate(()=>scrollTo(0,0));await shot('answered');}
    assert.deepEqual(errors,[],`${label}: page errors`);checks++;
    await context.close();
  }
  console.log(measured.join('\n'));
  console.log(`verify-quicker-inspections: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
