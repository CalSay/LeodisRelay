// Browser check for the weekly summary: one project's week (sent reports,
// issue and variation changes) opened from the engineer Reports view and the
// office project, stepping between weeks, and printable without the app chrome.
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
const root=mkdtempSync(join(tmpdir(),'relay-week-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay,weekStart,weekEnd,shiftWeek}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {dayShort}=require('../apps/web/.test-build/lib/dates.js');
const engineer={id:'entra:week-engineer',oid:'week-engineer',name:'Week Engineer',email:'week@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:week-other',oid:'week-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:week-manager',oid:'week-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date()),monday=weekStart(undefined,today),lastMonday=shiftWeek(monday,-1);
const at=(ymd,hour=10)=>`${ymd}T${String(hour).padStart(2,'0')}:00:00.000Z`;
const now=new Date().toISOString();
const card=(type,location,whatHappened='Work noted')=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[]});
const LONG='Ductwork hangers fitted along the whole of the level 3 corridor ceiling void, insulation to follow once the pressure test is signed off by the mechanical lead, and the access panels marked up for the ceiling fixers';
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',reference:`011LME-SPR-${randomUUID().slice(0,4)}`,visitDate:monday,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const sent=report({reference:'011LME-SPR-101',observations:[card('update','Level 2 corridor'),card('defect','level 2  corridor'),card('instruction','Plant room')]});
const theirs=report({reference:'011LME-SPR-102',review:'pending',author:other.name,authorId:other.id,authorTrade:'P&H',observations:[card('update','Riser','Pipework lagged'),card('update','Level 3 corridor',LONG),card('update','Plant room','Valves tagged'),card('update','Roof','Condensate run fixed'),card('update','Bin store','Drain capped')]});
const lastWeek=report({reference:'011LME-SPR-090',visitDate:lastMonday,observations:[card('update','Roof')]});
const draft=report({reference:'011LME-SPR-103',author:other.name,authorId:other.id,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:now});
const elsewhere=report({reference:'014LME-SPR-001',projectId:'proj-014lme'});
const issue=(extra)=>{const i={id:randomUUID(),reference:`011LME-ISS-${randomUUID().slice(0,4)}`,projectId:'proj-011lme',location:'Level 2 corridor',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',source:'individual',raisedAt:at(lastMonday),events:[],...extra};putRecord('issues',i);return i;};
const raised=issue({reference:'011LME-ISS-201',description:'Cable tray lid missing',raisedAt:now});
const closed=issue({reference:'011LME-ISS-202',description:'Socket faceplate cracked',work:'closed',events:[{at:now,actor:manager.name,kind:'verified',note:'',photos:[]}]});
const overdue=issue({reference:'011LME-ISS-203',description:'Old snag',targetDate:shiftWeek(lastMonday,-1)});
// Open at the end of last week but not now: past target then, checked and closed today.
const checkedToday=issue({reference:'011LME-ISS-204',description:'Riser door not closing',work:'closed',targetDate:lastMonday,events:[{at:now,actor:engineer.name,kind:'closure_submitted',note:'',photos:[]},{at:now,actor:manager.name,kind:'verified',note:'',photos:[]}]});
// Put forward as fixed last week, still waiting to be checked.
const fixedLastWeek=issue({reference:'011LME-ISS-205',description:'Light switch loose',work:'awaiting_verification',events:[{at:at(lastMonday,12),actor:engineer.name,kind:'closure_submitted',note:'',photos:[]}]});
const variation={id:randomUUID(),reference:'011LME-VO-301',projectId:'proj-011lme',description:'Extra sockets in the plant room',location:'Plant room',workDone:true,instruction:'pending',source:'report',raisedBy:engineer.name,raisedAt:now,events:[]};
putRecord('variations',variation);
const port=4336,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-week-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const rows=(page,section)=>page.locator('.week-section').filter({has:page.getByRole('heading',{name:section,level:2})}).locator('.week-rows > li');
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: sent to sign in, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/weekly-summary?project=proj-011lme`);await page.waitForURL(/\/signin/);
    check(true,'signed out: the page asks for sign-in');
    const res=await page.request.get(`${base}/api/weekly-summary?projectId=proj-011lme`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light: the Reports view links to this week's summary.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/engineer?project=proj-011lme&view=reports`);
    const link=page.getByRole('link',{name:'Weekly summary'});await link.waitFor();
    check(true,'engineer: Reports view offers a weekly summary');
    await link.click();await page.waitForURL(/\/weekly-summary\?/);await page.locator('.week-sheet').waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','engineer: opens on the current project');
    const text=await page.locator('.week-sheet').innerText();
    check(text.includes('Tetley Hall - Block E')&&/this week so far/.test(text),'engineer: names the project and says the week is still going');
    const onSite=await rows(page,'On site').allInnerTexts();
    check(onSite.length===2&&onSite.some(t=>t.includes(sent.reference))&&onSite.some(t=>t.includes(theirs.reference)),`engineer: both sent reports this week, from both engineers: ${JSON.stringify(onSite)}`);
    check(!text.includes(lastWeek.reference)&&!text.includes(draft.reference)&&!text.includes(elsewhere.reference),'engineer: last week, a draft and another project are left out');
    check(/awaiting review/i.test(onSite.find(t=>t.includes(theirs.reference)))&&!/awaiting review/i.test(onSite.find(t=>t.includes(sent.reference))),'engineer: a report still awaiting review is marked, a settled one is not');
    const mine=onSite.find(t=>t.includes(sent.reference));
    check(/1 progress update, 1 defect, 1 variation required/.test(mine),`engineer: report row counts what it found: ${mine}`);
    // What was done, in the engineer's words, without opening the report; the defect and variation are in their own sections.
    const work=await page.getByRole('list',{name:`Work done, ${sent.reference}`}).innerText();
    check(work.includes('Level 2 corridor: Work noted')&&!work.includes('Plant room'),`engineer: the visit says what was done and where, progress only: ${work}`);
    // A long visit shows three updates, each in full, then Show all.
    const theirsWork=page.getByRole('list',{name:`Work done, ${theirs.reference}`}).locator('li');
    const visible=async()=>(await theirsWork.evaluateAll(ls=>ls.filter(l=>l.offsetHeight>0).length));
    check(await theirsWork.count()===5&&await visible()===3,`engineer: five updates, three shown at first (${await visible()})`);
    const longLine=theirsWork.filter({hasText:'Level 3 corridor'});
    check((await longLine.innerText()).includes('ceiling fixers'),'engineer: a long note shows in full, never cut');
    const showAll=page.getByRole('button',{name:'Show all 5 updates'});
    check(await showAll.getAttribute('aria-expanded')==='false','engineer: Show all says it is folded');
    await showAll.click();
    check(await visible()===5,'engineer: Show all shows every update');
    await page.getByRole('button',{name:'Show less'}).click();
    check(await visible()===3,'engineer: Show less folds it again');
    check(await page.getByRole('button',{name:/^Show all/}).count()===1,'engineer: a short visit has no Show all');
    const stats=await page.locator('.week-stats').innerText();
    check(/Site reports\s*2/i.test(stats)&&/Engineers\s*2/i.test(stats)&&/Issues raised\s*1/i.test(stats)&&/Variations raised\s*1/i.test(stats),`engineer: headline counts: ${JSON.stringify(stats)}`);
    check((await rows(page,'Issues').allInnerTexts()).some(t=>t.includes(raised.reference)),'engineer: issue raised this week is listed');
    check((await page.locator('.week-section').filter({hasText:'Checked and closed'}).innerText()).includes(closed.reference),'engineer: issue closed this week is listed');
    check(/^Open now: 3 · 1 past target · 1 fixed and waiting to be checked\./.test(await page.locator('.week-total').nth(1).innerText()),'engineer: open now with past target');
    check(!/open now/i.test(stats),`engineer: on a phone the figures keep to one line each; open issues are under Issues: ${JSON.stringify(stats)}`);
    const vo=(await rows(page,'Variations').allInnerTexts()).join('\n');
    check(vo.includes(variation.reference)&&/done, not instructed/i.test(vo)&&!/£/.test(text),'engineer: variation raised, flagged as done, not instructed, no prices');
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'week-light-390.png'),fullPage:true});
    // Previous week shows last week's report; next week is not offered beyond this one.
    check(!(await page.getByRole('button',{name:/Next week/}).isEnabled()),'engineer: no next week after this one');
    await page.getByRole('button',{name:/Previous week/}).click();await page.waitForURL(new RegExp(`week=${lastMonday}`));
    await page.locator('.week-sheet').waitFor();
    const before=await rows(page,'On site').allInnerTexts();
    check(before.length===1&&before[0].includes(lastWeek.reference)&&!(await page.locator('.week-sheet').innerText()).includes('so far'),`engineer: previous week lists last week's report: ${JSON.stringify(before)}`);
    // Last week's issues as they stood at the end of its Sunday, not today's.
    const sunday=dayShort(weekEnd(lastMonday));
    const standing=await page.locator('.week-total').filter({hasText:'Open at the end of the week'}).innerText();
    check(standing.startsWith(`Open at the end of the week (${sunday}): 4 · 2 past target · 1 fixed and waiting to be checked.`),`engineer: last week's issues as they stood on its Sunday (${standing})`);
    const foot=await page.locator('.week-foot').innerText();
    check(/as the issues stood at the end of/.test(foot)&&!/Open now/.test(foot),`engineer: the footnote says when the figures were read (${foot})`);
    // A record opened from the summary comes back to the same week.
    await page.getByRole('link',{name:lastWeek.reference}).click();await page.waitForURL(`**/reports/${lastWeek.id}**`);
    await page.goBack();await page.waitForURL(new RegExp(`week=${lastMonday}`));await page.locator('.week-sheet').waitFor();
    check(true,'engineer: back from a report returns to the same week');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/engineer\?project=proj-011lme&view=reports/);
    check(true,'engineer: back returns to the Reports view');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Office, desktop, dark: the project's actions link to the summary, which prints on white.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects`);await page.locator('.glance-row').filter({hasText:'011LME'}).first().click();
    await page.getByRole('link',{name:'Weekly summary'}).click();await page.waitForURL(/\/weekly-summary\?/);await page.locator('.week-sheet').waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','office: opens on the chosen project');
    check((await rows(page,'On site').count())===2,'office: same two reports as the engineer, no drafts');
    if(screenshot)await page.screenshot({path:join(screenshot,'week-dark-1440.png'),fullPage:true});
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.appbar').isVisible())&&!(await page.locator('.week-controls').isVisible())&&!(await page.locator('.back').isVisible()),'print: app bar, controls and back link hidden');
    check(await page.locator('.banner').isVisible(),'print: prototype banner still prints');
    const printed=page.getByRole('list',{name:`Work done, ${theirs.reference}`}).locator('li');
    check((await printed.evaluateAll(ls=>ls.filter(l=>l.offsetHeight>0&&l.scrollHeight<=l.clientHeight+2).length))===5,'print: every update printed in full');
    check(!(await page.getByRole('button',{name:/Show all/}).isVisible()),'print: Show all is left off paper');
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.week-sheet')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white sheet in dark mode (${bg})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'week-print-dark.png'),fullPage:true});
    const pdf=await page.pdf({format:'A4'});
    check(pdf.length>1000,`print: produces an A4 PDF (${pdf.length} bytes)`);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/office/);
    check(true,'office: back returns to the office');
    // Today's to-check figure opens the register; last week's is words, since the register shows today.
    await page.goto(`${base}/weekly-summary?project=proj-011lme`);await page.locator('.week-sheet').waitFor();
    check(await page.locator('.week-total a[href^="/office"]').filter({hasText:'1 fixed and waiting to be checked'}).count()===1,'office: this week\'s to-check figure opens the register');
    check(/Issues raised\s*1\s*\d+ closed this week · 3 open now/i.test(await page.locator('.week-stats').innerText()),'office: the issues figure says how many are open now');
    await page.goto(`${base}/weekly-summary?project=proj-011lme&week=${lastMonday}`);await page.locator('.week-sheet').waitFor();
    const lastSunday=dayShort(weekEnd(lastMonday));
    check(new RegExp(`Issues raised\\s*\\d+\\s*\\d+ closed this week · 4 open on ${lastSunday}`,'i').test(await page.locator('.week-stats').innerText()),'office: the issues figure says how many were open at the end of last week');
    await page.emulateMedia({media:'print'});
    check((await page.locator('.week-stats').innerText()).includes(`4 open on ${lastSunday}`),'print: the open issues figure prints');
    await page.emulateMedia({media:'screen'});
    check(await page.locator('.week-total a[href^="/office"]').count()===0&&/1 fixed and waiting to be checked/.test(await page.locator('.week-total').filter({hasText:'Open at the end of the week'}).innerText()),'office: last week\'s to-check figure is words');
    // Another project: nothing this week, said plainly.
    await page.goto(`${base}/weekly-summary?project=proj-014lme&week=${lastMonday}`);await page.locator('.week-sheet').waitFor();
    check((await page.locator('.week-sheet').innerText()).includes('No site reports were sent for visits this week.'),'office: an empty week says so');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // No project chosen: the page asks for one.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/weekly-summary`);
    await page.getByText('Choose a project to see its week').waitFor();
    check(!(await page.getByRole('button',{name:'Print or save as PDF'}).isEnabled()),'no project: printing is not offered yet');
    const res=await page.request.get(`${base}/api/weekly-summary?projectId=no-such-project`);
    check(res.status()===404,`unknown project: refused (${res.status()})`);
    assert.deepEqual(errors,[],'empty: page errors');
    await context.close();
  }
  console.log(`Weekly summary check passed (${checks} checks): engineer and office routes, week stepping, counts, access, print layout, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
