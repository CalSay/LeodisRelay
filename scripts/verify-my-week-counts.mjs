// Browser check for My week's counts (2026-10-21). "Defects flagged" counted
// only defects flagged on their own, so an engineer who raised every defect in
// their site updates read 0. Now "Issues raised" counts every issue they raised
// in the week, by any route, each once, the same number the office's Weekly
// summary shows under "Issues raised". And a fix they put forward says what the
// office did since: sent it back, or checked it and closed it.
// Seeds, through the real code: a site update with two defects and an access
// problem (three issues), a later update that sees one of them again (no new
// issue), a sent correction of the first update (no new issues), another
// engineer's defect on another site; then flags a defect from the phone (one
// more). Checks My week at 390px light and dark, then the office Weekly summary
// for the same week and site. No sideways scroll, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
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
const root=mkdtempSync(join(tmpdir(),'relay-my-week-counts-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport,correctReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues,applyCommand}=require('../apps/web/.test-build/lib/issueStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const {londonDay,weekStart}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:wc-engineer',oid:'wc-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:wc-other',oid:'wc-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:wc-manager',oid:'wc-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme',OTHER_P='proj-014lme';
const today=londonDay(new Date()),monday=weekStart(undefined,today);
const photo=[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:'#aa7744'}}).jpeg().toBuffer()).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'Put it right',owner:'',photos:photo,...(type==='defect'?{affectedTrade:'Electrical'}:{}),...extra});
const send=async(id,version,who)=>{const sent=await submitReport(id,undefined,version,who.name);assert.ok(sent.ok,JSON.stringify(sent));while(await runOneJob());return sent.value;};
const update=async(who,project,observations)=>{const r=createReport(project,who.name,who,'progress');const saved=saveDraft(r.id,{...r,observations},r.version);assert.ok(saved.ok,JSON.stringify(saved));return send(r.id,saved.value.version,who);};

// Two defects and an access problem in one site update: three issues.
const first=await update(engineer,P,[ob('update','Level 2 corridor','Containment to grid C',{actionNeeded:'',photos:[]}),ob('defect','Level 2 riser','Fire stopping missing round the tray'),ob('defect','Flat 3.02','Socket faceplate cracked'),ob('access','Plant room','Plant room locked, no key on site')]);
const mine=()=>listIssues(P).filter(i=>i.reportedById===engineer.id);
assert.equal(mine().length,3,'the update raised three issues');
const riser=mine().find(i=>i.location==='Level 2 riser'),faceplate=mine().find(i=>i.location==='Flat 3.02');
// Seen again in a later update: a sighting on the same issue, not a new one.
await update(engineer,P,[ob('defect','Level 2 riser','Still open at the top',{linkedIssueId:riser.id})]);
// The first update corrected and sent again: its defects link back, nothing new.
const fix=correctReport(first.id,'Wrong grid line');assert.ok(fix.ok,JSON.stringify(fix));
await send(fix.value.id,fix.value.version,engineer);
assert.equal(mine().length,3,'a sighting and a correction raise nothing new');
// Someone else's defect on another site is not this engineer's.
await update(other,OTHER_P,[ob('defect','Roof','Flashing loose',{affectedTrade:'Other / non-Leodis'})]);
// Fixes put forward: the office sends one back and checks and closes the other.
for(const i of [riser,faceplate])assert.ok(applyCommand(i.id,{kind:'submit_closure',actor:engineer.name,actorId:engineer.id,note:'Done'}).ok);
assert.ok(applyCommand(riser.id,{kind:'reopen',actor:manager.name,actorId:manager.id,note:'Still a gap at the top.'}).ok);
const verified=applyCommand(faceplate.id,{kind:'verify',actor:manager.name,actorId:manager.id,note:'Checked'});assert.ok(verified.ok,JSON.stringify(verified));

const port=4471,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-my-week-counts',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  const open=async(role,scheme,width)=>{const wide=width>=900;const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const stat=async(page,name)=>{const dd=page.locator('.mw-stats > div').filter({has:page.locator('dt',{hasText:name})}).locator('dd');return Number((await dd.evaluate(e=>e.firstChild?.textContent??'')).trim());};

  // Phone, light: before flagging, then flag a defect on its own from the phone.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/my-week`);await page.locator('.mw-stats').waitFor();
    ok(await stat(page,'Issues raised')===3,`light 390: three issues raised from the site update (${await stat(page,'Issues raised')})`);
    ok(await page.locator('.mw-stats dt',{hasText:'Defects flagged'}).count()===0,'light 390: the old "Defects flagged" is gone');
    await page.goto(`${base}/engineer?project=${P}&view=defect`);
    await page.getByLabel('Where on site?',{exact:true}).waitFor();
    await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:await sharp({create:{width:24,height:24,channels:3,background:'#997744'}}).png().toBuffer()});
    await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
    await page.getByLabel('What needs attention?',{exact:true}).fill('Trunking lid missing');
    await page.getByLabel('Where on site?',{exact:true}).fill('Level 3 corridor');
    await page.getByRole('button',{name:/^Send defect to /}).tap();
    await page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor();
    ok(mine().length===4,'light 390: the defect flagged on its own is a fourth issue');
    await page.goto(`${base}/my-week`);await page.locator('.mw-stats').waitFor();
    ok(await stat(page,'Issues raised')===4,`light 390: Issues raised counts both routes, each once (${await stat(page,'Issues raised')})`);
    const day=await page.locator('.mw-today').innerText();
    ok(/Flagged a defect/i.test(day)&&/1 progress update, 2 defects, 1 access problem/.test(day),`light 390: today shows the flagged defect and the update's cards: ${JSON.stringify(day)}`);
    const rows=page.locator('.mw-rows li').filter({hasText:'Put forward as fixed'});
    const back=rows.filter({hasText:riser.reference}),closed=rows.filter({hasText:faceplate.reference});
    ok((await back.innerText()).includes('Since then the office sent it back as not finished.'),'light 390: a fix the office sent back says so');
    ok((await closed.innerText()).includes('Since then the office checked it and closed it.'),'light 390: a fix the office closed says so');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'light 390: no sideways scroll');
    if(shots)await page.screenshot({path:join(shots,'my-week-counts-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'light 390: page errors');
    await context.close();
  }

  // Phone, dark: the same numbers and words.
  {
    const {context,page,errors}=await open('Engineer','dark',390);
    await page.goto(`${base}/my-week`);await page.locator('.mw-stats').waitFor();
    ok(await stat(page,'Issues raised')===4,'dark 390: Issues raised 4');
    ok(await page.getByText('Since then the office sent it back as not finished.').isVisible(),'dark 390: sent back shown');
    const colour=await page.locator('.mw-since').first().evaluate(e=>[getComputedStyle(e).color,getComputedStyle(document.body).backgroundColor]);
    ok(colour[0]!==colour[1],`dark 390: the line is readable on the page (${colour.join(' on ')})`);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'dark 390: no sideways scroll');
    if(shots)await page.screenshot({path:join(shots,'my-week-counts-dark-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'dark 390: page errors');
    await context.close();
  }

  // The office's Weekly summary for the same site and week shows the same number.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/weekly-summary?project=${P}&week=${monday}`);
    const dd=page.locator('dl div').filter({has:page.locator('dt',{hasText:'Issues raised'})}).locator('dd');await dd.waitFor();
    const n=Number((await dd.evaluate(e=>e.firstChild?.textContent??'')).trim());
    ok(n===4,`office: Weekly summary says Issues raised ${n}, the same as My week`);
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }
  console.log(`My week counts check passed (${checks} checks): issues raised from site updates and on their own each once, sightings and corrections not counted again, matches the office's Weekly summary, fixes say what the office did since, 390 light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
