// Browser check for reading Notes for the next visit with no signal: with
// signal the engineer home leaves the open notes of their projects on the
// phone (words, who and when, no ids of people, nothing done with); with the
// server out of reach the no-signal page shows them read only, under each
// project with when they were last updated, and /site-notes opens at them;
// signing out takes the copy away.
// Stopping the server stands in for losing signal, as in verify-offline-capture.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-site-notes-offline-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const principal={id:'entra:sno-engineer',oid:'sno-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const newSession=()=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const P='proj-011lme';
const hoursAgo=h=>new Date(Date.now()-h*3600000).toISOString();
putRecord('site-notes',{id:'note-off-1',projectId:P,text:'Riser 3 key is with the site manager, Dave, in the cabin by gate B',by:'Pat Plumb',byId:'entra:pat',byTrade:'P&H',at:hoursAgo(26)});
putRecord('site-notes',{id:'note-off-2',projectId:P,text:'Basement plant room lights are off at the board: bring a torch',by:'Office Manager',byId:'entra:office',byTrade:'Office',at:hoursAgo(3)});
putRecord('site-notes',{id:'note-off-3',projectId:P,text:'Level 4 locked off for screeding until Friday',by:'Office Manager',byId:'entra:office',byTrade:'Office',at:hoursAgo(120),done:{by:'Office Manager',byId:'entra:office',at:hoursAgo(72)}});
const port=4353,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-notes-offline-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const kept=page=>page.evaluate(id=>JSON.parse(localStorage.getItem(`relay-offline-notes:${id}`)||'null'),principal.id);
try {
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    if(server.exitCode!==null)await start();
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:newSession(),url:base}]);
    let page=await context.newPage();const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());};watch(page);
    // With signal: the home screen leaves the notes on the phone.
    await page.goto(`${base}/engineer?project=${P}`);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.waitForFunction(id=>!!localStorage.getItem(`relay-offline-notes:${id}`),principal.id);
    const copy=await kept(page);
    const mineP=copy.projects.find(p=>p.projectId===P);
    check(mineP&&mineP.projectName&&mineP.projectNumber&&!Number.isNaN(Date.parse(mineP.savedAt)),`${scheme}: the phone keeps the project with when its notes were read`);
    check(mineP.open.map(n=>n.id).join()==='note-off-2,note-off-1',`${scheme}: open notes only, newest first: ${mineP.open.map(n=>n.id)}`);
    check(mineP.open.every(n=>Object.keys(n).every(k=>['id','text','by','byTrade','at'].includes(k))),`${scheme}: words, who and when only, no ids of people`);
    const projects=await page.evaluate(id=>JSON.parse(localStorage.getItem(`relay-offline-projects:${id}`)||'[]'),principal.id);
    check(copy.projects.map(p=>p.projectId).sort().join()===projects.map(p=>p.id).sort().join(),`${scheme}: the same projects as the offline page offers`);
    // Signal goes while the notes page is open: choosing another project opens the no-signal page there, with the notes.
    await page.goto(`${base}/site-notes?project=${P}`);
    await page.locator('.sn-form').waitFor();
    const other=copy.projects.find(p=>p.projectId!==P);
    check(!!other,`${scheme}: the engineer has a second project to switch to`);
    await stop();
    await page.locator('#sn-project').selectOption(other.projectId);
    await page.locator('#notes:not([hidden])').waitFor({timeout:10000});
    check((await page.locator('#notes .nlist li').count())===2,`${scheme}: the notes page with no signal turns into the no-signal page with the notes`);
    // A cold start with no signal: the no-signal page shows the notes.
    await page.close();page=await context.newPage();watch(page);
    await page.goto(`${base}/engineer`);
    await page.getByRole('heading',{name:'Notes for the next visit'}).waitFor();
    const panel=page.locator('#notes');
    check(await panel.isVisible(),`${scheme}: the no-signal page shows the notes`);
    check(await panel.locator('details[open]').count()===1,`${scheme}: the project being worked on is open`);
    const items=await panel.locator('.nlist li').allInnerTexts();
    check(items.length===2&&/torch/.test(items[0])&&/Office Manager · Office/.test(items[0])&&/Riser 3/.test(items[1])&&/Pat Plumb · P&H/.test(items[1]),`${scheme}: newest first, with who left each: ${items.join(' | ')}`);
    check(!items.some(t=>/Level 4 locked/.test(t)),`${scheme}: a note done with is not shown`);
    check(/^Last updated \w{3} \d{1,2} \w{3}, \d{2}:\d{2}\.$/.test(await panel.locator('.nsaved').innerText()),`${scheme}: says when they were last updated: ${await panel.locator('.nsaved').innerText()}`);
    check(/Read only/.test(await panel.innerText())&&await panel.locator('button').count()===0,`${scheme}: says it is read only, with nothing to press`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${scheme}: no sideways scroll`);
    await axe(page,`${scheme}: no-signal page with notes`);
    if(screenshot)await page.screenshot({path:join(screenshot,`notes-offline-${scheme}-${width}.png`),fullPage:true});
    // /site-notes with no signal opens the no-signal page at the notes.
    await page.goto(`${base}/site-notes?project=${P}`);
    await page.locator('#notes:not([hidden])').waitFor();
    check(await page.evaluate(()=>{const r=document.getElementById('notes').getBoundingClientRect();return r.top>=0&&r.top<window.innerHeight;}),`${scheme}: /site-notes opens at the notes`);
    // An old copy says it may be out of date.
    await page.evaluate(id=>{const k=`relay-offline-notes:${id}`;const c=JSON.parse(localStorage.getItem(k));for(const p of c.projects)p.savedAt=new Date(Date.now()-9*86400000).toISOString();localStorage.setItem(k,JSON.stringify(c));},principal.id);
    await page.reload();await page.locator('#notes:not([hidden])').waitFor();
    check(/\(9 days ago\)\. This may be out of date\.$/.test(await page.locator('#notes .nsaved').innerText()),`${scheme}: an old copy says it may be out of date`);
    check(errors.length===0,`${scheme}: no page errors: ${errors.join(' | ')}`);
    // Signal back; signing out takes the notes off the phone.
    await start();
    await page.goto(`${base}/engineer`);
    await page.waitForFunction(id=>!!localStorage.getItem(`relay-offline-notes:${id}`),principal.id);
    await page.getByRole('button',{name:'Sign out'}).click();
    await page.waitForURL(/signin|\/$/);
    check(await kept(page)===null,`${scheme}: signing out takes the notes off the phone`);
    await context.close();
  }
  console.log(`Notes with no signal: ${checks} checks passed.`);
} finally {
  await browser?.close();await stop();
}
