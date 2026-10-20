// Browser check for FE-3c: two versions of one draft are shown side by side
// and the engineer chooses what to keep. Two tabs on one phone (390px light),
// and a laptop that was offline while another device saved (1440px dark).
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-conflict-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport,saveDraft}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:conflict-engineer',oid:'conflict-engineer',name:'Conflict Engineer',email:'conflict@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const card=(id,whatHappened,location)=>({id,type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
/** A draft with two cards, saved once so it is at version 2. */
function seed(){
  const draft=createReport('proj-011lme',principal.name,principal);
  const saved=saveDraft(draft.id,{...draft,observations:[card('obs-riser','Containment complete','L3 riser'),card('obs-plant','Pumps set','Plant room')]},draft.version);
  assert.equal(saved.ok,true);
  return saved.value;
}
const port=4333,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-conflict-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
/** The "What happened" box of one card, opening the card first on the phone. */
async function what(page,id){
  const box=page.locator(`#what-${id}`);
  if(!(await box.isVisible())){
    // Leave the field being typed in first: the action bar comes back as it blurs and would take the tap.
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator(`#slot-${id} .eng-cardrow`).click();
  }
  await box.waitFor({state:'visible'});return box;
}
/** The save state beside the main button; the bar steps aside while typing, so it is read rather than seen. */
const state=(page,text)=>page.waitForFunction(t=>document.querySelector('.savestate')?.textContent?.includes(t),text,{timeout:20000});
const noSideways=page=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
let browser;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});

  /* Two tabs on one phone. */
  {
    const draft=seed();
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const errors=[];
    const a=await context.newPage(),b=await context.newPage();
    for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/reports/${draft.id}`);await p.locator('.eng-cardrow').first().waitFor();}
    // Tab A saves; tab B has nothing unsaved, so it takes tab A's copy by itself.
    await (await what(a,'obs-riser')).fill('Containment complete, tray labelled');
    await state(a,'Saved on server');
    await b.bringToFront();
    await (await what(b,'obs-riser')).waitFor();
    await b.waitForFunction(()=>document.querySelector('#what-obs-riser')?.value==='Containment complete, tray labelled',null,{timeout:8000});
    ok(true,'tab B took tab A’s save with nothing unsaved');
    eq(await b.locator('.eng-conflict').count(),0,'no comparison when nothing differs');
    // Tab B cannot reach the server, so its edit is held on the phone; then tab A saves again.
    await b.route('**/api/reports/*',route=>route.request().method()==='PUT'?route.abort():route.continue());
    await (await what(b,'obs-riser')).fill('Tray labelled, fire stopping to do');
    await state(b,'On this phone only');
    await a.bringToFront();
    await (await what(a,'obs-riser')).fill('Tray labelled and photographed');
    await state(a,'Saved on server');
    await b.bringToFront();
    await b.locator('.eng-conflict').waitFor({timeout:8000});
    ok(await b.getByRole('heading',{name:'This draft was also changed somewhere else'}).isVisible(),'tab B says it was changed elsewhere');
    const changed=b.locator('[data-card="obs-riser"]');
    ok(await changed.getByText('Changed in both').isVisible(),'the card is marked as changed in both');
    ok(await changed.getByText('Tray labelled, fire stopping to do').isVisible(),'this screen’s wording shown');
    ok(await changed.getByText('Tray labelled and photographed').isVisible(),'the server’s wording shown');
    ok(await noSideways(b),'no sideways scroll at 390px');
    eq(getReport(draft.id).observations[0].whatHappened,'Tray labelled and photographed','tab A’s save is untouched while tab B chooses');
    if(shots)await b.screenshot({path:join(shots,'conflict-two-tabs-390-light.png'),fullPage:true});
    await b.unroute('**/api/reports/*');
    // Tab A carries on: its edits replace the shared held copy and its save releases it.
    await a.bringToFront();
    await (await what(a,'obs-riser')).fill('Tray labelled, photographed and signed off');
    await state(a,'Saved on server');
    await (await what(a,'obs-plant')).fill('Pumps set, awaiting commissioning');
    await state(a,'Saved on server');
    // Tab B's work was set aside on the device, so a reload comes back to the same choice.
    await b.bringToFront();
    await b.reload();
    await b.locator('.eng-conflict').waitFor({timeout:20000});
    ok(await b.locator('[data-card="obs-riser"]').getByText('Tray labelled, fire stopping to do').isVisible(),'tab B’s work survives tab A carrying on and a reload');
    ok(await b.locator('[data-card="obs-riser"]').getByText('Tray labelled, photographed and signed off').isVisible(),'the comparison shows tab A’s latest save');
    await changed.getByRole('button',{name:'Keep both as two cards'}).click();
    ok(await b.getByText('Saving keeps 3 cards.').isVisible(),'the summary counts what is kept');
    await b.getByRole('button',{name:'Save this version'}).click();
    await state(b,'Saved on server');
    const merged=getReport(draft.id).observations.map(o=>o.whatHappened);
    eq(merged,['Tray labelled, fire stopping to do','Tray labelled, photographed and signed off','Pumps set, awaiting commissioning'],'both wordings saved as two cards, tab A’s other card kept');
    eq(await b.evaluate(()=>new Promise(r=>{const o=indexedDB.open('relay-drafts');o.onsuccess=()=>{const q=o.result.transaction('unsent').objectStore('unsent').getAllKeys();q.onsuccess=()=>{o.result.close();r(q.result.filter(k=>String(k).includes('::aside::')).length);};};})),0,'the set-aside copy is dropped once the choice is saved');
    // Tab A had nothing unsaved, so it shows the merged draft by itself.
    await a.bringToFront();
    await a.waitForFunction(()=>document.querySelectorAll('.eng-cardrow').length===3,null,{timeout:8000});
    ok(true,'tab A shows the merged draft');
    eq(errors,[],'two tabs: page errors');
    await context.close();
  }

  /* A laptop offline while another device saved. */
  {
    const draft=seed();
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/reports/${draft.id}`);await page.locator('.eng-cardrow').first().waitFor();
    await context.setOffline(true);
    await (await what(page,'obs-plant')).fill('Pumps set and aligned');
    await state(page,'On this phone only');
    // The phone saves while the laptop is offline: a card removed and one added.
    const current=getReport(draft.id);
    eq(saveDraft(draft.id,{...current,observations:[current.observations[0],card('obs-phone','Riser door left open','L3 riser')]},current.version).ok,true,'the other device saved');
    await context.setOffline(false);
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.locator('.eng-conflict').waitFor({timeout:20000});
    ok(await page.locator('[data-card="obs-plant"]').getByText('Only on this screen').isVisible(),'a card only here is shown');
    ok(await page.locator('[data-card="obs-phone"]').getByText('Only on the server').isVisible(),'a card only on the server is shown');
    ok(await noSideways(page),'no sideways scroll at 1440px');
    if(shots)await page.screenshot({path:join(shots,'conflict-offline-1440-dark.png'),fullPage:true});
    // A reload comes back to the same choice: the work here is held on the device.
    await page.reload();
    await page.locator('.eng-conflict').waitFor({timeout:20000});
    ok(await page.locator('[data-card="obs-plant"]').getByText('Pumps set and aligned').isVisible(),'the work here survives a reload during the choice');
    await page.getByRole('button',{name:'Keep everything on the server'}).click();
    ok(await page.getByText('1 card is left out.').isVisible(),'leaving a card out is said, not silent');
    await page.getByRole('button',{name:'Save this version'}).click();
    await state(page,'Saved on server');
    eq(getReport(draft.id).observations.map(o=>o.id),['obs-riser','obs-phone'],'the server’s version kept as chosen');
    eq(errors,[],'offline laptop: page errors');
    await context.close();
  }
  console.log(`Draft conflict check passed (${checks} checks): two tabs at 390px light, an offline laptop at 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
