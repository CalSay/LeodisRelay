// Browser check for a site update left unsent from an earlier day (2026-10-22).
// A walk of an engineer opening RELAY the next morning found the home screen
// clear ("visit Wed 21 Oct" under Unfinished reports) but the update itself
// said nothing about its day, on the cards or on Check & send, so this
// morning's work could be added to it and reach the office under yesterday.
// Checks: an update from yesterday has a note that the office files it under that day and "Go to today’s
// update" (an update for today says "For today, …" under its title); Check & send says "Filed under yesterday, …"; the button starts
// today's update on this site (dated today, no note) and, tapped again,
// opens the same one rather than a second, also past the first 50 reports; yesterday's cards and draft are
// untouched and still listed on the home screen; today's update, an inspection
// and a correction have no note; with no signal the button goes to the Site
// page. Axe on the note, 48px button, no sideways scroll. Light and dark at
// 390px, dark at 1440px.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-old-drafts-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport,correctReport,getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const P='proj-011lme',OTHER='proj-014lme';
const day=n=>new Date(Date.now()+n*86400000).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const today=day(0),yesterday=day(-1);
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const short=ymd=>{const d=new Date(`${ymd}T12:00:00Z`);return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;};
const ob=(location,whatHappened)=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
/** One engineer per screen size, with yesterday's unsent update on Tetley Hall. */
const seed=n=>{
  const principal={id:`entra:old-${n}`,oid:`old-${n}`,name:`Sam Sparks ${n}`,email:`sam${n}@example.test`,role:'Engineer',trade:'Electrical'};
  const make=(project,type='progress',visitDate=yesterday,cards=[ob('Level 2 east','First fix done in flats 2.03 to 2.06'),ob('Riser B','Containment up to level 3')])=>{
    const r=createReport(project,principal.name,principal,type,{clientKey:randomUUID(),visitDate});
    const saved=saveDraft(r.id,{...r,observations:type==='progress'?cards:r.observations},r.version);assert.ok(saved.ok,JSON.stringify(saved));
    return r.id;
  };
  const old=make(P);
  const inspection=make(P,'handover-inspection');
  const session=randomUUID();putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  return {principal,session,old,inspection,make};
};
const port=4483,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-old-drafts',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  let n=0;
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900,s=seed(++n);
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:s.session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`after-${name}-${scheme}-${width}.png`),fullPage:true});}};
    const opened=()=>page.locator('.eng-visit-day, .eng-earlier-day').first().waitFor();
    const openReport=async id=>{await page.goto(`${base}/reports/${id}?returnTo=${encodeURIComponent(`/engineer?project=${P}`)}`);await opened();};
    const note=page.locator('.eng-earlier-day');

    // From the home screen, as the engineer would: yesterday's is under Unfinished reports.
    await page.goto(`${base}/engineer?project=${P}`);
    const row=page.locator('#eng-unfinished-title').locator('xpath=ancestor::section[1]').locator('a',{hasText:'Site update'});
    await row.waitFor();
    ok((await row.innerText()).includes(`visit ${short(yesterday)}`),`${label}: home lists yesterday's update with its day`);
    ok(await page.getByRole('button',{name:/Start today’s site update/}).isVisible(),`${label}: the big button starts today's, not yesterday's`);
    await tap(row);await opened();
    ok(await note.isVisible(),`${label}: the earlier-day note shows`);
    eq(await page.locator('.eng-visit-day').count(),0,`${label}: the note says the day, so the line under the title does not repeat it`);
    ok((await note.innerText()).includes(`This update is for yesterday, ${short(yesterday)}.`),`${label}: the note names the day`);
    ok((await note.innerText()).includes('anything from today goes in today’s update'),`${label}: the note says where today's work goes`);
    const go=note.getByRole('button',{name:'Go to today’s update'});
    const box=await go.boundingBox();ok(box&&box.height>=48,`${label}: Go to today's update is at least 48px tall (${box?.height})`);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling`);
    await page.evaluate(axeSource);
    const found=await page.evaluate(async()=>(await window.axe.run('.pagehead, .eng-earlier-day',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(x=>x.target.join(' ')).join(', ')}`));
    eq(found.length,0,`${label}: axe finds nothing on the title and note: ${found.join('; ')}`);
    await shot('yesterday-open');

    // Check & send names the day the office files it under.
    await tap(page.getByRole('button',{name:/Check & send/}).last());
    await page.locator('#report-check').waitFor();
    ok((await page.locator('#report-check').innerText()).includes(`Filed under yesterday, ${short(yesterday)}.`),`${label}: Check & send says the day it is filed under`);
    await shot('yesterday-check');

    // Go to today's update: a new one, dated today, on the same site, no note.
    await openReport(s.old);
    await tap(note.getByRole('button',{name:'Go to today’s update'}));
    await page.waitForURL(u=>!u.pathname.endsWith(s.old)&&u.pathname.startsWith('/reports/'),{timeout:20000});
    await page.locator('.eng-visit-day').waitFor();
    eq(await page.locator('.pagehead .sub').innerText(),`${getReport(new URL(page.url()).pathname.split('/').pop()).reference} · Tetley Hall - Block E\nFor today, ${short(today)}`,`${label}: the line under the title says the update is for today`);
    const todaysId=new URL(page.url()).pathname.split('/').pop();
    eq(await page.locator('.eng-visit-day').innerText(),`For today, ${short(today)}`,`${label}: today's update says today`);
    eq(await note.count(),0,`${label}: today's update has no earlier-day note`);
    const todays=getReport(todaysId);
    eq(todays.visitDate,today,`${label}: today's update is dated today`);
    eq(todays.projectId,P,`${label}: today's update is on the same site`);
    ok(new URL(page.url()).searchParams.get('returnTo')?.startsWith('/engineer'),`${label}: today's update still goes back to the Site page`);
    await shot('today-open');
    const old=getReport(s.old);
    eq(old.state,'draft',`${label}: yesterday's is still a draft`);
    eq(old.visitDate,yesterday,`${label}: yesterday's keeps its day`);
    eq(old.observations.length,2,`${label}: yesterday's cards are untouched`);

    // Tapped again from yesterday's: the same today's update, not a second one.
    await openReport(s.old);
    await tap(note.getByRole('button',{name:'Go to today’s update'}));
    await page.waitForURL(u=>u.pathname.endsWith(todaysId),{timeout:20000});
    ok(true,`${label}: tapped again it opens the same today's update`);

    // A busy site: 55 reports sent since today's was last saved put it past the first page of 50.
    for(let k=0;k<55;k++){const id=s.make(P,'progress',day(-2));const r=await submitReport(id,undefined,getReport(id).version,s.principal.id);assert.ok(r.ok,JSON.stringify(r));}
    await openReport(s.old);
    await tap(note.getByRole('button',{name:'Go to today’s update'}));
    await page.waitForURL(u=>u.pathname.startsWith('/reports/')&&!u.pathname.endsWith(s.old),{timeout:20000});
    eq(new URL(page.url()).pathname.split('/').pop(),todaysId,`${label}: past the first 50 reports it still opens the same today's update`);

    // Home: today's on the big button, yesterday's still under Unfinished reports.
    await page.goto(`${base}/engineer?project=${P}`);
    await row.waitFor();
    ok(await page.getByRole('link',{name:/Carry on with today’s update/}).isVisible(),`${label}: home now carries on with today's`);
    ok(await row.isVisible(),`${label}: yesterday's is still listed, nothing removed`);

    // An inspection from yesterday: its day, no note (an inspection may take two days).
    await openReport(s.inspection);
    eq(await page.locator('.eng-visit-day').innerText(),`For yesterday, ${short(yesterday)}`,`${label}: an inspection says its day`);
    eq(await note.count(),0,`${label}: an inspection has no earlier-day note`);

    // A correction keeps the day of the report it corrects: no note.
    const sentId=s.make(P,'progress',day(-3));
    const sent=await submitReport(sentId,undefined,getReport(sentId).version,s.principal.id);assert.ok(sent.ok,JSON.stringify(sent));
    const corr=correctReport(sentId,'Wrong flat number');assert.ok(corr.ok,JSON.stringify(corr));
    await openReport(corr.value.id);
    eq(await note.count(),0,`${label}: a correction has no earlier-day note`);

    // No signal: the button goes to the Site page, which can start one offline.
    await openReport(s.old);
    await context.setOffline(true);
    await tap(note.getByRole('button',{name:'Go to today’s update'}));
    await page.waitForURL(u=>!u.pathname.startsWith('/reports/'),{timeout:20000}).catch(()=>{});
    ok(!new URL(page.url()).pathname.startsWith('/reports/'),`${label}: with no signal it leaves for the Site page (${page.url()})`);
    await context.setOffline(false);

    eq(errors.length,0,`${label}: no page errors ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`Old drafts check passed (${checks} checks): an update from an earlier day says its day, Go to today’s update, nothing removed.`);
} finally {
  await browser?.close();server.kill();
}
