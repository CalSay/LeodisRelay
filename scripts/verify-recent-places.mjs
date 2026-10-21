// Browser check for lighter recent places (2026-10-21): on a new card in a
// site update, recent places are a row of chips under the Where box, as wide
// as their words, with no boxed panel, no count and no hint line, and the
// place already in the box is not offered again. Recent places stay one tap
// away (FE-1 quick capture); Where stays free text.
// Measures, on a 390px phone, how far down the card "Take a photo" sits (572px
// on main c134875 with three recent places as full-width rows and a hint);
// checks a chip fills Where and is saved, the chip for the place in the box
// goes (whatever its case), "Show N more" on the same rows, a long place name
// wraps inside the card, 48px targets, no sideways scroll, and the wide editor.
// Light and dark at 390px, dark at 1440px.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-recent-places-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
/** "Take a photo" from the top of a new card, 390px, three recent places: 572px on main c134875. */
const BEFORE_PHOTO_OFFSET=572,MAX_PHOTO_OFFSET=420;
const MIN_TARGET=48;
const LONG='Level 4 east stair core beside the lift lobby, behind the riser door';
const engineer={id:'entra:rp-engineer',oid:'rp-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=n=>{const id=randomUUID();putRecord('sessions',{id,principal:{...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const P='proj-011lme',Q='proj-014lme';
const ob=(location,whatHappened)=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
/** Yesterday's sent update on a project, so its cards offer these places, newest last. */
async function sentYesterday(project,places){
  const r=createReport(project,engineer.name,engineer,'progress');
  const saved=saveDraft(r.id,{...r,observations:places.map((p,i)=>ob(p,`Work ${i+1}`))},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));
  const yesterday=new Date(Date.now()-86400000).toISOString();
  for(const kind of ['reports','snapshots'])putRecord(kind,{...getRecord(kind,r.id),visitDate:yesterday.slice(0,10),serverAcknowledgedAt:yesterday});
}
// The usual day: three places. A busier project: five, one with a long name.
await sentYesterday(P,['Level 2 corridor','Flat 3.02','Plant room']);
await sentYesterday(Q,['Riser B','Flat 1.04','Roof plant',LONG,'Car park']);
const port=4436,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-recent-places',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const measured=[];
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(`${scheme}-${width}`),url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:true});}};
    const card=()=>page.locator(wide?'.eng-card-body:not([hidden]) .eng-card':'.eng-slot.open .eng-card');
    const places=()=>card().getByRole('group',{name:'Recent places',exact:true});
    const chipTexts=async()=>(await places().locator('.eng-chip').allInnerTexts()).map(s=>s.trim());
    const where=()=>card().getByLabel('Where',{exact:true});
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const startUpdate=async project=>{
      await page.goto(`${base}/engineer?project=${project}`);
      const big=page.getByRole('button',{name:/Start today’s site update/});
      await big.waitFor();await tap(big);
      await page.waitForURL(/\/reports\//);await where().waitFor();
      return page.url().match(/\/reports\/([^/?#]+)/)[1];
    };
    const targets=async()=>{for(const b of await places().getByRole('button').all()){const box=await b.boundingBox();ok(box.height>=MIN_TARGET-0.5,`${label}: "${(await b.innerText()).trim()}" is at least ${MIN_TARGET}px tall (${Math.round(box.height)})`);}};
    const inside=async()=>{const c=await card().boundingBox();for(const b of await places().getByRole('button').all()){const box=await b.boundingBox();ok(box.x>=c.x-0.5&&box.x+box.width<=c.x+c.width+0.5,`${label}: "${(await b.innerText()).trim().slice(0,20)}" stays inside the card`);}};

    // The usual day: a new progress card on a project with three recent places.
    const reportId=await startUpdate(P);
    await places().waitFor();
    const photoOffset=await card().evaluate(c=>{const cam=c.querySelector('label.camera');return Math.round(cam.getBoundingClientRect().top-c.getBoundingClientRect().top);});
    measured.push(`${label}: "Take a photo" ${photoOffset}px down a new card (${BEFORE_PHOTO_OFFSET}px on main at 390px)`);
    if(!wide)ok(photoOffset<=MAX_PHOTO_OFFSET,`${label}: "Take a photo" at most ${MAX_PHOTO_OFFSET}px down the card (${photoOffset}px)`);
    if(!wide)ok(await card().getByLabel('What happened',{exact:true}).evaluate(e=>e.getBoundingClientRect().top<window.innerHeight-120),`${label}: "What happened" is on the first screen`);
    await shot('new-card');
    assert.deepEqual(await chipTexts(),['Level 2 corridor','Flat 3.02','Plant room'],`${label}: the three recent places`);checks++;
    eq(await card().getByText(/recent place or type anything/).count(),0,`${label}: no hint line`);
    eq(await places().locator('.eng-suggestions-head span').count(),1,`${label}: no count beside "Recent places"`);
    const rows=await places().locator('.eng-chip').evaluateAll(cs=>new Set(cs.map(c=>Math.round(c.getBoundingClientRect().top))).size);
    ok(rows<3,`${label}: chips share a row rather than one row each (${rows} rows)`);
    await targets();await inside();

    // A tap fills Where, is saved, and that place is no longer offered.
    await tap(places().getByRole('button',{name:'Flat 3.02',exact:true}));
    eq(await where().inputValue(),'Flat 3.02',`${label}: a chip fills Where`);
    assert.deepEqual(await chipTexts(),['Level 2 corridor','Plant room'],`${label}: the place now in Where is not offered again`);checks++;
    await page.waitForFunction(async id=>{const r=await (await fetch(`/api/reports/${id}`)).json();return (r.report??r).observations[0]?.location==='Flat 3.02';},reportId,{timeout:20000});
    ok(true,`${label}: the place is saved on the server`);
    // Another chip swaps it: the first comes back.
    await tap(places().getByRole('button',{name:'Plant room',exact:true}));
    eq(await where().inputValue(),'Plant room',`${label}: another chip replaces the place`);
    assert.deepEqual(await chipTexts(),['Level 2 corridor','Flat 3.02'],`${label}: the place taken out of Where is offered again`);checks++;
    // Typed in another case or spacing, it still counts as the same place.
    await where().fill('  level 2   CORRIDOR ');
    assert.deepEqual(await chipTexts(),['Flat 3.02','Plant room'],`${label}: a typed place is matched whatever its case or spacing`);checks++;
    // Anything else is fine: free text, every place offered.
    await where().fill('Basement store');
    eq((await chipTexts()).length,3,`${label}: a new place typed in leaves all three offered`);
    await card().getByLabel('What happened',{exact:true}).fill('Tray run in');
    await page.waitForFunction(async id=>{const r=await (await fetch(`/api/reports/${id}`)).json();return (r.report??r).observations[0]?.location==='Basement store';},reportId,{timeout:20000});
    ok(true,`${label}: a typed place is saved as typed`);

    // A second card offers this update's place first, one tap away.
    await tap(page.locator('.eng-add-kinds').getByRole('button',{name:/^\+ Progress$/}));
    await where().waitFor();await places().waitFor();
    eq((await chipTexts())[0],'Basement store',`${label}: the next card offers this update's place first`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();

    // A busier project: five places, a long one. Three show, "Show 2 more" on the same rows.
    const busy=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await busy.addCookies([{name:'relay_session',value:sessionFor(`${scheme}-${width}-busy`),url:base}]);
    const p2=await busy.newPage(),errs2=[];p2.on('pageerror',e=>errs2.push(e.message));
    await (async()=>{
      const card2=()=>p2.locator(wide?'.eng-card-body:not([hidden]) .eng-card':'.eng-slot.open .eng-card');
      const group=()=>card2().getByRole('group',{name:'Recent places',exact:true});
      const tap2=async l=>{await l.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await l.click();else await l.tap();};
      await p2.goto(`${base}/engineer?project=${Q}`);
      const big=p2.getByRole('button',{name:/Start today’s site update/});await big.waitFor();await tap2(big);
      await p2.waitForURL(/\/reports\//);await group().waitFor();
      eq(await group().locator('.eng-chip').count(),3,`${label} busy: three places show at first`);
      const more=group().getByRole('button',{name:'Show 2 more',exact:true});
      eq(await more.count(),1,`${label} busy: "Show 2 more"`);
      ok(await more.evaluate(e=>e.parentElement.classList.contains('eng-chips')),`${label} busy: "Show 2 more" sits on the chip rows`);
      await tap2(more);
      eq(await group().locator('.eng-chip').count(),5,`${label} busy: all five after "Show 2 more"`);
      const long=group().getByRole('button',{name:LONG,exact:true});
      const c=await card2().boundingBox(),b=await long.boundingBox();
      ok(b.x+b.width<=c.x+c.width+0.5,`${label} busy: the long place wraps inside the card`);
      ok(await long.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${label} busy: the long place is shown in full`);
      for(const btn of await group().getByRole('button').all()){const box=await btn.boundingBox();ok(box.height>=MIN_TARGET-0.5,`${label} busy: "${(await btn.innerText()).trim().slice(0,20)}" at least ${MIN_TARGET}px`);}
      if(shots){await p2.waitForTimeout(300);await p2.screenshot({path:join(shots,`${prefix}-busy-${scheme}-${width}.png`),fullPage:true});}
      await tap2(group().getByRole('button',{name:'Show fewer places',exact:true}));
      eq(await group().locator('.eng-chip').count(),3,`${label} busy: "Show fewer places" folds back to three`);
      ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label} busy: no sideways scrolling`);
      ok(!errs2.length,`${label} busy: no page errors: ${errs2.join(' | ')}`);
    })();
    await busy.close();
  }
  console.log(measured.join('\n'));
  console.log(`Recent places check passed (${checks} checks): chips under Where as wide as their words with no panel, count or hint; "Take a photo" higher on a new card; a chip fills Where and is saved; the place in Where is not offered again whatever its case; free text kept; the next card offers this update's place first; "Show more" on the chip rows; long names wrap; 48px targets; no sideways scroll; light and dark at 390px, dark at 1440px.`);
} finally {await browser?.close();server.kill();}
