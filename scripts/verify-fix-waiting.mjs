// Browser check for how long a fix has waited to be checked (2026-10-22).
// The checking fixes walk (21 Oct, project files ui-review/checking-fixes/walk-notes.md)
// left five small findings after #131:
//  - "waiting N days" counted from the issue's last event, so a note added after a fix
//    was put forward reset the wait;
//  - "Verify the oldest" picked the oldest defect, not the fix waiting longest;
//  - the issue sheet showed its target as "2026-10-13" where every other screen says "13 Oct";
//  - the engineer's "N put forward as fixed, waiting for the office to check" could not
//    be opened to see which (checked in verify-issues-yours);
//  - the engineer home counted a fix still waiting to be checked as "from the office"
//    because the office had assigned it before it was put forward.
// Example data: three fixes on Tetley Hall. A was raised 40 days ago, put forward 2 days
// ago, and has a note from today; B was raised 10 days ago and put forward 8 days ago;
// C was raised 20 days ago and put forward 5 days ago. Longest waiting: B, C, A.
// Checks, light and dark at 1440 and light at 390: the overview's Fixed, to check rows
// in that order with 8, 5 and 2 days; the project's figure says the oldest put forward;
// "Verify the oldest" starts at B; A's issue sheet says when it was put forward and
// waits 2 days, with its target in words; the engineer home counts only what the
// office sent back. No sideways scroll and no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-fix-waiting-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {dateShort}=require('../apps/web/.test-build/lib/dates.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const manager=person('fw-manager','Jo Office','Manager');
const sam=person('fw-sam','Sam Spark','Engineer','Electrical');
const sessions={};
for(const p of [manager,sam]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const DAY=86400000,now=Date.now();
// An hour past the whole day, so "waiting N days" is N however long the check takes.
const ago=days=>new Date(now-days*DAY-3600000).toISOString();
const T='proj-011lme';
const ev=(kind,at,who,note='')=>({at,actor:who.name,actorId:who.id,kind,note,photos:[]});
const fix=(id,description,raisedDays,putDays,extra=[],target='2026-10-13')=>({id,reference:`DEMO-011LME-ISS-${id}`,projectId:T,source:'individual',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',affectedTrade:'Electrical',
  location:'Level 2 riser',description,actionNeeded:'',confirmation:'confirmed',work:'awaiting_verification',owner:'Acme Electrical',targetDate:target,raisedAt:ago(raisedDays),
  closureSubmittedBy:sam.name,closureSubmittedById:sam.id,
  events:[ev('raised',ago(raisedDays),sam,description),ev('assigned',ago(raisedDays-0.5),manager,'Acme Electrical'),ev('closure_submitted',ago(putDays),sam,'Done'),...extra]});
const A=fix('701','Fire collar missing on the riser',40,2,[ev('progress',new Date(now-600000).toISOString(),sam,'Photo of the label added')]);
const B=fix('702','Cable tray lid missing',10,8);
const C=fix('703','Socket faceplate cracked',20,5);
// Sent back by the office with a reason: the one thing on Sam's home that came back from the office.
const D={...fix('704','Pull cord switch loose',12,6),work:'in_progress',events:[...fix('704','Pull cord switch loose',12,6).events,ev('reopened',ago(1),manager,'Still loose at the ceiling rose')]};
for(const i of [A,B,C,D])putRecord('issues',i);

const port=4523,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-fix-waiting',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const flat=s=>s.replace(/\s+/g,' ').trim();
try {
  try{await fetch(base+'/signin');throw Error(`Something is already answering on port ${port}: stop it first.`);}catch(e){if(/already answering/.test(e.message))throw e;}
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const open=async(who,scheme,width)=>{const phone=width<700;const context=await browser.newContext({viewport:{width,height:phone?844:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const sideways=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);

  for(const [scheme,width] of [['light',1440],['dark',1440],['light',390]]){
    const label=`${scheme} ${width}px`;
    const {context,page,errors}=await open(manager,scheme,width);
    // The overview: longest waiting first, each counted from when it was put forward.
    await page.goto(`${base}/office`);
    const panel=page.locator('.act').filter({hasText:'Fixed, to check'}).first();await panel.waitFor();
    await panel.locator('.rt b').first().waitFor();
    const rows=(await panel.locator('.rt').allInnerTexts()).map(flat);
    check(rows.length===3,`${label}: three fixes on the overview (${rows.length})`);
    const order=[B,C,A].map(i=>i.description),days=[8,5,2];
    check(order.every((d,n)=>rows[n]?.includes(d)),`${label}: longest waiting first, not oldest raised or newest note (${rows.join(' | ')})`);
    check(days.every((d,n)=>rows[n]?.includes(`waiting ${d} days`)),`${label}: each waits from when it was put forward (${rows.join(' | ')})`);
    check(await sideways(page)<=0,`${label}: overview has no sideways scroll`);
    // The project's figure says the oldest put forward.
    await page.goto(`${base}/office#/projects/${T}`);
    const figure=page.locator('dl.tb > div').filter({hasText:'Fixed, to check'}).first();await figure.waitFor();
    const figureText=flat(await figure.innerText());
    check(figureText.includes(`oldest put forward ${dateShort(B.events[2].at,'auto')}`),`${label}: the project figure gives the oldest put forward, ${dateShort(B.events[2].at,'auto')} (${figureText})`);
    // A's sheet: when it was put forward, how long it has waited, and its target in words.
    await page.goto(`${base}/office#/projects/${T}/issue/${A.id}`);
    const note=page.locator('.note').filter({hasText:'Closure submitted by'}).first();await note.waitFor();
    const noteText=flat(await note.innerText());
    check(noteText.includes(`put forward ${dateShort(A.events[2].at,'auto')}, waiting 2 days`),`${label}: the sheet waits from the put forward, not today's note (${noteText})`);
    const target=flat(await page.locator('dl.tb > div').filter({has:page.locator('dt',{hasText:/^Target$/})}).locator('dd').first().innerText());
    check(target===dateShort('2026-10-13','auto')&&!/\d{4}-\d{2}-\d{2}/.test(target),`${label}: the target reads ${dateShort('2026-10-13','auto')}, as on every other screen (${target})`);
    check(await sideways(page)<=0,`${label}: issue sheet has no sideways scroll`);
    // The register: "Verify the oldest" starts at the fix that has waited longest.
    await page.goto(`${base}/office#/issues/show/verify`);
    const oldest=page.getByRole('button',{name:'Verify the oldest'});await oldest.waitFor();
    await oldest.click();
    const dialog=page.locator('dialog.cf-dialog[open]');await dialog.locator('.cf-what b').waitFor();
    const first=flat(await dialog.locator('.cf-what b').innerText());
    check(first===B.description,`${label}: Verify the oldest starts at the fix waiting longest (${first})`);
    await dialog.getByRole('button',{name:'Skip'}).click();
    await page.waitForFunction(d=>document.querySelector('dialog.cf-dialog[open] .cf-what b')?.textContent?.trim()===d,C.description,{timeout:8000}).catch(()=>{});
    check(flat(await dialog.locator('.cf-what b').innerText())===C.description,`${label}: then the next longest waiting`);
    await page.keyboard.press('Escape');
    check(errors.length===0,`${label}: no page errors (${errors.join('; ')})`);
    await context.close();
  }

  // The engineer home counts only what the office sent back, not a fix still waiting for it.
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const label=`engineer ${scheme} ${width}px`;
    const {context,page,errors}=await open(sam,scheme,width);
    await page.goto(`${base}/engineer?project=${T}`);
    const title=page.locator('.eng-section-title').filter({hasText:'Came back from the office'});await title.waitFor();
    await page.waitForFunction(()=>/from the office$/.test(document.querySelector('#eng-came-back-title')?.parentElement?.querySelector('.r')?.textContent??''),null,{timeout:8000}).catch(()=>{});
    const count=flat(await title.locator('.r').innerText());
    check(count==='1 from the office',`${label}: counts the one sent back, not the three waiting to be checked (${count})`);
    const list=flat(await page.locator('main').innerText());
    check(list.includes(D.description)&&list.includes('Still loose at the ceiling rose'),`${label}: the sent-back one is listed with the office's words`);
    check(await sideways(page)<=0,`${label}: no sideways scroll`);
    check(errors.length===0,`${label}: no page errors (${errors.join('; ')})`);
    await context.close();
  }
  console.log(`verify-fix-waiting: ${checks} checks passed`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit').catch(()=>{});
  database().close();rmSync(root,{recursive:true,force:true});
}
