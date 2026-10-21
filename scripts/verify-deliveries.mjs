// Browser check for Deliveries: refused saves, the engineer home row, recording
// a delivery from a recent supplier, one that came short (kept "To sort"),
// marking it sorted, a reload, a retry kept once, withdrawing (by the recorder
// and the office, not another engineer), the spreadsheet, the office's Needs
// attention and project sheet, no connection, an empty project, and axe at
// 390px light and 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-deliveries-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:dl-engineer',oid:'dl-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const plumber={id:'entra:dl-plumber',oid:'dl-plumber',name:'Pat Plumb',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:dl-manager',oid:'dl-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,plumber,manager]){sessions[p.id]=randomUUID();putRecord('sessions',{id:sessions[p.id],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const P='proj-011lme';
const LONDON=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'});
const daysBack=n=>LONDON.format(new Date(Date.now()-n*86400000));
// Copper the plumber took in two days ago, all there.
putRecord('deliveries',{id:'delivery-seed-1',projectId:P,supplier:'City Plumbing, Leeds',items:'40 lengths 22mm copper, 2 boxes press fittings',day:daysBack(2),receivedBy:'Pat Plumb',storedAt:'Level 2 store',condition:'complete',by:'Pat Plumb',byId:plumber.id,at:new Date(Date.now()-2*86400000).toISOString()});
const port=4383,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-deliveries-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
// From the top of the page: a field half under the sticky top bar after a scroll is not a small target.
const axe=async(page,label)=>{await page.waitForFunction(()=>document.title.length>0,null,{timeout:5000}).catch(()=>{});await page.evaluate(()=>scrollTo(0,0));await page.evaluate(axeSource);const found=await page.evaluate(async debug=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')+(debug?` ${n.failureSummary}`:'')).slice(0,4).join(', ')}`),!!process.env.AXE_DEBUG);check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const body=(extra={})=>({project:P,requestId:randomUUID(),supplier:'Edmundson Electrical',items:'6 x 100m reels 2.5mm T&E',day:daysBack(0),receivedBy:'Sam Spark',condition:'complete',...extra});
const post=(page,data)=>page.request.post(`${base}/api/deliveries`,{data});
const cards=page=>page.locator('.dl-delivery');
const ONE_TITLE='Short delivery from Edmundson Electrical, not sorted yet';
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(who,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,acceptDownloads:true});if(who)await context.addCookies([{name:'relay_session',value:sessions[who.id],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: nothing read or kept, and the page goes to sign in with the project kept.
  {
    const {context,page}=await open(null,'light',390);
    check((await page.request.get(`${base}/api/deliveries?project=${P}`)).status()===401,'signed out: reading refused');
    check((await page.request.get(`${base}/api/deliveries`)).status()===401,'signed out: the office list refused');
    check((await post(page,body())).status()===401,'signed out: recording refused');
    check((await page.request.post(`${base}/api/deliveries/delivery-seed-1`,{data:{action:'withdraw',reason:'x'}})).status()===401,'signed out: withdrawing refused');
    await page.goto(`${base}/deliveries?project=${P}`);await page.waitForURL(/\/signin/);
    check(decodeURIComponent(page.url()).includes(`/deliveries?project=${P}`),'signed out: sign in returns to the same project');
    await context.close();
  }

  // Engineer on a phone, light.
  let recordedId;
  {
    const {context,page,errors}=await open(engineer,'light',390);
    check((await post(page,body({supplier:'  '}))).status()===422,'engineer: a delivery with no supplier is refused');
    check((await post(page,body({items:''}))).status()===422,'engineer: a delivery with nothing on it is refused');
    check((await post(page,body({condition:'lost'}))).status()===422,'engineer: an unknown condition is refused');
    check((await post(page,body({condition:'short'}))).status()===422,'engineer: a short delivery without saying what was short is refused');
    check((await post(page,body({day:daysBack(-1)}))).status()===422,'engineer: a delivery in the future is refused');
    check((await post(page,body({day:daysBack(9)}))).status()===422,'engineer: a delivery more than a week back is refused');
    check((await post(page,body({items:'x'.repeat(301)}))).status()===422,'engineer: too long a list of what arrived is refused');
    check((await post(page,body({receivedBy:['x']}))).status()===422,'engineer: a malformed delivery is refused');
    check((await post(page,body({project:'proj-missing'}))).status()===404,'engineer: a project that does not exist is refused');
    check((await post(page,body({project:'proj-004lcp'}))).status()===409,'engineer: a complete project takes no new deliveries');
    check((await page.request.post(`${base}/api/deliveries/delivery-seed-1`,{data:{action:'sort',note:'x'}})).status()===409,'engineer: one that was all there has nothing to sort');
    check(records('deliveries').length===1,'engineer: nothing kept by the refused saves');

    await page.goto(`${base}/engineer?project=${P}`);
    const row=page.locator('.eng-row',{has:page.locator('b',{hasText:/^Deliveries$/})});
    await row.locator('span',{hasText:/in the last 7 days/}).waitFor();
    const rowText=await row.locator('.main>span').innerText();
    check(rowText==='1 in the last 7 days',`engineer: the home row says how many came this week: ${JSON.stringify(rowText)}`);
    check(await row.evaluate(e=>e.closest('[role="group"]')?.querySelector('h3')?.textContent==='Reports and records'),'engineer: the row is under Reports and records');
    await row.click();await page.waitForURL(new RegExp(`/deliveries\\?project=${P}&returnTo=`));
    await cards(page).first().waitFor();
    await page.waitForFunction(()=>document.title.startsWith('Deliveries'),null,{timeout:10000}).catch(()=>{});
    check((await page.title()).startsWith('Deliveries'),`engineer: the tab is named (${await page.title()})`);
    check(await page.locator('a.back').first().innerText()==='← Back to Site','engineer: Back says Back to Site');
    check(/^0\s*nothing waiting on a supplier/.test(await page.locator('.dl-stats dd').first().innerText()),'engineer: nothing to sort yet');
    check(/Nothing to sort/.test(await page.locator('.dl-none').innerText()),'engineer: To sort says there is nothing');
    const seed=cards(page).first();
    check(/All there/i.test(await seed.locator('.tag').innerText())&&/taken in by Pat Plumb · put in Level 2 store/.test(await seed.innerText()),`engineer: the seeded delivery says who took it in and where it went: ${await seed.innerText()}`);
    check(!(await seed.getByRole('button').count()),'engineer: no buttons on a delivery someone else recorded that was all there');

    // Record a delivery: empty first, then a recent supplier, short.
    await page.getByRole('button',{name:'Record a delivery'}).click();
    check(await page.waitForFunction(()=>document.activeElement?.id==='dl-supplier',null,{timeout:2000}).then(()=>true,()=>false),'engineer: the form opens on the supplier');
    check(await page.getByLabel('Taken in by').inputValue()==='Sam Spark','engineer: taken in by starts as the signed-in engineer');
    check(await page.getByLabel('Arrived on').inputValue()===daysBack(0),'engineer: arrived on starts as today');
    await page.getByRole('button',{name:'Save delivery'}).click();
    check(/supplier/.test(await page.locator('.dl-form [role="alert"]').innerText()),'engineer: an empty delivery says what to do');
    await page.getByRole('group',{name:'Recent suppliers'}).getByRole('button',{name:'City Plumbing, Leeds'}).click();
    check(await page.getByLabel('Supplier',{exact:true}).inputValue()==='City Plumbing, Leeds','engineer: a recent supplier fills the supplier');
    check(await page.waitForFunction(()=>document.activeElement?.id==='dl-items',null,{timeout:2000}).then(()=>true,()=>false),'engineer: and moves on to what arrived');
    await page.getByLabel('Supplier',{exact:true}).fill('Edmundson Electrical');
    await page.getByLabel('What arrived').fill('6 x 100m reels 2.5mm T&E, 200 back boxes');
    check(!(await page.locator('#dl-problem').count()),'engineer: no "what was wrong" box until a problem is chosen');
    await page.getByText('Short or part delivery',{exact:true}).click();
    check(await page.getByRole('radio',{name:'Short or part delivery'}).isChecked(),'engineer: tapping a condition chooses it');
    await page.getByRole('button',{name:'Save delivery'}).click();
    check(/short, damaged or wrong/.test(await page.locator('.dl-form [role="alert"]').innerText()),'engineer: a short delivery asks what was short');
    check(await page.waitForFunction(()=>document.activeElement?.id==='dl-problem',null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus goes to what was short');
    await page.getByLabel('What was short?').fill('2 reels short, rest promised Thursday');
    await page.getByLabel(/^Where it was put/).fill('Site cabin');
    await page.getByLabel(/^Delivery note number/).fill('DN 448120');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'engineer 390px: no sideways scroll with the form open');
    check(await page.evaluate(()=>[...document.querySelectorAll('.dl-page button, .dl-page input:not([type=radio]), .dl-page select, .dl-page .dl-condition-chip')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().height>=44)),'engineer 390px: every control is at least 44px tall');
    await axe(page,'engineer 390px light, form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'deliveries-form-light-390.png'),fullPage:true});
    await page.getByRole('button',{name:'Save delivery'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.dl-delivery').length===2);
    check(!(await page.locator('.dl-form').count()),'engineer: the form closes after saving');
    check(await page.waitForFunction(()=>document.activeElement?.textContent==='Record a delivery',null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus returns to Record a delivery');
    check(/Delivery recorded: Edmundson Electrical, short\. It stays under To sort/.test(await page.locator('.eng-sr[role="status"]').innerText()),'engineer: a screen reader hears it was saved');
    const kept=records('deliveries').find(d=>d.supplier==='Edmundson Electrical');
    recordedId=kept?.id;
    check(kept&&kept.by==='Sam Spark'&&kept.byId===engineer.id&&kept.noteNumber==='DN 448120'&&kept.condition==='short'&&kept.problem==='2 reels short, rest promised Thursday','engineer: kept under the signed-in engineer as typed');
    check(/^1\s*short, damaged or wrong/.test(await page.locator('.dl-stats dd').first().innerText())&&await page.locator('.dl-stats dd.dl-due').count()===1,`engineer: the figures update in place: ${await page.locator('.dl-stats dd').first().innerText()}`);
    check(/^2/.test(await page.locator('.dl-stats dd').nth(1).innerText()),'engineer: two in the last 7 days');
    const waiting=page.locator('#dl-sort-title + .dl-list .dl-delivery');
    check(await waiting.count()===1&&/Short · to sort/i.test(await waiting.locator('.tag').innerText())&&/Short or part delivery: 2 reels short/.test(await waiting.innerText()),'engineer: the short delivery is under To sort with what was short');
    check(/Everything else\s*1/.test(await page.locator('#dl-all-title').innerText()),'engineer: the rest are under Everything else');

    // A retry of the same save is kept once; the same id with other details is refused.
    const again=body({items:'Retry delivery'});
    const a=await post(page,again),b=await post(page,again);
    check(a.status()===201&&b.status()===201&&(await a.json()).id===(await b.json()).id,'engineer: a retry returns the first save');
    check((await post(page,{...again,items:'Other words'})).status()===409,'engineer: the same request with different details is refused');
    check(records('deliveries').filter(d=>d.items==='Retry delivery').length===1,'engineer: the retried delivery is kept once');
    await page.reload();await cards(page).first().waitFor();
    check((await cards(page).count())===3,'engineer: every delivery is there after a reload');

    // Withdraw the retry delivery: a reason is needed, it stays listed, struck through.
    const retry=page.locator('.dl-delivery',{hasText:'Retry delivery'});
    await retry.getByRole('button',{name:/^Withdraw: Edmundson Electrical: Retry delivery/}).click();
    await retry.getByRole('button',{name:'Withdraw record'}).click();
    check(/Say why/.test(await retry.locator('[role="alert"]').innerText()),'engineer: a withdrawal needs a reason');
    await retry.getByLabel('Why withdraw it?').fill('Recorded by mistake while testing');
    await retry.getByRole('button',{name:'Withdraw record'}).click();
    await retry.locator('.tag',{hasText:'Withdrawn'}).waitFor();
    check(/Withdrawn by Sam Spark · .*: Recorded by mistake while testing/.test(await retry.innerText()),'engineer: the withdrawn delivery says who, when and why');
    check(await retry.locator('.dl-items').evaluate(e=>getComputedStyle(e).textDecorationLine.includes('line-through')),'engineer: the withdrawn delivery is struck through');
    check(/^2/.test(await page.locator('.dl-stats dd').nth(1).innerText()),'engineer: the counts leave out the withdrawn delivery');
    await axe(page,'engineer 390px light, list');
    if(screenshot)await page.screenshot({path:join(screenshot,'deliveries-list-light-390.png'),fullPage:true});

    await page.goto(`${base}/engineer?project=${P}`);
    await row.locator('span',{hasText:'to sort'}).waitFor();
    check(await row.locator('.main>span').innerText()==='2 in the last 7 days · 1 to sort','engineer: the home row says one is to sort');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Another engineer cannot withdraw it, by the page or the API, but may mark it sorted.
  {
    const {context,page}=await open(plumber,'light',390);
    check((await page.request.post(`${base}/api/deliveries/${recordedId}`,{data:{action:'withdraw',reason:'Not mine'}})).status()===403,'another engineer: withdrawing is refused');
    await page.goto(`${base}/deliveries?project=${P}`);await cards(page).first().waitFor();
    const edm=page.locator('.dl-delivery',{hasText:'Edmundson'}).first();
    check((await edm.getByRole('button',{name:/^Withdraw/}).count())===0,'another engineer: no Withdraw on it');
    check((await edm.getByRole('button',{name:/^Mark sorted/}).count())===1,'another engineer: may mark it sorted');
    check((await page.locator('.dl-delivery',{hasText:'City Plumbing'}).getByRole('button',{name:/^Withdraw/}).count())===1,'another engineer: Withdraw on their own delivery');
    await context.close();
  }

  // Office on a desk, dark: Needs attention, marking sorted, the project sheet, may withdraw anyone's.
  {
    const {context,page,errors}=await open(manager,'dark',1440);
    const all=await (await page.request.get(`${base}/api/deliveries`)).json();
    check(all.totals.toSort===1&&all.projects.length===1&&all.projects[0].toSort[0].id===recordedId,'office: the list across projects has the one to sort');
    await page.goto(`${base}/office`);
    const also=page.locator('.sheet > .rmenu').last();
    await also.getByText(ONE_TITLE).waitFor();
    check(/Edmundson Electrical: 2 reels short, rest promised Thursday · arrived/.test(await also.locator('a',{hasText:ONE_TITLE}).innerText()),'office: Also needs attention says who, what was short and when it arrived');
    const bell=page.getByRole('button',{name:/^Attention \d+$/});
    await bell.click();
    const pop=page.locator('.attn-pop');
    const titles=await pop.locator('.mini b').allInnerTexts();
    check(titles.includes(ONE_TITLE),`office: the Attention list has the delivery: ${JSON.stringify(titles.slice(0,6))}`);
    check(Number((await bell.innerText()).match(/\d+/)[0])===titles.length,'office: the Attention count is the number of lines');
    await pop.getByRole('link',{name:ONE_TITLE}).click();
    await page.waitForURL(new RegExp(`/deliveries\\?project=${P}&returnTo=`));await cards(page).first().waitFor();
    check(await page.locator('a.back').first().innerText()==='← Back to Office','office: Back says Back to Office');
    check(/Edmundson/i.test(await cards(page).first().innerText()),`office: the line opens the project's deliveries with that one first: ${await cards(page).first().innerText()}`);
    check((await page.locator('.dl-delivery',{hasText:'City Plumbing'}).getByRole('button',{name:/^Withdraw/}).count())===1,'office: may withdraw an engineer\'s delivery');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'office 1440px: no sideways scroll');
    await axe(page,'office 1440px dark, list');
    if(screenshot)await page.screenshot({path:join(screenshot,'deliveries-list-dark-1440.png'),fullPage:true});
    // Marking it sorted needs a note, and takes the line off Needs attention.
    const edm=page.locator('.dl-delivery',{hasText:'Edmundson'}).first();
    await edm.getByRole('button',{name:/^Mark sorted/}).click();
    check(await page.waitForFunction(()=>document.activeElement?.id?.startsWith('dl-sorted-'),null,{timeout:2000}).then(()=>true,()=>false),'office: focus moves to how it was sorted');
    await edm.getByRole('button',{name:'Mark sorted',exact:true}).click();
    check(/how it was sorted/.test(await edm.locator('[role="alert"]').innerText()),'office: marking sorted needs a note');
    await edm.getByLabel('How was it sorted?').fill('Supplier sent the 2 reels on Thursday');
    await axe(page,'office 1440px dark, marking sorted');
    await edm.getByRole('button',{name:'Mark sorted',exact:true}).click();
    const done=page.locator('.dl-delivery',{hasText:'DN 448120'});
    await done.locator('.tag',{hasText:'sorted'}).waitFor();
    check(/Short · sorted/i.test(await done.locator('.tag').innerText())&&/Sorted by Office Manager · .*: Supplier sent the 2 reels on Thursday/.test(await done.innerText()),'office: the sorted delivery says who, when and how');
    check(await page.waitForFunction(()=>document.activeElement?.classList.contains('dl-title')&&document.activeElement.textContent.includes('200 back boxes'),null,{timeout:2000}).then(()=>true,()=>false),'office: focus goes to the sorted delivery');
    check(/Nothing to sort/.test(await page.locator('.dl-none').innerText())&&/All deliveries/.test(await page.locator('#dl-all-title').innerText()),'office: To sort is empty again');
    check(records('deliveries').find(d=>d.id===recordedId).sorted?.byId===manager.id,'office: the sorting is kept');

    // The spreadsheet.
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download spreadsheet'}).click()]);
    check(/^relay-deliveries-011LME-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()),`office: the spreadsheet is named for the project (${download.suggestedFilename()})`);
    const csv=readFileSync(await download.path(),'utf8');
    check(csv.startsWith('﻿Delivery note number,Project number,Project,Supplier,What arrived,Arrived on')&&csv.split('\r\n').filter(Boolean).length===4,'office: the spreadsheet has a header and every delivery, withdrawn included');
    check(csv.includes('Supplier sent the 2 reels on Thursday')&&csv.includes('Recorded by mistake while testing')&&csv.includes('DN 448120')&&csv.includes('"6 x 100m reels 2.5mm T&E, 200 back boxes"'),'office: the note, the withdrawal reason, the number and a comma kept in one cell');

    await page.getByRole('link',{name:/Back to Office/}).first().click();
    // The desk reads deliveries with its other records; wait for that answer rather than reading at once.
    check(await page.waitForFunction(t=>{const m=[...document.querySelectorAll('.sheet > .rmenu')].at(-1);return !!m&&m.textContent.length>0&&!m.textContent.includes(t);},ONE_TITLE,{timeout:5000}).then(()=>true,()=>false),'office: once sorted, the line leaves Needs attention');
    // The project sheet links to it.
    await page.goto(`${base}/office#/projects/${P}`);
    const links=page.getByRole('navigation',{name:'On this project'});
    await links.getByRole('link',{name:'Deliveries'}).first().click();
    await page.waitForURL(new RegExp(`/deliveries\\?project=${P}&returnTo=`));await cards(page).first().waitFor();
    await page.getByRole('button',{name:'Record a delivery'}).click();
    await page.getByText('Damaged',{exact:true}).click();
    await axe(page,'office 1440px dark, form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'deliveries-form-dark-1440.png'),fullPage:true});
    // No connection: what was typed stays.
    await page.getByLabel('Supplier',{exact:true}).fill('Wolseley');
    await page.getByLabel('What arrived').fill('3 panel radiators');
    await page.getByLabel('What was damaged?').fill('One radiator dented, noted on the delivery note');
    await context.setOffline(true);
    await page.getByRole('button',{name:'Save delivery'}).click();
    await page.locator('.dl-form [role="alert"]').filter({hasText:/No connection/}).waitFor();
    check(await page.getByLabel('What was damaged?').inputValue()==='One radiator dented, noted on the delivery note','office: with no connection the delivery stays in the form');
    await context.setOffline(false);
    await page.getByRole('button',{name:'Save delivery'}).click();
    await page.locator('.dl-delivery',{hasText:'Wolseley'}).waitFor();
    check(records('deliveries').find(d=>d.supplier==='Wolseley')?.receivedBy==='Office Manager','office: may record a delivery');
    // Another project starts empty; a complete project opens on the project choice.
    await page.getByLabel('Project',{exact:true}).selectOption('proj-014lme');
    await page.locator('.dl-none').waitFor();
    check(/No deliveries recorded on this project yet/.test(await page.locator('.dl-none').innerText()),'office: another project has a clear empty state');
    check(!(await page.getByRole('link',{name:'Download spreadsheet'}).count()),'office: no spreadsheet with no deliveries');
    await page.goto(`${base}/deliveries?project=proj-004lcp`);await page.locator('.eng-panel',{hasText:'Choose a project'}).waitFor();
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
    const whatsNew=page.locator('#help-new'),entry=whatsNew.getByRole('heading',{name:'Deliveries',exact:true}),more=whatsNew.getByRole('button',{name:/^Show all/});
    let listed=false;
    for(const until=Date.now()+8000;!listed&&Date.now()<until;){
      if(await entry.count()){listed=true;break;}
      if(await more.count())await more.click().catch(()=>{});
      await page.waitForTimeout(200);
    }
    check(listed,'help: What\'s new lists Deliveries');
    await context.close();
  }
  console.log(`Deliveries check passed (${checks} checks): refused saves, engineer home row, recording from a recent supplier, a short delivery kept to sort, marking it sorted, reload, retries, withdrawing and who may, spreadsheet, office Needs attention and project sheet, no connection, empty and complete projects, axe, 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
