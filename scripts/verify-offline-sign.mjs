// Browser check: signing an inspection with no signal (FE-3e, third slice).
// With the server stopped, the offline page starts an inspection, lists what
// stops it being signed, takes a drawn signature once every check is answered
// and locks it. When RELAY opens with signal it goes to the office by itself,
// signed; a copy changed after signing is not sent and keeps no signature.
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
const root=mkdtempSync(join(tmpdir(),'relay-offline-sign-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records}=require('../apps/web/.test-build/lib/storage.js');
const {getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:offline-signer',oid:'offline-signer',name:'Sam Signer',email:'sam@example.test',role:'Engineer',trade:'Mechanical'};
const newSession=()=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4356,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-offline-sign-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
const mine=()=>records('reports').filter(r=>r.authorId===principal.id);
const held=page=>page.evaluate(()=>new Promise(done=>{const open=indexedDB.open('relay-drafts',2);open.onsuccess=()=>{const r=open.result.transaction('unsent').objectStore('unsent').getAll();r.onsuccess=()=>{open.result.close();done(r.result);};};}));
// Change a held copy behind the page's back, as a checklist reworded or a stale tab would.
const tamper=page=>page.evaluate(()=>new Promise(done=>{const open=indexedDB.open('relay-drafts',2);open.onsuccess=()=>{const tx=open.result.transaction('unsent','readwrite');const store=tx.objectStore('unsent');const r=store.getAll();r.onsuccess=()=>{const d=r.result[0];d.observations[1].check.answer='na';store.put(d);};tx.oncomplete=()=>{open.result.close();done();};};}));
async function draw(page){
  await page.locator('.sigpad').scrollIntoViewIfNeeded();
  const box=await page.locator('.sigpad').boundingBox();
  await page.mouse.move(box.x+30,box.y+box.height*0.6);await page.mouse.down();
  for(let i=1;i<=12;i++)await page.mouse.move(box.x+30+i*14,box.y+box.height*(0.6-0.3*Math.sin(i/2)));
  await page.mouse.up();
}
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
try {
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  // Light at phone width: a handover inspection, signed, taken back and signed again. Dark on a desk:
  // a safety inspection, signed and sent; then one changed after signing, which is not sent.
  for(const [scheme,width,type,name,code,changedAfter] of [['light',390,'handover-inspection','Handover inspection','PHI',false],['dark',1440,'safety-inspection','Safety inspection','SSI',false],['dark',390,'safety-inspection','Safety inspection','SSI',true]]){
    const label=`${scheme} ${width}${changedAfter?' changed after signing':''}`;
    const before=new Set(mine().map(r=>r.id));
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:newSession(),url:base}]);
    let page=await context.newPage();const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());};watch(page);
    await page.goto(`${base}/engineer`);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    // No signal, cold start.
    await stop();
    await page.close();page=await context.newPage();watch(page);
    await page.goto(`${base}/engineer`);
    await page.getByRole('heading',{name:'Keep reporting. It is saved on this phone.'}).waitFor();
    await page.getByRole('radio',{name:new RegExp(`^${name}`)}).check();
    await page.getByRole('button',{name:'Start on this phone'}).click();
    await page.locator('#editor-title',{hasText:`New ${name.toLowerCase()}`}).waitFor();
    const sign=page.locator('section.sign');
    check(/12 checks not answered yet/.test(await sign.innerText())&&!(await page.locator('.sigpad').isVisible()),`${label}: before every check is answered it says what is left and offers no signature`);
    const cards=page.locator('.card');
    await cards.nth(0).getByLabel('Answer').selectOption('action');
    for(let i=1;i<12;i++)await cards.nth(i).getByLabel('Answer').selectOption('ok');
    await cards.nth(0).getByLabel('Notes or what is wrong').fill('Riser door left unlocked');
    await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
    const left=await sign.innerText();
    check(/: say what needs doing/.test(left)&&(type==='handover-inspection')===/: say where, for the snag list/.test(left)&&!/not answered/.test(left),`${label}: lists what the action still needs: ${left.split('\n').slice(1,4).join(' / ')}`);
    await cards.nth(0).getByLabel('What needs doing').fill('Lock it and tell the site manager');
    if(type==='handover-inspection')await cards.nth(0).getByLabel(/^Where/).fill('Level 3 riser');
    await page.locator('.sigpad').waitFor();
    const go=page.getByRole('button',{name:'Sign it. Send when there is signal'});
    check(await go.isDisabled(),`${label}: cannot sign before drawing`);
    check(await page.getByLabel('Your name').inputValue()===principal.name,`${label}: the name is the signed-in person's`);
    await draw(page);
    if(screenshot){await go.scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`offline-sign-form-${scheme}-${width}.png`),fullPage:false});}
    check(await go.isEnabled(),`${label}: can sign once drawn`);
    await go.click();
    await page.getByRole('heading',{name:'Signed. Not sent yet.'}).waitFor();
    check(await cards.nth(0).getByLabel('Answer').isDisabled()&&await page.getByText('Add a photo').count()===0,`${label}: signing locks the inspection on this phone`);
    check(await page.locator('#drafts .item .tag',{hasText:'Signed · not sent yet'}).count()===1&&await page.locator('.edhead .tag',{hasText:'Signed · not sent yet'}).count()===1,`${label}: it says signed and not sent, in the list and on the report`);
    check(/Signed by Sam Signer/.test(await sign.innerText())&&await sign.locator('.signed-ink img').evaluate(i=>i.complete&&i.naturalWidth>0),`${label}: shows who signed and the signature`);
    if(type==='handover-inspection'){
      // Take it back, change an answer, and sign again.
      await page.getByRole('button',{name:'Take back signature to change it'}).click();
      await page.locator('.sigpad').waitFor();
      check(await cards.nth(0).getByLabel('Answer').isEnabled()&&await page.locator('#drafts .item .tag',{hasText:'Only on this phone'}).count()===1,`${label}: taking the signature back unlocks it and it is no longer marked signed`);
      await cards.nth(11).getByLabel('Answer').selectOption('na');
      await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
      check(await page.getByRole('button',{name:'Sign it. Send when there is signal'}).isDisabled(),`${label}: the old drawing does not carry over`);
      await draw(page);await page.getByRole('button',{name:'Sign it. Send when there is signal'}).click();
      await page.getByRole('heading',{name:'Signed. Not sent yet.'}).waitFor();
    }
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${label}: no sideways scroll`);
    if(screenshot){await sign.scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`offline-signed-${scheme}-${width}${changedAfter?'-changed':''}.png`),fullPage:false});}
    // Reload, still no signal: still signed and locked.
    await page.reload();
    const row=page.locator('#drafts .item',{hasText:`New ${name.toLowerCase()}`});await row.waitFor();
    check(/Signed · not sent yet/i.test(await row.innerText()),`${label}: still signed after a reload: ${await row.innerText()} ${JSON.stringify((await held(page)).map(h=>[h.key,!!h.signed,h.seq]))}`);
    await row.click();await page.getByRole('heading',{name:'Signed. Not sent yet.'}).waitFor();
    const [copy]=await held(page);
    check(copy.signed?.name===principal.name&&/^data:image\/png;base64,/.test(copy.signed.dataUrl)&&copy.signed.content.length>100,`${label}: the signature and what it covers are kept on the phone`);
    check(mine().filter(r=>!before.has(r.id)).length===0,`${label}: nothing reached the server while it was out of reach`);
    if(changedAfter)await tamper(page);
    // Signal back: open RELAY.
    await start();
    await page.goto(`${base}/engineer`);
    const fresh=()=>mine().filter(r=>!before.has(r.id));
    if(!changedAfter){
      const note=page.locator('.held-send .note-ok');await note.waitFor({timeout:30000});
      check(/The inspection you signed on this phone has gone to the office\./.test(await note.innerText()),`${label}: says it has gone to the office: ${await note.innerText()}`);
      check(fresh().length===1,`${label}: one report on the server`);
      const sent=getReport(fresh()[0].id);
      check(sent.reportType===type&&sent.state==='submitted'&&new RegExp(`-${code}-\\d{3}$`).test(sent.reference),`${label}: sent as a ${name.toLowerCase()}: ${sent.reference} ${sent.state}`);
      check(sent.signature?.name===principal.name&&sent.signature.dataUrl===copy.signed.dataUrl&&!!sent.signature.signedAt,`${label}: with the signature drawn on the phone`);
      check(sent.observations[0].check.answer==='action'&&sent.observations[0].actionNeeded==='Lock it and tell the site manager'&&sent.observations.slice(1,11).every(o=>o.check.answer==='ok')&&sent.observations[11].check.answer===(type==='handover-inspection'?'na':'ok'),`${label}: exactly as signed`);
      const raised=records('issues').filter(i=>i.raisedByReport===sent.id);
      check(type==='handover-inspection'?raised.length===1&&raised[0].location==='Level 3 riser':raised.length===0,`${label}: ${type==='handover-inspection'?'its action is on the snag list':'raises no issue'}`);
      await note.getByRole('link').click();
      await page.waitForURL(new RegExp(`/reports/${sent.id}`));
      await page.getByText(sent.reference.split('-').slice(1).join('-')).first().waitFor({timeout:20000});
      check(true,`${label}: opens the sent report`);
    } else {
      const note=page.locator('.held-send .note-bad');await note.waitFor({timeout:30000});
      check(/signed, but not sent to the office\.\s+It changed after you signed it, so it was not sent\./.test(await note.innerText()),`${label}: says it was not sent and why: ${await note.innerText()}`);
      const draft=getReport(fresh()[0].id);
      check(fresh().length===1&&draft.state==='draft'&&!draft.draftSignature&&!draft.signature,`${label}: on the server as a draft with no signature`);
      check(draft.observations[1].check.answer==='na',`${label}: the changed answer is kept, not lost`);
      await note.getByRole('link').click();
      await page.waitForURL(new RegExp(`/reports/${draft.id}`));
      await page.getByText(draft.reference.split('-').slice(1).join('-')).first().waitFor({timeout:20000});
      check(true,`${label}: opens the draft to check and sign again`);
    }
    check((await held(page)).length===0,`${label}: nothing is left held on the phone`);
    check(errors.length===0,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`Offline signing check passed (${checks} checks): a handover inspection (390px light, signed, taken back, signed again) and a safety inspection (1440px dark) signed with no signal, locked, kept across a reload and sent to the office by themselves, signed, when signal returned; one changed after signing (390px dark) went up as an unsigned draft and said so.`);
} finally {
  await browser?.close();await stop();
}
