// Browser check: on a busy project, Issues over time tells the office how many
// open issues are fixed and waiting for the office to check, apart from those
// past target, with the same figures as the records and the project sheet.
// Busy example data (scripts/seed-busy-projects.mjs). Office manager at 1440px
// light and dark, and 390px light:
// - Open now, past target and fixed, to check equal the records (withdrawn
//   left out; fixed, to check never past target) and the project sheet;
// - the headline says how many of the open issues wait for the office;
// - every week's past target and fixed, to check fit inside its open, and this
//   week's row and bar carry all three;
// - the page loads within 5 seconds, nothing scrolls sideways and no legend
//   label is parted from its colour.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the three screens.
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
const root=mkdtempSync(join(tmpdir(),'relay-trend-busy-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,records,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today});
const P='proj-011lme';
const live=records('issues',P).filter(i=>i.confirmation!=='withdrawn');
const OPEN=live.filter(i=>i.work!=='closed').length;
const TO_CHECK=live.filter(i=>i.work==='awaiting_verification').length;
const LATE=live.filter(i=>i.work!=='closed'&&i.work!=='awaiting_verification'&&/^\d{4}-\d{2}-\d{2}$/.test(i.targetDate)&&i.targetDate<today).length;
assert.ok(TO_CHECK>0&&LATE>0&&OPEN>TO_CHECK+LATE,`the busy seed has every kind of open issue (${OPEN} open, ${LATE} late, ${TO_CHECK} to check)`);
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4527,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-trend-busy-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
let browser,checks=0;
const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const flat=s=>s.replace(/\s+/g,' ').trim();
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [width,colorScheme] of [[1440,'light'],[1440,'dark'],[390,'light']]){
    const label=`${width}px ${colorScheme}`;
    const context=await browser.newContext({viewport:{width,height:900},colorScheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    // Warm the server once so the timing is the office's, not the first compile of the route.
    if(width===1440&&colorScheme==='light')await page.request.get(`${base}/api/issue-trend?projectId=${P}`);
    const started=Date.now();
    await page.goto(`${base}/issue-trend?project=${P}`);
    await page.locator('.it-stats').waitFor({timeout:30000});
    const ms=Date.now()-started;
    check(ms<5000,`${label}: the page loads within 5 seconds (${ms} ms)`);
    const card=flat(await page.locator('.it-stat').first().innerText()).toLowerCase();
    check(card===`open now ${OPEN} ${LATE} past target ${TO_CHECK} fixed, to check`,`${label}: Open now agrees with the records (${card})`);
    const verdict=flat(await page.locator('.it-verdict').innerText());
    check(verdict.endsWith(`${TO_CHECK} of them are fixed and waiting for the office to check.`),`${label}: the headline says how many wait for the office (${verdict})`);
    const rows=await page.locator('.it-table tbody tr').evaluateAll(trs=>trs.map(tr=>[...tr.children].slice(1).map(td=>Number(td.textContent))));
    check(rows.length===12,`${label}: twelve weeks`);
    check(rows.every(([,,open,late,toCheck])=>late+toCheck<=open),`${label}: every week's past target and fixed, to check fit inside its open`);
    check(rows[0][2]===OPEN&&rows[0][3]===LATE&&rows[0][4]===TO_CHECK,`${label}: this week's row is ${OPEN}, ${LATE}, ${TO_CHECK} (${rows[0]})`);
    const bar=page.locator('.it-col').last();
    check(await bar.locator('.it-late').count()===1&&await bar.locator('.it-check').count()===1&&await bar.locator('.it-open').count()===1,`${label}: this week's bar has all three parts`);
    check(/, \d+ past target, \d+ fixed, to check\.$/.test(await page.locator('.it-readout').innerText()),`${label}: the readout names fixed, to check`);
    const parted=await page.locator('.it-legend > span').evaluateAll(els=>els.filter(e=>e.getClientRects().length>1||e.getBoundingClientRect().height>24).map(e=>e.textContent));
    check(!parted.length,`${label}: each legend label stays with its colour (${parted})`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: nothing scrolls sideways`);
    check(await page.locator('.it-table-wrap').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${label}: the week-by-week table fits without scrolling inside its box`);
    if(width===390){
      const tall=await page.locator('.it-table tbody th').evaluateAll(ths=>ths.slice(1).filter(th=>th.getBoundingClientRect().height>40).length);
      check(!tall,`${label}: week names fit on one line (${tall} wrap)`);
    }
    if(shot)await page.screenshot({path:join(shot,`issues-over-time-${colorScheme}-${width}.png`),fullPage:true});
    if(width===1440&&colorScheme==='light'){
      // The project sheet: the same Fixed, to check.
      await page.goto(`${base}/office#/projects/${P}`);
      const fixed=page.locator('.ws .col-main .sheet dl.tb').first().locator('div',{hasText:/^Fixed, to check/}).first().locator('dd');
      await fixed.waitFor({timeout:30000});
      check(Number((await fixed.innerText()).match(/^\d+/)[0])===TO_CHECK,`${label}: the project sheet's Fixed, to check is ${TO_CHECK} too`);
    }
    await context.close();
  }
  check(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-issue-trend-busy: ${checks} checks passed (${OPEN} open, ${LATE} past target, ${TO_CHECK} fixed, to check)`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
