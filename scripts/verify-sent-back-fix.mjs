// Browser check for a fix the office sent back, put forward again (2026-10-22).
// A walk at 390px: Sam's socket was sent back as "Not finished" with a reason.
// The engineer side was already short (home row with the office's words, the
// issue opens with the reason above the buttons, photo, note, Put forward: 4
// taps). But the office's Check this fix window then looked like a first
// attempt: nothing said it had been sent back or what was asked, so whoever
// checked it could not check the new photo against the ask.
// Now the window says "Sent back by Jo Office on …: “…”" above the engineer's
// note, the Fixed, to check rows say "put forward again", and the office issue
// sheet says the same. A first attempt says none of it.
// Checks: the engineer's walk and its taps; the second attempt reaches the
// server with the new photo; on the office overview at 1440 dark and 390 light,
// the row, the window (reason before their note, the new photo, not the first)
// and the issue sheet; a first attempt says nothing of the kind; axe on the
// window; no sideways scroll; no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the screens.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-sent-back-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {getIssue}=require('../apps/web/.test-build/lib/issueStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const sam=person('sb-sam','Sam Spark','Engineer','Electrical'),jo=person('sb-jo','Jo Office','Manager'),ann=person('sb-ann','Ann Checker','Manager');
const sessions={};
for(const p of [sam,jo,ann]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const today=londonDay(new Date());
const addDays=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const T='proj-011lme';
const png=colour=>sharp({create:{width:640,height:480,channels:3,background:colour}}).png().toBuffer();
const photo=async(colour,id,when)=>{const pid=randomUUID();await putMedia(pid,{issueId:id,ownerId:sam.id,mime:'image/png'},await png(colour));return {id:pid,dataUrl:`/api/media/${pid}`,caption:'',capturedAt:when};};
const REASON='The plate is new but the back box is still loose. Fix the back box and send a photo with the plate off.';
const issue=async(id,description,location,events,work)=>{const r=`${addDays(-6)}T09:00:00.000Z`;
  putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:T,source:'individual',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',affectedTrade:'Electrical',location,description,actionNeeded:'',confirmation:'confirmed',work,owner:'Acme Electrical',targetDate:addDays(4),raisedAt:r,
    ...(work==='awaiting_verification'?{closureSubmittedBy:sam.name,closureSubmittedById:sam.id}:{}),
    events:[{at:r,actor:sam.name,actorId:sam.id,kind:'raised',note:'',photos:[await photo('#7a3b2a',id,r)]},{at:`${addDays(-6)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'assigned',to:'Acme Electrical',targetDate:addDays(4),note:'',photos:[]},...events]});};
const firstFix=await photo('#2f6b45','901',`${addDays(-2)}T14:00:00.000Z`);
await issue('901','Socket face plate cracked','Flat 3.02, kitchen',[
  {at:`${addDays(-2)}T14:00:00.000Z`,actor:sam.name,actorId:sam.id,kind:'closure_submitted',note:'New face plate fitted',photos:[firstFix]},
  {at:`${addDays(-1)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'reopened',note:REASON,photos:[]}],'in_progress');
// A first attempt, waiting: never "again".
await issue('902','Light switch loose','Flat 3.04, hall',[{at:`${addDays(-3)}T14:00:00.000Z`,actor:sam.name,actorId:sam.id,kind:'closure_submitted',note:'Switch refixed',photos:[await photo('#2f6b45','902',`${addDays(-3)}T14:00:00.000Z`)]}],'awaiting_verification');

const port=4473,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-sent-back',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
const shoot=async(page,name,full=false)=>{if(shots)await page.screenshot({path:join(shots,`${name}.png`),fullPage:full});};
const flat=s=>s.replace(/\s+/g,' ').trim();
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const errors=[];
const open=async(who,width,scheme)=>{const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:scheme,hasTouch:width===390});
  await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(`${who.name} ${width}: ${e.message}`));return page;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});

  // Sam, 390 light: from the home's Came back row to put forward again.
  {const page=await open(sam,390,'light');let taps=0;
    await page.goto(`${base}/engineer?project=${T}`);
    const row=page.locator('a[href^="/issues/901"]').first();await row.waitFor();
    ok(flat(await row.innerText()).includes(REASON),'home: the row carries the office\'s reason');
    await shoot(page,'engineer-home-light-390');
    await row.click();taps++;await page.waitForURL(/\/issues\/901/);
    const box=page.locator('.eng-word-box');await box.waitFor();
    ok(flat(await box.innerText()).includes(REASON),'issue: the reason is shown');
    const put=page.getByRole('button',{name:'Put forward as fixed'});await put.waitFor();
    ok((await box.boundingBox()).y<(await put.boundingBox()).y&&(await put.boundingBox()).y+(await put.boundingBox()).height<=844,'issue: the reason, then Put forward, both on the first screen');
    await shoot(page,'engineer-issue-light-390');
    await page.locator('label.camera input[type=file]').setInputFiles({name:'plate-off.png',mimeType:'image/png',buffer:await png('#335599')});taps++;
    await page.fill('#note','Back box screwed tight, photo with the plate off');taps++;
    await put.click();taps++;
    await page.locator('.issue-eng-done').waitFor();
    ok(taps===4,`engineer: 4 taps from the home to put forward again (${taps})`);
    const saved=getIssue('901'),last=saved.events.at(-1);
    ok(saved.work==='awaiting_verification'&&last.kind==='closure_submitted'&&last.photos.length===1&&last.photos[0].id!==firstFix.id,'server: put forward again with the new photo');
    await shoot(page,'engineer-put-forward-light-390');
    await page.context().close();}

  // The office, someone other than who sent it back: 1440 dark and 390 light.
  for(const [width,scheme] of [[1440,'dark'],[390,'light']]){const label=`${width} ${scheme}`;const page=await open(ann,width,scheme);
    await page.goto(`${base}/office`);
    const panel=page.locator('.act').filter({hasText:'Fixed, to check'}).first();await panel.waitFor();
    const rows=flat(await panel.innerText());
    ok(/Socket face plate cracked[^]*put forward again/.test(rows),`${label}: the overview row says put forward again: ${rows}`);
    ok(!rows.slice(rows.indexOf('Light switch loose'),rows.indexOf('Socket face plate cracked')).includes('again')&&rows.indexOf('Light switch loose')<rows.indexOf('Socket face plate cracked'),`${label}: a first attempt does not say again`);
    // Open the window on the socket: the panel lists oldest put forward first, so the switch is first; skip to the socket.
    await panel.getByRole('button',{name:'Verify'}).first().click();
    const dialog=page.locator('dialog.cf-dialog[open]');await dialog.waitFor();
    for(let n=0;n<3&&!flat(await dialog.innerText()).includes('Socket face plate cracked');n++){
      ok(!flat(await dialog.innerText()).includes('Sent back'),`${label}: the first attempt's window says nothing of a send-back`);
      await dialog.getByRole('button',{name:'Skip'}).click();await page.waitForTimeout(300);}
    await dialog.locator('.cf-back').waitFor();
    const words=flat(await dialog.innerText());
    ok(words.includes(`Sent back by Jo Office on`)&&words.includes(`“${REASON}”`)||words.includes(REASON),`${label}: the window says who sent it back and why: ${words}`);
    ok(words.indexOf(REASON)<words.indexOf('Their note'),`${label}: the reason comes before their note`);
    const fixSrc=await dialog.locator('.cf-side').nth(1).locator('img').first().getAttribute('src');
    ok(fixSrc&&!fixSrc.includes(firstFix.id)&&fixSrc.includes(getIssue('901').events.at(-1).photos[0].id),`${label}: the fix shown is the new photo, not the one sent back`);
    ok(await overflow(page)<=0,`${label}: no sideways scroll`);
    await page.evaluate(axeSource);
    const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('dialog[open]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,3).join(', ')}`));
    ok(!found.length,`${label}: axe found ${found.join('; ')}`);
    await shoot(page,`office-check-${scheme}-${width}`);
    await dialog.getByRole('button',{name:'Stop'}).click();
    if(width===1440){await page.locator('.ws .bell').click();const pop=page.locator('.ws .attn-pop');await pop.waitFor();
      const listed=flat(await pop.innerText());
      ok(/Socket face plate cracked[^]*?put forward again/.test(listed)&&!listed.slice(listed.indexOf('Light switch loose')).split('Socket face plate cracked')[0].includes('again'),`${label}: Attention says put forward again on the socket only: ${listed}`);
      await page.keyboard.press('Escape');}
    // The office issue sheet says the same.
    await page.goto(`${base}/office#/projects/${T}/issue/901`);
    const sheet=page.locator('.note',{hasText:'Closure submitted by'});await sheet.waitFor();
    const said=flat(await sheet.innerText());
    ok(said.includes('Sent back by Jo Office on')&&said.includes(REASON),`${label}: the issue sheet says it was sent back and why: ${said}`);
    await page.goto(`${base}/office#/projects/${T}/issue/902`);
    await page.reload();await page.waitForFunction(()=>document.body.innerText.includes('Switch refixed'),null,{timeout:10000});
    const first=page.locator('.note',{hasText:'Closure submitted by'});await first.waitFor();
    ok(!flat(await first.innerText()).includes('Sent back'),`${label}: a first attempt's sheet says nothing of a send-back`);
    ok(await overflow(page)<=0,`${label}: issue sheet, no sideways scroll`);
    await page.context().close();}

  ok(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`Sent-back fix check passed (${checks} checks): 4 taps for the engineer to put it forward again; the office sees who sent it back and why, before the new note and photo, on the row, the window and the sheet; a first attempt says none of it.`);
} finally {await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});}
