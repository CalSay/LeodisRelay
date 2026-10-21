// Browser check for "Seen by the office" (FE-4, made automatic): a Manager
// opening a sent report in the office marks it seen, with no button; the
// office's "Where each project stands" row says how many reports nobody has
// opened; the engineer sees "Seen by the office" on the report and on their
// home screen. Opening your own report, or an engineer opening one, does not
// count. 390px phone and 1440px desk, light and dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the office and engineer screens before and after.
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
const root=mkdtempSync(join(tmpdir(),'relay-seen-by-office-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const manager={id:'entra:seen-manager',oid:'seen-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:seen-engineer',oid:'seen-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=principal=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});return id;};
const sessions={office:sessionFor(manager),engineer:sessionFor(engineer)};
const P='proj-011lme';
const at=hoursAgo=>new Date(Date.now()-hoursAgo*3600000).toISOString();
const obs=what=>[{id:randomUUID(),type:'update',location:'Level 2 riser',whatHappened:what,actionNeeded:'',owner:'',photos:[]}];
const sent=(person,what,hoursAgo)=>{const r=createReport(P,person.name,person);const row={...r,authorTrade:person.trade,state:'submitted',review:'not_required',delivery:'rendered',serverAcknowledgedAt:at(hoursAgo),lastSavedAt:at(hoursAgo),observations:obs(what)};putRecord('reports',row);putRecord('snapshots',row);return r;};
const first=sent(engineer,'Containment complete to the riser',3);
const second=sent(engineer,'First fix started on level 3',2);
const own=sent(manager,'Walked the site with the client',1);
const port=4341,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-seen-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const VIEWS=[['light',390,844],['dark',390,844],['light',1440,900],['dark',1440,900]];
async function contextFor(who,[scheme,width,height]){
  const phone=width<700;
  const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
  await context.addCookies([{name:'relay_session',value:sessions[who],url:base}]);
  return context;
}
/** The project's "Needs action" cell on Where each project stands. */
async function needsAction(page){
  await page.goto(`${base}/office#/projects`);
  const row=page.locator('.glance-row').filter({hasText:'011LME'});await row.waitFor();
  return (await row.locator('.glance-cells > div').filter({hasText:'Needs action'}).locator('dd').innerText()).replace(/\s+/g,' ').trim();
}
/** The tags on an engineer's own sent report under "Came back from the office". */
async function homeTags(page,report){
  await page.goto(`${base}/engineer?project=${P}`);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();
  const row=page.locator(`.eng-list a[href*="/reports/${report.id}"]`);await row.waitFor();
  return (await row.locator('.stat').innerText()).replace(/\s+/g,' ');
}
const name=([scheme,width])=>`${scheme}-${width}`;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];

  // Before anyone in the office opens anything.
  for(const view of VIEWS){
    const label=`${view[0]} ${view[1]}px`;
    const office=await contextFor('office',view);const page=await office.newPage();page.on('pageerror',e=>errors.push(e.message));
    const before=await needsAction(page);
    check(/· 3 reports not seen yet$/.test(before),`${label}: the project row counts the three reports nobody has opened: ${before}`);
    check(await overflow(page)<=0,`${label}: office, no horizontal scroll`);
    if(shot&&view[0]==='light'||shot&&view[1]===1440)await page.screenshot({path:join(shot,`before-office-${name(view)}.png`),fullPage:view[1]<700});
    await office.close();
    const eng=await contextFor('engineer',view);const epage=await eng.newPage();epage.on('pageerror',e=>errors.push(e.message));
    check(!/Seen by the office/.test(await homeTags(epage,first)),`${label}: engineer home, nothing claims the office has seen it yet`);
    if(shot&&view[1]===390)await epage.screenshot({path:join(shot,`before-engineer-home-${name(view)}.png`),fullPage:true});
    await epage.goto(`${base}/reports/${first.id}`);await epage.locator('ol.stages').waitFor();
    check((await epage.locator('ol.stages li[data-stage="read"] .tag').innerText())==='Not seen yet',`${label}: engineer report, "Not seen yet"`);
    await eng.close();
  }
  check(getRecord('reports',first.id).acknowledged===undefined,'the engineer reading their own report does not mark it seen');

  // The engineer cannot mark anything seen through the API.
  const refused=await fetch(`${base}/api/reports/${second.id}`,{method:'POST',headers:{'content-type':'application/json',cookie:`relay_session=${sessions.engineer}`,origin:base},body:JSON.stringify({action:'acknowledge'})});
  check(refused.status===403,`an engineer asking to mark a report seen is refused (${refused.status})`);

  // The manager opens their own report: still not seen. Then the engineer's: seen, with no button pressed.
  {
    const office=await contextFor('office',VIEWS[2]);const page=await office.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects/${P}/report/${own.id}`);await page.locator('ol.stages').waitFor();await page.waitForTimeout(1500);
    check((await page.locator('ol.stages li[data-stage="read"] .tag').innerText())==='Not seen yet','the author opening their own report leaves it not seen');
    check(getRecord('reports',own.id).acknowledged===undefined,'nothing recorded against the author');
    await page.goto(`${base}/office#/projects/${P}/report/${first.id}`);await page.locator('ol.stages').waitFor();
    check(await page.getByRole('button',{name:/Acknowledge/}).count()===0,'there is no Acknowledge button');
    await page.locator('ol.stages li[data-stage="read"]').getByText('Seen by the office').waitFor();
    check(/Opened by Office Manager/.test(await page.locator('ol.stages li[data-stage="read"] small').innerText()),'the office reader says who opened it and when');
    const stored=getRecord('reports',first.id).acknowledged;
    check(stored?.by==='Office Manager'&&stored?.byId===manager.id&&!!stored?.at,'stored with who and when');
    if(shot)await page.screenshot({path:join(shot,'after-office-reader-light-1440.png')});
    await office.close();
  }

  // After: the office row counts one fewer; the engineer sees it landed.
  for(const view of VIEWS){
    const label=`${view[0]} ${view[1]}px`;
    const office=await contextFor('office',view);const page=await office.newPage();page.on('pageerror',e=>errors.push(e.message));
    const after=await needsAction(page);
    check(/· 2 reports not seen yet$/.test(after),`${label}: the project row now counts two not seen: ${after}`);
    if(shot&&view[0]==='light'||shot&&view[1]===1440)await page.screenshot({path:join(shot,`after-office-${name(view)}.png`),fullPage:view[1]<700});
    await office.close();
    const eng=await contextFor('engineer',view);const epage=await eng.newPage();epage.on('pageerror',e=>errors.push(e.message));
    check(/Seen by the office/.test(await homeTags(epage,first)),`${label}: engineer home, "Seen by the office" on the report the office opened`);
    check(!/Seen by the office/.test(await homeTags(epage,second)),`${label}: engineer home, not on the one nobody opened`);
    check(await overflow(epage)<=0,`${label}: engineer home, no horizontal scroll`);
    if(shot&&view[1]===390)await epage.screenshot({path:join(shot,`after-engineer-home-${name(view)}.png`),fullPage:true});
    await epage.goto(`${base}/reports/${first.id}`);await epage.locator('ol.stages').waitFor();
    check((await epage.locator('ol.stages li[data-stage="read"] .tag').innerText())==='Seen by the office',`${label}: engineer report, "Seen by the office"`);
    if(shot&&view[1]===390)await epage.locator('ol.stages').screenshot({path:join(shot,`after-engineer-report-stages-${name(view)}.png`)});
    await eng.close();
  }
  check(getRecord('reports',second.id).acknowledged===undefined,'a report nobody opened stays not seen');
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} seen-by-the-office checks (390px and 1440px, light and dark; opening marks seen, author and engineers do not).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
