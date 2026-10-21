// Browser check for the site diary (EXP-1): one project's visits, day by day,
// made only from sent reports, each entry linking its report revision and the
// earlier revisions it replaced, with the issues and variations its cards raised.
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
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-diary-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:diary-engineer',oid:'diary-engineer',name:'Diary Engineer',email:'diary@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:diary-other',oid:'diary-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:diary-manager',oid:'diary-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const dayBefore=n=>{const d=new Date(`${londonDay(new Date())}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const today=dayBefore(0),at=(ymd,hour)=>`${ymd}T${String(hour).padStart(2,'0')}:00:00.000Z`;
const photo=async(owner,colour,caption='')=>{const id=randomUUID();await putMedia(id,{...owner,ownerId:engineer.id,mime:'image/png'},await sharp({create:{width:320,height:240,channels:3,background:colour}}).png().toBuffer());return {id,dataUrl:`/api/media/${id}`,caption,capturedAt:at(today,9)};};
const card=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',visitDate:today,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:at(today,16),observations:[],...extra};putRecord('reports',r);return r;};

// Today: a report sent, then corrected. Both revisions keep the same card IDs.
const ids={rev1:randomUUID(),rev2:randomUUID()};
const shots=[await photo({reportId:ids.rev2},'#3b6e8f','Riser before boarding'),await photo({reportId:ids.rev2},'#6e3b3b'),await photo({reportId:ids.rev2},'#3b6e4a'),await photo({reportId:ids.rev2},'#8a6f2c'),await photo({reportId:ids.rev2},'#555555'),await photo({reportId:ids.rev2},'#777777')];
const progress=card('update','Level 3 riser','Containment run complete',{photos:shots});
const defect=card('defect','Plant room','Fire stopping missing around tray',{actionNeeded:'Fire stop the penetration',owner:'Acme Fire Ltd'});
const extra=card('instruction','Roof','Client asked for two more external sockets');
const strip=c=>({...c,photos:[]});
const rev1=report({id:ids.rev1,reference:'011LME-SPR-401',serverAcknowledgedAt:at(today,9),observations:[strip(progress),defect,extra]});
const rev2=report({id:ids.rev2,reference:'011LME-SPR-401',revision:2,corrects:rev1.id,correctionReason:'Photographs were missing',serverAcknowledgedAt:at(today,11),observations:[progress,{...defect,linkedIssueId:'diary-issue'},extra]});
const theirs=report({reference:'011LME-SPR-402',author:other.name,authorId:other.id,authorTrade:'P&H',review:'pending',serverAcknowledgedAt:at(today,15),observations:[card('update','Basement','Drainage first fix')]});
const draft=report({reference:'011LME-SPR-403',author:other.name,authorId:other.id,state:'draft',serverAcknowledgedAt:undefined,observations:[card('update','Basement','Private draft words')]});
const away=report({reference:'014LME-SPR-001',projectId:'proj-014lme',state:'draft',serverAcknowledgedAt:undefined,observations:[card('update','Elsewhere','Other project')]});
const issue={id:'diary-issue',reference:'011LME-ISS-401',projectId:'proj-011lme',location:'Plant room',description:'Fire stopping missing around tray',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Acme Fire Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:rev1.id,raisedByObservation:defect.id,source:'report',raisedAt:at(today,9),events:[{at:at(today,9),actor:engineer.name,kind:'raised',note:'',photos:[]}]};
putRecord('issues',issue);
const variation={id:randomUUID(),reference:'011LME-VO-401',projectId:'proj-011lme',description:'Two more external sockets',location:'Roof',workDone:false,instruction:'pending',source:'report',raisedBy:engineer.name,raisedAt:at(today,9),raisedByReport:rev1.id,raisedByObservation:extra.id,events:[]};
putRecord('variations',variation);
// Twelve earlier site days, so the diary has more than one page (ten days a page).
const older=[];for(let n=1;n<=12;n++)older.push(report({reference:`011LME-SPR-${String(300+n)}`,visitDate:dayBefore(n*2),serverAcknowledgedAt:at(dayBefore(n*2),16),observations:[card(n===3?'defect':'update',`Level ${n} corridor`,`Day ${n} work`)]}));

const port=4341,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-diary-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const entry=(page,name)=>page.locator('.diary-entry').filter({has:page.getByRole('link',{name,exact:true})});

  // Signed out: sent to sign in with the project kept, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/diary?project=proj-011lme`);await page.waitForURL(/\/signin/);
    check(decodeURIComponent(page.url()).includes('/diary?project=proj-011lme'),'signed out: sign-in keeps the diary address');
    const res=await page.request.get(`${base}/api/site-diary?projectId=proj-011lme`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light: from the home page's project list.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    // The Site page keeps it under "More on this project", folded until opened.
    await page.locator('details.eng-more-pages summary').click();
    const link=page.getByRole('link',{name:/Site diary/});await link.waitFor();
    check(true,'engineer: home offers the site diary');
    await link.click();await page.waitForURL(/\/diary\?/);await page.locator('.diary-entry').first().waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','engineer: opens on the current project');
    const count=await page.locator('.diary-count').innerText();
    check(/13 site days · 14 reports since/.test(count),`engineer: counts site days and reports, the corrected report once: ${count}`);
    const heads=await page.locator('.diary-day h2').allInnerTexts();
    check(heads.length===10,`engineer: one page holds ten site days (${heads.length})`);
    check(heads[0].includes(`${Number(today.slice(8))} ${new Date(`${today}T12:00:00Z`).toLocaleDateString('en-GB',{timeZone:'Europe/London',month:'long'})} ${today.slice(0,4)}`)&&heads[0].includes('Diary Engineer, Pat Pipe'),`engineer: newest day first, naming who was on site: ${heads[0]}`);
    const text=await page.locator('.diary-days').innerText();
    check(!text.includes(draft.reference)&&!text.includes('Private draft words')&&!text.includes(away.reference),'engineer: drafts and other projects are left out');
    const fixed=entry(page,rev2.reference);
    check(await fixed.count()===1,'engineer: the corrected report is one entry');
    const fixedText=await fixed.innerText();
    check(/rev 2/i.test(fixedText)&&/Corrects rev 1: \W?Photographs were missing/.test(fixedText),`engineer: entry says it is rev 2 and why it corrected rev 1: ${fixedText.slice(0,200)}`);
    check(await fixed.getByRole('link',{name:rev2.reference,exact:true}).getAttribute('href').then(h=>h.startsWith(`/reports/${rev2.id}?`)),'engineer: the reference links the latest revision');
    check(await fixed.getByRole('link',{name:/^rev 1/}).getAttribute('href').then(h=>h.startsWith(`/reports/${rev1.id}?`)),'engineer: the earlier revision is linked');
    check(fixedText.indexOf('Containment run complete')<fixedText.indexOf('Fire stopping missing')&&fixedText.indexOf('Fire stopping missing')<fixedText.indexOf('two more external sockets'),'engineer: cards in report order, with the words as sent');
    check(/Action needed\s*Fire stop the penetration/i.test(fixedText)&&/Who\s*Acme Fire Ltd/i.test(fixedText),'engineer: action needed and who are shown');
    const issueLink=fixed.getByRole('link',{name:/011LME-ISS-401/});
    check(/Raised\s*011LME-ISS-401\s*Assigned/i.test(await issueLink.innerText())&&(await issueLink.getAttribute('href')).startsWith('/issues/diary-issue?'),'engineer: the defect card links the issue it raised, with its state now');
    check(/Raised\s*011LME-VO-401\s*Awaiting instruction/i.test(await fixed.getByRole('link',{name:/011LME-VO-401/}).innerText()),'engineer: the variation card links its variation');
    await page.waitForFunction(()=>[...document.querySelectorAll('.diary-photos img')].length===4&&[...document.querySelectorAll('.diary-photos img')].every(i=>i.complete&&i.naturalWidth>0));
    check(true,'engineer: four photographs load as thumbnails');
    check((await fixed.locator('.diary-more-photos').innerText()).trim()==='+2','engineer: the rest are counted, linking the report');
    check(await fixed.getByRole('img',{name:'Riser before boarding'}).count()===1,'engineer: a caption is the photograph\'s description');
    check(/awaiting review/i.test(await entry(page,theirs.reference).innerText()),'engineer: another engineer\'s report awaiting review is shown and marked');
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'diary-light-390.png'),fullPage:false});
    if(screenshot)await page.screenshot({path:join(screenshot,'diary-light-390-full.png'),fullPage:true});
    // Earlier days.
    await page.getByRole('button',{name:'Show earlier days'}).click();
    await page.getByText('That is the start of the diary.').waitFor();
    check(await page.locator('.diary-day').count()===13,'engineer: earlier days load below, to the start');
    // Filter: defects only.
    await page.getByRole('button',{name:'Defects'}).click();await page.waitForURL(/show=defect/);
    await page.locator('.diary-count').filter({hasText:'Matching'}).waitFor();
    check(/Matching: 2 site days · 2 reports/.test(await page.locator('.diary-count').innerText()),'filter: defects narrow the diary');
    const partial=await entry(page,rev2.reference).innerText();
    check(!partial.includes('Containment run complete')&&partial.includes('Fire stopping missing')&&/Showing 1 of 3 cards/.test(partial),`filter: only the defect card shows, saying the report has more: ${partial.slice(0,300)}`);
    // Words, kept in the address.
    await page.getByRole('button',{name:'Everything'}).click();
    await page.getByLabel('Find').fill('drainage');await page.waitForURL(/q=drainage/);
    await page.locator('.diary-count').filter({hasText:'1 report'}).waitFor();
    check(await page.locator('.diary-entry').count()===1&&await entry(page,theirs.reference).count()===1,'find: words narrow to the matching report');
    if(screenshot)await page.screenshot({path:join(screenshot,'diary-find-light-390.png')});
    await page.getByLabel('Find').fill('nothing like this');await page.getByText('Nothing in the diary matches').waitFor();
    await page.getByRole('button',{name:'Clear the find box and filter'}).click();await page.locator('.diary-count').filter({hasText:/^13 site days/}).waitFor();
    check(true,'find: no match says so and offers to clear');
    // A report opened from the diary comes back to it, words kept.
    await page.getByLabel('Find').fill('riser');await page.waitForURL(/q=riser/);await entry(page,rev2.reference).waitFor();
    await entry(page,rev2.reference).getByRole('link',{name:rev2.reference,exact:true}).click();await page.waitForURL(`**/reports/${rev2.id}**`);
    await page.locator('a.back').first().click();await page.waitForURL(/\/diary\?.*q=riser/);await entry(page,rev2.reference).waitFor();
    check(await page.getByLabel('Find').inputValue()==='riser','engineer: back from a report returns to the diary with the words kept');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/engineer\?project=proj-011lme$/);
    check(true,'engineer: back returns to the engineer home');
    // The Reports view links it too.
    await page.goto(`${base}/engineer?project=proj-011lme&view=reports`);
    check(await page.getByRole('link',{name:'Site diary'}).count()===1,'engineer: the Reports view offers the site diary');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Office, desktop, dark: from the project's actions.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects`);await page.locator('.glance-row').filter({hasText:'011LME'}).first().click();
    await page.getByRole('link',{name:'Site diary'}).click();await page.waitForURL(/\/diary\?/);await page.locator('.diary-entry').first().waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','office: opens on the chosen project');
    check(/13 site days · 14 reports/.test(await page.locator('.diary-count').innerText()),'office: same diary as the engineer, no drafts');
    if(screenshot)await page.screenshot({path:join(screenshot,'diary-dark-1440.png'),fullPage:false});
    await entry(page,rev2.reference).getByRole('link',{name:/011LME-ISS-401/}).click();await page.waitForURL('**/issues/diary-issue**');
    await page.goBack();await page.locator('.diary-entry').first().waitFor();
    check(true,'office: an issue opens from the diary and back returns');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/office/);
    check(true,'office: back returns to the office');
    // A project with nothing sent yet says so plainly.
    await page.goto(`${base}/diary?project=proj-014lme`);await page.getByText('No site visits yet').waitFor();
    check(true,'office: an empty diary says so');
    const res=await page.request.get(`${base}/api/site-diary?projectId=no-such-project`);
    check(res.status()===404,`unknown project: refused (${res.status()})`);
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }
  console.log(`Site diary check passed (${checks} checks): engineer and office routes, revisions, linked records, photographs, filters, paging, access, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
