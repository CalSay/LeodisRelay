// Browser check for Safety actions: what the weekly safety inspections found
// needing action, open until a later inspection finds it put right. Opened
// from the engineer home, the Reports view and the office projects sheet.
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
const root=mkdtempSync(join(tmpdir(),'relay-safety-actions-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:sa-engineer',oid:'sa-engineer',name:'Safe Engineer',email:'safe@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:sa-other',oid:'sa-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:sa-manager',oid:'sa-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date());
const daysAgo=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const now=new Date().toISOString();
const check_=(item,answer,extra={})=>({id:`obs-check-${item}`,type:'check',location:'',whatHappened:'',actionNeeded:'',owner:'',photos:[],check:{item,question:{housekeeping:'Work areas tidy, waste cleared, walkways clear',fire:'Fire points and escape routes clear and signed',ppe:'Everyone wearing the right PPE, in good condition',height:'Ladders, steps, towers and podiums checked and used safely'}[item],answer},...extra});
const inspection=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',reportType:'safety-inspection',author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const first=inspection({reference:'011LME-SSI-001',visitDate:daysAgo(15),observations:[
  check_('housekeeping','action',{whatHappened:'Offcuts and packaging in the level 2 riser',actionNeeded:'Clear the riser and bag the waste',owner:'Sparks Ltd',location:'Level 2 riser'}),
  check_('fire','action',{whatHappened:'Fire point by stair 2 blocked by pallets',actionNeeded:'Move the pallets to the compound',owner:'Site team'}),
  check_('ppe','ok')]});
const second=inspection({reference:'011LME-SSI-002',visitDate:daysAgo(9),author:other.name,authorId:other.id,authorTrade:'P&H',observations:[
  check_('housekeeping','action',{whatHappened:'Riser still has offcuts',actionNeeded:'Clear the riser today',owner:'Sparks Ltd'}),
  check_('fire','ok',{whatHappened:'Pallets moved'}),
  check_('ppe','ok')]});
// Kirkstall: an action raised and cleared, then corrected so the correction stands in.
const kirk1=inspection({reference:'014LME-SSI-001',projectId:'proj-014lme',visitDate:daysAgo(3),observations:[check_('height','action',{whatHappened:'Tower missing a toe board',actionNeeded:'Fit toe board',owner:'Access Co'})]});
const kirk1rev=inspection({reference:'014LME-SSI-001',projectId:'proj-014lme',visitDate:daysAgo(3),revision:2,corrects:kirk1.id,correctionReason:'Wrong answer',observations:[check_('height','ok')]});
// A draft inspection is not a record yet.
const draft=inspection({reference:'011LME-SSI-003',visitDate:today,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:now,observations:[check_('ppe','action',{whatHappened:'Draft only'})]});
const port=4339,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-safety-actions-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
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
    await page.goto(`${base}/safety-actions`);await page.waitForURL(/\/signin/);
    check(true,'signed out: the page asks for sign-in');
    const res=await page.request.get(`${base}/api/safety-actions`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light: from the home screen, on one project.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const link=page.getByRole('link',{name:/^Safety actions/});await link.waitFor();
    check(true,'engineer: home offers Safety actions');
    await link.click();await page.waitForURL(/\/safety-actions\?project=proj-011lme/);await page.locator('.sa-project').first().waitFor();
    check((await page.locator('#sa-project').inputValue())==='proj-011lme','engineer: opens on the current project');
    check((await page.locator('.sa-project').count())===1,'engineer: one project shown');
    const block=await page.locator('.sa-project').innerText();
    check(/1 action open/i.test(block),`engineer: one action open: ${JSON.stringify(block)}`);
    const action=await page.locator('.sa-action').first().innerText();
    check(action.includes('Work areas tidy, waste cleared, walkways clear')&&action.includes('Riser still has offcuts')&&action.includes('Clear the riser today')&&action.includes('Sparks Ltd'),`engineer: the open action says what, to do and who, as last written: ${JSON.stringify(action)}`);
    check(/Open 15 days/i.test(action)&&/Found 2 times/i.test(action),'engineer: open since the first inspection that found it, found twice');
    check(action.includes(first.reference)&&action.includes(second.reference),'engineer: names the inspections that found it');
    check(!block.includes('Draft only'),'engineer: a draft inspection is left out');
    check(/Last inspection 011LME-SSI-002/.test(block)&&/9 days ago · another is due/.test(block),'engineer: last inspection and that another is due');
    // Cleared actions are folded away until asked for.
    const fold=page.locator('.sa-put-right summary');
    check(/Put right in the last 4 weeks \(1\)/.test(await fold.innerText()),'engineer: one put right');
    check(!(await page.getByText('Was: Fire point by stair 2 blocked by pallets').isVisible()),'engineer: cleared list starts folded');
    await fold.click();
    const cleared=await page.locator('.sa-cleared').innerText();
    check(/Satisfactory/i.test(cleared)&&/put right after 6 days/.test(cleared)&&cleared.includes('Pallets moved')&&cleared.includes(`cleared in ${second.reference}`)&&cleared.includes('Pat Pipe'),`engineer: the cleared action says when and by whom: ${JSON.stringify(cleared)}`);
    const stats=await page.locator('.sa-stats').innerText();
    check(/Open actions\s*1/i.test(stats)&&/Projects with actions\s*1/i.test(stats)&&/Put right, last 4 weeks\s*1/i.test(stats)&&/Inspections due\s*1/i.test(stats),`engineer: headline counts: ${JSON.stringify(stats)}`);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'safety-actions-light-390.png'),fullPage:true});
    // Every project: the corrected Kirkstall inspection cleared its own action.
    await page.locator('#sa-project').selectOption('');await page.waitForURL(u=>!u.search.includes('project='));
    const all=await page.locator('main').innerText();
    check((await page.locator('.sa-project').count())===2,'every project: both inspected projects listed');
    check(/014LME Kirkstall Gate - Phase 2[\s\S]*Nothing open/i.test(all)&&!all.includes('Tower missing a toe board'),'every project: a corrected inspection stands in for the one it corrects');
    check(/No safety inspection sent yet/.test(all)&&all.includes('Hunslet Depot'),'every project: a live project with no inspection is named');
    check(!all.includes('Aire Court')&&!all.includes('Bramley Works'),'every project: tender and complete projects are left out');
    check((await page.locator('.sa-project').first().innerText()).includes('Tetley Hall'),'every project: a project with open actions comes first');
    // An inspection opened from the page comes back to it.
    await page.locator('.sa-action').first().getByRole('link',{name:first.reference}).click();await page.waitForURL(`**/reports/${first.id}**`);
    await page.getByRole('link',{name:/Back to Safety actions/}).waitFor();
    check(true,'engineer: an inspection opened from the page offers Back to Safety actions');
    await page.goBack();await page.waitForURL(/\/safety-actions/);await page.locator('.sa-project').first().waitFor();
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/engineer\?project=proj-011lme/);
    check(true,'engineer: back returns to the home screen');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Engineer, desktop, dark: from the Reports view, and printable.
  {
    const {context,page,errors}=await open('Engineer','dark',1440);
    await page.goto(`${base}/engineer?project=proj-011lme&view=reports`);
    await page.getByRole('link',{name:'Safety actions'}).click();await page.waitForURL(/\/safety-actions\?/);await page.locator('.sa-project').first().waitFor();
    if(screenshot)await page.screenshot({path:join(screenshot,'safety-actions-dark-1440.png'),fullPage:true});
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.appbar').isVisible())&&!(await page.locator('.sa-controls').isVisible())&&!(await page.locator('.back').isVisible()),'print: app bar, controls and back link hidden');
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.sa-project')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white panels in dark mode (${bg})`);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/view=reports/);
    check(true,'desktop: back returns to the Reports view');
    assert.deepEqual(errors,[],'desktop: page errors');
    await context.close();
  }

  // Manager, desktop: from the office projects sheet, every project.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/office#/projects`);
    const link=page.getByRole('link',{name:'Safety actions'}).first();await link.waitFor();
    await link.click();await page.waitForURL(/\/safety-actions\?returnTo=/);await page.locator('.sa-project').first().waitFor();
    const text=await page.locator('main').innerText();
    check(text.includes('Riser still has offcuts')&&/Open actions\s*1/i.test(await page.locator('.sa-stats').innerText()),'manager: sees the open action on every project');
    await page.getByRole('link',{name:/^← Back to Office/}).waitFor();
    check(true,'manager: back goes to the office');
    assert.deepEqual(errors,[],'manager: page errors');
    await context.close();
  }
  console.log(`Safety actions check passed (${checks} checks): home, Reports and office routes, open and cleared actions, found again, corrections, drafts, live projects only, print, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
