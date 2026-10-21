// Browser check for "Came back from the office" coming first (2026-10-21).
// Walking a whole site visit at 390px found the office's answer below the first
// screen, under the two inspection tiles, and behind the engineer's own newer
// records: a defect just flagged ("not yet assigned") and a report the office had
// only received. Now the section sits straight under "Flag a defect" and
// "Request a variation", above Inspections, and anything the office wrote on or
// sent back is at the top of it. The repeated help line under the tiles is gone.
// Checks, light and dark at 390px and dark at 1440px: the section comes before
// Inspections on the page and for a screen reader; the issue the office answered is
// its first row, whole on the first screen above the bottom bar on a phone, with
// what the office wrote; then the rest newest first; tapping it opens the issue
// ready to update; no sideways scroll, 48px rows, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
// RELAY_MEASURE_ONLY=1 only prints the measurements (used on main for the "before" numbers).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-came-back-first-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues,applyCommand}=require('../apps/web/.test-build/lib/issueStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const manager={id:'entra:cf-manager',oid:'cf-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const P='proj-011lme';
const photo=[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:'#aa7744'}}).jpeg().toBuffer()).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const QUESTION='Still a gap at the top of the riser. Can you send a photo of the top?';
const send=async(who,observations)=>{
  const r=createReport(P,who.name,who,'progress');
  const saved=saveDraft(r.id,{...r,observations},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,who.name);assert.ok(sent.ok,JSON.stringify(sent));
  while(await runOneJob());
};
/**
 * One engineer per run, each with the day the walk-through found: yesterday's
 * update raised the riser defect; they put it forward as fixed and the office sent
 * it back with a question; today they sent another update with a new defect, so
 * the office's answer is the oldest of their records.
 */
const sessions={};
const seed=async n=>{
  const engineer={id:`entra:cf-engineer-${n}`,oid:`cf-engineer-${n}`,name:"Sam Sparks",email:`sam${n}@example.test`,role:'Engineer',trade:'Electrical'};
  sessions[n]=randomUUID();putRecord('sessions',{id:sessions[n],principal:engineer,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  const riser='Fire stopping missing round the cable tray';
  await send(engineer,[ob('update','Level 2 corridor','Containment to grid C'),ob('defect','Level 2 riser',riser,{actionNeeded:'Fire stop the riser',owner:'Leodis',affectedTrade:'Electrical',photos:photo})]);
  const issue=listIssues(P).find(i=>i.description===riser&&i.reportedById===engineer.id);
  assert.ok(applyCommand(issue.id,{kind:'submit_closure',actor:engineer.name,actorId:engineer.id,note:'Done'}).ok);
  assert.ok(applyCommand(issue.id,{kind:'reopen',actor:manager.name,actorId:manager.id,note:QUESTION}).ok);
  await new Promise(r=>setTimeout(r,20));
  await send(engineer,[ob('update','Flat 3.02','Second fix sockets done'),ob('defect','Flat 2.04','Socket faceplate cracked',{actionNeeded:'Replace',owner:'Leodis',affectedTrade:'Electrical',photos:photo})]);
  return {engineer,riser,issueId:issue.id};
};
const runs=[['light',390],['dark',390],['dark',1440]];
const seeded={};for(const [scheme,width] of runs)seeded[`${scheme}-${width}`]=await seed(`${scheme}-${width}`);
const port=4476,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-came-back-first',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const measureOnly=process.env.RELAY_MEASURE_ONLY==='1';
let browser,checks=0;
const ok=(value,message)=>{if(measureOnly){if(!value)console.log(`(not met) ${message}`);return;}assert.ok(value,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of runs){
    const label=`${scheme} ${width}`,wide=width>=900,s=seeded[`${scheme}-${width}`];
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessions[`${scheme}-${width}`],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/engineer?project=${P}`);
    // The list under the heading (found the same way on main, where the section had no wrapper of its own).
    const rows=page.locator('xpath=//h2[.="Came back from the office"]/../following-sibling::div[contains(@class,"eng-list")][1]/a[contains(@class,"eng-row")]');
    await rows.nth(3).waitFor({timeout:20000});
    await page.waitForTimeout(400);
    const m=await page.evaluate(()=>{
      const h=[...document.querySelectorAll('h2')];
      const back=h.find(x=>x.textContent==='Came back from the office'),insp=h.find(x=>x.textContent==='Inspections');
      const first=back.parentElement.nextElementSibling.querySelector('.eng-row');
      const row=first.getBoundingClientRect(),said=(first.querySelector('.eng-word')??first).getBoundingClientRect();
      const nav=document.querySelector('.eng-navigation').getBoundingClientRect();
      // The bottom bar on a phone; on a desktop the bar is at the top, so the screen ends at the window's foot.
      const foot=nav.top>innerHeight/2?nav.top:innerHeight;
      return {row:Math.round(row.top+scrollY),rowBottom:Math.round(row.bottom+scrollY),said:Math.round(said.bottom+scrollY),foot:Math.round(foot),
        before:!!(back.compareDocumentPosition(insp)&Node.DOCUMENT_POSITION_FOLLOWING),
        backTop:Math.round(back.getBoundingClientRect().top+scrollY),inspTop:Math.round(insp.getBoundingClientRect().top+scrollY),
        sideways:document.documentElement.scrollWidth>innerWidth+1,helpLine:document.body.innerText.includes('A defect goes to the office as soon as you send it')};
    });
    const titles=await rows.locator('b').allInnerTexts();
    const hrefs=await rows.evaluateAll(as=>as.map(a=>a.getAttribute('href')));
    const first=hrefs.findIndex(h=>h.includes(`/issues/${s.issueId}?`));
    console.log(`${label}: first row ${m.row}-${m.rowBottom}px (its words end ${m.said}px), first screen ends ${m.foot}px; the office's answer is row ${first+1} of ${titles.length}; Came back ${m.backTop}px, Inspections ${m.inspTop}px`);
    if(shots){await page.screenshot({path:join(shots,`${prefix}-home-${scheme}-${width}.png`),fullPage:true});await page.screenshot({path:join(shots,`${prefix}-home-first-screen-${scheme}-${width}.png`)});}
    ok(m.before&&m.backTop<m.inspTop,`${label}: Came back from the office comes before Inspections, on the page and in reading order`);
    ok(first===0,`${label}: the issue the office sent back is the first row (row ${first+1}: ${titles.join(' | ')})`);
    ok(m.said<=m.foot,`${label}: the first row, down to what the office wrote, is on the first screen (${m.said}px, screen ends ${m.foot}px)`);
    ok((await rows.first().innerText()).includes(QUESTION),`${label}: the first row shows what the office wrote`);
    // Then the rest, newest first: today's report and defect before yesterday's report.
    const rest=titles.slice(1);
    const refs=rest.map(t=>Number(/SPR-(\d+)/.exec(t)?.[1]??NaN));
    ok(rest.length===3&&rest.some((t,i)=>i<2&&/Socket faceplate cracked/.test(t))&&refs[2]<Math.max(refs[0]||0,refs[1]||0),`${label}: the rest follow, newest first: ${rest.join(' | ')}`);
    ok(!m.helpLine,`${label}: the help line repeating the tiles is gone`);
    ok(!m.sideways,`${label}: no sideways scrolling`);
    const heights=await rows.evaluateAll(rs=>rs.map(r=>r.getBoundingClientRect().height));
    ok(heights.every(h=>h>=48),`${label}: rows at least 48px tall (${heights.map(Math.round).join(', ')})`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    if(!measureOnly){
      const target=rows.first();await target.evaluate(e=>e.scrollIntoView({block:'center'}));
      if(wide)await target.click();else await target.tap();
      await page.waitForURL(new RegExp(`/issues/${s.issueId}\\?update=1`));
      await page.getByRole('button',{name:'Put forward as fixed'}).waitFor();
      ok(true,`${label}: tapping it opens the issue ready to update`);
    }
    await context.close();
  }
  console.log(measureOnly?'Measured (no checks asserted).':`came back first verified: ${checks} checks`);
} finally {
  await browser?.close();server.kill();
}
