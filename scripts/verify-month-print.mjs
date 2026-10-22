// Browser check for printing a busy project's month (scripts/seed-busy-projects.mjs):
// the paper shows the ten longest-late issues and says how many more there are,
// instead of every one; "Show all" on screen prints them all; the screen is
// unchanged; every place still prints; the PDF stays short; the figures on
// paper match the month's own; light and dark, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves month-print-busy.pdf and month-print-busy-all.pdf.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-month-print-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {monthOf,shiftMonth}=require('../apps/web/.test-build/lib/monthSummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const M=shiftMonth(monthOf(undefined,today),-1),P='proj-011lme';
const pages=(pdf)=>(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)??[]).length;

const port=4396,base=`http://127.0.0.1:${port}`;let output='';
assert.ok(await fetch(base+'/signin').then(()=>false,()=>true),`Port ${port} is already in use: stop the server an earlier run left behind.`);
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-month-print-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  const m=await (await fetch(`${base}/api/monthly-summary?projectId=${P}&month=${M}`,{headers:{cookie:`relay_session=${session}`}})).json();
  const late=m.pastTarget.length;
  check(late>10,`the busy month has more than ten issues past target (${late})`);
  check(m.companies.reduce((n,c)=>n+c.pastTarget,0)===late,'the companies\' past-target figures add up to the list');
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/weekly-summary?project=${P}&period=month&month=${M}`);await page.locator('.month-sheet').waitFor();
    const behind=page.locator('.week-section').filter({has:page.getByRole('heading',{name:'Behind or stuck',level:2})});
    const rows=behind.locator('.week-rows').first().locator('> li');
    const shown=()=>rows.evaluateAll(ls=>ls.filter(l=>l.offsetHeight>0).length);
    const more=behind.locator('.month-print-only');
    const places=page.locator('.month-places > li');
    const placesShown=()=>places.evaluateAll(ls=>ls.filter(l=>l.offsetHeight>0).length);

    // Screen: as before, ten and Show all; the paper's line is not on screen.
    check(await rows.count()===late,`${scheme} screen: every late issue is on the page (${await rows.count()})`);
    check(await shown()===10,`${scheme} screen: ten late issues shown`);
    check(!(await more.isVisible()),`${scheme} screen: the paper's "And N more" line is not on screen`);

    // Paper: the same ten, the line saying how many more, every place, the company figures.
    await page.emulateMedia({media:'print'});
    check(await shown()===10,`${scheme} print: ten late issues printed (${await shown()})`);
    const firstTen=await rows.evaluateAll(ls=>ls.filter(l=>l.offsetHeight>0).map(l=>l.querySelector('.ref').textContent));
    check(JSON.stringify(firstTen)===JSON.stringify(m.pastTarget.slice(0,10).map(i=>i.reference)),`${scheme} print: the ten longest late, in order`);
    const line=await more.innerText().catch(()=>'');
    check(await more.isVisible()&&line.includes(`And ${late-10} more past their target`)&&line.includes('Still open, with whom'),`${scheme} print: says how many more and where to look: ${line}`);
    check(await placesShown()===m.places.length,`${scheme} print: every place printed (${await placesShown()} of ${m.places.length})`);
    const companies=page.locator('.month-companies > li summary');
    check(await companies.count()===m.companies.length&&await companies.first().isVisible(),`${scheme} print: each company's figures printed`);
    const text=await page.locator('.month-sheet').innerText();
    check(text.includes(`${late} past target`),`${scheme} print: the section still says ${late} past target`);
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.week-sheet')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`${scheme} print: white sheet (${bg})`);
    const pdf=await page.pdf({format:'A4',printBackground:true});
    const n=pages(pdf);
    check(n>0&&n<=8,`${scheme} print: the month fits in eight A4 pages (${n})`);
    if(shots&&scheme==='light')writeFileSync(join(shots,'month-print-busy.pdf'),pdf);

    // Show all on screen, then print: every late issue, and no "more" line.
    await page.emulateMedia({media:'screen'});
    await behind.getByRole('button',{name:`Show all ${late} issues`}).click();
    await page.emulateMedia({media:'print'});
    check(await shown()===late,`${scheme} print after Show all: every late issue printed (${await shown()})`);
    check(!(await more.isVisible()),`${scheme} print after Show all: no "And N more" line`);
    const all=await page.pdf({format:'A4',printBackground:true});
    check(pages(all)>n,`${scheme} print after Show all: longer (${pages(all)} pages)`);
    if(shots&&scheme==='light')writeFileSync(join(shots,'month-print-busy-all.pdf'),all);
    await page.emulateMedia({media:'screen'});
    await behind.getByRole('button',{name:'Show less'}).click();
    check(await shown()===10,`${scheme} screen: Show less goes back to ten`);
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Month print check passed (${checks} checks): ten longest-late issues on paper with how many more, Show all prints every one, screen unchanged, every place, under eight pages, light and dark.`);
} catch(error) {
  console.error(output.slice(-4000));throw error;
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
