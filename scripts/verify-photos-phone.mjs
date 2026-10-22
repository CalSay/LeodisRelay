// Browser check for Photographs on a phone (busy seed, 390x844): the first
// screen shows photographs, and choosing a month or a day, stepping a day, or
// opening a link that names a day brings the count, the day steps and the
// photographs up under the top bar, so nothing needs scrolling to see what
// was chosen. Typing in the find box and changing project do not move the
// page, and at 1440 nothing moves and the titles and line under the heading
// stay. Engineer and office manager, light and dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves photos-phone-*.png.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {seedBusyProjects,PEOPLE} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-photos-phone-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
seedBusyProjects({storagePath,today:londonDay(new Date()),days:60});
const sessions={};
for(const k of ['engineer','manager']){sessions[k]=randomUUID();putRecord('sessions',{id:sessions[k],principal:PEOPLE[k],issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});}
const port=4492,base=`http://127.0.0.1:${port}`;let output='';
assert.ok(await fetch(base+'/signin').then(()=>false,()=>true),`Port ${port} is already in use: stop the server an earlier run left behind.`);
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-photos-phone-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};

// Runs in the page: where the count line, the day steps and the first photograph sit against the top bar and the screen.
const where=()=>{
  const r=s=>document.querySelector(s)?.getBoundingClientRect();
  const bar=r('.appbar'),count=r('.photos-count'),steps=r('.photos-day-step'),tile=r('.photos-tile');
  return {bar:bar?.bottom??0,count:count?.top,steps:steps?{top:steps.top,bottom:steps.bottom}:null,tile:tile?{top:tile.top,bottom:tile.bottom}:null,
    scrollY:Math.round(scrollY),height:innerHeight,text:document.querySelector('.photos-count')?.textContent??'',sideways:document.documentElement.scrollWidth>innerWidth+1,
    intro:!!document.querySelector('.photos-intro')?.offsetHeight,titles:[...document.querySelectorAll('.photos-when .photos-label')].map(e=>e.getBoundingClientRect().height)};
};
const loaded=page=>page.waitForFunction(()=>document.querySelector('.photos-tile')&&!document.querySelector('[role=status]')?.textContent?.startsWith('Loading'));
const settle=page=>page.waitForTimeout(250);
// Brought into view: the count line just under the top bar, the day steps (if any) and a whole first row of photographs on the screen.
const inView=(m,label)=>{
  check(m.count!==undefined&&m.count>=m.bar-1&&m.count<=m.bar+24,`${label}: the count line sits just under the top bar (count ${m.count}, bar ${m.bar})`);
  if(m.steps)check(m.steps.top>=m.bar-1&&m.steps.bottom<=m.height,`${label}: the day steps are on the screen`);
  check(m.tile&&m.tile.bottom<=m.height,`${label}: a whole first row of photographs is on the screen (tile bottom ${m.tile?.bottom}, screen ${m.height})`);
};

try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const open=async(who,scheme,width,height)=>{const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[who],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  for(const [who,scheme] of [['engineer','light'],['manager','dark']]){
    const {context,page,errors}=await open(who,scheme,390,844);
    await page.goto(`${base}/photos?project=proj-011lme`);await loaded(page);
    let m=await page.evaluate(where);
    check(m.tile&&m.tile.top<m.height-60,`${who}: photographs show on the first screen (first at ${m.tile?.top}px of ${m.height})`);
    check(!m.intro,`${who}: the line under the heading is left off on a phone`);
    check(m.titles.length===2&&m.titles.every(h=>h<=1),`${who}: Month and Day have no visible title on a phone`);
    const month=page.getByRole('combobox',{name:/^Month/}),day=page.getByRole('combobox',{name:/^Day/});
    check(await month.count()===1&&await day.count()===1,`${who}: Month and Day keep their names for screen readers`);
    check(!m.sideways,`${who}: no sideways scroll`);
    if(shots)await page.screenshot({path:`${shots}/photos-phone-${who}-${scheme}-landed.png`});

    const days=await day.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    await day.selectOption(days[7]);await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: after choosing a day`);
    check(new URL(page.url()).searchParams.get('day')===days[7],`${who}: the chosen day is in the address`);
    if(shots)await page.screenshot({path:`${shots}/photos-phone-${who}-${scheme}-day.png`});

    const before=m.text;await page.getByRole('button',{name:/^Older day/}).click();await settle(page);m=await page.evaluate(where);
    check(m.text!==before&&new URL(page.url()).searchParams.get('day')===days[8],`${who}: Older day moves to the next day with photographs`);
    inView(m,`${who}: after Older day`);
    await page.getByRole('button',{name:/^Newer day/}).click();await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: after Newer day`);
    await page.locator('.photos-day-step').getByRole('button',{name:'Every day'}).click();await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: after Every day`);

    const months=await month.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    await page.evaluate(()=>window.scrollTo(0,0));await month.selectOption(months[1]);await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: after choosing a month`);
    await page.getByRole('button',{name:/Previous month/}).click();await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: after Previous month`);
    if(shots)await page.screenshot({path:`${shots}/photos-phone-${who}-${scheme}-month.png`});

    // Typing in the find box and changing project leave the page where it is.
    await page.evaluate(()=>window.scrollTo(0,0));await page.getByRole('textbox',{name:/^Find/}).fill('riser');await settle(page);
    check((await page.evaluate(where)).scrollY===0,`${who}: typing in the find box does not move the page`);
    await page.getByRole('combobox',{name:/^Project/}).selectOption('proj-014lme');await loaded(page);await settle(page);
    check((await page.evaluate(where)).scrollY===0,`${who}: changing project does not move the page`);

    // A link that names a day, as a visit's "N photographs" on the Weekly summary does.
    await page.goto(`${base}/photos?project=proj-011lme&day=${days[3]}`);await loaded(page);await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: a link naming a day`);
    await page.goto(`${base}/photos?project=proj-011lme&month=${months[1]}`);await loaded(page);await settle(page);m=await page.evaluate(where);
    inView(m,`${who}: a link naming a month`);
    check(!m.sideways,`${who}: no sideways scroll with a day chosen`);
    check(!errors.length,`${who}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }

  // A wide screen is as before: nothing moves, the titles and the line under the heading stay.
  {
    const {context,page,errors}=await open('manager','light',1440,900);
    await page.goto(`${base}/photos?project=proj-011lme`);await loaded(page);
    let m=await page.evaluate(where);
    check(m.intro,'1440: the line under the heading shows');
    check(m.titles.length===2&&m.titles.every(h=>h>10),'1440: Month and Day keep their titles');
    const day=page.getByRole('combobox',{name:/^Day/});const days=await day.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    await day.selectOption(days[7]);await settle(page);
    check((await page.evaluate(where)).scrollY===0,'1440: choosing a day does not move the page');
    await page.getByRole('button',{name:/^Older day/}).click();await settle(page);
    check((await page.evaluate(where)).scrollY===0,'1440: Older day does not move the page');
    await page.goto(`${base}/photos?project=proj-011lme&day=${days[3]}`);await loaded(page);await settle(page);
    check((await page.evaluate(where)).scrollY===0,'1440: a link naming a day opens at the top');
    if(shots)await page.screenshot({path:`${shots}/photos-phone-manager-light-1440.png`});
    check(!errors.length,`1440: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`Photographs on a phone: ${checks} checks passed.`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  rmSync(root,{recursive:true,force:true});
}
