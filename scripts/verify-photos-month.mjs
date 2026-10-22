// Browser check for the Month choice on Photographs: one calendar month of one
// project's photographs, grouped by day, with the same months and Previous,
// This and Next month steps as the Weekly summary's Month choice. Checks the
// counts, a month with none, the Day choice staying inside the month, links
// that name a month, the Weekly summary's link to its month, Back from a
// record, light and dark at 1440 and 1024, and no sideways scroll at 390.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves photos-month-*.png.
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
const root=mkdtempSync(join(tmpdir(),'relay-photos-month-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {monthOf,shiftMonth,monthName}=require('../apps/web/.test-build/lib/monthSummary.js');
const {dayShort}=require('../apps/web/.test-build/lib/dates.js');
const engineer={id:'entra:pm-engineer',oid:'pm-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:pm-manager',oid:'pm-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}

// This month, last month (two days), a month with none, and the month before that.
const today=londonDay(new Date()),T=monthOf(undefined,today),M1=shiftMonth(T,-1),M2=shiftMonth(T,-2),M3=shiftMonth(T,-3);
const d03=`${M1}-03`,d20=`${M1}-20`,d10=`${M3}-10`;
const now=new Date().toISOString();
let colour=0;const COLOURS=['#8a6f2c','#3b6e8f','#6e3b3b','#3b6e4a','#5b4a7a','#7a5b3b','#2f6b6b','#6b2f5a'];
const photo=async(owner,day)=>{const id=randomUUID();await putMedia(id,{...owner,ownerId:engineer.id,mime:'image/png'},await sharp({create:{width:640,height:480,channels:3,background:COLOURS[colour++%COLOURS.length]}}).png().toBuffer());return {id,dataUrl:`/api/media/${id}`,caption:'',capturedAt:`${day}T10:00:00.000Z`};};
const card=(type,location,whatHappened,photos)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos});
let n=0;
const report=async(day,cards)=>{const id=randomUUID();const r={id,projectId:'proj-011lme',reference:`011LME-SPR-${String(++n).padStart(3,'0')}`,visitDate:day,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,
  observations:await Promise.all(cards.map(async([type,place,text,count])=>card(type,place,text,await Promise.all(Array.from({length:count},()=>photo({reportId:id},day))))))};putRecord('reports',r);return r;};
await report(today,[['update','Plant room','Pumps commissioned',1],['update','Roof','Roof platform handed over',1]]);
const early=await report(d03,[['update','Level 2 corridor','Containment run complete',1],['defect','Flat 101','Socket faceplate cracked',1]]);
await report(d20,[['update','Bin store','Lighting second fix',1]]);
await report(d10,[['update','Switch room','Board dressed',1]]);
const issueId=randomUUID();
putRecord('issues',{id:issueId,reference:'011LME-ISS-301',projectId:'proj-011lme',location:'Level 3 riser',description:'Fire stopping missing',actionNeeded:'Fire stop',confirmation:'confirmed',work:'awaiting_verification',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',source:'individual',raisedAt:`${d03}T09:00:00.000Z`,
  events:[{at:`${d20}T14:00:00.000Z`,actor:engineer.name,kind:'closure_submitted',note:'Fire stopping done',photos:[await photo({issueId},d20)]}]});
// Another project's photograph never counts here.
putRecord('reports',{id:randomUUID(),projectId:'proj-014lme',reference:'014LME-SPR-001',visitDate:d20,author:engineer.name,authorId:engineer.id,state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[card('update','Elsewhere','Other project',[await photo({reportId:'x'},d20)])]});
const TOTAL=7;

const port=4398,base=`http://127.0.0.1:${port}`;let output='';
assert.ok(await fetch(base+'/signin').then(()=>false,()=>true),`Port ${port} is already in use: stop the server an earlier run left behind.`);
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-photos-month-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const tiles=page=>page.locator('.photos-tile');
const count=(page,k)=>page.waitForFunction(k=>document.querySelectorAll('.photos-tile').length===k&&!document.querySelector('[role=status]')?.textContent?.startsWith('Loading'),k);
const options=sel=>sel.locator('option').evaluateAll(o=>o.map(x=>x.textContent));
const param=(page,k)=>new URL(page.url()).searchParams.get(k);
const word=ym=>monthName(ym).split(' ')[0];
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  const open=async(role,scheme,width,height=900)=>{const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const thumbs=async page=>{for(const img of await page.locator('.photos-tile img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.complete&&i.naturalWidth>0||new Promise((ok,fail)=>{i.onload=ok;i.onerror=()=>fail(Error(`thumbnail failed: ${i.src}`));}));}await page.evaluate(()=>window.scrollTo(0,0));};

  // Office, 1440, light: the whole walk.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/photos?project=proj-011lme`);await count(page,TOTAL);
    const month=page.getByRole('combobox',{name:/^Month/}),day=page.getByRole('combobox',{name:/^Day/});
    const expected=['Every month',`${monthName(T)} · 2 photographs`,`${monthName(M1)} · 4 photographs`,`${monthName(M3)} · 1 photograph`];
    check(JSON.stringify(await options(month))===JSON.stringify(expected),`month: every month, then each month with photographs, newest first, with its count: ${JSON.stringify(await options(month))}`);
    check(!(await page.getByRole('navigation',{name:'Move by a month'}).count()),'month: no month steps until a month is chosen');

    await month.selectOption(M1);await count(page,4);
    check(param(page,'month')===M1,'month: the month is kept in the address');
    check((await page.locator('.photos-count').innerText()).trim()===`4 of ${TOTAL} photographs in ${monthName(M1)}`,`month: the count names the month (${await page.locator('.photos-count').innerText()})`);
    const heads=await page.locator('.photos-day h2').allInnerTexts();
    check(heads.length===2&&heads[0].startsWith(dayShort(d20,true))&&heads[1].startsWith(dayShort(d03,true))&&heads.every(h=>/2 photographs$/.test(h.trim())),`month: grouped by day, newest first: ${JSON.stringify(heads)}`);
    check(await page.getByRole('button',{name:/Open photograph: Put forward as fixed, Level 3 riser/}).count()===1,'month: a fix added to an issue that month is in it');
    check(JSON.stringify(await options(day))===JSON.stringify([`Every day in ${monthName(M1)}`,`${dayShort(d20,true)} · 2 photographs`,`${dayShort(d03,true)} · 2 photographs`]),`month: the Day choice lists only the month's days: ${JSON.stringify(await options(day))}`);
    const step=page.getByRole('navigation',{name:'Move by a month'});
    const labels=await step.getByRole('button').allInnerTexts();
    check(JSON.stringify(labels.map(s=>s.trim()))===JSON.stringify(['← Previous month','This month','Next month →']),`month: the same steps as the Weekly summary: ${JSON.stringify(labels)}`);
    check(!(await step.getByRole('button',{name:'This month'}).isDisabled())&&!(await step.getByRole('button',{name:/Next month/}).isDisabled()),'month: This month and Next month are on for last month');
    const small=await step.getByRole('button').evaluateAll(b=>b.map(x=>x.getBoundingClientRect().height).filter(h=>h<44));
    check(!small.length,`month: the month buttons are at least 44px tall (${JSON.stringify(small)})`);

    // Viewer, record and Back keep the month.
    await tiles(page).last().click();
    const viewer=page.locator('dialog.photos-viewer[open]');await viewer.waitFor();
    check((await viewer.locator('.photos-viewer-bar').innerText()).includes('4 of 4'),'month: the viewer steps through the month only');
    await viewer.getByRole('link',{name:`Open report ${early.reference}`}).click();await page.waitForURL(`**/reports/${early.id}**`);
    await page.getByRole('link',{name:/^← Back to /}).first().click();await page.waitForURL(/\/photos\?/);await count(page,4);
    check(param(page,'month')===M1&&await month.inputValue()===M1,'month: Back from a report returns to the same month');

    // A day inside the month: stepping stays in the month; "All of" goes back to it.
    await day.selectOption(d03);await count(page,2);
    check(param(page,'month')===M1&&param(page,'day')===d03,'day in month: both kept in the address');
    check((await page.locator('.photos-count').innerText()).trim()===`2 of ${TOTAL} photographs on ${dayShort(d03,true)}`,'day in month: the count names the day');
    check(!(await step.count()),'day in month: the day steps show, not the month steps');
    const dstep=page.getByRole('navigation',{name:'Move by a day'});
    check(await dstep.getByRole('button',{name:/Older day/}).isDisabled(),`day in month: Older day stays inside ${monthName(M1)}, though ${monthName(M3)} has photographs`);
    await dstep.getByRole('button',{name:/Newer day/}).click();await count(page,2);
    check(await day.inputValue()===d20&&await dstep.getByRole('button',{name:/Newer day/}).isDisabled(),`day in month: Newer day goes to ${d20} and no further`);
    await dstep.getByRole('button',{name:`All of ${word(M1)}`}).click();await count(page,4);
    check(param(page,'day')===null&&param(page,'month')===M1,`day in month: "All of ${word(M1)}" goes back to the month`);

    // The find box narrows the months' counts too.
    await page.getByLabel('Find').fill('riser');await count(page,1);
    check((await month.locator('option:checked').textContent())===`${monthName(M1)} · 1 photograph`,'find: the month\'s count is what the find box leaves');
    await page.getByLabel('Find').fill('');await count(page,4);
    if(shots){await thumbs(page);await page.screenshot({path:join(shots,'photos-month-light-1440.png'),fullPage:true});}

    // Previous month into a month with none, then the oldest; This month; Next month off.
    await step.getByRole('button',{name:/Previous month/}).click();
    await page.getByText(`No photographs were sent in ${monthName(M2)}. Choose another month, or every month.`).waitFor();
    check((await month.locator('option:checked').textContent())===`${monthName(M2)} · 0 photographs`&&param(page,'month')===M2,'month: a month with none says so and stays chosen');
    if(shots)await page.screenshot({path:join(shots,'photos-month-none-light-1440.png'),fullPage:true});
    await step.getByRole('button',{name:/Previous month/}).click();await count(page,1);
    check(await step.getByRole('button',{name:/Previous month/}).isDisabled(),'month: Previous month is off at the oldest month with photographs');
    await step.getByRole('button',{name:'This month'}).click();await count(page,2);
    check(await month.inputValue()===T&&await step.getByRole('button',{name:'This month'}).isDisabled()&&await step.getByRole('button',{name:/Next month/}).isDisabled(),'month: This month goes to this month; This month and Next month are then off');
    await step.getByRole('button',{name:/Previous month/}).click();await count(page,4);
    check(await month.inputValue()===M1,'month: Previous month steps back one month');
    await month.selectOption('');await count(page,TOTAL);
    check(param(page,'month')===null&&!(await step.count()),'month: Every month brings every photograph back and leaves the address');

    // Choosing another project goes back to every month.
    await month.selectOption(M1);await count(page,4);
    await page.getByRole('combobox',{name:/^Project/}).selectOption('proj-014lme');
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('project')==='proj-014lme');
    check(await month.inputValue()===''&&param(page,'month')===null,'project: choosing another project goes back to every month');

    // Links that name a month.
    await page.goto(`${base}/photos?project=proj-011lme&month=${M1}&day=${d10}`);await count(page,1);
    check(await month.inputValue()===M3&&await day.inputValue()===d10,'link: a day outside the month named opens the day, in its own month');
    await page.goto(`${base}/photos?project=proj-011lme&month=${shiftMonth(T,2)}`);await count(page,2);
    check(await month.inputValue()===T,'link: a month after this one opens this month');
    await page.goto(`${base}/photos?project=proj-011lme&month=${shiftMonth(T,2)}&day=${shiftMonth(T,2)}-03`);await count(page,2);
    check(await month.inputValue()===T&&await day.inputValue()===''&&param(page,'day')===null,'link: a day in a month after this one is dropped with its month');
    await page.goto(`${base}/photos?project=proj-011lme&month=2026-13`);await count(page,TOTAL);
    check(await month.inputValue()==='','link: a month that is not a month opens every month');

    // The Weekly summary's Month choice links to the month's photographs.
    await page.goto(`${base}/weekly-summary?project=proj-011lme&period=month&month=${M1}`);
    const link=page.getByRole('link',{name:`Every photograph from ${monthName(M1)}, by day`});await link.waitFor();
    check(true,'weekly summary: the month offers every photograph from it');
    await link.click();await page.waitForURL(/\/photos\?/);await count(page,4);
    check(param(page,'month')===M1&&param(page,'project')==='proj-011lme','weekly summary: opens Photographs on that month');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/weekly-summary\?/);
    check(param(page,'period')==='month'&&param(page,'month')===M1,'weekly summary: Back returns to the same month');
    assert.deepEqual(errors,[],'office 1440: page errors');
    await context.close();
  }

  // Office at 1440 dark and 1024 light and dark: fits, no sideways scroll, controls on as few rows as fit.
  for(const [scheme,width] of [['dark',1440],['light',1024],['dark',1024]]){
    const {context,page,errors}=await open('Manager',scheme,width);
    await page.goto(`${base}/photos?project=proj-011lme&month=${M1}`);await count(page,4);
    const sw=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(sw<=width,`${scheme} ${width}: no sideways scroll (${sw})`);
    const rows=await page.locator('.photos-controls > label').evaluateAll(l=>new Set(l.map(x=>Math.round(x.getBoundingClientRect().top))).size);
    check(rows===2,`${scheme} ${width}: Project and Month, then Day and Find, two by two (${rows})`);
    const cut=await page.locator('.photos-controls select').evaluateAll(s=>s.filter(x=>{const c=document.createElement('canvas').getContext('2d');const st=getComputedStyle(x);c.font=`${st.fontSize} ${st.fontFamily}`;return c.measureText(x.options[x.selectedIndex].text).width>x.clientWidth-40;}).map(x=>x.value));
    check(!cut.length,`${scheme} ${width}: the chosen project, month and day are not cut off (${JSON.stringify(cut)})`);
    if(shots){await thumbs(page);await page.screenshot({path:join(shots,`photos-month-${scheme}-${width}.png`),fullPage:true});}
    assert.deepEqual(errors,[],`${scheme} ${width}: page errors`);
    await context.close();
  }

  // Engineer on a phone: the same month, no sideways scroll.
  {
    const {context,page,errors}=await open('Engineer','light',390,844);
    await page.goto(`${base}/photos?project=proj-011lme&month=${M1}`);await count(page,4);
    const sw=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(sw<=390,`engineer 390: no sideways scroll (${sw})`);
    const step=page.getByRole('navigation',{name:'Move by a month'});
    const overflow=await step.getByRole('button').evaluateAll(b=>b.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent));
    check(!overflow.length,`engineer 390: the month buttons' words fit (${JSON.stringify(overflow)})`);
    if(shots){await thumbs(page);await page.screenshot({path:join(shots,'photos-month-light-390.png'),fullPage:true});}
    assert.deepEqual(errors,[],'engineer 390: page errors');
    await context.close();
  }
  console.log(`Photographs by month check passed (${checks} checks): month choices and counts, grouped by day, a month with none, month steps, days inside the month, links, Weekly summary link, Back, 1440 and 1024 light and dark, 390.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
