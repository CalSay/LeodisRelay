// Browser check for "Came back from the office" on every site (2026-10-22).
// A two-site walk found the office's question at Kirkstall Gate shown nowhere
// while the engineer was at Tetley Hall: the home listed one project only.
// Now the home lists, after the current site's rows, what waits on the
// engineer on their other sites (the office's notes and things sent back),
// each naming its site, and nothing they only sent themselves from there.
// Checks, light and dark at 390px: at Tetley, the Kirkstall question is listed
// after Tetley's rows, names Kirkstall Gate and shows what the office wrote; the
// engineer's own Kirkstall report and new defect are not listed; the heading
// counts only what the office did ("1 from the office"); tapping the row opens
// the issue ready to update, on Kirkstall Gate; at Kirkstall the same question
// is listed without a site name and nothing from Tetley is; with the other
// sites' answer lost or slow, Tetley's rows still show first; no sideways scroll, 48px rows,
// no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
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
const root=mkdtempSync(join(tmpdir(),'relay-other-sites-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues,applyCommand}=require('../apps/web/.test-build/lib/issueStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const manager={id:'entra:os-manager',oid:'os-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const T='proj-011lme',K='proj-014lme',KIRKSTALL='Kirkstall Gate - Phase 2';
const photo=()=>[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+PIXELS,caption:'',capturedAt:new Date().toISOString()}];
const PIXELS=(await sharp({create:{width:320,height:240,channels:3,background:'#aa7744'}}).jpeg().toBuffer()).toString('base64');
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const defect=(location,what)=>ob('defect',location,what,{actionNeeded:'Replace',owner:'Leodis',affectedTrade:'Electrical',photos:photo()});
const QUESTION='The faceplate photo is blurred. Can you send a closer one?';
const send=async(who,project,observations)=>{
  const r=createReport(project,who.name,who,'progress');
  const saved=saveDraft(r.id,{...r,observations},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,who.name);assert.ok(sent.ok,JSON.stringify(sent));
  while(await runOneJob());
  return r;
};
/**
 * The walk's day, one engineer per run: at Kirkstall Gate yesterday they raised
 * the faceplate defect and put it forward as fixed, and the office sent it back
 * with a question; today they sent a Kirkstall update with a new defect (theirs
 * only, nothing from the office), then a Tetley update with a defect.
 */
const sessions={};
const seed=async n=>{
  const engineer={id:`entra:os-engineer-${n}`,oid:`os-engineer-${n}`,name:'Sam Sparks',email:`sam${n}@example.test`,role:'Engineer',trade:'Electrical'};
  sessions[n]=randomUUID();putRecord('sessions',{id:sessions[n],principal:engineer,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  const faceplate=`Socket faceplate cracked ${n}`;
  await send(engineer,K,[ob('update','Flat 1.03','First fix sockets'),defect('Flat 1.03',faceplate)]);
  const issue=listIssues(K).find(i=>i.description===faceplate);
  assert.ok(applyCommand(issue.id,{kind:'submit_closure',actor:engineer.name,actorId:engineer.id,note:'Replaced'}).ok);
  assert.ok(applyCommand(issue.id,{kind:'reopen',actor:manager.name,actorId:manager.id,note:QUESTION}).ok);
  await new Promise(r=>setTimeout(r,20));
  const kirkstallToday=`Light switch loose ${n}`;
  const kReport=await send(engineer,K,[ob('update','Flat 1.04','Second fix lighting'),defect('Flat 1.04',kirkstallToday)]);
  await new Promise(r=>setTimeout(r,20));
  await send(engineer,T,[ob('update','Level 2 corridor','Containment to grid C'),defect('Level 2 riser',`Cable tray bracket bent ${n}`)]);
  return {issueId:issue.id,kirkstallToday,kReport:kReport.reference.split('-').slice(1).join('-')};
};
const runs=[['light',390],['dark',390]];
const seeded={};for(const [scheme,width] of runs)seeded[`${scheme}-${width}`]=await seed(`${scheme}-${width}`);
const port=4478,base=`http://127.0.0.1:${port}`;let output='';
try{await fetch(base+'/signin');throw Error(`Something is already answering on port ${port}: stop it and run again.`);}catch(e){if(/already answering/.test(e.message))throw e;}
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-other-sites',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of runs){
    const label=`${scheme} ${width}`,s=seeded[`${scheme}-${width}`];
    const context=await browser.newContext({viewport:{width,height:844},colorScheme:scheme,hasTouch:true,isMobile:true});
    await context.addCookies([{name:'relay_session',value:sessions[`${scheme}-${width}`],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const rows=page.locator('.eng-came-back .eng-list a.eng-row');
    const home=async(project,wait)=>{await page.goto(`${base}/engineer?project=${project}`);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();await rows.filter({hasText:wait}).first().waitFor({timeout:20000});await page.waitForTimeout(300);};
    // At Tetley Hall.
    await home(T,QUESTION);
    const texts=await rows.allInnerTexts();
    const hrefs=await rows.evaluateAll(as=>as.map(a=>a.getAttribute('href')));
    const at=hrefs.findIndex(h=>h.includes(`/issues/${s.issueId}?`));
    console.log(`${label} at Tetley: ${texts.map(t=>t.split('\n')[0]).join(' | ')}`);
    ok(at>=0,`${label}: the Kirkstall question is listed at Tetley`);
    ok(texts.slice(0,at).length>0&&texts.slice(0,at).every(t=>!t.includes(KIRKSTALL)),`${label}: Tetley's own rows come first`);
    ok(texts[at].includes(`${KIRKSTALL} ·`)&&texts[at].includes(QUESTION),`${label}: the row names Kirkstall Gate and shows what the office wrote: ${texts[at]}`);
    ok(texts.filter(t=>t.includes(KIRKSTALL)).length===1&&!texts.some(t=>t.includes(s.kirkstallToday)||t.includes(s.kReport)),`${label}: the engineer's own Kirkstall report and defect are not listed at Tetley`);
    const count=(await page.locator('.eng-came-back .eng-section-title .r').innerText()).trim();
    ok(count==='1 from the office',`${label}: the heading counts only what the office did (${count})`);
    const m=await page.evaluate(()=>({sideways:document.documentElement.scrollWidth>innerWidth+1,heights:[...document.querySelectorAll('.eng-came-back .eng-row')].map(r=>r.getBoundingClientRect().height)}));
    ok(!m.sideways,`${label}: no sideways scrolling`);
    ok(m.heights.every(h=>h>=48),`${label}: rows at least 48px tall (${m.heights.map(Math.round).join(', ')})`);
    if(shots){const row=rows.nth(at);await row.evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:join(shots,`after-tetley-${scheme}-${width}.png`)});await page.screenshot({path:join(shots,`after-tetley-full-${scheme}-${width}.png`),fullPage:true});}
    // Tapping it opens the issue on Kirkstall Gate, ready to update.
    await rows.nth(at).evaluate(e=>e.scrollIntoView({block:'center'}));await rows.nth(at).tap();
    await page.waitForURL(new RegExp(`/issues/${s.issueId}\\?update=1`));
    await page.getByRole('button',{name:'Put forward as fixed'}).waitFor();
    const opened=await page.locator("main").innerText();
    ok(/Site\s*Kirkstall Gate - Phase 2\s*Where\s*Flat 1.03/.test(opened),`${label}: tapping it opens the issue ready to update, on Kirkstall Gate`);
    if(shots)await page.screenshot({path:join(shots,`after-opened-${scheme}-${width}.png`)});
    // At Kirkstall Gate: the same question, no site name; nothing from Tetley (only the engineer's own there).
    await home(K,QUESTION);
    const kTexts=await rows.allInnerTexts();
    const kRow=kTexts.find(t=>t.includes(QUESTION));
    ok(kRow&&!kRow.includes(`${KIRKSTALL} ·`),`${label}: at Kirkstall the question is listed without a site name`);
    ok(!kTexts.some(t=>/Tetley/.test(t)||t.includes('Cable tray bracket bent')),`${label}: at Kirkstall nothing from Tetley is listed`);
    ok(kTexts.some(t=>t.includes(s.kirkstallToday)),`${label}: at Kirkstall the engineer's own new defect is listed, as before`);
    if(shots)await page.screenshot({path:join(shots,`after-kirkstall-${scheme}-${width}.png`),fullPage:true});
    await page.goto(`${base}/issues/${s.issueId}?update=1&returnTo=${encodeURIComponent(`/engineer?project=${K}`)}`);await page.getByRole('button',{name:'Put forward as fixed'}).waitFor();
    ok(!/Site\s*Kirkstall Gate/.test(await page.locator('main').innerText()),`${label}: opened at Kirkstall, the issue does not name the site again`);
    // The other sites' answer lost (a weak signal): Tetley's own rows still show.
    await page.route(/\/api\/came-back\?elsewhere=1/,r=>r.abort());
    await page.goto(`${base}/engineer?project=${T}`);await rows.filter({hasText:'Cable tray bracket bent'}).first().waitFor({timeout:20000});
    ok(!(await rows.allInnerTexts()).some(t=>t.includes(KIRKSTALL)),`${label}: with the other sites' answer lost, Tetley's rows still show`);
    await page.unroute(/\/api\/came-back\?elsewhere=1/);
    // The other sites slow to answer: Tetley's rows show first, the Kirkstall question joins them after.
    await page.route(/\/api\/came-back\?elsewhere=1/,async r=>{await new Promise(w=>setTimeout(w,4000));await r.continue().catch(()=>{});});
    const asked=Date.now();await page.goto(`${base}/engineer?project=${T}`);await rows.filter({hasText:'Cable tray bracket bent'}).first().waitFor({timeout:20000});
    const shownIn=Date.now()-asked;
    ok(shownIn<3500&&!(await rows.allInnerTexts()).some(t=>t.includes(KIRKSTALL)),`${label}: with the other sites slow, Tetley's rows show first (${shownIn} ms)`);
    await rows.filter({hasText:QUESTION}).first().waitFor({timeout:20000});
    ok(true,`${label}: then the Kirkstall question joins them`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`other sites came back verified: ${checks} checks`);
} finally {
  await browser?.close();server.kill();
}
