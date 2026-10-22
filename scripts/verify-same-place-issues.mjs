// Browser check for "already raised" at the same place (2026-10-22). A two-site
// engineer day walk found every defect card listing up to six open issues from
// anywhere on site, each with a photo, between Where and What's wrong. Now a
// defect or access card lists only the open issues at its place (or a part of
// it: "Flat 2.04" and "flat 2.04 bathroom", never "Level 1" and "Level 12"),
// says so in one line when there are none, and keeps the rest behind "Link to an
// issue somewhere else". A link to an issue elsewhere is kept and still shown,
// after a reload too, and the list works with no signal from the issues already
// on the phone. Also: the number beside "Came back from the office" counts only
// what the office did, not the engineer's own report and defects just sent.
// Light and dark at 390px, with 48px targets, no sideways scroll, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
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
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-same-place-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues,applyCommand}=require('../apps/web/.test-build/lib/issueStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const P='proj-011lme';
const manager={id:'entra:sp-manager',oid:'sp-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const pat={id:'entra:sp-pat',oid:'sp-pat',name:'Pat Pipes',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const jpeg=colour=>sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer();
const photo=[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await jpeg('#aa7744')).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const defect=(location,what)=>ob('defect',location,what,{actionNeeded:'Make good',owner:'Leodis',affectedTrade:'Electrical',photos:photo});
async function send(who,observations){
  const r=createReport(P,who.name,who,'progress');
  const saved=saveDraft(r.id,{...r,observations},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,who.name);assert.ok(sent.ok,JSON.stringify(sent));
  while(await runOneJob());
}
// Open issues across the site from another trade.
await send(pat,[defect('Riser 2','Fire stopping missing round the cable tray'),defect('Flat 2.04','Socket faceplate cracked'),defect('flat 2.04 bathroom','Extract fan not wired'),defect('Level 12','Containment lid missing'),defect('Level 1 corridor','Light fitting hanging loose'),defect('Plant room','Isolator label missing'),defect('Roof','Cable ties perished')]);
const PLACES=7;
// One engineer per colour scheme: their own report with two defects; the office assigned one of them.
const sessions={};
const engineers={};
for(const scheme of ['light','dark']){
  const e={id:`entra:sp-${scheme}`,oid:`sp-${scheme}`,name:`Sam ${scheme}`,email:`sam-${scheme}@example.test`,role:'Engineer',trade:'Electrical'};
  engineers[scheme]=e;
  sessions[scheme]=randomUUID();putRecord('sessions',{id:sessions[scheme],principal:e,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  await send(e,[ob('update','Level 3','First fix done'),defect(`Store ${scheme}`,`Door closer missing ${scheme}`),defect(`Lift lobby ${scheme}`,`Trunking lid off ${scheme}`)]);
  const mine=listIssues(P).find(i=>i.description===`Door closer missing ${scheme}`);
  assert.ok(applyCommand(mine.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'',owner:'Leodis',targetDate:''}).ok);
}
const port=4511,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-same-place',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme,hasTouch:true,isMobile:true});
    await context.addCookies([{name:'relay_session',value:sessions[scheme],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-390.png`),fullPage:true});}};
    const sideways=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    const home=async()=>{await page.goto(`${base}/engineer?project=${P}`);await page.locator('.eng-came-back .eng-row').nth(2).waitFor({timeout:20000});};
    const count=()=>page.locator('.eng-came-back .eng-section-title .r').innerText();
    // Home: three rows (a report and two defects), one of them assigned by the office.
    await home();
    eq(await page.locator('.eng-came-back .eng-row').count(),3,`${scheme} home: the report and both defects are listed`);
    eq(await count(),'1 from the office',`${scheme} home: only the defect the office assigned is counted`);
    await shot('home');
    // A new update with a defect card.
    await page.getByRole('button',{name:/Start today’s site update/}).tap();await page.waitForURL(/\/reports\//);
    const open=()=>page.locator('.eng-slot.open');
    await open().getByLabel('Where',{exact:true}).waitFor();
    await open().getByLabel('Where',{exact:true}).fill('Level 3');
    await open().locator('textarea').first().fill('Second fix sockets done');
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.eng-add-kinds').getByRole('button',{name:/^\+ Defect$/}).tap();
    const where=open().getByLabel('Where',{exact:true});await where.waitFor();
    const question=open().locator('.field',{has:page.getByText('Is this something already raised?')});
    // No place yet: one line, nothing listed.
    eq(await question.locator('.eng-linkrow').count(),0,`${scheme} defect: nothing listed before a place is given`);
    ok(/Say where, and any issue still open there shows here\./.test(await question.innerText()),`${scheme} defect: says what to do first`);
    // A new place: one line, and the rest one tap away.
    await where.fill('Flat 1.03');
    eq(await question.locator('.eng-linkrow').count(),0,`${scheme} defect at Flat 1.03: no issues from elsewhere listed`);
    ok((await question.innerText()).includes('No open issue at Flat 1.03.'),`${scheme} defect at Flat 1.03: says so in one line`);
    ok(!(await question.innerText()).includes('Linking avoids'),`${scheme} defect at Flat 1.03: no hint about linking when there is nothing to link`);
    const elsewhere=question.locator('button.eng-link-elsewhere');
    // Pat's seven, both engineers' two each, and what the light run sent.
    const totalOpen=listIssues(P).filter(i=>i.work!=='closed'&&i.confirmation!=='withdrawn').length;
    if(scheme==='light')eq(totalOpen,PLACES+4,'light: the open issues seeded');
    eq(await elsewhere.innerText(),`Link to an issue somewhere else · ${totalOpen} open`,`${scheme} defect: the rest are one tap away, counted`);
    const asked=Math.round((await question.boundingBox()).height);
    console.log(`${scheme}: "Is this something already raised?" takes ${asked}px with no issue at the place`);
    ok(asked<=130,`${scheme} defect: the question takes a few lines, not a list (${asked}px)`);
    const box=await elsewhere.boundingBox();ok(box.height>=48,`${scheme} defect: "Link to an issue somewhere else" is a 48px target (${box.height}px)`);
    await shot('defect-new-place');
    // The same place, and a part of it: two listed. A longer number is not the same place.
    await where.fill('Flat 2.04');
    const rowTexts=async()=>(await question.locator('.eng-linkrow').allInnerTexts()).map(t=>t.replace(/\s+/g,' '));
    let rows=await rowTexts();
    eq(rows.length,3,`${scheme} defect at Flat 2.04: "this is new" and the two issues there`);
    ok(rows.some(t=>t.includes('Socket faceplate cracked'))&&rows.some(t=>t.includes('Extract fan not wired')),`${scheme} defect at Flat 2.04: the flat and its bathroom`);
    eq(await elsewhere.innerText(),`Link to an issue somewhere else · ${totalOpen-2} open`,`${scheme} defect at Flat 2.04: the others still one tap away`);
    await shot('defect-same-place');
    await where.fill('Level 1');
    rows=await rowTexts();
    ok(rows.length===2&&rows[1].includes('Light fitting hanging loose'),`${scheme} defect at Level 1: Level 1 corridor, not Level 12 (${rows.join(' | ')})`);
    // Linking to an issue somewhere else: through the fold, kept and shown after it closes.
    await where.fill('Flat 1.03');
    await page.evaluate(()=>document.activeElement?.blur());
    await elsewhere.tap();
    eq(await elsewhere.getAttribute('aria-expanded'),'true',`${scheme} fold: open`);
    ok((await question.locator('.eng-linkrow').count())>=7,`${scheme} fold: every open issue can be picked, with "Show all" for the rest`);
    eq(await sideways(),false,`${scheme} fold: no sideways scroll`);
    await shot('defect-elsewhere-open');
    const showAll=question.getByRole('button',{name:/^Show all \d+ open issues$/});
    if(await showAll.count())await showAll.tap();
    const riser=question.locator('.eng-linkrow',{hasText:'Fire stopping missing round the cable tray'});
    await riser.tap();
    eq(await riser.getAttribute('aria-pressed'),'true',`${scheme} fold: tapping an issue elsewhere links it`);
    eq(await elsewhere.innerText(),'Only issues at Flat 1.03',`${scheme} fold: says how to go back to this place only`);
    await elsewhere.tap();
    rows=await rowTexts();
    ok(rows.length===2&&rows[1].includes('Fire stopping missing'),`${scheme} defect: the issue linked elsewhere stays listed and chosen (${rows.join(' | ')})`);
    eq(await riser.getAttribute('aria-pressed'),'true',`${scheme} defect: still linked`);
    ok((await question.innerText()).includes("This will be added to that issue's history"),`${scheme} defect: says what linking does`);
    await page.getByText('Saved on server',{exact:true}).waitFor({state:'attached',timeout:20000});
    await page.waitForTimeout(1200);
    await page.reload();
    await page.locator('.eng-cardrow').nth(1).waitFor();
    if(await page.locator('.eng-cardrow').nth(1).getAttribute('aria-expanded')!=='true')await page.locator('.eng-cardrow').nth(1).tap();
    await open().locator('.eng-linkrow').nth(1).waitFor({timeout:20000});
    rows=await rowTexts();
    ok(rows.length===2&&rows[1].includes('Fire stopping missing'),`${scheme} reload: the link to an issue elsewhere survives and is shown`);
    eq(await open().locator('.eng-linkrow').nth(1).getAttribute('aria-pressed'),'true',`${scheme} reload: still chosen`);
    if(scheme==='dark'){
      // The issue linked elsewhere is withdrawn by the office: the card still says it is linked, and can be unlinked in one tap.
      const linkedIssue=listIssues(P).find(i=>i.description==='Fire stopping missing round the cable tray');
      assert.ok(applyCommand(linkedIssue.id,{kind:'withdraw',actor:manager.name,actorId:manager.id,note:'Raised twice'}).ok);
      await page.reload();
      await page.locator('.eng-cardrow').nth(1).waitFor();
      if(await page.locator('.eng-cardrow').nth(1).getAttribute('aria-expanded')!=='true')await page.locator('.eng-cardrow').nth(1).tap();
      const linkedQuestion=open().locator('.field',{has:page.getByText('Is this something already raised?')});
      await linkedQuestion.locator('.eng-linkrow').first().waitFor({timeout:20000});
      ok((await linkedQuestion.innerText()).includes("This will be added to that issue's history"),'dark: a link to an issue no longer open still says so');
      const unlink=linkedQuestion.getByRole('button',{name:/No — this is new/});
      eq(await unlink.getAttribute('aria-pressed'),'false','dark: "No — this is new" is there to unlink it');
      await unlink.tap();
      eq(await unlink.count(),0,'dark: unlinked, the card says there is nothing open here in one line');
      ok((await linkedQuestion.innerText()).includes('No open issue at Flat 1.03.'),'dark: one line after unlinking');
    }
    // Access card, with no signal: the issues already on the phone are matched to the place.
    await page.evaluate(()=>document.activeElement?.blur());
    await context.setOffline(true);
    await page.locator('.eng-add-kinds').getByRole('button',{name:/^\+ Access$/}).tap();
    await open().getByLabel('Where',{exact:true}).waitFor();
    const access=open().locator('.field',{has:page.getByText('Is this something already raised?')});
    eq(await access.locator('.eng-linkrow').count(),0,`${scheme} access, no signal: nothing listed before a place`);
    await open().getByLabel('Where',{exact:true}).fill('Plant room');
    rows=(await access.locator('.eng-linkrow').allInnerTexts()).map(t=>t.replace(/\s+/g,' '));
    ok(rows.length>=2&&rows.some(t=>t.includes('Isolator label missing'))&&rows.slice(1).every(t=>t.includes('· Plant room ·')),`${scheme} access, no signal: the issue in the plant room is listed (${rows.join(' | ')})`);
    await shot('access-offline');
    await context.setOffline(false);
    eq(await sideways(),false,`${scheme} report: no sideways scroll`);
    // Send it: the home's number still counts only what the office did.
    await page.getByText('Saved on server',{exact:true}).waitFor({state:'attached',timeout:30000});
    await open().locator('textarea').first().fill('Plant room locked, no key on site');
    await open().getByLabel('Where',{exact:true}).fill('Plant room');
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.eng-cardrow').nth(1).tap();
    await open().locator('textarea').first().fill('Back box damaged by plasterer');
    await open().locator('input[type=file]').first().setInputFiles({name:'d.jpg',mimeType:'image/jpeg',buffer:await jpeg('#663344')});
    await open().locator('.shot img').last().waitFor();
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).tap();
    await page.locator('#report-check').waitFor();
    await page.getByText('Saved on server',{exact:true}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'Send to office'}).tap();
    await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    while(await runOneJob());
    await home();
    await page.locator('.eng-came-back .eng-row').nth(3).waitFor();
    eq(await count(),'1 from the office',`${scheme} home after sending: the new report and defect are listed but not counted`);
    await shot('home-after-send');
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Same place issues check passed (${checks} checks): defect and access cards list issues at their place only, one line when none, the rest one tap away, links elsewhere kept, works with no signal, home counts only what the office did, light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit').catch(()=>{});}
  rmSync(root,{recursive:true,force:true});
}
