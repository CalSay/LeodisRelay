// Browser check for the photo library: one project's photographs from sent
// reports and later issue evidence, opened from the engineer Reports view and
// the office project, with the find box, the kind filter, the Day choice and the viewer.
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
const root=mkdtempSync(join(tmpdir(),'relay-photos-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {londonDay,shiftWeek}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {dayShort}=require('../apps/web/.test-build/lib/dates.js');
const engineer={id:'entra:photo-engineer',oid:'photo-engineer',name:'Photo Engineer',email:'photo@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:photo-other',oid:'photo-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:photo-manager',oid:'photo-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const today=londonDay(new Date()),earlier=shiftWeek(today,-1),now=new Date().toISOString();
const colours=['#8a6f2c','#3b6e8f','#6e3b3b','#3b6e4a','#555555','#777777'];
const photo=async(n,owner)=>{const id=randomUUID();await putMedia(id,{...owner,ownerId:engineer.id,mime:'image/png'},await sharp({create:{width:640,height:480,channels:3,background:colours[n]}}).png().toBuffer());return {id,dataUrl:`/api/media/${id}`,caption:n===1?'Before boarding':'',capturedAt:now};};
const card=(type,location,whatHappened,photos)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos});
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',visitDate:today,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const ids={sent:randomUUID(),older:randomUUID(),draft:randomUUID(),elsewhere:randomUUID(),issue:randomUUID()};
const corridor=await photo(0,{reportId:ids.sent}),plant=await photo(1,{reportId:ids.sent}),roof=await photo(2,{reportId:ids.older});
const fixed=await photo(3,{issueId:ids.issue}),private_=await photo(4,{reportId:ids.draft}),away=await photo(5,{reportId:ids.elsewhere});
const sent=report({id:ids.sent,reference:'011LME-SPR-201',observations:[card('update','Level 2 corridor','Containment run complete',[corridor]),card('defect','Plant room','Cable tray lid missing',[plant])]});
const older=report({id:ids.older,reference:'011LME-SPR-190',visitDate:earlier,observations:[card('update','Roof','Roof platform first fix',[roof])]});
report({id:ids.draft,reference:'011LME-SPR-202',author:other.name,authorId:other.id,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:now,observations:[card('update','Plant room','Private draft',[private_])]});
report({id:ids.elsewhere,reference:'014LME-SPR-001',projectId:'proj-014lme',observations:[card('update','Elsewhere','Other project',[away])]});
const issue={id:ids.issue,reference:'011LME-ISS-301',projectId:'proj-011lme',location:'Plant room',description:'Cable tray lid missing',actionNeeded:'Fit lid',confirmation:'confirmed',work:'awaiting_verification',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:sent.id,source:'report',raisedAt:now,
  events:[{at:now,actor:engineer.name,kind:'raised',note:'Cable tray lid missing',photos:[plant]},{at:now,actor:engineer.name,kind:'closure_submitted',note:'Lid fitted',photos:[fixed]}]};
putRecord('issues',issue);
const port=4337,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-photo-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const tiles=page=>page.locator('.photos-tile');
const loaded=page=>page.locator('.photos-tile img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0));
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width,height=900)=>{const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: sent to sign in, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/photos?project=proj-011lme`);await page.waitForURL(/\/signin/);
    check(true,'signed out: the page asks for sign-in');
    const res=await page.request.get(`${base}/api/photos?projectId=proj-011lme`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer, phone width, light.
  {
    const {context,page,errors}=await open('Engineer','light',390,844);
    await page.goto(`${base}/engineer?project=proj-011lme&view=reports`);
    const link=page.getByRole('link',{name:'Photographs'});await link.waitFor();
    check(true,'engineer: Reports view offers the photographs');
    if(screenshot)await page.screenshot({path:join(screenshot,'reports-view-light-390.png')});
    await link.click();await page.waitForURL(/\/photos\?/);await tiles(page).first().waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','engineer: opens on the current project');
    check((await tiles(page).count())===4,`engineer: four photographs (${await tiles(page).count()})`);
    check(/^4 photographs$/.test((await page.locator('.photos-count').innerText()).trim()),'engineer: the count says four');
    const text=await page.locator('main').innerText();
    check(!text.includes('Private draft')&&!text.includes('Elsewhere'),'engineer: another engineer\'s draft and another project are left out');
    const days=await page.locator('.photos-day h2').allInnerTexts();
    check(days.length===2&&/3 photographs/.test(days[0])&&/1 photograph$/.test(days[1].trim()),`engineer: grouped by day, newest first: ${JSON.stringify(days)}`);
    // Thumbnails load lazily, so bring each into view before checking it.
    for(const img of await page.locator('.photos-tile img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.complete&&i.naturalWidth>0||new Promise((ok,fail)=>{i.onload=ok;i.onerror=()=>fail(Error(`thumbnail failed: ${i.src}`));}));}
    check(await loaded(page),'engineer: every thumbnail loads');
    await page.evaluate(()=>window.scrollTo(0,0));
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    const across=await tiles(page).evaluateAll(t=>new Set(t.slice(0,3).map(x=>Math.round(x.getBoundingClientRect().top))).size);
    check(across===1,'engineer: three photographs across on a phone');
    if(screenshot)await page.screenshot({path:join(screenshot,'photos-light-390.png'),fullPage:true});

    // Find box: words anywhere, kept in the address.
    await page.getByLabel('Find').fill('plant');
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===2);
    check(/2 of 4 photographs/.test(await page.locator('.photos-count').innerText()),'find: "plant" finds the defect and the fix in the plant room');
    check(new URL(page.url()).searchParams.get('q')==='plant','find: the words are kept in the address');
    await page.getByLabel('Find').fill('lid fitted');
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check(true,'find: the note on the fix is searchable');
    await page.getByLabel('Find').fill('nothing like this');
    await page.getByText('No photographs match').waitFor();
    await page.getByRole('button',{name:'Clear the find box and filter'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===4);
    check(true,'find: no match says so, and clearing brings all four back');

    // Kind filter.
    await page.getByRole('button',{name:'Fixes and checks'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check((await tiles(page).first().innerText()).includes('Plant room')&&new URL(page.url()).searchParams.get('show')==='fix','filter: fixes and checks shows the fix photograph');
    await page.getByRole('button',{name:'Defects and access'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check(true,'filter: the defect photograph, copied onto its issue, shows once');
    await page.getByRole('button',{name:'All',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===4);

    // Day choice: each day with photographs and its count, one day at a time, kept in the address.
    const day=page.getByRole('combobox',{name:/^Day/});
    const options=await day.locator('option').evaluateAll(o=>o.map(x=>x.textContent));
    check(JSON.stringify(options)===JSON.stringify(['Every day',`${dayShort(today,true)} · 3 photographs`,`${dayShort(earlier,true)} · 1 photograph`]),`day: every day, then each day newest first with its count: ${JSON.stringify(options)}`);
    await day.selectOption(earlier);
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check((await tiles(page).first().innerText()).includes('Roof')&&new URL(page.url()).searchParams.get('day')===earlier,'day: an earlier day shows only its photograph, and the day is in the address');
    check((await page.locator('.photos-count').innerText()).trim()===`1 of 4 photographs on ${dayShort(earlier,true)}`,'day: the count names the day');
    const step=page.getByRole('navigation',{name:'Move by a day'});
    check(await step.getByRole('button',{name:/Older day/}).isDisabled(),'day: no older day with photographs, so Older day is off');
    check((await step.getByRole('button',{name:/Newer day/}).innerText()).includes(dayShort(today,true)),'day: Newer day names the day it goes to');
    const sw=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(sw<=390,`day: no sideways scroll at 390px (${sw})`);
    const small=await step.getByRole('button').evaluateAll(b=>b.map(x=>x.getBoundingClientRect().height).filter(h=>h<44));
    check(!small.length,`day: the day buttons are at least 44px tall (${JSON.stringify(small)})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'photos-day-light-390.png'),fullPage:true});
    await step.getByRole('button',{name:/Newer day/}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===3);
    check(await day.inputValue()===today&&await step.getByRole('button',{name:/Newer day/}).isDisabled(),'day: Newer day steps to today, the newest');
    await step.getByRole('button',{name:/Older day/}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check(await day.inputValue()===earlier,'day: Older day steps back');
    await page.getByLabel('Find').fill('plant');
    await page.getByText(`No photographs match on ${dayShort(earlier,true)}`).waitFor();
    await page.getByRole('button',{name:'Clear the find box and filter'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check(await day.inputValue()===earlier,'day: no match on the day says so, and clearing the words keeps the day');
    await step.getByRole('button',{name:'Every day'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===4);
    check(!new URL(page.url()).searchParams.has('day')&&!(await step.count()),'day: Every day brings all four back and leaves the address');

    // Viewer: large copy, details, stepping, and the record it came from.
    await page.getByRole('button',{name:/Open photograph: Defect, Plant room/}).click();
    const viewer=page.locator('dialog.photos-viewer[open]');await viewer.waitFor();
    const v=await viewer.innerText();
    check(v.includes('Plant room')&&v.includes('Before boarding')&&v.includes('Cable tray lid missing')&&v.includes(engineer.name),`viewer: place, caption, what was found and who: ${JSON.stringify(v)}`);
    await page.waitForFunction(()=>{const i=document.querySelector('.photos-viewer-image img');return i&&i.complete&&i.naturalWidth>=600;});
    check((await viewer.locator('.photos-viewer-image img').getAttribute('src')).endsWith('?variant=pdf'),'viewer: shows the larger copy, not the thumbnail');
    const where=(await viewer.locator('.photos-viewer-bar').innerText()).match(/(\d+) of 4/)?.[1];
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(n=>document.querySelector('.photos-viewer-bar')?.textContent?.includes(`${n} of 4`),Number(where)+1);
    check(true,'viewer: the right arrow key steps to the next photograph');
    await viewer.getByRole('button',{name:/Newer/}).click();
    await page.waitForFunction(n=>document.querySelector('.photos-viewer-bar')?.textContent?.includes(`${n} of 4`),Number(where));
    check(true,'viewer: Newer steps back');
    if(screenshot)await page.screenshot({path:join(screenshot,'photos-viewer-light-390.png')});
    const vw=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(vw<=390,`viewer: no sideways scroll at 390px (${vw})`);
    await viewer.getByRole('link',{name:`Open report ${sent.reference}`}).click();await page.waitForURL(`**/reports/${sent.id}**`);
    check(true,'viewer: opens the report the photograph came from');
    await page.goBack();await page.waitForURL(/\/photos\?/);await tiles(page).first().waitFor();
    check(true,'back from a report returns to the photographs');
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/engineer\?project=proj-011lme&view=reports/);
    check(true,'engineer: back returns to the Reports view');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Office, desktop, dark: from the project's actions.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects`);await page.locator('.glance-row').filter({hasText:'011LME'}).first().click();
    await page.getByRole('link',{name:'Photographs'}).click();await page.waitForURL(/\/photos\?/);await tiles(page).first().waitFor();
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','office: opens on the chosen project');
    check((await tiles(page).count())===4,'office: the same four photographs, no drafts');
    const across=await tiles(page).evaluateAll(t=>new Set(t.map(x=>Math.round(x.getBoundingClientRect().top))).size);
    check(across===2,'office: each day is one row of tiles at 1440px');
    await page.waitForFunction(()=>[...document.querySelectorAll('.photos-tile img')].every(i=>i.complete&&i.naturalWidth>0));
    if(screenshot)await page.screenshot({path:join(screenshot,'photos-dark-1440.png'),fullPage:true});
    await page.getByRole('button',{name:/Open photograph: Put forward as fixed/}).click();
    const viewer=page.locator('dialog.photos-viewer[open]');await viewer.waitFor();
    check(await viewer.getByRole('link',{name:`Open issue ${issue.reference}`}).isVisible(),'office: a fix photograph opens its issue');
    if(screenshot)await page.screenshot({path:join(screenshot,'photos-viewer-dark-1440.png')});
    await viewer.getByRole('button',{name:'Close'}).click();
    check(!(await page.locator('dialog.photos-viewer[open]').count()),'office: Close shuts the viewer');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/office/);
    check(true,'office: back returns to the office');
    // A link to a day opens on it, and Back from a record keeps it.
    await page.goto(`${base}/photos?project=proj-011lme&day=${earlier}`);
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check(await page.getByRole('combobox',{name:/^Day/}).inputValue()===earlier,'office: a link with a day opens on that day');
    if(screenshot)await page.screenshot({path:join(screenshot,'photos-day-dark-1440.png'),fullPage:true});
    await tiles(page).first().click();
    await page.locator('dialog.photos-viewer[open]').getByRole('link',{name:`Open report ${older.reference}`}).click();await page.waitForURL(`**/reports/${older.id}**`);
    await page.getByRole('link',{name:/^← Back to /}).first().click();await page.waitForURL(/\/photos\?/);
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===1);
    check(new URL(page.url()).searchParams.get('day')===earlier,'office: Back from the report returns to the same day');
    await page.getByRole('combobox',{name:/^Project/}).selectOption('proj-014lme');
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('project')==='proj-014lme');
    check(await page.getByRole('combobox',{name:/^Day/}).inputValue()===''&&!new URL(page.url()).searchParams.has('day'),'office: choosing another project goes back to every day');
    // A quiet day says so; a day that is not a date is ignored.
    const quiet=shiftWeek(earlier,-1);
    await page.goto(`${base}/photos?project=proj-011lme&day=${quiet}`);
    await page.getByText(`No photographs were sent on ${dayShort(quiet,true)}`).waitFor();
    check((await page.getByRole('combobox',{name:/^Day/}).locator('option:checked').textContent())===`${dayShort(quiet,true)} · 0 photographs`,'office: a day with no photographs says so and stays chosen');
    await page.goto(`${base}/photos?project=proj-011lme&day=2026-02-30`);
    await page.waitForFunction(()=>document.querySelectorAll('.photos-tile').length===4);
    check(await page.getByRole('combobox',{name:/^Day/}).inputValue()==='','office: a day that is not a date opens every day');
    // A project with no photographs says so.
    await page.goto(`${base}/photos?project=proj-009lcp`);await page.getByText('No photographs yet').waitFor();
    check(true,'office: an empty project says so');
    check(JSON.stringify(await page.getByRole('combobox',{name:/^Day/}).locator('option').evaluateAll(o=>o.map(x=>x.textContent)))==='["Every day"]','office: an empty project offers only Every day');
    const res=await page.request.get(`${base}/api/photos?projectId=no-such-project`);
    check(res.status()===404,`unknown project: refused (${res.status()})`);
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // No project chosen: the page asks for one.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/photos`);
    await page.getByText('Choose a project to see its photographs.').waitFor();
    check(true,'no project: asks for one');
    assert.deepEqual(errors,[],'empty: page errors');
    await context.close();
  }
  console.log(`Photo library check passed (${checks} checks): engineer and office routes, drafts and other projects left out, find, filter, day, viewer, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
