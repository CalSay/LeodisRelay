// Browser check for Issues over time: one project's issues week by week.
// Opened from the engineer home and the office project sheet.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
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
const root=mkdtempSync(join(tmpdir(),'relay-issue-trend-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:it-engineer',oid:'it-engineer',name:'Trend Engineer',email:'it@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:it-manager',oid:'it-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date());
const daysAgo=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const at=n=>`${daysAgo(n)}T10:00:00Z`;
let seq=0;
const issue=(extra)=>{const i={id:randomUUID(),reference:`011LME-ISS-${String(++seq).padStart(3,'0')}`,projectId:'proj-011lme',location:'Level 2',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'',targetDate:'',raisedByReport:'',events:[],...extra};putRecord('issues',i);return i;};
const verified=n=>({at:at(n),actor:'Office Manager',kind:'verified',note:'',photos:[]});
// Six raised seven weeks ago; four of them closed in the last four weeks, 30 days after raising.
const oldest=issue({raisedAt:at(50),description:'Oldest open'});
issue({raisedAt:at(49),targetDate:daysAgo(10)});
for(let k=0;k<4;k++)issue({raisedAt:at(48),work:'closed',events:[verified(18)]});
// One raised this week, one withdrawn, one on another project.
issue({raisedAt:at(0)});
issue({raisedAt:at(20),confirmation:'withdrawn'});
issue({raisedAt:at(5),projectId:'proj-014lme'});
const port=4364,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-issue-trend-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: sent to sign in, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/issue-trend?project=proj-011lme`);await page.waitForURL(/\/signin/);
    check(true,'signed out: the page asks for sign-in');
    const res=await page.request.get(`${base}/api/issue-trend?projectId=proj-011lme`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light: from the home screen.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    const res=await page.request.get(`${base}/api/issue-trend?projectId=proj-missing`);
    check(res.status()===404,`engineer: a project that does not exist is refused (${res.status()})`);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const link=page.getByRole('link',{name:/^Issues over time/});await link.waitFor();
    check(true,'engineer: home offers Issues over time');
    await link.click();await page.waitForURL(/\/issue-trend\?project=proj-011lme/);await page.locator('.it-sheet').waitFor();
    check((await page.locator('#it-project').inputValue())==='proj-011lme','engineer: opens on the current project');
    await page.waitForFunction(()=>/Issues over time/.test(document.title));
    check(true,'engineer: the tab is named Issues over time');
    const verdict=await page.locator('.it-verdict').innerText();
    check(/Getting shorter: 3 issues open, down from 6 four weeks ago\./.test(verdict),`engineer: the headline says which way it is going: ${JSON.stringify(verdict)}`);
    const stats=(await page.locator('.it-stats').innerText()).replace(/\s+/g,' ');
    check(/Open now 3 1 past target/i.test(stats),`engineer: open now and past target: ${stats}`);
    check(/Last four weeks 1 raised 4 closed/i.test(stats),`engineer: raised and closed in four weeks: ${stats}`);
    check(/Time to close 30 days typical, of 4 closed/i.test(stats),`engineer: typical time to close: ${stats}`);
    check(/Oldest open 50 days 011LME-ISS-001/i.test(stats),`engineer: oldest open issue: ${stats}`);
    // The chart: twelve weeks, the current one picked, with its words read out.
    check(await page.locator('.it-col').count()===12,'engineer: twelve weeks in the chart');
    const readout=await page.locator('.it-readout').innerText();
    check(/^This week so far: 1 raised, 0 closed, 3 open at the end of today, 1 past target\.$/.test(readout),`engineer: the readout starts on this week: ${JSON.stringify(readout)}`);
    check((await page.locator('.it-col').last().getAttribute('aria-pressed'))==='true','engineer: the current week is marked as picked');
    await page.locator('.it-col').nth(0).click();
    check(/^Week of /.test(await page.locator('.it-readout').innerText()),'engineer: tapping a week reads it out');
    const lateBar=await page.locator('.it-col').last().locator('.it-late').count();
    check(lateBar===1,'engineer: the past-target part of this week\'s bar is drawn');
    // The table, newest first; the withdrawn and other-project issues are left out.
    const rows=page.locator('.it-table tbody tr');
    check(await rows.count()===12,'engineer: twelve rows in the table');
    const first=(await rows.first().innerText()).replace(/\s+/g,' ');
    check(/so far 1 0 3 1$/.test(first),`engineer: this week's row: ${first}`);
    const totalRaised=await rows.evaluateAll(trs=>trs.reduce((n,tr)=>n+Number(tr.children[1].textContent),0));
    check(totalRaised===7,`engineer: raised over the weeks shown leaves out withdrawn and other projects (${totalRaised})`);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    const small=await page.locator('.it-controls select, .it-links a, .it-col').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<24).map(e=>e.className||e.textContent));
    check(small.length===0,`engineer: targets big enough to tap: ${JSON.stringify(small)}`);
    if(screenshot)await page.screenshot({path:join(screenshot,'issue-trend-light-390.png'),fullPage:true});
    // The oldest issue opened from the page comes back to it.
    await page.getByRole('link',{name:oldest.reference}).click();await page.waitForURL(`**/issues/${oldest.id}**`);
    await page.getByRole('link',{name:/Back to Issues over time/}).click();await page.waitForURL(/\/issue-trend\?project=proj-011lme/);await page.locator('.it-sheet').waitFor();
    check(true,'engineer: an issue opened from the page offers Back to Issues over time');
    await page.getByRole('link',{name:/^← Back to Site/}).click();await page.waitForURL(/\/engineer\?project=proj-011lme/);
    check(true,'engineer: back returns to the home screen');
    // A project with no issues says so.
    await page.goto(`${base}/issue-trend?project=proj-009lcp`);await page.locator('.it-sheet').waitFor();
    check(/No open issues, now or four weeks ago\./.test(await page.locator('.it-verdict').innerText()),'engineer: a project with no issues says so');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Manager, desktop, dark: from the office project sheet.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects/proj-011lme`);
    const link=page.getByRole('link',{name:'Issues over time'});await link.waitFor();
    await link.click();await page.waitForURL(/\/issue-trend\?project=proj-011lme&returnTo=/);await page.locator('.it-sheet').waitFor();
    check(/Getting shorter/.test(await page.locator('.it-verdict').innerText()),'manager: the same figures from the office');
    const colour=await page.evaluate(()=>getComputedStyle(document.querySelector('.it-open')).backgroundColor);
    check(colour==='rgb(138, 146, 153)',`manager: the dark theme's own bar colour (${colour})`);
    await page.locator('.it-col').nth(10).hover();
    check(/^Week of /.test(await page.locator('.it-readout').innerText()),'manager: hovering a week reads it out');
    if(screenshot)await page.screenshot({path:join(screenshot,'issue-trend-dark-1440.png'),fullPage:true});
    await page.getByRole('link',{name:/^← Back to Office/}).click();await page.waitForURL(/\/office/);
    check(true,'manager: back goes to the office');
    assert.deepEqual(errors,[],'manager: page errors');
    await context.close();
  }
  console.log(`Issues over time check passed (${checks} checks): home and office routes, headline, counts, chart, table, no issues, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
