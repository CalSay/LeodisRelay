// Browser check: starting an inspection with no signal (FE-3e, second slice).
// The app leaves the inspections' checks on the phone; the offline page starts
// a safety, handover, first fix or tower inspection with every check (a tower
// inspection asks which tower first), takes answers, Where and
// photos, and the inspection goes up by itself once RELAY opens with signal.
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
const root=mkdtempSync(join(tmpdir(),'relay-offline-inspection-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records}=require('../apps/web/.test-build/lib/storage.js');
// Safety, permits and deliveries are off unless the office turns them on (lib/featureSwitch.ts); this check needs them on. verify-simpler-home.mjs covers both states.
putRecord('settings',{id:'features',safetyRecords:true});
const {getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:offline-inspector',oid:'offline-inspector',name:'Ivy Offline',email:'ivy@example.test',role:'Engineer',trade:'Electrical'};
const newSession=()=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4355,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-offline-inspection-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
const jpeg=colour=>sharp({create:{width:640,height:480,channels:3,background:colour}}).jpeg().toBuffer();
const mine=()=>records('reports').filter(r=>r.authorId===principal.id);
const heldKeys=page=>page.evaluate(()=>new Promise(done=>{const open=indexedDB.open('relay-drafts',2);open.onsuccess=()=>{const r=open.result.transaction('unsent').objectStore('unsent').getAllKeys();r.onsuccess=()=>{open.result.close();done(r.result);};};}));
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
try {
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  // Light at phone width: a handover inspection, whose actions ask Where. Dark on a desk: a safety inspection.
  // Light on a desk: a first fix inspection, whose actions ask Where too.
  // Dark at phone width: a tower inspection, which names its tower before it starts.
  for(const [scheme,width,type,name,code] of [['light',390,'handover-inspection','Handover inspection','PHI'],['dark',1440,'safety-inspection','Safety inspection','SSI'],['light',1440,'first-fix-inspection','First fix inspection','FFI'],['dark',390,'tower-inspection','Tower inspection','TPI']]){
    const raises=type!=='safety-inspection'&&type!=='tower-inspection';
    const tower=type==='tower-inspection'?'T7, level 3 stair core':'';
    const before=new Set(mine().map(r=>r.id));
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:newSession(),url:base}]);
    let page=await context.newPage();const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());};watch(page);
    await page.goto(`${base}/engineer`);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const types=await page.evaluate(()=>JSON.parse(localStorage.getItem('relay-offline-types')||'[]'));
    check(types.map(t=>t.id).join()==='safety-inspection,handover-inspection,first-fix-inspection,tower-inspection'&&types.every(t=>t.checklist.length===12&&t.checklist.every(c=>c.item&&c.question)),`${scheme}: the app leaves every inspection and its checks on the phone`);
    // No signal, cold start.
    await stop();
    await page.close();page=await context.newPage();watch(page);
    await page.goto(`${base}/engineer`);
    await page.getByRole('heading',{name:'Keep reporting. It is saved on this phone.'}).waitFor();
    check(await page.getByRole('heading',{name:'Start a report'}).isVisible(),`${scheme}: the start panel offers more than a site update`);
    const choices=await page.locator('#start-choices .choice strong').allInnerTexts();
    check(choices.join('|')==='Site update|Safety inspection|Handover inspection|First fix inspection|Tower inspection',`${scheme}: five choices: ${choices}`);
    check(await page.locator('#start-inspects').isHidden(),`${scheme}: no tower asked for a site update`);
    check(await page.getByRole('radio',{name:/^Site update/}).isChecked(),`${scheme}: a site update is chosen until another is picked`);
    await page.getByRole('radio',{name:new RegExp(`^${name}`)}).check();
    if(tower){
      check(await page.getByRole('textbox',{name:'Tower or podium'}).isVisible(),`${scheme}: a tower inspection asks which tower`);
      await page.getByRole('button',{name:'Start on this phone'}).click();
      await page.locator('#error',{hasText:'Say which tower or podium you are inspecting.'}).waitFor();
      check((await heldKeys(page)).length===0,`${scheme}: nothing started without a tower`);
      await page.getByRole('textbox',{name:'Tower or podium'}).fill(`  ${tower} `);
    } else check(await page.locator('#start-inspects').isHidden(),`${scheme}: no tower asked for a ${name.toLowerCase()}`);
    await page.getByRole('button',{name:'Start on this phone'}).click();
    await page.locator('#editor-title',{hasText:`New ${name.toLowerCase()}${tower?` of ${tower}`:''} · Tetley Hall - Block E`}).waitFor();
    check((await page.locator('.card').count())===12,`${scheme}: it starts with every check`);
    check(await page.getByRole('button',{name:/^Defect/}).count()===0&&await page.getByRole('button',{name:'Remove card 1'}).count()===0,`${scheme}: checks cannot be added or removed`);
    check((await page.locator('.card').nth(0).locator('.qhint').innerText()).length>10,`${scheme}: each check shows what to look at`);
    check(/Answer every check, then sign at the foot of the page/.test(await page.locator('#editor .panel').first().innerText()),`${scheme}: says where it is signed`);
    const first=page.locator('.card').nth(0);
    await first.getByLabel('Answer').selectOption('action');
    if(raises)await page.locator('.card').nth(0).getByLabel(/^Where/).fill('Level 2 east corridor');
    else check(await page.locator('.card').nth(0).getByLabel(/^Where/).count()===0,`${scheme}: a safety action asks no Where`);
    await page.locator('.card').nth(0).getByLabel('What’s wrong').fill('Tray lid missing over the door');
    await page.locator('.card').nth(0).getByLabel('What needs doing').fill('Fit the lid');
    await page.locator('.card').nth(0).locator('input[type=file]').setInputFiles({name:'tray.jpg',mimeType:'image/jpeg',buffer:await jpeg('#aa6633')});
    await page.locator('.card').nth(0).locator('.shot img').waitFor();
    await page.locator('.card').nth(1).getByLabel('Answer').selectOption('ok');
    await page.locator('.card').nth(2).getByLabel('Answer').selectOption('na');
    await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${scheme}: no sideways scroll`);
    if(screenshot)await page.screenshot({path:join(screenshot,`offline-inspection-${scheme}-${width}.png`),fullPage:false});
    // Reload, still no signal: it is all there.
    await page.reload();
    const row=page.locator('#drafts .item',{hasText:`New ${name.toLowerCase()}`});
    await row.waitFor();
    check(/3 of 12 checks answered · 1 photo/.test(await row.innerText()),`${scheme}: listed with its answers and photo: ${await row.innerText()}`);
    await row.click();
    check(await page.locator('.card').nth(0).getByLabel('Answer').inputValue()==='action'&&await page.locator('.card').nth(2).getByLabel('Answer').inputValue()==='na',`${scheme}: the answers survive a reload`);
    check(mine().filter(r=>!before.has(r.id)).length===0,`${scheme}: nothing reached the server while it was out of reach`);
    if(screenshot){await page.locator('#start').scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`offline-inspection-start-${scheme}-${width}.png`),fullPage:false});}
    // Signal back: open RELAY and it goes up by itself.
    await start();
    await page.goto(`${base}/engineer`);
    const note=page.locator('.held-send .note-ok');await note.waitFor({timeout:30000});
    check(/The report you started on this phone is now on the server\. It stays a draft until you sign and send\./.test(await note.innerText()),`${scheme}: says it went up: ${await note.innerText()}`);
    const fresh=mine().filter(r=>!before.has(r.id));
    check(fresh.length===1,`${scheme}: one report on the server, not two`);
    const made=getReport(fresh[0].id);
    check((made.inspected??'')===tower,`${scheme}: the tower reached the server as typed, tidied: ${made.inspected}`);
    check(made.reportType===type&&made.state==='draft'&&new RegExp(`-${code}-\\d{3}$`).test(made.reference),`${scheme}: it is a ${name.toLowerCase()} draft, numbered as one: ${made.reference}`);
    const o=made.observations;
    check(o.length===12&&o.every(c=>c.type==='check'&&c.check?.item),`${scheme}: with every check`);
    check(o[0].check.answer==='action'&&o[0].whatHappened==='Tray lid missing over the door'&&o[0].actionNeeded==='Fit the lid'&&o[0].photos.length===1&&o[0].location===(raises?'Level 2 east corridor':''),`${scheme}: the action, its words, Where and photo reached the server`);
    check(o[1].check.answer==='ok'&&o[2].check.answer==='na'&&o.slice(3).every(c=>!c.check.answer),`${scheme}: and the other answers, the rest left open`);
    check(!JSON.stringify(records('issues')).includes(made.id),`${scheme}: nothing sent and no issue raised before it is signed and sent`);
    await page.locator('.held-send .note-ok').getByRole('link').click();
    await page.waitForURL(new RegExp(`/reports/${made.id}`));
    await page.getByText(made.reference.split('-').slice(1).join('-')).first().waitFor({timeout:20000});
    check(true,`${scheme}: it opens in the editor with its reference`);
    check((await heldKeys(page)).length===0,`${scheme}: nothing is left held on the phone`);
    check(errors.length===0,`${scheme}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`Offline inspection check passed (${checks} checks): checks left on the phone, a handover inspection (390px light), a safety inspection (1440px dark), a first fix inspection (1440px light) and a tower inspection with its tower (390px dark) started with no signal, answered with a photo, kept across a reload, and sent up by themselves as drafts when signal returned.`);
} finally {
  await browser?.close();await stop();
}
