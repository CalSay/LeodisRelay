// Browser check for an engineer's day on a 390px phone, after the plain-words
// pass of 2026-10-21: the big button is today's update (one left from an
// earlier day waits under Unfinished reports, and a report the big buttons
// open is not listed twice); sent reports on the home screen do not say
// "PM not notified"; a card just added shows no red warning; signing a site
// update is marked optional; the sent report and a defect on its own say what
// happened in plain words; the hidden safety extras stay hidden. Light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-engday-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport,acknowledgeReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const engineer={id:'entra:ed-engineer',oid:'ed-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:ed-manager',oid:'ed-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme';
const jpeg=colour=>sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer();
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const dayBack=n=>new Date(Date.now()-n*86400000).toISOString();
async function send(observations,ago){
  const r=createReport(P,engineer.name,engineer,'progress');
  const saved=saveDraft(r.id,{...r,observations},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));
  for(const kind of ['reports','snapshots'])putRecord(kind,{...getRecord(kind,r.id),visitDate:dayBack(ago).slice(0,10),serverAcknowledgedAt:dayBack(ago)});
  return r.id;
}
const photo=[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await jpeg('#aa7744')).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const seen=await send([ob('update','Level 4','First fix complete'),ob('defect','Level 2 riser','Fire stopping missing',{actionNeeded:'Fire stop',owner:'Firestop Ltd',affectedTrade:'Other',photos:photo})],2);
const notSeen=await send([ob('instruction','Flat 3.02','Extra double socket asked for by the client',{workDone:false})],1);
while(await runOneJob());
assert.ok(acknowledgeReport(seen,manager,'').ok,'the office opened the first report');
// Yesterday's site update, never sent.
const old=createReport(P,engineer.name,engineer,'progress');
saveDraft(old.id,{...old,observations:[ob('update','Level 5','Containment half done')]},old.version);
putRecord('reports',{...getRecord('reports',old.id),visitDate:dayBack(1).slice(0,10),lastSavedAt:dayBack(1)});
const port=4421,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-engineer-day',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const SAFETY_WORDS=/toolbox|permit|deliveries|safety action|safety inspection|tower/i;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  let newId;
  for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const shot=async name=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-390.png`),fullPage:true});};
    const home=`${base}/engineer?project=${P}`;
    const goHome=async()=>{await page.goto(home);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();await page.locator('.eng-list .eng-row',{hasText:/Site update SPR-/}).first().waitFor();};
    const main=()=>page.locator('main').innerText();
    // Morning: yesterday's update is not offered as today's.
    await goHome();
    {
      ok(await page.getByRole('button',{name:/Start today’s site update/}).count()===1,`${scheme} home: yesterday’s draft leaves the big button starting today’s update`);
      ok(await page.getByText('Carry on with today’s update').count()===0,`${scheme} home: yesterday’s draft is not called today’s`);
      const row=page.locator('section[aria-labelledby="eng-unfinished-title"] .eng-row');
      ok(await row.count()===1&&/visit .*· 1 card/.test(await row.innerText()),`${scheme} home: yesterday’s draft waits under Unfinished reports`);
    }
    const back=await page.locator('.eng-list').filter({has:page.locator('.eng-row',{hasText:/Site update SPR-/})}).innerText();
    ok(!/PM not notified/i.test(back),`${scheme} home: sent reports do not say "PM not notified"`);
    if(scheme==='light')ok(/Seen by the office/i.test(back),'home: the report the office opened says Seen by the office');
    ok(!SAFETY_WORDS.test((await main()).replace(/handover inspection/gi,'')),`${scheme} home: nothing of the hidden extras`);
    await shot('home-morning');
    // Today's update: the big button starts it, and its new card shows no red warning.
    {
      await page.getByRole('button',{name:/Start today’s site update/}).click();await page.waitForURL(/\/reports\/rep-/);
      newId=page.url().split('/reports/')[1].split(/[?#]/)[0];
      await page.locator('.eng-slot.open').waitFor();
    }
    {
      ok(await page.locator('.eng-cardrow.late').count()===0,`${scheme} new update: the card just added is not marked as stopping it`);
      ok(!/no description of what happened|thing stops it being sent|things stop it being sent/.test(await main()),`${scheme} new update: no red warning before anything is typed`);
      await shot('new-update');
      const open=page.locator('.eng-slot.open');
      await open.getByLabel('Where',{exact:true}).fill('Level 3 corridor');
      await open.locator('textarea').first().fill('Containment complete');
      await open.locator('input[type=file]').first().setInputFiles({name:'a.jpg',mimeType:'image/jpeg',buffer:await jpeg('#996633')});
      await open.getByText('On the server').last().waitFor({timeout:15000});
      await open.getByRole('button',{name:'Done with this card'}).click();
      await page.locator('.eng-add-kinds').getByRole('button',{name:'+ Variation'}).first().click();
      await page.locator('.eng-slot.open').getByLabel('Where',{exact:true}).fill('Flat 1.01');
      await page.locator('.eng-slot.open textarea').first().fill('Move a socket 300mm left');
      await page.locator('.eng-slot.open').getByRole('button',{name:'Not yet',exact:true}).click();
      await page.locator('.eng-slot.open').getByRole('button',{name:'Done with this card'}).click();
      await page.locator('.savestate b').filter({hasText:/Saved on server/}).waitFor({timeout:15000});
      // Back home: today's update is the big button, and is not listed again below it.
      await goHome();
      ok(await page.getByText('Carry on with today’s update').count()===1,`${scheme} home: today’s update is carried on from the big button`);
      const rows=await page.locator('section[aria-labelledby="eng-unfinished-title"] .eng-row').allInnerTexts();
      ok(rows.length===1&&!rows.some(r=>/visit .*· 2 cards/.test(r)),`${scheme} home: today’s update is not listed twice (${rows.length} unfinished)`);
      await shot('home-carry-on');
      await page.getByText('Carry on with today’s update').click();await page.waitForURL(new RegExp(newId));
      await page.getByRole('button',{name:/Check & send/}).last().click();await page.locator('#report-check').waitFor();
    }
    const check=await page.locator('#report-check').innerText();
    ok(/Sign · optional/i.test(check)&&/do not have to sign a site update/.test(check),`${scheme} check: signing a site update is optional`);
    ok(!/mailbox is live|raise variations|raise issues/.test(check),`${scheme} check: no "mailbox is live" or "raise issues"`);
    ok(/tell them yourself if it cannot wait/.test(check),`${scheme} check: says to tell the project manager if it cannot wait`);
    await shot('check');
    {
      await page.getByRole('button',{name:'Send to office'}).click();
      await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:20000});
      while(await runOneJob());
    }
    // A sent report says where it has got to in plain words.
    await page.goto(`${base}/reports/${notSeen}`);await page.locator('ol.stages').waitFor();
    const sent=await main();
    ok(!/local outbox|new revision|View the document/.test(sent),`${scheme} sent report: no "local outbox" or "new revision"`);
    ok(/RELAY does not email anyone yet/.test(sent)&&await page.getByRole('link',{name:'See the full report'}).count()===1,`${scheme} sent report: says nobody is emailed, and links the full report`);
    await shot('sent-report');
    // A defect on its own.
    await goHome();await page.getByRole('button',{name:/Flag a defect/}).click();await page.getByRole('heading',{name:'Flag a defect'}).waitFor();
    const defect=await main();
    ok(/Sent on its own, straight away/.test(defect)&&!/JPEG|Not submitted|remains recorded/.test(defect),`${scheme} defect: plain words, no file types`);
    await shot('defect');
    // Issues and an issue.
    await goHome();await page.getByRole('button',{name:'Issues',exact:true}).first().click();await page.locator('#eng-issue-scope').waitFor();
    ok(!/Project scope|Showing issues only/.test(await main()),`${scheme} issues: no "Project scope"`);
    await page.locator('a',{hasText:'Open issue'}).first().click();await page.waitForURL(/\/issues\/iss-/);
    await page.getByRole('button',{name:'Put forward as fixed'}).waitFor();
    ok(/From a site update/.test(await main()),`${scheme} issue: "Put forward as fixed" and "From a site update"`);
    await shot('issue');
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Engineer day check passed (${checks} checks): today's update, no duplicate unfinished row, no "PM not notified", no red on a new card, optional signing, plain sent report, defect and issue words, light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit').catch(()=>{});}
  database().close();rmSync(root,{recursive:true,force:true});
}
