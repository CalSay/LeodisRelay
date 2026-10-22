// Browser check for the office's reason reaching whoever is fixing (2026-10-22).
// Sam raised a cracked socket plate; Pat, another electrician, fitted a new
// plate and put it forward; Jo in the office sent it back as "Not finished"
// with a reason. Before, only Sam saw that reason at the top of the issue and
// on the home: Pat, who has to go back, found it only in History, and Pat's
// home said nothing. Now the reason is above the buttons for whoever the issue
// is theirs to see to (they raised it, it is their trade, or they worked on
// it, as Issues "Yours"), and the home's Came back row lists an issue the
// engineer put forward that the office sent back.
// Checks: Pat at 1440 dark and 390 light (the reason above Put forward on the
// first screen, the home row, 4 taps to put it forward again, then the box and
// row go); Lee, same trade but not involved, sees the reason on the issue but
// gets no home row; Pete, another trade, sees no box (the reason stays in
// History, as before); Sam, who raised it, as before; one put forward and not
// sent back is not on Pat's home; axe on the box; no sideways scroll; no page errors.
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
const root=mkdtempSync(join(tmpdir(),'relay-sent-back-reason-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {getIssue}=require('../apps/web/.test-build/lib/issueStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const sam=person('sr-sam','Sam Spark','Engineer','Electrical'),pat=person('sr-pat','Pat Wire','Engineer','Electrical'),lee=person('sr-lee','Lee Live','Engineer','Electrical'),
  pete=person('sr-pete','Pete Pipe','Engineer','P&H'),jo=person('sr-jo','Jo Office','Manager');
const sessions={};
for(const p of [sam,pat,lee,pete,jo]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const today=londonDay(new Date());
const addDays=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const T='proj-011lme';
const png=colour=>sharp({create:{width:640,height:480,channels:3,background:colour}}).png().toBuffer();
const photo=async(colour,id,when,owner)=>{const pid=randomUUID();await putMedia(pid,{issueId:id,ownerId:owner.id,mime:'image/png'},await png(colour));return {id:pid,dataUrl:`/api/media/${pid}`,caption:'',capturedAt:when};};
const REASON='The plate is new but the back box is still loose. Fix the back box and send a photo with the plate off.';
const issue=async(id,description,location,events,work)=>{const r=`${addDays(-6)}T09:00:00.000Z`;
  putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:T,source:'individual',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',affectedTrade:'Electrical',location,description,actionNeeded:'',confirmation:'confirmed',work,owner:'Acme Electrical',targetDate:addDays(4),raisedAt:r,
    ...(work==='awaiting_verification'?{closureSubmittedBy:pat.name,closureSubmittedById:pat.id}:{}),
    events:[{at:r,actor:sam.name,actorId:sam.id,kind:'raised',note:'',photos:[await photo('#7a3b2a',id,r,sam)]},{at:`${addDays(-6)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'assigned',to:'Acme Electrical',targetDate:addDays(4),note:'',photos:[]},...events]});};
const putBy=async(id,day,note)=>({at:`${addDays(day)}T14:00:00.000Z`,actor:pat.name,actorId:pat.id,kind:'closure_submitted',note,photos:[await photo('#2f6b45',id,`${addDays(day)}T14:00:00.000Z`,pat)]});
await issue('921','Socket face plate cracked','Flat 3.02, kitchen',[await putBy('921',-2,'New face plate fitted'),
  {at:`${addDays(-1)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'reopened',note:REASON,photos:[]}],'in_progress');
// Put forward by Pat, not sent back: waiting on the office, so not on Pat's home.
await issue('922','Light switch loose','Flat 3.04, hall',[await putBy('922',-3,'Switch refixed')],'awaiting_verification');

const port=4474,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-sent-back-reason',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
const shoot=async(page,name,full=false)=>{if(shots)await page.screenshot({path:join(shots,`${name}.png`),fullPage:full});};
const flat=s=>s.replace(/\s+/g,' ').trim();
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const errors=[];
const open=async(who,width,scheme)=>{const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:scheme,hasTouch:width===390});
  await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(`${who.name} ${width}: ${e.message}`));return page;};
// The issue page has loaded when its buttons or its closed note show.
const issuePage=async(page,id)=>{await page.goto(`${base}/issues/${id}`);await page.locator('h1.issue-eng-title').waitFor();await page.locator('.issue-eng-facts').first().waitFor();await page.waitForTimeout(300);};
const home=async page=>{await page.goto(`${base}/engineer?project=${T}`);
  await page.waitForFunction(()=>{const t=document.body.innerText;return /Came back from the office/.test(t)&&!/Checking with the office/.test(t);},null,{timeout:15000});await page.waitForTimeout(800);};
const axeBox=async(page,label)=>{await page.evaluate(axeSource);
  const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('.eng-word-box'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,3).join(', ')}`));
  ok(!found.length,`${label}: axe found ${found.join('; ')}`);};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});

  // Sam raised it: as before, the reason on the issue and the home row says "you raised it".
  {const page=await open(sam,390,'light');await issuePage(page,'921');
    const box=page.locator('.eng-word-box');ok(await box.count()===1&&flat(await box.innerText()).includes(REASON),'Sam: the reason on the issue, as before');
    await home(page);const row=page.locator('.eng-came-back a[href^="/issues/921"]').first();
    ok(await row.count()===1&&/you raised it/.test(flat(await row.innerText())),'Sam: the home row says you raised it');
    await page.context().close();}

  // Pat put the fix forward, at 1440 dark: the reason on the issue.
  {const page=await open(pat,1440,'dark');await issuePage(page,'921');
    const box=page.locator('.eng-word-box');ok(await box.count()===1&&flat(await box.innerText()).includes(`Jo Office wrote on`)&&flat(await box.innerText()).includes(REASON),'Pat 1440 dark: who sent it back and why, on the issue');
    await axeBox(page,'Pat 1440 dark');ok(await overflow(page)<=0,'Pat 1440 dark: no sideways scroll');
    await shoot(page,'pat-issue-dark-1440');await page.context().close();}

  // Pat at 390 light: from the home row to put forward again.
  {const page=await open(pat,390,'light');let taps=0;await home(page);
    const row=page.locator('.eng-came-back a[href^="/issues/921"]').first();
    ok(await row.count()===1,'Pat: the sent-back issue is on the home');
    const said=flat(await row.innerText());
    ok(said.includes(REASON)&&/you put it forward/.test(said)&&!/you raised it/.test(said),`Pat: the row carries the reason and says Pat put it forward: ${said}`);
    ok(await page.locator('.eng-came-back a[href^="/issues/922"]').count()===0,'Pat: one waiting on the office, not sent back, is not on the home');
    ok(await overflow(page)<=0,'Pat home: no sideways scroll');
    await shoot(page,'pat-home-light-390');
    await row.click();taps++;await page.waitForURL(/\/issues\/921/);
    const box=page.locator('.eng-word-box');await box.waitFor();
    ok(flat(await box.innerText()).includes(REASON),'Pat 390: the reason on the issue');
    const put=page.getByRole('button',{name:'Put forward as fixed'});await put.waitFor();
    const b=await box.boundingBox(),p=await put.boundingBox();
    ok(b.y<p.y&&p.y+p.height<=844,'Pat 390: the reason, then Put forward, both on the first screen');
    await axeBox(page,'Pat 390 light');ok(await overflow(page)<=0,'Pat 390 issue: no sideways scroll');
    await shoot(page,'pat-issue-light-390');
    await page.locator('label.camera input[type=file]').setInputFiles({name:'plate-off.png',mimeType:'image/png',buffer:await png('#335599')});taps++;
    await page.fill('#note','Back box screwed tight, photo with the plate off');taps++;
    await put.click();taps++;
    await page.locator('.issue-eng-done').waitFor();
    ok(taps===4,`Pat: 4 taps from the home to put it forward again (${taps})`);
    const last=getIssue('921').events.at(-1);
    ok(getIssue('921').work==='awaiting_verification'&&last.kind==='closure_submitted'&&last.actorId===pat.id,'server: Pat put it forward again');
    await issuePage(page,'921');ok(await page.locator('.eng-word-box').count()===0,'Pat: once answered, the box goes');
    await home(page);ok(await page.locator('.eng-came-back a[href^="/issues/921"]').count()===0,'Pat: once answered, the home row goes');
    await page.context().close();}

  // Put the reason back for the other two engineers.
  {const saved=getIssue('921');putRecord('issues',{...saved,work:'in_progress',events:[...saved.events,{at:new Date().toISOString(),actor:jo.name,actorId:jo.id,kind:'reopened',note:REASON,photos:[]}]});}

  // Lee, same trade, not involved: the reason on the issue, no home row.
  {const page=await open(lee,390,'light');await issuePage(page,'921');
    ok(await page.locator('.eng-word-box').count()===1&&flat(await page.locator('.eng-word-box').innerText()).includes(REASON),'Lee (same trade): the reason on the issue');
    await shoot(page,'lee-issue-light-390');
    await home(page);ok(await page.locator('.eng-came-back a[href^="/issues/921"]').count()===0,'Lee: not on the home (did not raise or put it forward)');
    await page.context().close();}

  // Pete, another trade: no box; the reason stays in History, as before.
  {const page=await open(pete,390,'light');await issuePage(page,'921');
    ok(await page.locator('.eng-word-box').count()===0,'Pete (another trade): no box');
    ok(flat(await page.content()).includes(REASON.slice(0,40)),'Pete: the reason is still in History, as before');
    await shoot(page,'pete-issue-light-390');
    await page.context().close();}

  ok(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`Sent-back reason check passed (${checks} checks): whoever put the fix forward sees the office's reason on the issue and the home, 4 taps to put it forward again; the same trade sees it on the issue; another trade does not; the raiser as before.`);
} finally {await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});}
