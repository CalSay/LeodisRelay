// Browser check for Before handover: everything RELAY still has open on one
// project, on one page. Opened from the engineer home and the office project
// sheet; printable.
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
const root=mkdtempSync(join(tmpdir(),'relay-before-handover-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
// Safety, permits and deliveries are off unless the office turns them on (lib/featureSwitch.ts); this check needs them on. verify-simpler-home.mjs covers both states.
putRecord('settings',{id:'features',safetyRecords:true});
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:ho-engineer',oid:'ho-engineer',name:'Hand Over',email:'ho@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:ho-manager',oid:'ho-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date());
const daysAgo=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const now=new Date().toISOString();
const check_=(id,item,answer,extra={})=>({id,type:'check',location:'',whatHappened:'',actionNeeded:'',owner:'',photos:[],check:{item,question:`Question ${item}`,answer},...extra});
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',reportType:'handover-inspection',author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const phi=report({reference:'011LME-PHI-001',visitDate:daysAgo(4),observations:[
  check_('o-labels','labels','action',{location:'Level 3 riser',whatHappened:'Circuit labels missing'}),
  check_('o-covers','covers','action',{location:'Level 3 riser',whatHappened:'Blank plate missing'}),
  check_('o-tested','tested','ok'),check_('o-clean','clean','na')]});
const issue=(extra)=>{const i={id:randomUUID(),projectId:'proj-011lme',location:'',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'',targetDate:'',raisedByReport:'',raisedAt:now,events:[],...extra};putRecord('issues',i);return i;};
const labels=issue({reference:'011LME-ISS-401',description:'Circuit labels missing',location:'Level 3 riser',reporterTrade:'Electrical',raisedByReport:phi.id,raisedByObservation:'o-labels',owner:'Sparks Ltd',targetDate:daysAgo(2)});
const covers=issue({reference:'011LME-ISS-402',description:'Blank plate missing',location:'Level 3 riser',reporterTrade:'Electrical',raisedByReport:phi.id,raisedByObservation:'o-covers',work:'awaiting_verification',closureSubmittedBy:'Sparks Ltd'});
const duct=issue({reference:'011LME-ISS-403',description:'Duct insulation torn',location:'Plant room',affectedTrade:'HVAC',owner:'Cool Air Ltd'});
const plaster=issue({reference:'011LME-ISS-404',description:'Ceiling tile cracked',location:'Lobby',affectedTrade:'Other / non-Leodis',owner:'Ceilings Co'});
issue({reference:'011LME-ISS-405',description:'Closed one',affectedTrade:'Electrical',work:'closed'});
issue({reference:'014LME-ISS-001',projectId:'proj-014lme',description:'On another project',affectedTrade:'Electrical'});
const vo=(extra)=>{const v={id:randomUUID(),projectId:'proj-011lme',description:'Variation',location:'',workDone:false,instruction:'pending',source:'report',raisedBy:engineer.name,raisedAt:now,events:[],...extra};putRecord('variations',v);return v;};
const doneVo=vo({reference:'011LME-VO-501',description:'Extra sockets in the plant room',location:'Plant room',workDone:true});
vo({reference:'011LME-VO-502',description:'Move the panel',quotedValue:900});
vo({reference:'011LME-VO-503',description:'Instructed one',instruction:'instructed'});
report({reference:'011LME-SSI-001',reportType:'safety-inspection',visitDate:daysAgo(6),observations:[check_('s-fire','fire','action',{actionNeeded:'Move the pallets',location:'Stair 2'})]});
// A draft handover inspection is not a record yet.
report({reference:'011LME-PHI-002',visitDate:today,state:'draft',serverAcknowledgedAt:undefined,observations:[check_('d1','labels','action',{whatHappened:'Draft only'})]});
const port=4341,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-before-handover-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const section=(page,id)=>page.locator(`#${id}`);
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: sent to sign in, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/handover?project=proj-011lme`);await page.waitForURL(/\/signin/);
    check(true,'signed out: the page asks for sign-in');
    const res=await page.request.get(`${base}/api/before-handover?projectId=proj-011lme`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light: from the home screen.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    const res=await page.request.get(`${base}/api/before-handover?projectId=proj-missing`);
    check(res.status()===404,`engineer: a project that does not exist is refused (${res.status()})`);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    // The Site page keeps it under "More on this project", folded until opened.
    await page.locator('details.eng-more-pages summary').click();
    const link=page.getByRole('link',{name:/^Before handover/});await link.waitFor();
    check(true,'engineer: home offers Before handover');
    await link.click();await page.waitForURL(/\/handover\?project=proj-011lme/);await page.locator('.ho-sheet').waitFor();
    check((await page.locator('#ho-project').inputValue())==='proj-011lme','engineer: opens on the current project');
    const verdict=await page.locator('.ho-verdict').innerText();
    check(/7 things still open in RELAY, 1 past target/.test(verdict),`engineer: the headline says how much is open: ${JSON.stringify(verdict)}`);
    const stats=await page.locator('.ho-stats').innerText();
    check(/Our snags\s*2/i.test(stats)&&/Waiting to be checked\s*1/i.test(stats)&&/Other trades\s*1/i.test(stats)&&/Variations\s*2\s*1 done, not instructed/i.test(stats)&&/Safety actions\s*1/i.test(stats),`engineer: counts: ${JSON.stringify(stats)}`);
    const ours=await section(page,'ho-ours').innerText();
    check(/Electrical/.test(ours)&&/HVAC/.test(ours)&&ours.includes(labels.reference)&&ours.includes(duct.reference),'engineer: our snags by trade');
    check(/Past target/i.test(ours)&&ours.includes('Sparks Ltd')&&ours.includes('from 011LME-PHI-001'),`engineer: a snag says past target, who, and the inspection that raised it: ${JSON.stringify(ours)}`);
    check(!ours.includes('Closed one')&&!ours.includes('On another project')&&!ours.includes(covers.reference),'engineer: closed, other projects and fixed ones are not in our snags');
    const toCheck=await section(page,'ho-check').innerText();
    check(toCheck.includes(covers.reference)&&toCheck.includes('put forward as fixed by Sparks Ltd'),`engineer: a fix waiting to be checked says who fixed it: ${JSON.stringify(toCheck)}`);
    const insp=await section(page,'ho-inspections').innerText();
    check(insp.includes('011LME-PHI-001')&&/2 actions still open/i.test(insp)&&/0 of 2 closed, 1 fixed and waiting to be checked/.test(insp)&&insp.includes('Actions at Level 3 riser')&&!insp.includes('PHI-002'),`engineer: the handover inspection and its open actions; the draft left out: ${JSON.stringify(insp)}`);
    const others=await section(page,'ho-others').innerText();
    check(others.includes(plaster.reference)&&others.includes('Other / non-Leodis'),'engineer: another firm\'s issue is listed apart');
    const vos=await section(page,'ho-variations').innerText();
    check(vos.indexOf(doneVo.reference)<vos.indexOf('011LME-VO-502')&&/Done, not instructed/i.test(vos)&&/Not yet priced/i.test(vos)&&!vos.includes('Instructed one'),`engineer: variations not settled, work done first: ${JSON.stringify(vos)}`);
    check(!vos.includes('£'),'engineer: no prices on the page');
    const safety=await section(page,'ho-safety').innerText();
    check(safety.includes('Move the pallets')&&safety.includes('Stair 2')&&/Open 6 days/i.test(safety),`engineer: the open safety action: ${JSON.stringify(safety)}`);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    const small=await page.locator('.ho-stat, .ho-controls select, .ho-controls button, .ho-group h3 a').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height<44).map(e=>e.textContent));
    check(small.length===0,`engineer: tap targets at least 44px tall: ${JSON.stringify(small)}`);
    if(screenshot)await page.screenshot({path:join(screenshot,'before-handover-light-390.png'),fullPage:true});
    // The count tile jumps to its list.
    await page.locator('.ho-stat',{hasText:'Waiting to be checked'}).click();
    check(page.url().endsWith('#ho-check'),'engineer: a count jumps to its list');
    // The per-trade snag list link keeps the trade.
    const snag=await section(page,'ho-ours').getByRole('link',{name:'Snag list to print'}).first().getAttribute('href');
    check(/\/issues\/snag-list\?project=proj-011lme&trade=Electrical&returnTo=/.test(snag),`engineer: the trade's snag list link: ${snag}`);
    // An issue opened from the page comes back to it.
    await section(page,'ho-ours').getByRole('link',{name:labels.reference}).click();await page.waitForURL(`**/issues/${labels.id}**`);
    await page.getByRole('link',{name:/Back to Before handover/}).click();await page.waitForURL(/\/handover\?project=proj-011lme/);await page.locator('.ho-sheet').waitFor();
    check(true,'engineer: an issue opened from the page offers Back to Before handover');
    await page.getByRole('link',{name:/^← Back to Site/}).click();await page.waitForURL(/\/engineer\?project=proj-011lme/);
    check(true,'engineer: back returns to the home screen');
    // Another project with nothing open says so.
    await page.goto(`${base}/handover?project=proj-009lcp`);await page.locator('.ho-sheet').waitFor();
    const quiet=await page.locator('.ho-verdict').innerText();
    check(/Nothing is open in RELAY on this project\. No handover inspection has been sent yet\./.test(quiet.replace(/\s+/g,' ').replace('project.No','project. No')),`engineer: a project with nothing open says so: ${JSON.stringify(quiet)}`);
    check(/No handover inspection has been sent from this project yet/.test(await section(page,'ho-inspections').innerText()),'engineer: says how to start a handover inspection');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Manager, desktop, dark: from the office project sheet, and printable.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects/proj-011lme`);
    const link=page.getByRole('link',{name:'Before handover'});await link.waitFor();
    await link.click();await page.waitForURL(/\/handover\?project=proj-011lme&returnTo=/);await page.locator('.ho-sheet').waitFor();
    check(/7 things still open/.test(await page.locator('.ho-verdict').innerText()),'manager: the same list from the office');
    if(screenshot)await page.screenshot({path:join(screenshot,'before-handover-dark-1440.png'),fullPage:true});
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.appbar').isVisible())&&!(await page.locator('.ho-controls').isVisible())&&!(await page.locator('.back').isVisible()),'print: app bar, controls and back link hidden');
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.ho-section')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white panels in dark mode (${bg})`);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('link',{name:/^← Back to Office/}).click();await page.waitForURL(/\/office/);
    check(true,'manager: back goes to the office');
    assert.deepEqual(errors,[],'manager: page errors');
    await context.close();
  }
  console.log(`Before handover check passed (${checks} checks): home and office routes, snags by trade, fixes to check, handover inspections, other trades, variations, safety actions, nothing open, print, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
