// Browser check for My week: one person's own week across every project,
// opened from the engineer home and the Reports view, stepping between weeks,
// copying the week as text, and leaving out other people's records.
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
const root=mkdtempSync(join(tmpdir(),'relay-my-week-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay,weekStart,shiftWeek}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:mw-engineer',oid:'mw-engineer',name:'Week Engineer',email:'week@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:mw-other',oid:'mw-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:mw-manager',oid:'mw-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date()),monday=weekStart(undefined,today),lastMonday=shiftWeek(monday,-1);
const now=new Date().toISOString();
const card=(type,location)=>({id:randomUUID(),type,location,whatHappened:'Work noted',actionNeeded:'',owner:'',photos:[]});
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',reference:`011LME-SPR-${randomUUID().slice(0,4)}`,visitDate:monday,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const tetley=report({reference:'011LME-SPR-101',observations:[card('update','Level 2 corridor'),card('defect','level 2  corridor'),card('instruction','Plant room')]});
const kirkstall=report({reference:'014LME-SPR-201',projectId:'proj-014lme',observations:[card('update','Roof plant')]});
const original=report({reference:'011LME-SPR-102',visitDate:today});
const corrected=report({reference:'011LME-SPR-102',visitDate:today,revision:2,corrects:original.id,correctionReason:'Wrong level'});
const theirs=report({reference:'011LME-SPR-103',author:other.name,authorId:other.id,authorTrade:'P&H',observations:[card('update','Riser')]});
const lastWeek=report({reference:'011LME-SPR-090',visitDate:lastMonday,observations:[card('update','Roof')]});
const draft=report({reference:'011LME-SPR-104',visitDate:today,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:now,observations:[card('update','Stairs')]});
const ev=(kind,by=engineer,extra={})=>({at:now,actor:by.name,actorId:by.id,kind,note:'',photos:[],...extra});
const issue=(extra)=>{const i={id:randomUUID(),reference:`011LME-ISS-${randomUUID().slice(0,4)}`,projectId:'proj-011lme',location:'Level 2 corridor',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',raisedAt:now,events:[],...extra};putRecord('issues',i);return i;};
const flagged=issue({reference:'011LME-ISS-301',description:'Cable tray lid missing',source:'individual',reportedBy:engineer.name,reportedById:engineer.id,events:[ev('raised')]});
const worked=issue({reference:'011LME-ISS-302',description:'Socket faceplate cracked',source:'report',raisedAt:shiftWeek(lastMonday,-1)+'T10:00:00.000Z',events:[{...ev('raised',other),at:shiftWeek(lastMonday,-1)+'T10:00:00.000Z'},ev('progress'),ev('verified',manager)]});
const theirIssue=issue({reference:'011LME-ISS-303',description:'Not mine',source:'individual',reportedBy:other.name,reportedById:other.id,events:[ev('raised',other)]});
const port=4337,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-my-week-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
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
    await page.goto(`${base}/my-week`);await page.waitForURL(/\/signin/);
    check(true,'signed out: the page asks for sign-in');
    const res=await page.request.get(`${base}/api/my-week`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light: from the home screen.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const link=page.getByRole('link',{name:/^My week/});await link.waitFor();
    check(true,'engineer: home offers My week');
    await link.click();await page.waitForURL(/\/my-week\?/);await page.locator('.mw-days').waitFor();
    const text=await page.locator('main').innerText();
    check(text.includes(engineer.name)&&/this week so far/.test(text),'engineer: names the person and says the week is still going');
    const mon=await page.locator('.mw-day').first().innerText();
    check(mon.includes(tetley.reference)&&mon.includes(kirkstall.reference)&&mon.includes('Tetley Hall')&&mon.includes('Kirkstall Gate'),`engineer: Monday lists both projects and their reports: ${JSON.stringify(mon)}`);
    check(/1 progress update, 1 defect, 1 variation required/.test(mon)&&mon.includes('Level 2 corridor · Plant room'),'engineer: a report says what it found and where');
    check(!text.includes(theirs.reference)&&!text.includes(theirIssue.reference),'engineer: another engineer\'s report and defect are left out');
    check(!text.includes(lastWeek.reference),'engineer: last week is left out');
    const day=await page.locator('.mw-today').innerText();
    check(day.includes(flagged.reference)&&/Flagged a defect/i.test(day),`engineer: today lists the defect flagged: ${JSON.stringify(day)}`);
    check(day.includes(worked.reference)&&/Recorded an update/i.test(day),'engineer: today lists the issue update, not the office\'s verification');
    check((day.match(/011LME-SPR-102/g)||[]).length===1&&/Rev 2/i.test(day),'engineer: a corrected report shows once, at rev 2');
    check(day.includes(draft.reference)&&/Not sent yet/i.test(day),'engineer: today\'s draft is marked not sent yet');
    check(/One report for this week is not sent yet/.test(text),'engineer: the unsent draft is called out above the days');
    const stats=await page.locator('.mw-stats').innerText();
    const days=monday===today?1:2;
    check(new RegExp(`Days with records\\s*${days}`,'i').test(stats)&&/Projects\s*2/i.test(stats)&&/Reports sent\s*3/i.test(stats)&&/Defects flagged\s*1/i.test(stats)&&/1 issue update/.test(stats),`engineer: headline counts: ${JSON.stringify(stats)}`);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'my-week-light-390.png'),fullPage:true});
    // Copy for a timesheet.
    await page.getByRole('button',{name:'Copy for my timesheet'}).click();
    await page.getByText('Copied. Paste it into your timesheet').waitFor();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());
    check(copied.startsWith(`${engineer.name} · `)&&copied.includes(`011LME Tetley Hall - Block E (${tetley.reference}`)&&copied.includes(`014LME Kirkstall Gate - Phase 2 (${kirkstall.reference})`),`copy: names projects and reports: ${JSON.stringify(copied)}`);
    check(!copied.includes(draft.reference)&&!copied.includes(theirs.reference),'copy: leaves out the draft and other people\'s reports');
    check(/1 defect flagged/.test(copied)&&/1 issue update/.test(copied),'copy: counts the defect and the issue update');
    // Weeks: no next week after this one; the previous week shows last week's report.
    check(!(await page.getByRole('button',{name:/Next week/}).isEnabled()),'engineer: no next week after this one');
    await page.getByRole('button',{name:/Previous week/}).click();await page.waitForURL(new RegExp(`week=${lastMonday}`));
    await page.locator('.mw-days').waitFor();await page.getByRole('link',{name:lastWeek.reference}).waitFor();
    const before=await page.locator('main').innerText();
    check(before.includes(lastWeek.reference)&&!before.includes(tetley.reference)&&!before.includes('so far'),'engineer: previous week lists last week\'s report only');
    // A record opened from the page comes back to the same week.
    await page.getByRole('link',{name:lastWeek.reference}).click();await page.waitForURL(`**/reports/${lastWeek.id}**`);
    await page.goBack();await page.waitForURL(new RegExp(`week=${lastMonday}`));await page.locator('.mw-days').waitFor();
    check(true,'engineer: back from a report returns to the same week');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/engineer\?project=proj-011lme$/);
    check(true,'engineer: back returns to the home screen');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Engineer, desktop, dark: from the Reports view, and printable.
  {
    const {context,page,errors}=await open('Engineer','dark',1440);
    await page.goto(`${base}/engineer?project=proj-011lme&view=reports`);
    await page.getByRole('link',{name:'My week'}).click();await page.waitForURL(/\/my-week\?/);await page.locator('.mw-days').waitFor();
    check((await page.locator('.mw-day').count())>=5,'desktop: every weekday is shown');
    if(screenshot)await page.screenshot({path:join(screenshot,'my-week-dark-1440.png'),fullPage:true});
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.appbar').isVisible())&&!(await page.locator('.mw-controls').isVisible())&&!(await page.locator('.back').isVisible()),'print: app bar, controls and back link hidden');
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.mw-day')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white days in dark mode (${bg})`);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/view=reports/);
    check(true,'desktop: back returns to the Reports view');
    assert.deepEqual(errors,[],'desktop: page errors');
    await context.close();
  }

  // A manager sees only their own records: none here.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/my-week`);await page.locator('.mw-days').waitFor();
    const text=await page.locator('main').innerText();
    check(!text.includes(tetley.reference)&&!text.includes(flagged.reference)&&/Reports sent\s*0/i.test(await page.locator('.mw-stats').innerText()),'manager: nobody else\'s records');
    check(/Nothing recorded\./.test(text)||/Still to come\./.test(text),'manager: empty days say so');
    const verified=await page.locator('main').innerText();
    check(!verified.includes(worked.reference),'manager: an office verification is not counted as a record from site');
    assert.deepEqual(errors,[],'manager: page errors');
    check(await page.getByRole('link',{name:/^← Back to /}).getAttribute('href')==='/office','manager: back goes to the office');
    await context.close();
  }
  console.log(`My week check passed (${checks} checks): home and Reports routes, own records only, corrections, drafts, issue updates, copy, week stepping, print, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
