// Browser check that a date from another year says its year, and a late issue
// says how many days past its target rather than a date. One issue a year and
// a day late (its target "Fri 7 Nov" would read as a day still to come), one a
// day late, one due next year. Checked on the office register and issue sheet,
// the issue page, the snag list, Check fixes' line, the Month summary, the
// Weekly summary and My week for a week last year, Issues over time and Site
// coverage. 1440px dark and 390px light.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-dates-year-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay,weekStart}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:dy-engineer',oid:'dy-engineer',name:'Dee Year',email:'dy@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:dy-manager',oid:'dy-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const today=londonDay(new Date());
const daysAgo=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const year=ymd=>ymd.slice(0,4),thisYear=year(today);
const P='proj-011lme',now=new Date().toISOString();
// A week a year back: Monday to Sunday, all last year.
const oldMonday=weekStart(daysAgo(371),daysAgo(371));
const oldSunday=(()=>{const d=new Date(`${oldMonday}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+6);return d.toISOString().slice(0,10);})();
const report=(extra)=>{const r={id:randomUUID(),projectId:P,reportType:'site-progress',author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
const oldVisit=report({reference:'011LME-SPR-001',visitDate:daysAgo(371),serverAcknowledgedAt:new Date(Date.parse(`${daysAgo(371)}T15:00:00Z`)).toISOString()});
report({reference:'011LME-SPR-002',visitDate:today});
const issue=(extra)=>{const i={id:randomUUID(),projectId:P,location:'Level 2',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Sparks Ltd',targetDate:'',raisedByReport:oldVisit.id,raisedAt:new Date(Date.parse(`${daysAgo(400)}T10:00:00Z`)).toISOString(),events:[],reporterTrade:'Electrical',affectedTrade:'Electrical',...extra};putRecord('issues',i);return i;};
const yearLate=issue({reference:'011LME-ISS-901',description:'Fire stopping missing',targetDate:daysAgo(366)});
const dayLate=issue({reference:'011LME-ISS-902',description:'Socket loose',targetDate:daysAgo(1),raisedAt:now});
const nextYear=issue({reference:'011LME-ISS-903',description:'Paint touch up',targetDate:daysAgo(-400),raisedAt:now});
const toCheck=issue({reference:'011LME-ISS-904',description:'Cover plate',targetDate:daysAgo(30),work:'awaiting_verification',closureSubmittedBy:'Sparks Ltd',raisedAt:now,
  events:[{kind:'closure_submitted',at:now,by:'Sparks Ltd',note:'Done',photos:[]}]});
const port=4367,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-dates-year-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const flat=s=>s.replace(/\s+/g,' ').trim().replace(/PAST TARGET/g,'past target').replace(/ DAYS? /g,m=>m.toLowerCase());
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const open=async role=>{const c=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});await c.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;};
    const page=await open('Manager');
    // Office issue register.
    await page.goto(`${base}/office#/issues`);
    const row=page.locator('tr',{hasText:'Fire stopping missing'}).first();await row.waitFor({timeout:30000});
    const regRow=flat(await row.innerText());
    const regTarget=flat(await row.locator('td[data-label="Target"]').innerText());
    check(regRow.includes('366 days past target')&&regTarget.includes(year(daysAgo(366))),`${label}: register says 366 days past target and the target's year: ${regRow}`);
    const dayRow=flat(await page.locator('tr',{hasText:'Socket loose'}).first().innerText());
    check(dayRow.includes('1 day past target'),`${label}: register says 1 day past target: ${dayRow}`);
    // Office issue sheet.
    await page.goto(`${base}/office#/projects/${P}/issue/${yearLate.id}`);
    const sheet=page.locator('dl.tb',{hasText:'Confirmation'}).first();await sheet.waitFor({timeout:30000});
    const sheetText=flat(await sheet.innerText());
    check(sheetText.includes('366 days past target')&&sheetText.includes(year(daysAgo(366))),`${label}: issue sheet: ${sheetText}`);
    // Project figures: the oldest late one.
    await page.goto(`${base}/office#/projects/${P}`);
    const late=page.locator('dd',{hasText:/oldest \d+ days? past target/}).first();await late.waitFor({timeout:30000});
    check(/oldest 366 days past target/.test(await late.innerText()),`${label}: project figures say the oldest is 366 days past target`);
    // Issue page in RELAY (office view).
    await page.goto(`${base}/issues/${yearLate.id}`);
    const target=page.locator('.tb-cell',{hasText:'Target date'});await target.waitFor({timeout:30000});
    const targetText=flat(await target.innerText());
    check(targetText.includes(year(daysAgo(366)))&&targetText.includes('366 days past target'),`${label}: issue page target: ${targetText}`);
    await page.goto(`${base}/issues/${nextYear.id}`);await target.waitFor();
    const soonText=flat(await target.innerText());
    check(soonText.includes(year(daysAgo(-400)))&&!/past target/.test(soonText),`${label}: a target next year has its year and is not late: ${soonText}`);
    await page.goto(`${base}/issues/${toCheck.id}`);await target.waitFor();
    check(!/past target/.test(await target.innerText()),`${label}: a fix waiting to be checked is not called past target`);
    // Snag list.
    await page.goto(`${base}/issues/snag-list?project=${P}`);
    const items=page.locator('.snag-item');await items.first().waitFor({timeout:30000});
    const snag=flat(await page.locator('.snag-item',{hasText:'Fire stopping missing'}).innerText());
    check(snag.includes('366 days past target')&&snag.includes(year(daysAgo(366))),`${label}: snag list: ${snag}`);
    check(flat(await page.locator('.snag-item',{hasText:'Socket loose'}).innerText()).includes('1 day past target'),`${label}: snag list says 1 day past target`);
    check(!/past target/i.test(await page.locator('.snag-item',{hasText:'Cover plate'}).innerText()),`${label}: snag list: a fixed one is not past target`);
    // Month summary: late issues.
    await page.goto(`${base}/weekly-summary?project=${P}&period=month&month=${today.slice(0,7)}`);await page.locator('.month-sheet').waitFor({timeout:30000});
    const monthText=flat(await page.locator('.month-sheet').innerText());
    check(monthText.includes('366 days past target')&&monthText.includes('1 day past target')&&!/\d+ days? late\b/.test(monthText),`${label}: Month summary says days past target`);
    check(new RegExp(`Target \\w{3} \\d{1,2} \\w{3} ${year(daysAgo(366))}`,"i").test(monthText),`${label}: Month summary target has its year`);
    // Weekly summary for a week last year: every day in it has its year.
    await page.goto(`${base}/weekly-summary?project=${P}&week=${oldMonday}`);await page.locator('.week-range').waitFor({timeout:30000});
    const range=flat(await page.locator('.week-range').innerText());
    check(new RegExp(`^\\w{3} \\d{1,2} \\w{3} ${year(oldMonday)} to `).test(range),`${label}: a week last year starts with its year: ${range}`);
    const when=await page.locator('.week-when').allInnerTexts();
    check(when.length>0&&when.every(w=>!/^\w{3} \d{1,2} \w{3}$/.test(w.trim())),`${label}: no day on last year's summary without its year: ${JSON.stringify(when)}`);
    // Issues over time: the oldest open issue was raised last year.
    await page.goto(`${base}/issue-trend?project=${P}`);
    const oldest=page.locator('small',{hasText:/raised /}).first();await oldest.waitFor({timeout:30000});
    check(new RegExp(`raised \\w{3} \\d{1,2} \\w{3} ${year(daysAgo(400))}`).test(await oldest.innerText()),`${label}: Issues over time: oldest raised with its year: ${await oldest.innerText()}`);
    await page.context().close();
    // Engineer: My week for that week last year.
    const eng=await open('Engineer');
    await eng.goto(`${base}/my-week?week=${oldMonday}`);await eng.locator('.mw-range').waitFor({timeout:30000});
    const mw=flat(await eng.locator('.mw-range').innerText());
    check(new RegExp(`^\\w{3} \\d{1,2} \\w{3}${year(oldMonday)===year(oldSunday)?'':` ${year(oldMonday)}`} to \\w{3} \\d{1,2} \\w{3} ${year(oldSunday)}( |$)`).test(mw)&&!/(\d{4}).*\1/.test(mw.replace(/^(.*?) to /,'').trim()),`${label}: My week last year gives its year once, at the end (and the start too across New Year): ${mw}`);
    await eng.context().close();
  }
  check(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-dates-with-year: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
