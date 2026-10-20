// Browser check: a draft is sent from another tab or device while this screen
// still holds changes the server never had. The sent report is left as it is
// and the changes are offered as a correction, or can be discarded. Two tabs on
// one phone (390px light), and a laptop that was offline while another device
// changed and sent the draft (1440px dark).
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
const root=mkdtempSync(join(tmpdir(),'relay-sent-elsewhere-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport,saveDraft,submitReport,reportsFor}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:sent-engineer',oid:'sent-engineer',name:'Sent Engineer',email:'sent@example.test',role:'Engineer',trade:'Electrical'};
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
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-sent-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
async function what(page,id){
  const box=page.locator(`#what-${id}`);
  if(!(await box.isVisible())){
    await page.evaluate(()=>document.activeElement?.blur());
    // On the phone each card unfolds under its own row; side by side, the row in the list opens it.
    const slot=page.locator(`#slot-${id} .eng-cardrow`);
    if(await slot.count())await slot.click();
    else await page.locator('.eng-rail .eng-cardrow').nth(await page.evaluate(id=>[...document.querySelectorAll('#card-editor > div')].findIndex(d=>d.querySelector(`#what-${id}`)),id)).click();
  }
  await box.waitFor({state:'visible'});return box;
}
const state=(page,text)=>page.waitForFunction(t=>document.querySelector('.savestate')?.textContent?.includes(t),text,{timeout:20000});
const noSideways=page=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
/** Copies of a report this device holds, ordinary and set aside. */
const heldFor=(page,id)=>page.evaluate(id=>new Promise(r=>{const o=indexedDB.open('relay-drafts');o.onsuccess=()=>{const q=o.result.transaction('unsent').objectStore('unsent').getAllKeys();q.onsuccess=()=>{o.result.close();r(q.result.filter(k=>String(k).includes(id)).length);};};}),id);
const words=id=>getReport(id).observations.map(o=>o.whatHappened);
let browser;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});

  /* Two tabs on one phone: tab A sends while tab B holds an edit it could not save. */
  {
    const draft=seed();
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const errors=[];
    const a=await context.newPage(),b=await context.newPage();
    for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/reports/${draft.id}`);await p.locator('.eng-cardrow').first().waitFor();}
    await b.route('**/api/reports/*',route=>route.request().method()==='PUT'?route.abort():route.continue());
    await (await what(b,'obs-riser')).fill('Containment complete, fire stopping to do');
    await state(b,'On this phone only');
    await a.bringToFront();
    await a.getByRole('button',{name:/Check & send/}).first().click();
    await a.getByRole('button',{name:'Send to office'}).click();
    await a.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    eq(getReport(draft.id).state,'submitted','tab A sent the draft');
    await b.unroute('**/api/reports/*');
    await b.bringToFront();
    await b.locator('.eng-sent-away').waitFor({timeout:20000});
    ok(await b.getByRole('heading',{name:'Sent from another screen'}).isVisible(),'tab B says the report was sent elsewhere');
    ok(await b.getByText('1 change on this screen was not in it.',{exact:false}).isVisible(),'it counts the changes not in the sent report');
    const change=b.locator('.eng-sent-away [data-change="changed"]');
    ok(await change.getByText('Changed here').isVisible(),'the riser card is marked as changed here');
    ok(await change.getByText('Containment complete, fire stopping to do').isVisible(),'with this screen’s wording');
    ok(await b.locator('.pagehead .tag-sent').isVisible(),'the sent report is shown beneath');
    eq(await b.getByRole('button',{name:'Make a correction'}).count(),0,'one way to correct while the offer is open');
    const primary=await b.getByRole('button',{name:'Start a correction with my changes'}).boundingBox();
    ok(primary&&primary.height>=44,'the main button is a 44px target');
    ok(await noSideways(b),'no sideways scroll at 390px');
    eq(words(draft.id),['Containment complete','Pumps set'],'the sent revision is untouched');
    if(shots)await b.screenshot({path:join(shots,'sent-away-two-tabs-390-light.png'),fullPage:true});
    // The work is set aside on the device, so a reload comes back to the same offer.
    await b.reload();
    await b.locator('.eng-sent-away').waitFor({timeout:20000});
    ok(await b.locator('.eng-sent-away').getByText('Containment complete, fire stopping to do').isVisible(),'the offer survives a reload');
    const reason=b.getByLabel('Why is a correction needed?');
    ok((await reason.inputValue()).length>0,'a reason is suggested');
    await reason.fill('Fire stopping was left off');
    await b.getByRole('button',{name:'Start a correction with my changes'}).click();
    await b.waitForURL(url=>!url.pathname.endsWith(draft.id),{timeout:20000});
    const correctionId=new URL(b.url()).pathname.split('/').at(-1);
    await b.getByText('Correction · rev 2.').waitFor({timeout:20000});
    const correction=getReport(correctionId);
    eq([correction.state,correction.revision,correction.corrects,correction.correctionReason],['draft',2,draft.id,'Fire stopping was left off'],'a correction draft at rev 2');
    eq(correction.observations.map(o=>o.whatHappened),['Containment complete, fire stopping to do','Pumps set'],'with the unsaved change already in it, saved on the server');
    eq(await (await what(b,'obs-riser')).inputValue(),'Containment complete, fire stopping to do','the correction opens with the change on screen');
    eq(words(draft.id),['Containment complete','Pumps set'],'the sent revision is still untouched');
    eq(await heldFor(b,draft.id),0,'nothing is left held on the device for the sent report');
    eq(errors,[],'two tabs: page errors');
    await context.close();
  }

  /* A laptop offline while another device changed and sent the draft. */
  {
    const draft=seed();
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const errors=[];
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const quiet=await context.newPage();quiet.on('pageerror',e=>errors.push(e.message));
    for(const p of [page,quiet]){await p.goto(`${base}/reports/${draft.id}`);await p.locator('.eng-cardrow').first().waitFor();}
    await page.bringToFront();
    await context.setOffline(true);
    await (await what(page,'obs-riser')).fill('Containment complete to L4');
    await state(page,'On this phone only');
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.eng-rail .eng-add').click();
    await page.locator('#card-editor .eng-tile.update').first().click();
    const added=await page.locator('#card-editor > div:not([hidden]) textarea[id^="what-"]').first();
    await added.fill('Riser door left open');
    await state(page,'On this phone only');
    // The other device changes the plant card and sends.
    const current=getReport(draft.id);
    const other=saveDraft(draft.id,{...current,observations:[current.observations[0],card('obs-plant','Pumps set and aligned','Plant room')]},current.version);
    eq(other.ok,true,'the other device saved');
    eq((await submitReport(draft.id,{name:principal.name},other.value.version)).ok,true,'the other device sent');
    await context.setOffline(false);
    // A tab with nothing unsaved takes the sent report quietly when it comes back into view.
    await quiet.bringToFront();
    await quiet.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await quiet.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    eq(await quiet.locator('.eng-sent-away').count(),0,'no offer where nothing was unsaved');
    await page.bringToFront();
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.locator('.eng-sent-away').waitFor({timeout:20000});
    ok(await page.getByText('2 changes on this screen were not in it.',{exact:false}).isVisible(),'both changes counted');
    ok(await page.locator('.eng-sent-away [data-change="changed"]').getByText('Containment complete to L4').isVisible(),'the edit is listed');
    ok(await page.locator('.eng-sent-away [data-change="added"]').getByText('Riser door left open').isVisible(),'the new card is listed');
    eq(await page.locator('.eng-sent-away').getByText('Pumps set and aligned').count(),0,'the other device’s own change is not listed as this screen’s');
    ok(await noSideways(page),'no sideways scroll at 1440px');
    if(shots)await page.screenshot({path:join(shots,'sent-away-offline-1440-dark.png'),fullPage:true});
    // Discard asks first, then lets the changes go.
    await page.getByRole('button',{name:'Discard my changes'}).click();
    ok(await page.getByText('Discard 2 changes?',{exact:false}).isVisible(),'discarding asks first');
    await page.getByRole('button',{name:'Discard',exact:true}).click();
    await page.locator('.eng-sent-away').waitFor({state:'detached',timeout:10000});
    ok(await page.getByRole('button',{name:'Make a correction'}).isVisible(),'the usual correction button is back');
    eq(await heldFor(page,draft.id),0,'the discarded changes are gone from the device');
    eq(words(draft.id),['Containment complete','Pumps set and aligned'],'the sent revision is untouched');
    eq(reportsFor(principal).items.filter(r=>r.corrects===draft.id).length,0,'no correction was started');
    await page.reload();
    await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    eq(await page.locator('.eng-sent-away').count(),0,'the offer does not come back after a reload');
    eq(errors,[],'offline laptop: page errors');
    await context.close();
  }
  console.log(`Sent elsewhere check passed (${checks} checks): two tabs at 390px light, an offline laptop at 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
