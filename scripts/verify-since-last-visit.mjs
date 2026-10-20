// Browser check for "Since your last visit" on the engineer home: what other
// people sent, raised, moved on and answered on the project since the
// engineer's own last report there, and nothing of their own.
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
const root=mkdtempSync(join(tmpdir(),'relay-since-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:since-engineer',oid:'since-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:since-other',oid:'since-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const newcomer={id:'entra:since-new',oid:'since-new',name:'Nia New',email:'nia@example.test',role:'Engineer',trade:'HVAC'};
const sessions={};
for(const p of [engineer,other,newcomer]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Times relative to now, so the check passes whatever day it runs.
const ago=days=>new Date(Date.now()-days*86400000).toISOString();
const day=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const card=(type,location)=>({id:randomUUID(),type,location,whatHappened:'Work noted',actionNeeded:'',owner:'',photos:[]});
const report=(extra)=>{const at=extra.serverAcknowledgedAt??ago(3);const r={id:randomUUID(),projectId:'proj-011lme',reference:`011LME-SPR-${randomUUID().slice(0,4)}`,visitDate:day(at),author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:at,observations:[],...extra};putRecord('reports',r);return r;};
const mine=report({reference:'011LME-SPR-201',serverAcknowledgedAt:ago(3)});
const theirsBefore=report({reference:'011LME-SPR-198',author:other.name,authorId:other.id,authorTrade:'P&H',serverAcknowledgedAt:ago(5)});
const theirsAfter=report({reference:'011LME-SPR-202',author:other.name,authorId:other.id,authorTrade:'P&H',serverAcknowledgedAt:ago(2),observations:[card('update','Riser'),card('defect','Riser')]});
const draft=report({reference:'011LME-SPR-203',author:other.name,authorId:other.id,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:ago(1)});
const elsewhere=report({reference:'014LME-SPR-001',projectId:'proj-014lme',author:other.name,authorId:other.id,serverAcknowledgedAt:ago(1)});
const issue=(extra)=>{const i={id:randomUUID(),reference:`011LME-ISS-${randomUUID().slice(0,4)}`,projectId:'proj-011lme',location:'Level 2 corridor',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'open',owner:'',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',source:'individual',reportedBy:other.name,reportedById:other.id,raisedAt:ago(10),events:[],...extra};putRecord('issues',i);return i;};
const raised=issue({reference:'011LME-ISS-301',description:'Cable tray lid missing',raisedAt:ago(1)});
const closed=issue({reference:'011LME-ISS-302',description:'Socket faceplate cracked',affectedTrade:'P&H',work:'closed',events:[{at:ago(1),actor:'Office Manager',actorId:'entra:mgr',kind:'verified',note:'',photos:[]}]});
const own=issue({reference:'011LME-ISS-303',description:'My own defect',raisedAt:ago(1),reportedBy:engineer.name,reportedById:engineer.id});
const old=issue({reference:'011LME-ISS-304',description:'Old snag',raisedAt:ago(4)});
const extra=[1,2,3,4].map(n=>issue({reference:`011LME-ISS-31${n}`,description:`Extra snag ${n}`,affectedTrade:'HVAC',raisedAt:ago(2-n/10)}));
const variation={id:randomUUID(),reference:'011LME-VO-401',projectId:'proj-011lme',description:'Extra sockets in the plant room',location:'Plant room',workDone:false,instruction:'pending',source:'report',raisedBy:other.name,raisedById:other.id,raisedAt:ago(1),events:[]};
putRecord('variations',variation);
const port=4339,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-since-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(who,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(who)await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const panel=page=>page.locator('.eng-since');

  // Signed out, and an unknown project: the API refuses.
  {
    const res=await fetch(`${base}/api/since-last-visit?projectId=proj-011lme`);
    check(res.status===401,`signed out: the API refuses (${res.status})`);
    const unknown=await fetch(`${base}/api/since-last-visit?projectId=no-such-project`,{headers:{cookie:`relay_session=${sessions[engineer.oid]}`}});
    check(unknown.status===404,`unknown project: refused (${unknown.status})`);
  }

  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const {context,page,errors}=await open(engineer,scheme,width);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await panel(page).getByText('Reports from others').waitFor();
    const text=await panel(page).innerText();
    check(/From others since your report on/.test(text)&&text.includes('SPR-201'),`${width}: names my last report as the starting point`);
    check(text.includes('SPR-202')&&/1 defect/.test(text)&&text.includes('Pat Pipe · P&H'),`${width}: another trade's later report, with what it found`);
    check(!text.includes('SPR-198')&&!text.includes('SPR-203')&&!text.includes('014LME')&&!text.includes('SPR-201 ·'),`${width}: earlier reports, drafts, other projects and my own report are left out`);
    check(text.includes('Cable tray lid missing')&&text.includes('Socket faceplate cracked')&&/Checked and closed/i.test(text),`${width}: new and closed issues listed`);
    check(!text.includes('My own defect')&&!text.includes('Old snag'),`${width}: my own issue and one raised before my visit are left out`);
    const trade=await panel(page).locator('.eng-row').filter({hasText:'Cable tray lid missing'}).innerText();
    check(/Your trade/i.test(trade),`${width}: an issue for my trade is marked`);
    check(!(/Your trade/i.test(await panel(page).locator('.eng-row').filter({hasText:'Socket faceplate cracked'}).innerText())),`${width}: another trade's issue is not marked`);
    check(text.includes(variation.reference.split('-').slice(1).join('-'))&&/New variation/i.test(text)&&!/£/.test(text),`${width}: the new variation, without prices`);
    check(/Issues\s*6/i.test(text)&&(await panel(page).locator('.eng-row').filter({hasText:/Extra snag/}).count())<4,`${width}: six issues, only the first few shown`);
    await panel(page).getByRole('button',{name:'Show 2 more'}).click();
    check((await panel(page).locator('.eng-row').filter({hasText:/Extra snag/}).count())===4,`${width}: Show more lists the rest`);
    check(/8 new/.test(await page.locator('#eng-since-title').locator('..').innerText()),`${width}: total count beside the heading`);
    const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(scroll<=width,`${width}: no sideways scroll (${scroll})`);
    if(screenshot)await page.screenshot({path:join(screenshot,`since-${scheme}-${width}.png`),fullPage:true});
    // A record opened from the list comes back to the home.
    await panel(page).getByRole('link',{name:/Cable tray lid missing/}).click();await page.waitForURL(`**/issues/${raised.id}**`);
    await page.goBack();await panel(page).getByText('Reports from others').waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme',`${width}: back returns to the home on the same project`);
    assert.deepEqual(errors,[],`${width}: page errors`);
    await context.close();
  }

  // Another engineer: my report is news to them, their own is not.
  {
    const {context,page,errors}=await open(other,'light',390);
    await page.goto(`${base}/engineer?project=proj-011lme`);await panel(page).getByText('My own defect').waitFor();
    const text=await panel(page).innerText();
    check(text.includes('SPR-202')&&!/Reports from others/i.test(text),'other engineer: starts from their own later report, so my earlier one is not news');
    check(!text.includes('Cable tray lid missing')&&!text.includes(variation.reference.slice(7)),'other engineer: issues and variations they raised are left out, mine are news');
    assert.deepEqual(errors,[],'other engineer: page errors');
    await context.close();
  }

  // An engineer with no earlier report here sees the last seven days, and an empty project says so.
  {
    const {context,page,errors}=await open(newcomer,'dark',390);
    await page.goto(`${base}/engineer?project=proj-011lme`);await panel(page).getByText('Reports from others').waitFor();
    await panel(page).getByRole('button',{name:/Show \d+ more/}).click();
    const text=await panel(page).innerText();
    check(/You have not sent a report on this project before today, so this is the last 7 days/.test(text),'newcomer: told it is the last seven days');
    check(text.includes('SPR-202')&&text.includes('SPR-201')&&text.includes('Old snag'),'newcomer: reports and issues from the last seven days');
    if(screenshot)await page.screenshot({path:join(screenshot,'since-newcomer-dark-390.png'),fullPage:true});
    await page.goto(`${base}/engineer?project=proj-009lcp`);
    await panel(page).getByText(/Nothing new from anyone else in the last 7 days/).waitFor();
    check(true,'empty project: says nothing is new');
    assert.deepEqual(errors,[],'newcomer: page errors');
    await context.close();
  }
  console.log(`Since your last visit check passed (${checks} checks): starting point, others' reports, issues and variations, own work left out, show more, access, 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
