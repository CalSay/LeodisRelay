// Browser check: "visits this week" means one person on site on one day,
// everywhere the office reads it. Busy example data
// (scripts/seed-busy-projects.mjs), where engineers send a site update and a
// safety or tower inspection on the same day. Office manager at 1440px:
// - the overview's This week, the project sheet's Last visit line and the
//   Weekly summary's Site reports line give the same number of visits, worked
//   out here from the records as people-days, and fewer than the reports;
// - the Weekly summary still counts every report it lists;
// - with the safety records switched off (the default), their safety and
//   tower inspections are not visits on any of the three;
// - the Project page's "fixed, to check" and Closed leave withdrawn issues out,
//   so it matches the project's Fixed, to check figure.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the four screens.
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
const root=mkdtempSync(join(tmpdir(),'relay-visits-week-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,records,database}=require(storagePath);
const {londonDay,weekStart}=require('../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date()),monday=weekStart(today,today);
seedBusyProjects({storagePath,today});
const P='proj-011lme';

// The same engineer sends a first fix inspection on the day of their latest site update this week: one visit, two reports.
{const update=records('reports',P).filter(r=>r.state==='submitted'&&!r.reportType&&r.visitDate>=monday&&r.visitDate<=today).sort((a,b)=>b.visitDate.localeCompare(a.visitDate))[0];
  assert.ok(update,'a site update this week');
  putRecord('reports',{...update,id:randomUUID(),reference:update.reference.replace(/SPR-\d+$/,'FFI-900'),reportType:'first-fix-inspection',observations:[]});}
// Someone with no other report today sends only a tower inspection: switched off, that is not a visit, nor today's last visit.
{const any=records('reports',P).find(r=>r.state==='submitted'&&!r.reportType);
  putRecord('reports',{...any,id:randomUUID(),reference:any.reference.replace(/SPR-\d+$/,'TPI-900'),reportType:'tower-inspection',visitDate:today,author:'Tia Tower',authorId:'entra:tia-tower',authorTrade:'Scaffold',observations:[]});}
const sentNow=records('reports',P).filter(r=>r.state==='submitted');
const superseded=new Set(sentNow.map(r=>r.corrects).filter(Boolean));
// The safety records are switched off (the default), so their weekly safety and tower inspections are left out everywhere.
const week=sentNow.filter(r=>!superseded.has(r.id)&&r.visitDate>=monday&&r.visitDate<=today&&!['safety-inspection','tower-inspection'].includes(r.reportType));
const allVisits=new Set(sentNow.filter(r=>!superseded.has(r.id)&&r.visitDate>=monday&&r.visitDate<=today).map(r=>`${r.authorId??r.author.trim()}|${r.visitDate}`)).size;
const visits=new Set(week.map(r=>`${r.authorId??r.author.trim()}|${r.visitDate}`)).size;
assert.ok(allVisits>visits,`the tower inspection alone would be one more visit (${allVisits} with it, ${visits} without)`);
assert.ok(week.length>visits,`the week has a same-day update and inspection to count once (${week.length} reports, ${visits} visits)`);
const issues=records('issues',P);
const toCheck=issues.filter(i=>i.confirmation!=='withdrawn'&&i.work==='awaiting_verification').length;
const closed=issues.filter(i=>i.confirmation!=='withdrawn'&&i.work==='closed').length;
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4519,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-visits-week-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
let browser,checks=0;
const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark']){
    const label=`1440px ${colorScheme}`;
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    // The overview: Tetley Hall's This week.
    await page.goto(`${base}/office#/projects`);
    const glance=page.locator('.ws .glance-list > li').filter({hasText:'Tetley Hall - Block E'}).first();
    await glance.waitFor({timeout:30000});
    const thisWeek=await glance.locator('dt',{hasText:/^This week$/}).locator('xpath=following-sibling::dd[1]').innerText();
    check(thisWeek.startsWith(plural(visits,'visit')),`${label}: the overview says ${plural(visits,'visit')} this week: "${thisWeek.split('\n')[0]}"`);
    if(shot)await page.screenshot({path:join(shot,`overview-${colorScheme}-1440.png`)});
    // The project sheet: Last visit.
    await page.goto(`${base}/office#/projects/${P}`);
    const last=page.locator('.ws .col-main .sheet dl.tb').first().locator('div',{hasText:/^Last visit/}).first();
    await last.waitFor({timeout:30000});
    const lastText=await last.innerText();
    check(!lastText.includes('Tia Tower'),`${label}: a tower inspection alone does not make Last visit: "${lastText.replace(/\n/g,' ')}"`);
    check(lastText.includes(`${plural(visits,'visit')} this week`),`${label}: the project's Last visit says ${plural(visits,'visit')} this week: "${lastText.replace(/\n/g,' ')}"`);
    const fixed=await page.locator('.ws .col-main .sheet dl.tb').first().locator('div',{hasText:/^Fixed, to check/}).first().locator('dd').innerText();
    check(Number(fixed.match(/^\d+/)[0])===toCheck,`${label}: the project's Fixed, to check is ${toCheck} (${fixed.split('\n')[0]})`);
    if(shot)await page.screenshot({path:join(shot,`sheet-${colorScheme}-1440.png`)});
    // The Weekly summary: the same visits, every report still counted.
    await page.goto(`${base}/weekly-summary?project=${P}&week=${monday}`);
    const stat=page.locator('.week-stats > div',{hasText:/^Site reports/});await stat.waitFor({timeout:30000});
    const days=new Set(week.map(r=>r.visitDate)).size;
    const statText=(await stat.innerText()).replace(/\n/g,' ');
    check(statText.includes(`${plural(visits,'visit')} over ${plural(days,'day')}`),`${label}: the Weekly summary says ${plural(visits,'visit')} over ${plural(days,'day')}: "${statText}"`);
    check(Number(await stat.locator('dd').evaluate(d=>d.firstChild.textContent))===week.length,`${label}: the Weekly summary still counts all ${week.length} reports: "${statText}"`);
    if(shot)await page.screenshot({path:join(shot,`weekly-${colorScheme}-1440.png`)});
    // The Project page: fixed, to check and Closed without withdrawn issues.
    await page.goto(`${base}/projects/${P}`);
    const head=page.locator('.sec-controls .lbl',{hasText:/^Issues/}).first();await head.waitFor({timeout:30000});
    await page.locator('.seg',{hasText:/^Closed/}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.empty')?.textContent?.startsWith('Loading'));
    const headText=await head.innerText();
    check(headText.toLowerCase()===`issues · ${toCheck} fixed, to check`,`${label}: the Project page says ${toCheck} fixed, to check: "${headText}"`);
    const closedText=await page.locator('.seg',{hasText:/^Closed/}).locator('.seg-n').innerText();
    check(Number(closedText)===closed,`${label}: the Project page's Closed is ${closed} (${closedText})`);
    if(shot)await page.screenshot({path:join(shot,`project-page-${colorScheme}-1440.png`)});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: nothing scrolls sideways`);
    await context.close();
  }
  check(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-visits-this-week: ${checks} checks passed (${week.length} reports, ${visits} visits, ${toCheck} fixed to check, ${issues.filter(i=>i.confirmation==='withdrawn').length} withdrawn)`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
