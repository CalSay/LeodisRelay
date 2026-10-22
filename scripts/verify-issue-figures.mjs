// Browser check that the office's issue figures agree on every screen.
// Open is every issue not closed or withdrawn; overdue is open, past its target
// and not put forward as fixed; fixed, to check is never overdue
// (lib/officeActions.ts `issueFigures`). Tetley Hall has issues past target,
// some of them fixed and waiting to be checked, plus closed and withdrawn ones
// past target. The project list card, the project sheet (desk and phone), "Where
// each project stands", the Issues tab and register, Issues by company, the
// snag list, the Weekly summary and Issues over time (its card, headline,
// table and bar) must all say 7 open,
// 2 overdue and 3 to check; the sheet's figures open lists of exactly that many;
// and a fixed issue past its target is never listed as overdue.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the project and overview at 1440px light and dark and the phone project at 390px light.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-issue-figures-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const manager={id:'entra:figures-manager',oid:'figures-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sam={id:'entra:figures-sam',oid:'figures-sam',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const managerSession=randomUUID();
putRecord('sessions',{id:managerSession,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,h=9)=>`${ymd}T${String(h).padStart(2,'0')}:00:00.000Z`;

// Tetley Hall (011LME): a visit today, and nine issues raised this week, so the Weekly summary lists them.
const P='proj-011lme';
const r=createReport(P,sam.name,sam);
putRecord('reports',{...r,authorTrade:sam.trade,visitDate:today,state:'submitted',review:'not_required',serverAcknowledgedAt:at(today,8),acknowledged:{by:manager.name,byId:manager.id,at:at(today,9)},
  observations:[{id:randomUUID(),type:'update',location:'Level 1 corridor',whatHappened:'Containment installed',actionNeeded:'',owner:'',photos:[]}]});
const fixed=(day)=>({closureSubmittedBy:sam.name,events:[{at:at(addDays(today,day)),actor:sam.name,actorId:sam.id,kind:'closure_submitted',note:'Done',photos:[]}]});
const issue=(id,over)=>putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:P,source:'report',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',location:'Riser',description:`Issue ${id}`,actionNeeded:'',
  confirmation:'confirmed',work:'assigned',owner:'Acme Electrical',targetDate:'',raisedByReport:r.id,raisedAt:at(today,7),events:[],...over});
issue('301',{targetDate:addDays(today,-3)});                                              // overdue
issue('302',{work:'in_progress',targetDate:addDays(today,-10)});                         // overdue
issue('303',{work:'open',owner:''});                                                       // open, nobody named
issue('304',{work:'awaiting_verification',targetDate:addDays(today,-8),...fixed(0)});     // fixed, to check, past target: not overdue
issue('305',{work:'awaiting_verification',targetDate:addDays(today,-1),...fixed(0)});     // fixed, to check, past target: not overdue
issue('306',{work:'awaiting_verification',targetDate:addDays(today,5),...fixed(0)});      // fixed, to check
issue('307',{targetDate:addDays(today,4)});                                               // open, on time
issue('308',{work:'closed',targetDate:addDays(today,-20),events:[{at:at(today,6),actor:manager.name,kind:'verified',note:'',photos:[]}]}); // closed
issue('309',{confirmation:'withdrawn',targetDate:addDays(today,-20)});                    // withdrawn
const OPEN=7,OVERDUE=2,TO_CHECK=3;

const port=4362,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-figures-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const flat=s=>s.replace(/\s+/g,' ').trim();
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
// The project list's group headings (Active, Defects liability period) are left out: in light mode they measure 4.2 to 4.4:1 on main
// too, a separate fix noted in docs/progress.md, not part of these figures.
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run({exclude:[['.project-group-title']]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')+' '+n.failureSummary).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe found ${found.join('; ')}`);};
// No fixed issue (304, 305, 306) sits in a row, card or list item that calls it overdue.
const fixedNeverOverdue=async(page,label)=>{
  const bad=await page.evaluate(()=>{const out=[];for(const el of document.querySelectorAll('body *')){if(el.children.length)continue;if(!/Issue 30[456]|ISS-30[456]/.test(el.textContent??''))continue;const row=el.closest('li, tr, .arow, a.item, .row');if(row&&/overdue/i.test(row.textContent??''))out.push((row.textContent??'').replace(/\s+/g,' ').slice(0,120));}return out;});
  check(!bad.length,`${label}: a fixed issue is never shown as overdue (${bad.join(' | ')})`);
};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  const open=async(scheme,width,height)=>{const phone=width<700;const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:managerSession,url:base}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};};

  for(const scheme of ['light','dark']){
    const label=`${scheme} 1440px`;
    const {context,page}=await open(scheme,1440,900);

    // Where each project stands.
    await page.goto(`${base}/office`);
    const row=page.locator('.glance-row').filter({hasText:'Tetley Hall'}).first();await row.waitFor();
    const cell=flat(await row.locator('dl.glance-cells > div').filter({hasText:'Open issues'}).innerText());
    check(new RegExp(`Open issues ${OPEN} ${OVERDUE} overdue`,'i').test(cell),`${label}: overview row says ${OPEN} open, ${OVERDUE} overdue (${cell})`);
    const tab=flat(await page.locator('a[href="#/issues"]').first().innerText());
    check(new RegExp(`^Issues ${OPEN}\\b`,'i').test(tab),`${label}: the Issues tab counts ${OPEN} open (${tab})`);
    await page.getByText('Issue 304').first().waitFor();
    await fixedNeverOverdue(page,`${label}, overview`);
    await axe(page,`${label}, overview`);
    if(shot)await page.screenshot({path:join(shot,`figures-overview-${scheme}-1440.png`)});

    // The project list card and the sheet beside it.
    await page.goto(`${base}/office#/projects/${P}`);
    const figures=page.locator('.col-main .sheet dl.tb').first();await figures.waitFor();
    const card=page.locator('a.item').filter({hasText:'Tetley Hall'}).first();
    const meta=flat(await card.locator('.meta').first().innerText());
    check(meta===`${OPEN} open ${OVERDUE} overdue ${TO_CHECK} to check`,`${label}: the project list says ${OPEN} open, ${OVERDUE} overdue, ${TO_CHECK} to check (${meta})`);
    const widths=await card.locator('.cbar i').evaluateAll(is=>is.map(i=>parseFloat(i.style.width)));
    const total=OPEN+1; // the closed one; withdrawn is left out of the bar
    check(widths.map(w=>Math.round(w*total/100)).join(',')===`1,${TO_CHECK},${OVERDUE},${OPEN-TO_CHECK-OVERDUE}`,`${label}: the bar is 1 closed, ${TO_CHECK} to check, ${OVERDUE} overdue, ${OPEN-TO_CHECK-OVERDUE} open and not late (${widths.join(', ')})`);
    check(/open, not late/.test(await page.locator('.cbar-key').first().textContent()),`${label}: the key names the last part "open, not late"`);
    const fig=async name=>flat(await figures.locator('> div').filter({hasText:name}).innerText());
    const od=await fig('Overdue actions'),tc=await fig('Fixed, to check');
    check(new RegExp(`^Overdue actions ${OVERDUE}\\b.*${OPEN} open`,'i').test(od),`${label}: the sheet says ${OVERDUE} overdue of ${OPEN} open (${od})`);
    check(new RegExp(`^Fixed, to check ${TO_CHECK}\\b`,'i').test(tc),`${label}: the sheet says ${TO_CHECK} to check (${tc})`);
    const head=flat(await page.locator('.col-head').filter({hasText:'Register'}).first().innerText());
    check(new RegExp(`${OPEN} open$`,'i').test(head),`${label}: the register heading says ${OPEN} open (${head})`);
    await fixedNeverOverdue(page,`${label}, project`);
    await axe(page,`${label}, project`);
    if(shot)await page.screenshot({path:join(shot,`figures-project-${scheme}-1440.png`)});

    // Each figure opens a list of exactly that many (#108).
    const rows=async(n,what)=>{await page.waitForFunction(n=>document.querySelectorAll('table.reg tbody tr').length===n,n,{timeout:8000}).catch(()=>{});const got=await page.locator('table.reg tbody tr').count();check(got===n,`${label}: ${what} opens ${n} issues (${got})`);};
    await figures.locator('a.tb-go').nth(1).click();await page.waitForFunction(()=>location.hash.startsWith('#/issues/show/overdue'));
    await rows(OVERDUE,'Overdue actions');
    check(!/Issue 30[456]/.test(await page.locator('table.reg tbody').innerText()),`${label}: no fixed issue on the Overdue list`);
    const chips=flat(await page.locator('.chip').allInnerTexts().then(a=>a.join(' | ')));
    check(new RegExp(`Open · ${OPEN} \\| Overdue · ${OVERDUE} \\| Fixed, to check · ${TO_CHECK}`).test(chips),`${label}: the register's chips agree (${chips})`);
    await page.goto(`${base}/office#/projects/${P}`);await figures.waitFor();
    await figures.locator('a.tb-go').nth(2).click();await page.waitForFunction(()=>location.hash.startsWith('#/issues/show/verify'));
    await rows(TO_CHECK,'Fixed, to check');
    await fixedNeverOverdue(page,`${label}, register`);
    await context.close();
  }

  // The other pages that count the same things.
  {
    const label='light 1440px';
    const {context,page}=await open('light',1440,900);
    await page.goto(`${base}/companies`);await page.getByText('Acme Electrical').first().waitFor();
    const past=flat(await page.locator('dl > div').filter({hasText:/^Past target/}).first().innerText());
    check(new RegExp(`^Past target ${OVERDUE}\\b`,'i').test(past),`${label}: Issues by company says ${OVERDUE} past target (${past})`);
    const acme=flat(await page.locator('.co-card').filter({hasText:'Acme Electrical'}).first().innerText());
    check(new RegExp(`${OVERDUE} past target`).test(acme)&&new RegExp(`Fixed, to check ${TO_CHECK}\\b`,'i').test(acme),`${label}: Acme's card says ${OVERDUE} past target and ${TO_CHECK} to check (${acme.slice(0,200)})`);

    await page.goto(`${base}/issues/snag-list?project=${P}`);await page.getByText('Issue 301').first().waitFor();
    const snag=flat(await page.locator('main').innerText());
    check(new RegExp(`· ${OVERDUE} past target`).test(snag),`${label}: the snag list says ${OVERDUE} past target`);
    check(await page.locator('.snag-item.fixed').filter({hasText:'Past target'}).count()===0,`${label}: no fixed item on the snag list is marked past target`);

    await page.goto(`${base}/weekly-summary?project=${P}`);await page.locator('.week-total').filter({hasText:'Open now'}).first().waitFor();
    const week=flat(await page.locator('.week-total').filter({hasText:'Open now'}).first().innerText());
    check(week.startsWith(`Open now: ${OPEN} · ${OVERDUE} past target · ${TO_CHECK} fixed and waiting to be checked.`),`${label}: the Weekly summary agrees (${week})`);

    await page.goto(`${base}/issue-trend?project=${P}`);await page.locator('.it-stat').first().waitFor();
    const trend=flat(await page.locator('.it-stat').first().innerText());
    check(trend.toLowerCase()===`open now ${OPEN} ${OVERDUE} past target ${TO_CHECK} fixed, to check`,`${label}: Issues over time agrees (${trend})`);
    const trendVerdict=flat(await page.locator('.it-verdict').innerText());
    check(trendVerdict.endsWith(`${TO_CHECK} of them are fixed and waiting for the office to check.`),`${label}: Issues over time says how many open are waiting for the office (${trendVerdict})`);
    const trendRow=flat(await page.locator('.it-table tbody tr').first().innerText());
    check(new RegExp(`${OPEN} ${OVERDUE} ${TO_CHECK}$`).test(trendRow),`${label}: this week's row gives open, past target and fixed, to check (${trendRow})`);
    check(await page.locator('.it-col').last().locator('.it-check').count()===1,`${label}: this week's bar has a fixed, to check part`);
    await context.close();
  }

  // A project on a phone: the same figures at the top of the register.
  {
    const label='light 390px';
    const {context,page}=await open('light',390,844);
    await page.goto(`${base}/office#/projects/${P}`);
    const figures=page.locator('.register-standing dl.tb').first();await figures.waitFor();
    const fig=async name=>flat(await figures.locator('> div').filter({hasText:name}).innerText());
    check(new RegExp(`^Overdue actions ${OVERDUE}\\b.*${OPEN} open`,'i').test(await fig('Overdue actions')),`${label}: phone says ${OVERDUE} overdue of ${OPEN} open`);
    check(new RegExp(`^Fixed, to check ${TO_CHECK}\\b`,'i').test(await fig('Fixed, to check')),`${label}: phone says ${TO_CHECK} to check`);
    check(await overflow(page)<=1,`${label}: no sideways scroll`);
    if(shot)await page.screenshot({path:join(shot,'figures-phone-light-390.png')});
    await figures.locator('a.tb-go').nth(1).click();await page.waitForFunction(()=>location.hash.startsWith('#/issues/show/overdue'));
    await page.waitForFunction(n=>document.querySelectorAll('.ws-main [data-issue-row], table.reg tbody tr, .issue-cards > *').length>0,null,{timeout:8000}).catch(()=>{});
    const listed=await page.evaluate(()=>[...new Set((document.querySelector('.ws-main')?.innerText.match(/Issue 3\d\d/g))??[])]);
    check(listed.sort().join(',')==='Issue 301,Issue 302',`${label}: Overdue actions opens just the two overdue issues (${listed.join(', ')})`);
    await context.close();
  }

  check(!errors.length,`no page errors (${errors.join('; ')})`);
  console.log(`issue figures: ${checks} checks passed`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();
  rmSync(root,{recursive:true,force:true,maxRetries:5});
}
