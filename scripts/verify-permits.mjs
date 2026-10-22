// Browser check for Permits to work: refused saves, the engineer home row
// (red while a permit is past its end time), recording a permit with a kind
// and "Start from a recent one", closing one with its check confirmed,
// a reload, a retry kept once, withdrawing (by the recorder and the office,
// not another engineer), the spreadsheet, the office's Needs attention and
// project sheet, no connection, an empty project, and axe at 390px light and
// 1440px dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
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
const root=mkdtempSync(join(tmpdir(),'relay-permits-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
// Safety, permits and deliveries are off unless the office turns them on (lib/featureSwitch.ts); this check needs them on. verify-simpler-home.mjs covers both states.
putRecord('settings',{id:'features',safetyRecords:true});
const engineer={id:'entra:pt-engineer',oid:'pt-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const plumber={id:'entra:pt-plumber',oid:'pt-plumber',name:'Pat Plumb',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:pt-manager',oid:'pt-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,plumber,manager]){sessions[p.id]=randomUUID();putRecord('sessions',{id:sessions[p.id],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const P='proj-011lme';
const LONDON=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'});
const daysBack=n=>LONDON.format(new Date(Date.now()-n*86400000));
// A hot works permit the plumber recorded yesterday, which ran until 17:00 yesterday and was never closed.
putRecord('permits',{id:'permit-seed-1',projectId:P,kind:'hot-works',reference:'HW-0141',work:'Brazing LTHW flow and return, level 3 riser',issuedBy:'Dana Reid, Northbank Construction',heldBy:'Pat Plumb',day:daysBack(1),ends:`${daysBack(1)}T17:00`,by:'Pat Plumb',byId:plumber.id,at:new Date(Date.now()-86400000).toISOString()});
const port=4381,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-permits-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const axe=async(page,label)=>{await page.waitForFunction(()=>document.title.length>0,null,{timeout:5000}).catch(()=>{});await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const body=(extra={})=>({project:P,requestId:randomUUID(),kind:'electrical-isolation',work:'DB-3 isolated for second fix',issuedBy:'Dana Reid',heldBy:'Sam Spark',day:daysBack(0),ends:`${daysBack(0)}T23:59`,...extra});
const post=(page,data)=>page.request.post(`${base}/api/permits`,{data});
const permits=page=>page.locator('.pt-permit');
const LATE_TITLE='Hot works permit still open past its end time';
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(who,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,acceptDownloads:true});if(who)await context.addCookies([{name:'relay_session',value:sessions[who.id],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: nothing read or kept, and the page goes to sign in with the project kept.
  {
    const {context,page}=await open(null,'light',390);
    check((await page.request.get(`${base}/api/permits?project=${P}`)).status()===401,'signed out: reading refused');
    check((await page.request.get(`${base}/api/permits`)).status()===401,'signed out: the office list refused');
    check((await post(page,body())).status()===401,'signed out: recording refused');
    check((await page.request.post(`${base}/api/permits/permit-seed-1`,{data:{action:'close',confirmed:true}})).status()===401,'signed out: closing refused');
    await page.goto(`${base}/permits?project=${P}`);await page.waitForURL(/\/signin/);
    check(decodeURIComponent(page.url()).includes(`/permits?project=${P}`),'signed out: sign in returns to the same project');
    await context.close();
  }

  // Engineer on a phone, light.
  let recordedId;
  {
    const {context,page,errors}=await open(engineer,'light',390);
    check((await post(page,body({work:'  '}))).status()===422,'engineer: a permit with no work is refused');
    check((await post(page,body({kind:'boiler'}))).status()===422,'engineer: an unknown kind is refused');
    check((await post(page,body({day:daysBack(-1)}))).status()===422,'engineer: a permit issued in the future is refused');
    check((await post(page,body({day:daysBack(9)}))).status()===422,'engineer: a permit more than a week back is refused');
    check((await post(page,body({ends:`${daysBack(-9)}T08:00`}))).status()===422,'engineer: a permit running more than a week is refused');
    check((await post(page,body({ends:`${daysBack(1)}T08:00`}))).status()===422,'engineer: a permit ending before its issue day is refused');
    check((await post(page,body({heldBy:['x']}))).status()===422,'engineer: a malformed permit is refused');
    check((await post(page,body({project:'proj-missing'}))).status()===404,'engineer: a project that does not exist is refused');
    check((await post(page,body({project:'proj-004lcp'}))).status()===409,'engineer: a complete project takes no new permits');
    check((await page.request.post(`${base}/api/permits/permit-seed-1`,{data:{action:'close',confirmed:false}})).status()===422,'engineer: closing without the check is refused');
    check(records('permits').length===1&&!records('permits')[0].closed,'engineer: nothing kept by the refused saves');

    await page.goto(`${base}/engineer?project=${P}`);
    const row=page.locator('.eng-row',{has:page.locator('b',{hasText:/^Permits to work$/})});
    await row.locator('span',{hasText:/^(\d+ open|None)/}).waitFor();
    const rowText=await row.locator('.main>span').innerText();
    check(rowText==='1 open · 1 past its end time',`engineer: the home row says what is open and past its time: ${JSON.stringify(rowText)}`);
    check(await row.evaluate(e=>e.classList.contains('late')),'engineer: the home row has the red edge while a permit is past its end time');
    check(await row.evaluate(e=>e.closest('[role="group"]')?.querySelector('h3')?.textContent==='Safety, permits and deliveries'),'engineer: the row is under Safety, permits and deliveries');
    await row.click();await page.waitForURL(new RegExp(`/permits\\?project=${P}&returnTo=`));
    await permits(page).first().waitFor();
    await page.waitForFunction(()=>document.title.startsWith('Permits to work'),null,{timeout:5000}).catch(()=>{});
    check((await page.title()).startsWith('Permits to work'),`engineer: the tab is named (${await page.title()})`);
    check(await page.locator('a.back').first().innerText()==='← Back to Site','engineer: Back says Back to Site');
    check(/1\s*1 past its end time/.test(await page.locator('.pt-stats dd').first().innerText())&&await page.locator('.pt-stats dd.pt-due').count()===1,'engineer: one open, past its end time, marked');
    const late=permits(page).first();
    check(/Past its end time/i.test(await late.locator('.tag').innerText())&&/Ended 17:00 yesterday/.test(await late.innerText()),`engineer: the seeded permit says it ended yesterday: ${await late.innerText()}`);
    check(/Permit HW-0141 · issued by Dana Reid, Northbank Construction on .* · held by Pat Plumb/.test(await late.locator('.pt-meta').first().innerText()),'engineer: number, who issued and who holds it');
    check(!(await late.getByRole('button',{name:/^Withdraw/}).count()),'engineer: no Withdraw on a permit someone else recorded');

    // Record a permit: empty first, then from the recent one, changed to an isolation.
    await page.getByRole('button',{name:'Record a permit'}).click();
    check(await page.waitForFunction(()=>document.activeElement?.name==='pt-kind',null,{timeout:2000}).then(()=>true,()=>false),'engineer: the form opens on the kind');
    check(await page.getByLabel('Held by').inputValue()==='Sam Spark','engineer: held by starts as the signed-in engineer');
    check(await page.getByLabel('Issued on').inputValue()===daysBack(0),'engineer: issued on starts as today');
    await page.getByRole('button',{name:'Save permit'}).click();
    check(/kind of permit/.test(await page.locator('.pt-form [role="alert"]').innerText()),'engineer: an empty permit says what to do');
    await page.getByRole('group',{name:'Start from a recent one'}).getByRole('button',{name:/^Hot works · Brazing LTHW/}).click();
    check(await page.getByLabel('The work and where').inputValue()==='Brazing LTHW flow and return, level 3 riser'&&await page.getByLabel('Issued by').inputValue()==='Dana Reid, Northbank Construction','engineer: a recent permit fills the kind, work and who issued it');
    check(await page.getByRole('radio',{name:'Hot works'}).isChecked(),'engineer: and the kind');
    await page.getByText('Electrical isolation',{exact:true}).click();
    check(await page.getByRole('radio',{name:'Electrical isolation'}).isChecked(),'engineer: tapping a kind chooses it');
    await page.getByLabel('The work and where').fill('DB-3 isolated for second fix, level 2 east');
    await page.getByLabel('Runs until').fill(`${daysBack(0)}T23:59`);
    await page.getByLabel(/^Permit number/).fill('ISO-077');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'engineer 390px: no sideways scroll with the form open');
    check(await page.evaluate(()=>[...document.querySelectorAll('.pt-page button, .pt-page input:not([type=radio]), .pt-page select, .pt-page .pt-kind-chip')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().height>=44)),'engineer 390px: every control is at least 44px tall');
    await axe(page,'engineer 390px light, form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'permits-form-light-390.png'),fullPage:true});
    await page.getByRole('button',{name:'Save permit'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.pt-permit').length===2);
    check(!(await page.locator('.pt-form').count()),'engineer: the form closes after saving');
    check(await page.waitForFunction(()=>document.activeElement?.textContent==='Record a permit',null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus returns to Record a permit');
    check(/Permit recorded: Electrical isolation, open until 23:59/.test(await page.locator('.eng-sr[role="status"]').innerText()),'engineer: a screen reader hears it was saved');
    const kept=records('permits').find(p=>p.kind==='electrical-isolation');
    recordedId=kept?.id;
    check(kept&&kept.by==='Sam Spark'&&kept.byId===engineer.id&&kept.reference==='ISO-077'&&kept.ends===`${daysBack(0)}T23:59`,'engineer: kept under the signed-in engineer as typed');
    check(/^2\s*1 past its end time/.test(await page.locator('.pt-stats dd').first().innerText()),`engineer: the figures update in place: ${await page.locator('.pt-stats dd').first().innerText()}`);
    check((await permits(page).nth(1).locator('.pt-work').innerText())==='DB-3 isolated for second fix, level 2 east'&&/Runs until 23:59 today/.test(await permits(page).nth(1).innerText()),'engineer: the new permit is under the one past its time, with its end');

    // A retry of the same save is kept once; the same id with other details is refused.
    const again=body({work:'Retry permit'});
    const a=await post(page,again),b=await post(page,again);
    check(a.status()===201&&b.status()===201&&(await a.json()).id===(await b.json()).id,'engineer: a retry returns the first save');
    check((await post(page,{...again,work:'Other words'})).status()===409,'engineer: the same request with different details is refused');
    check(records('permits').filter(p=>p.work==='Retry permit').length===1,'engineer: the retried permit is kept once');
    await page.reload();await permits(page).first().waitFor();
    check((await permits(page).count())===3,'engineer: every permit is there after a reload');

    // Close the plumber's permit: the check must be ticked.
    await late.getByRole('button',{name:/^Close permit: Hot works/}).click();
    check(await page.waitForFunction(()=>document.activeElement?.type==='checkbox',null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus moves to the closing check');
    check(/fire watch was kept for at least 60 minutes/.test(await late.locator('.pt-check').innerText()),`engineer: hot works asks for the fire watch: ${await late.locator('.pt-check').innerText()}`);
    await late.getByRole('button',{name:'Close permit',exact:true}).click();
    check(/Confirm the closing check/.test(await late.locator('[role="alert"]').innerText()),'engineer: closing needs the check');
    await late.locator('.pt-check input').check();
    await late.getByLabel(/^Closing note/).fill('Fire watch by Chris until 18:10');
    await axe(page,'engineer 390px light, closing');
    await late.getByRole('button',{name:'Close permit',exact:true}).click();
    const closed=page.locator('.pt-permit',{hasText:'Brazing LTHW'});
    await closed.locator('.tag',{hasText:'Closed'}).waitFor();
    check(/Closed by Sam Spark · .*Confirmed: Work stopped, a fire watch was kept.* Note: Fire watch by Chris until 18:10/.test(await closed.innerText()),'engineer: the closed permit says who, when, what was confirmed and the note');
    check(await page.waitForFunction(()=>document.activeElement?.classList.contains('pt-title')&&document.activeElement.textContent.includes('Brazing'),null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus goes to the closed permit');
    check(await closed.evaluate(e=>e.closest('section')?.querySelector('h2')?.textContent.startsWith('Closed')),'engineer: it moves under Closed');
    check(!(await page.locator('.pt-stats dd.pt-due').count())&&/^2\s*all within their time/.test(await page.locator('.pt-stats dd').first().innerText()),'engineer: nothing past its time now');
    check(/^1/.test(await page.locator('.pt-stats dd').nth(1).innerText()),'engineer: one closed in the last four weeks');
    check(records('permits').find(p=>p.id==='permit-seed-1').closed?.byId===engineer.id,'engineer: the closing is kept');

    // Withdraw the retry permit: a reason is needed, it stays listed, struck through.
    const retry=page.locator('.pt-permit',{hasText:'Retry permit'});
    await retry.getByRole('button',{name:/^Withdraw: Electrical isolation: Retry permit/}).click();
    await retry.getByRole('button',{name:'Withdraw record'}).click();
    check(/Say why/.test(await retry.locator('[role="alert"]').innerText()),'engineer: a withdrawal needs a reason');
    await retry.getByLabel('Why withdraw it?').fill('Recorded by mistake while testing');
    await retry.getByRole('button',{name:'Withdraw record'}).click();
    await retry.locator('.tag',{hasText:'Withdrawn'}).waitFor();
    check(/Withdrawn by Sam Spark · .*: Recorded by mistake while testing/.test(await retry.innerText()),'engineer: the withdrawn permit says who, when and why');
    check(await retry.locator('.pt-work').evaluate(e=>getComputedStyle(e).textDecorationLine.includes('line-through')),'engineer: the withdrawn work is struck through');
    check(/Closed and withdrawn\s*1/.test(await page.locator('#pt-done-title').innerText())&&/Open now\s*1/.test(await page.locator('#pt-open-title').innerText()),'engineer: the counts leave out the withdrawn permit');
    await axe(page,'engineer 390px light, list');
    if(screenshot)await page.screenshot({path:join(screenshot,'permits-list-light-390.png'),fullPage:true});

    // The spreadsheet.
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download spreadsheet'}).click()]);
    check(/^relay-permits-011LME-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()),`engineer: the spreadsheet is named for the project (${download.suggestedFilename()})`);
    const csv=readFileSync(await download.path(),'utf8');
    check(csv.startsWith('﻿Permit number,Project number,Project,Kind,Work and where')&&csv.split('\r\n').filter(Boolean).length===4,'engineer: the spreadsheet has a header and every permit, withdrawn included');
    check(csv.includes('Fire watch by Chris until 18:10')&&csv.includes('Recorded by mistake while testing')&&csv.includes('ISO-077'),'engineer: the closing note, the withdrawal reason and the number');

    await page.goto(`${base}/engineer?project=${P}`);
    await row.locator('span',{hasText:'1 open'}).waitFor();
    check(!(await row.evaluate(e=>e.classList.contains('late'))),'engineer: the home row loses its red edge once nothing is past its time');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Another engineer cannot withdraw it, by the page or the API, but may close it.
  {
    const {context,page}=await open(plumber,'light',390);
    check((await page.request.post(`${base}/api/permits/${recordedId}`,{data:{action:'withdraw',reason:'Not mine'}})).status()===403,'another engineer: withdrawing is refused');
    await page.goto(`${base}/permits?project=${P}`);await permits(page).first().waitFor();
    const iso=page.locator('.pt-permit',{hasText:'DB-3 isolated'});
    check((await iso.getByRole('button',{name:/^Withdraw/}).count())===0,'another engineer: no Withdraw on it');
    check((await iso.getByRole('button',{name:/^Close permit/}).count())===1,'another engineer: may close it');
    check((await page.locator('.pt-permit',{hasText:'Brazing LTHW'}).getByRole('button',{name:/^Withdraw/}).count())===1,'another engineer: Withdraw on their own permit');
    await context.close();
  }

  // A permit past its end time on another project, for the office.
  putRecord('permits',{id:'permit-seed-2',projectId:P,kind:'hot-works',work:'Grinding brackets, roof plant deck',issuedBy:'Dana Reid',heldBy:'Chris Weld',day:daysBack(0),ends:`${daysBack(0)}T00:01`,by:'Pat Plumb',byId:plumber.id,at:new Date().toISOString()});

  // Office on a desk, dark: Needs attention, the project sheet, may withdraw anyone's.
  {
    const {context,page,errors}=await open(manager,'dark',1440);
    const all=await (await page.request.get(`${base}/api/permits`)).json();
    check(all.totals.overdue===1&&all.projects.length===1&&all.projects[0].overdue[0].id==='permit-seed-2','office: the list across projects has the one past its end time');
    await page.goto(`${base}/office`);
    const also=page.locator('.sheet > .rmenu').last();
    await also.getByText(LATE_TITLE).waitFor();
    check(/Grinding brackets, roof plant deck · held by Chris Weld · ended 00:01 today/.test(await also.locator('a',{hasText:LATE_TITLE}).innerText()),'office: Also needs attention says what, who holds it and when it ended');
    const bell=page.getByRole('button',{name:/^Attention\s*,\s*something is waiting$/});
    await bell.click();
    const pop=page.locator('.attn-pop');
    const titles=await pop.locator('.mini b').allInnerTexts();
    check(titles.includes(LATE_TITLE),`office: the Attention list has the permit: ${JSON.stringify(titles.slice(0,4))}`);
    check(await pop.locator('.attn-group',{hasText:'Safety, permits and deliveries'}).evaluate(g=>Number(g.querySelector('.attn-gh b').textContent)===g.querySelectorAll('.mini').length),'office: the Safety, permits and deliveries figure is the number of its lines, all listed');
    await pop.getByRole('link',{name:LATE_TITLE}).click();
    await page.waitForURL(new RegExp(`/permits\\?project=${P}&returnTo=`));await permits(page).first().waitFor();
    check(await page.locator('a.back').first().innerText()==='← Back to Office','office: Back says Back to Office');
    check(/Grinding brackets/.test(await permits(page).first().innerText()),'office: the line opens the project\'s permits with that one first');
    check((await page.locator('.pt-permit',{hasText:'DB-3 isolated'}).getByRole('button',{name:/^Withdraw/}).count())===1,'office: may withdraw an engineer\'s permit');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'office 1440px: no sideways scroll');
    await axe(page,'office 1440px dark, list');
    if(screenshot)await page.screenshot({path:join(screenshot,'permits-list-dark-1440.png'),fullPage:true});
    // Closing it from the office takes the line off Needs attention.
    const grind=page.locator('.pt-permit',{hasText:'Grinding brackets'});
    await grind.getByRole('button',{name:/^Close permit/}).click();
    await grind.locator('.pt-check input').check();
    await grind.getByRole('button',{name:'Close permit',exact:true}).click();
    await grind.locator('.tag',{hasText:'Closed'}).waitFor();
    await page.getByRole('link',{name:/Back to Office/}).first().click();
    // The desk reads permits with its other records; wait for that answer rather than reading at once.
    check(await page.waitForFunction(t=>{const m=[...document.querySelectorAll('.sheet > .rmenu')].at(-1);return !!m&&m.textContent.length>0&&!m.textContent.includes(t);},LATE_TITLE,{timeout:5000}).then(()=>true,()=>false),'office: once closed, the line leaves Needs attention');
    // The project sheet links to it.
    await page.goto(`${base}/office#/projects/${P}`);
    const links=page.getByRole('navigation',{name:'On this project'});
    await links.getByRole('link',{name:'Permits to work'}).first().click();
    await page.waitForURL(new RegExp(`/permits\\?project=${P}&returnTo=`));await permits(page).first().waitFor();
    await page.getByRole('button',{name:'Record a permit'}).click();
    await axe(page,'office 1440px dark, form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'permits-form-dark-1440.png'),fullPage:true});
    // No connection: what was typed stays.
    await page.getByText('Roof or work at height',{exact:true}).click();
    await page.getByLabel('The work and where').fill('Roof access for AHU filter change');
    await page.getByLabel('Issued by').fill('Dana Reid');
    await page.getByLabel('Runs until').fill(`${daysBack(0)}T23:59`);
    await context.setOffline(true);
    await page.getByRole('button',{name:'Save permit'}).click();
    await page.locator('.pt-form [role="alert"]').filter({hasText:/No connection/}).waitFor();
    check(await page.getByLabel('The work and where').inputValue()==='Roof access for AHU filter change','office: with no connection the permit stays in the form');
    await context.setOffline(false);
    await page.getByRole('button',{name:'Save permit'}).click();
    await page.locator('.pt-permit',{hasText:'Roof access for AHU'}).waitFor();
    check(records('permits').find(p=>p.work==='Roof access for AHU filter change')?.heldBy==='Office Manager','office: may record a permit');
    // Another project starts empty; a complete project opens on the project choice.
    await page.getByLabel('Project',{exact:true}).selectOption('proj-014lme');
    await page.locator('.pt-none').waitFor();
    check(/No permits recorded on this project yet/.test(await page.locator('.pt-none').innerText()),'office: another project has a clear empty state');
    check(!(await page.getByRole('link',{name:'Download spreadsheet'}).count()),'office: no spreadsheet with no permits');
    await page.goto(`${base}/permits?project=proj-004lcp`);await page.locator('.eng-panel',{hasText:'Choose a project'}).waitFor();
    check(true,'office: a complete project in the address opens on the project choice');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Help lists it.
  {
    const {context,page}=await open(engineer,'light',390);
    await page.goto(`${base}/help?for=site`);
    // Help shows the latest few entries and the rest under "Show all" (a first visit marks none as new),
    // so open the full list, again if the first click came before the page was ready.
    const whatsNew=page.locator('#help-new'),entry=whatsNew.getByRole('heading',{name:'Permits to work',exact:true}),more=whatsNew.getByRole('button',{name:/^Show all/});
    let listed=false;
    for(const until=Date.now()+8000;!listed&&Date.now()<until;){
      if(await entry.count()){listed=true;break;}
      if(await more.count())await more.click().catch(()=>{});
      await page.waitForTimeout(200);
    }
    check(listed,'help: What\'s new lists Permits to work');
    await context.close();
  }
  console.log(`Permits to work check passed (${checks} checks): refused saves, engineer home row and its red edge, recording from a recent one, closing with the check, reload, retries, withdrawing and who may, spreadsheet, office Needs attention and project sheet, no connection, empty and complete projects, axe, 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
