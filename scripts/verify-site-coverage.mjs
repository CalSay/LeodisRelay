// Browser check for site coverage: the office's fortnight grid of which days
// each reportable project had a report from site, opened from the office,
// with quiet active sites marked, records opening and coming back, stepping
// between fortnights, office-only access, phone and desktop, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-coverage-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {fortnightStart,shiftFortnight,workingDaysBetween}=require('../apps/web/.test-build/lib/siteCoverage.js');
const engineer={id:'entra:cov-engineer',oid:'cov-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const hvac={id:'entra:cov-hvac',oid:'cov-hvac',name:'Harriet Air',email:'harriet@example.test',role:'Engineer',trade:'HVAC'};
const manager={id:'entra:cov-manager',oid:'cov-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const start=fortnightStart(undefined,today),previous=shiftFortnight(start,-1);
const now=new Date().toISOString();
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',reference:`011LME-SPR-${randomUUID().slice(0,4)}`,visitDate:today,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const todays=report({reference:'011LME-SPR-101'});
const theirs=report({reference:'011LME-SPR-102',visitDate:addDays(today,-1),author:hvac.name,authorId:hvac.id,authorTrade:'HVAC'});
const older=report({reference:'011LME-SPR-090',visitDate:addDays(previous,2)});
// Ten days back, or the day before the fortnight when ten days back is inside it.
const quietLast=report({reference:'014LME-SPR-050',projectId:'proj-014lme',visitDate:addDays(today,-10)<start?addDays(today,-10):addDays(start,-1),author:hvac.name,authorId:hvac.id,authorTrade:'HVAC'});
const draft=report({reference:'014LME-SPR-051',projectId:'proj-014lme',state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:now});
const tender=report({reference:'021LME-SPR-001',projectId:'proj-021lme'});
const quietDays=workingDaysBetween(quietLast.visitDate,today);
const port=4340,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-coverage-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const rowOf=(page,number)=>page.locator('.cov-grid tbody tr').filter({has:page.locator('th[scope=row]',{hasText:number})});
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: sent to sign in with the fortnight kept, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/coverage?start=${previous}`);await page.waitForURL(/\/signin/);
    check(new URL(page.url()).searchParams.get('returnTo')===`/coverage?start=${previous}`,'signed out: sign-in keeps the address');
    const res=await page.request.get(`${base}/api/site-coverage`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer: an office view, so the page sends them on and the API refuses.
  {
    const {context,page}=await open('Engineer','light',390);
    await page.goto(`${base}/coverage`);await page.waitForURL(u=>!u.pathname.startsWith('/coverage'));
    check(true,`engineer: sent away from the page (${new URL(page.url()).pathname})`);
    const res=await page.request.get(`${base}/api/site-coverage`);
    check(res.status()===403,`engineer: the API refuses (${res.status()})`);
    await context.close();
  }

  // Office, desktop, dark: opened from the office overview.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects`);
    await page.getByRole('link',{name:'Site coverage'}).click();await page.waitForURL(/\/coverage\?/);await page.locator('.cov-grid').waitFor();
    check(true,'office: the overview links to site coverage');
    const rows=await page.locator('.cov-grid th[scope=row]').allInnerTexts();
    check(rows.length===3&&['011LME','014LME','009LCP'].every(n=>rows.some(t=>t.includes(n))),`office: the three reportable projects, tender and completed jobs left out: ${JSON.stringify(rows)}`);
    const groups=await page.locator('.cov-group').allInnerTexts();
    check(/Active\s*2/i.test(groups[0])&&/Defects liability period\s*1/i.test(groups[1]),`office: grouped active then defects liability: ${JSON.stringify(groups)}`);
    const heads=await page.locator('.cov-grid thead th').count();
    check(heads===16,`office: project, 14 days and last report columns (${heads})`);
    const tetley=rowOf(page,'011LME');
    const todayChip=tetley.locator('td.cov-today .cov-chip');
    check((await todayChip.count())===1&&(await todayChip.innerText())==='Elec'&&(await todayChip.getAttribute('aria-label')).includes(todays.reference),'office: today\'s Electrical report is in today\'s column');
    const chips=await tetley.locator('.cov-chip').allInnerTexts();
    check(chips.length===2&&chips.includes('HVAC'),`office: yesterday's HVAC report is there too, the older one is not: ${JSON.stringify(chips)}`);
    const kirkstall=rowOf(page,'014LME');
    check((await kirkstall.locator('.cov-chip').count())===0,'office: a draft is not a visit');
    const last=await kirkstall.locator('.cov-last').innerText();
    check(last.includes('Harriet Air, HVAC')&&new RegExp(`Quiet ${quietDays} working days`,'i').test(last)&&new RegExp(`${quietDays} working days? without a report`).test(last),`office: the last report from before the fortnight, and quiet: ${JSON.stringify(last)}`);
    check(await rowOf(page,'014LME').evaluate(r=>r.classList.contains('cov-quiet')),'office: the quiet row is marked');
    const dlp=await rowOf(page,'009LCP').locator('.cov-last').innerText();
    check(/No report sent from this site yet/.test(dlp)&&!/quiet|no reports yet/i.test(dlp),`office: a defects liability site with no report is not flagged: ${JSON.stringify(dlp)}`);
    check(/Reported today/.test(await tetley.locator('.cov-last').innerText()),'office: the site reported today says so');
    const stats=await page.locator('.cov-stats').innerText();
    check(/Active sites\s*2/i.test(stats)&&/Reported today\s*1/i.test(stats)&&/Gone quiet\s*1/i.test(stats),`office: headline counts: ${JSON.stringify(stats)}`);
    const quiet=await page.locator('.cov-quiet-list li').allInnerTexts();
    check(quiet.length===1&&quiet[0].includes('Kirkstall Gate')&&quiet[0].includes('PM A. Whitfield'),`office: gone quiet names the site and its PM: ${JSON.stringify(quiet)}`);
    const text=await page.locator('main').innerText();
    check(!text.includes(tender.reference)&&!text.includes(draft.reference),'office: no tender report or draft anywhere on the page');
    if(screenshot)await page.screenshot({path:join(screenshot,'coverage-dark-1440.png'),fullPage:true});
    // A report opened from the grid comes back to the grid.
    await todayChip.click();await page.waitForURL(`**/reports/${todays.id}**`);
    await page.goBack();await page.waitForURL(/\/coverage/);await page.locator('.cov-grid').waitFor();
    check(true,'office: back from a report returns to site coverage');
    // The project name opens its weekly summary.
    await tetley.locator('.cov-project').click();await page.waitForURL(/\/weekly-summary\?/);
    check(new URL(page.url()).searchParams.get('project')==='proj-011lme','office: the project opens its weekly summary');
    await page.goBack();await page.locator('.cov-grid').waitFor();
    // Stepping: the previous fortnight shows the older report; there is no fortnight after this one.
    check(!(await page.getByRole('button',{name:/Next fortnight/}).isEnabled()),'office: nothing after the current fortnight');
    await page.getByRole('button',{name:/Previous fortnight/}).click();await page.waitForURL(new RegExp(`start=${previous}`));
    await page.locator('.cov-grid').waitFor();
    const before=await rowOf(page,'011LME').locator('.cov-chip').evaluateAll(a=>a.map(x=>x.getAttribute('aria-label')));
    check(before.length===1&&before[0].includes(older.reference),`office: previous fortnight shows its report: ${JSON.stringify(before)}`);
    check(/Reported today/.test(await rowOf(page,'011LME').locator('.cov-last').innerText()),'office: the last report is still the latest, whichever fortnight is shown');
    await page.getByRole('button',{name:'Last two weeks'}).click();await page.waitForURL(u=>!u.search.includes('start='));
    check(true,'office: back to the last two weeks');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/office/);
    check(true,'office: Back returns to the office');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Office on a phone, light: the grid scrolls inside its box, the page does not.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/coverage`);await page.locator('.cov-grid').waitFor();
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`phone: no sideways page scroll at 390px (${width})`);
    const box=await page.locator('.cov-scroll').evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));
    check(box.scroll>box.client,`phone: the grid scrolls inside its own box (${box.scroll} > ${box.client})`);
    const sticky=await page.locator('.cov-grid th[scope=row]').first().evaluate(e=>getComputedStyle(e).position);
    check(sticky==='sticky','phone: the project column stays in view while scrolling');
    const seen=await page.evaluate(()=>{const box=document.querySelector('.cov-scroll').getBoundingClientRect(),cell=document.querySelector('.cov-grid thead .cov-today').getBoundingClientRect();return cell.left>=box.left&&cell.right<=box.right+1;});
    check(seen,'phone: the grid opens scrolled to today, not the oldest day');
    check(await page.locator('.cov-quiet-list').isVisible(),'phone: the quiet list is readable without scrolling sideways');
    if(screenshot)await page.screenshot({path:join(screenshot,'coverage-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'phone: page errors');
    await context.close();
  }
  console.log(`Site coverage check passed (${checks} checks): office-only access, grid contents, quiet sites, back navigation, fortnight stepping, phone and desktop, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
