// Browser check for the engineer home screen and the office project sheet:
// the project's pages are grouped, daily ones first, every one still a tap
// away, with nothing crowded at phone width or on a desktop. Run with the
// office's safety, permits and deliveries switch off (the default) and on.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves full-page screenshots (RELAY_SHOT_PREFIX names them, default "after").
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
const root=mkdtempSync(join(tmpdir(),'relay-home-sheet-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:hs-engineer',oid:'hs-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:hs-manager',oid:'hs-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const ago=d=>new Date(Date.now()-d*86400000).toISOString();
const card=(type,location,whatHappened)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[]});
for(const [n,d] of [[101,6],[102,3],[103,1]])putRecord('reports',{id:randomUUID(),projectId:'proj-011lme',reference:`011LME-SPR-${n}`,visitDate:ago(d).slice(0,10),author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:ago(d),observations:[card('update','Level 2 corridor','Cable tray fixed along the corridor')]});
for(const [n,description,work] of [[301,'Cable tray lid missing','assigned'],[302,'Socket faceplate cracked','open']])putRecord('issues',{id:randomUUID(),reference:`011LME-ISS-${n}`,projectId:'proj-011lme',location:'Level 2 corridor',description,actionNeeded:'',confirmation:'confirmed',work,owner:work==='assigned'?'Sparks Ltd':'',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',raisedAt:ago(4),source:'individual',reportedBy:engineer.name,reportedById:engineer.id,events:[]});
const port=4347,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-home-sheet-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
// RELAY_SHOTS_ONLY=1 takes the screenshots without the checks (for "before" pictures of older code).
const shotsOnly=process.env.RELAY_SHOTS_ONLY==='1';
let browser,checks=0;const check=(ok,message)=>{if(shotsOnly)return;assert.ok(ok,message);checks++;};
const pages=['/weekly-summary','/photos','/diary','/handover','/issue-trend','/site-notes'];
const safetyPages=['/safety-actions','/toolbox-talks','/permits','/deliveries'];
// Each state, and which widths and themes it is looked at in.
const states=[[false,[['light',375],['dark',375],['light',1440],['dark',1440]]],[true,[['light',375],['dark',1440]]]];
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  const shot=async(page,name)=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}.png`),fullPage:true});};
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const noSideways=async(page,at)=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${at}: no sideways scroll`);
  const names=async loc=>(await loc.locator(':scope > a, :scope > button').evaluateAll(els=>els.map(e=>(e.querySelector('b')??e).textContent.trim())));

  for(const [on,views] of states){
  putRecord('settings',{id:'features',safetyRecords:on});
  const state=on?'switch on':'switch off';
  for(const [scheme,width] of views){
    const at=`engineer ${width}px ${scheme}, ${state}`;
    const {context,page,errors}=await open('Engineer',scheme,width);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('heading',{name:'Came back from the office'}).waitFor();
    await page.locator('.eng-since').first().waitFor().catch(()=>{});
    await page.waitForTimeout(400);
    await shot(page,`engineer-home-${on?'on-':''}${scheme}-${width}`);
    if(shotsOnly){await context.close();continue;}
    // The job comes first: one big button for the site update, then the two quick ones.
    const tiles=await page.locator('.eng-tiles-main > :is(a,button) b').allInnerTexts();
    check(tiles.join('|')==='Start today’s site update|Flag a defect|Request a variation',`${at}: the main actions (${tiles.join('|')})`);
    const inspections=await page.getByRole('region',{name:'Inspections'}).locator('.eng-tile b').allInnerTexts();
    check(inspections.join('|')===(on?'Do a safety inspection|Do a handover inspection|Do a first fix inspection|Do a tower inspection':'Do a handover inspection|Do a first fix inspection'),`${at}: inspections (${inspections.join('|')})`);
    check(await page.getByRole('heading',{name:'Unfinished reports'}).count()===0,`${at}: no empty Unfinished reports section`);
    // The right-hand column reads: what came back, what changed, the project's pages, then you.
    const order=await page.locator('.eng-home-grid > div:last-child h2').allInnerTexts();
    check(order.join('|')==='Came back from the office|Since your last visit|This project|Your week and help',`${at}: home sections in order (${order.join('|')})`);
    const project=page.getByRole('region',{name:'This project'});
    check((await names(project.locator(':scope > .eng-list'))).join('|')==='Site issues|Reports|Notes for the next visit|Photographs',`${at}: the four pages used most (${await names(project.locator(':scope > .eng-list'))})`);
    const more=project.locator('details.eng-more-pages');
    check(await more.evaluate(d=>!d.open),`${at}: More on this project starts folded`);
    check((await names(more.locator('.eng-list'))).join('|')==='Weekly summary|Site diary|Before handover|Issues over time',`${at}: More on this project (${await names(more.locator('.eng-list'))})`);
    const safety=project.getByRole('group',{name:'Safety, permits and deliveries'});
    if(on)check((await names(safety.locator('.eng-list'))).join('|')==='Safety actions|Toolbox talks|Permits to work|Deliveries',`${at}: safety, permits and deliveries (${await names(safety.locator('.eng-list'))})`);
    else check(await safety.count()===0,`${at}: no safety, permits and deliveries group`);
    check((await names(page.getByRole('region',{name:'Your week and help'}).locator('.eng-list'))).join('|')==='My week|How RELAY works and what’s new',`${at}: your week and help`);
    for(const path of [...pages,...(on?safetyPages:[])]){const href=await page.locator(`.eng-home-grid a[href^="${path}?"]`).getAttribute('href');check(href&&new URLSearchParams(href.split('?')[1]).get('project')==='proj-011lme',`${at}: home links to ${path} for the project`);}
    if(!on)for(const path of safetyPages)check(await page.locator(`a[href^="${path}"]`).count()===0,`${at}: no link to ${path}`);
    if(width<600){
      const small=await page.locator('.eng-home-grid .eng-row:visible').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height<56).length);
      check(small===0,`${at}: every home row is at least 56px tall`);
      const main=await page.locator('.eng-tile-main').boundingBox();
      check(main&&main.height>=72&&main.y+main.height<=900,`${at}: the site update button is big and on the first screen`);
      const wraps=await project.locator('.eng-row:visible .main>span').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height>40).length);
      check(wraps===0,`${at}: no project row's note runs past two lines`);
    }
    await noSideways(page,at);
    await more.locator('summary').click();
    await project.getByRole('link',{name:/^Before handover/}).click();await page.waitForURL(/\/handover\?project=proj-011lme/);
    check(await page.locator('a.back').first().innerText()==='← Back to Site',`${at}: Before handover says Back to Site`);
    if(!shotsOnly)assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }

  for(const [scheme,width] of views){
    const at=`office sheet ${width}px ${scheme}, ${state}`;
    const {context,page,errors}=await open('Manager',scheme,width);
    await page.goto(`${base}/office#/projects/proj-011lme`);
    await page.getByRole('heading',{name:/^Register · Tetley Hall/}).waitFor();
    await page.waitForTimeout(400);
    await shot(page,`office-sheet-${on?'on-':''}${scheme}-${width}`);
    if(shotsOnly){await context.close();continue;}
    const phone=width<600;
    if(!phone){const actions=await page.locator('.sheet-title .actions a:visible').allInnerTexts();
      check(actions.join('|')==='Project page',`${at}: the title keeps one button (${actions.join('|')})`);}
    // On a phone the register stands in for the sheet, so the links come with it.
    const more=page.getByRole('navigation',{name:'On this project'});
    check(await more.count()===1,`${at}: one set of project links on screen`);
    check((await more.locator(':is(h3,h4)').allTextContents()).join('|')===(on?'Reports and records|Issues|Safety, permits and deliveries':'Reports and records|Issues'),`${at}: groups (${await more.locator(':is(h3,h4)').allTextContents()})`);
    const group=n=>more.locator('.sheet-links-group').nth(n).locator('a').allInnerTexts();
    check((await group(0)).join('|')===(phone?'Weekly summary|Site diary|Photographs|Notes for the next visit|Project page':'Weekly summary|Site diary|Photographs|Notes for the next visit'),`${at}: reports and records (${await group(0)})`);
    check((await group(1)).join('|')==='Issues over time|Before handover',`${at}: issues (${await group(1)})`);
    if(on)check((await group(2)).join('|')==='Safety actions|Toolbox talks|Permits to work|Deliveries',`${at}: safety, permits and deliveries (${await group(2)})`);
    for(const path of [...pages,...(on?safetyPages:[])]){const href=await more.locator(`a[href^="${path}?"]`).getAttribute('href');check(href&&new URLSearchParams(href.split('?')[1]).get('project')==='proj-011lme',`${at}: the project links go to ${path} for the project`);}
    if(!on)for(const path of safetyPages)check(await page.locator(`a[href^="${path}"]`).count()===0,`${at}: no link to ${path}`);
    // Where the project stands and what site said come first (what needs the office is in the register beside it); the project's other pages after them.
    if(phone)check(await page.evaluate(()=>{const nav=[...document.querySelectorAll('.sheet-links')].find(e=>e.offsetParent),chips=[...document.querySelectorAll('.filters')].find(e=>e.offsetParent);return !!nav&&!!chips&&!!(chips.compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING);}),`${at}: the links come after the register`);
    else check(await page.evaluate(()=>{const nav=[...document.querySelectorAll('.sheet-links')].find(e=>e.offsetParent),h=[...document.querySelectorAll('.sec-h')].find(e=>/Latest from site/.test(e.textContent));return !!nav&&!!h&&!!(h.compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING);}),`${at}: the links come after Latest from site`);
    check(await page.evaluate(()=>[...document.querySelectorAll('.sheet-links a')].filter(a=>a.offsetParent).every(a=>a.getBoundingClientRect().height>=(innerWidth<600?44:24))),`${at}: every link is a comfortable size`);
    check(await page.evaluate(()=>[...document.querySelectorAll('.sheet,.cols .col')].filter(e=>e.offsetParent).every(e=>e.scrollWidth<=e.clientWidth)),`${at}: nothing scrolls sideways inside the desk`);
    await noSideways(page,at);
    await more.getByRole('link',{name:'Issues over time'}).click();await page.waitForURL(/\/issue-trend\?project=proj-011lme&returnTo=/);
    check(await page.locator('a.back').first().innerText()==='← Back to Office',`${at}: Issues over time says Back to Office`);
    if(!shotsOnly)assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  }
  console.log(shotsOnly?'Screenshots taken.':`Home and project sheet check passed (${checks} checks): with the safety, permits and deliveries switch off and on, the engineer home leads with the site update, keeps four project pages in view and the rest folded, office project sheet links grouped under one title button and on the phone register, every page linked for the project, 56px rows on a phone, no sideways scroll, at 375 and 1440px in light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
