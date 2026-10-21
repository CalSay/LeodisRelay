// Browser check: a handover inspection held on the phone, changed on the
// offline page (FE-3e). An action asks Where, as it does in the editor, and
// what is typed reaches the server once RELAY opens with signal.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-handover-offline-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport,saveDraft}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:handover-offline-engineer',oid:'handover-offline-engineer',name:'Holly Offline',email:'holly@example.test',role:'Engineer',trade:'Electrical'};
// One session per run: the light run ends by signing out, which ends its session.
const newSession=()=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4354,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-handover-offline-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
const jpeg=colour=>sharp({create:{width:640,height:480,channels:3,background:colour}}).jpeg().toBuffer();
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const mine=()=>records('reports').filter(r=>r.authorId===principal.id);
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
// A copy the editor left on the phone before signal went: built on the server's version.
async function holdCopy(page,report,extra={}){
  await page.evaluate(async ({report,principal,extra})=>{
    await new Promise((done,fail)=>{
      const open=indexedDB.open('relay-drafts',2);
      open.onupgradeneeded=()=>open.result.createObjectStore('unsent',{keyPath:'key'});
      open.onsuccess=()=>{const tx=open.result.transaction('unsent','readwrite');
        tx.objectStore('unsent').put({key:`${principal}::${report.id}`,reportId:report.id,principalId:principal,seq:1,observations:report.observations,heldAt:new Date().toISOString(),baseVersion:report.version,report,tab:'tab-gone',...extra});
        tx.oncomplete=()=>{open.result.close();done();};tx.onerror=()=>fail(tx.error);};
    });
  },{report,principal:principal.id,extra});
}
const heldKeys=page=>page.evaluate(()=>new Promise(done=>{const open=indexedDB.open('relay-drafts',2);open.onsuccess=()=>{const r=open.result.transaction('unsent').objectStore('unsent').getAllKeys();r.onsuccess=()=>{open.result.close();done(r.result);};};}));
try {
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    // A handover inspection already on the server, which the phone also holds.
    const kept=createReport('proj-011lme',principal.name,principal,'handover-inspection');
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:newSession(),url:base}]);
    let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto(`${base}/engineer`);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await holdCopy(page,kept);
    // No signal: a cold start opens the offline page.
    await stop();
    await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto(`${base}/engineer`);
    await page.getByRole('heading',{name:'Keep reporting. It is saved on this phone.'}).waitFor();
    const row=page.locator('#drafts .item',{hasText:kept.reference});
    check(/Handover inspection/.test(await row.innerText())&&/12 checks/.test(await row.innerText()),`${scheme}: the held copy is named as a handover inspection: ${await row.innerText()}`);
    await row.click();
    await page.locator('#editor-title',{hasText:kept.reference}).waitFor();
    const first=page.locator('.card').nth(0);
    check(await first.getByLabel(/^Where/).count()===0,`${scheme}: no Where until the answer needs one`);
    await first.getByLabel('Answer').selectOption('action');
    await page.locator('.card').nth(0).getByLabel(/^Where/).fill('L4 corridor');
    await page.locator('.card').nth(0).getByLabel('What’s wrong').fill('Tray lid missing');
    await page.locator('.card').nth(0).getByLabel('What needs doing').fill('Fit the lid');
    // A second check: action needed, then satisfactory, clears its Where.
    await page.locator('.card').nth(1).getByLabel('Answer').selectOption('action');
    await page.locator('.card').nth(1).getByLabel(/^Where/).fill('Plant room');
    await page.locator('.card').nth(1).getByLabel('Answer').selectOption('ok');
    check(await page.locator('.card').nth(1).getByLabel(/^Where/).count()===0,`${scheme}: moving off Action needed hides Where`);
    await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${scheme}: no sideways scroll`);
    if(screenshot)await page.screenshot({path:join(screenshot,`handover-offline-${scheme}-${width}.png`),fullPage:false});
    // Signal back: opening RELAY sends the held copy by itself.
    await start();
    await page.goto(`${base}/engineer`);
    await page.locator('.held-send .note-ok').waitFor({timeout:30000});
    const saved=getReport(kept.id);
    check(saved.observations[0].check.answer==='action'&&saved.observations[0].location==='L4 corridor'&&saved.observations[0].actionNeeded==='Fit the lid',`${scheme}: the action and its Where reached the server`);
    check(saved.observations[1].check.answer==='ok'&&saved.observations[1].location==='',`${scheme}: and the satisfactory check carries no Where`);
    check(saved.observations.length===12&&saved.reportType==='handover-inspection',`${scheme}: still a handover inspection with every check`);
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Handover inspection offline check passed (${checks} checks): a held copy named, Where asked only for an action, cleared off it, and sent up when signal returns, at 390px light and 1440px dark.`);
} finally {
  await browser?.close();await stop();
}
