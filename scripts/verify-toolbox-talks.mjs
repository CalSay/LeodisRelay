// Browser check for Toolbox talks: the engineer home row, recording a talk
// with a topic starter and "Same people as the last talk", the figures, a
// reload, a retry kept once, refused and closed projects, withdrawing (by
// the recorder and the office, not another engineer), the spreadsheet, the
// office project sheet link, no connection, and axe at 390px light and
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
const root=mkdtempSync(join(tmpdir(),'relay-toolbox-talks-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:tt-engineer',oid:'tt-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const plumber={id:'entra:tt-plumber',oid:'tt-plumber',name:'Pat Plumb',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:tt-manager',oid:'tt-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,plumber,manager]){sessions[p.id]=randomUUID();putRecord('sessions',{id:sessions[p.id],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const P='proj-011lme';
const LONDON=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'});
const daysBack=n=>LONDON.format(new Date(Date.now()-n*86400000));
// A talk the plumber gave nine days ago, so the page starts with the last talk more than a week old.
putRecord('toolbox-talks',{id:'talk-seed-1',projectId:P,day:daysBack(9),topic:'Hot works on the roof plant deck',givenBy:'Pat Plumb',attendees:['Pat Plumb','Chris Weld','Dana Lee, Northbank Electrical'],by:'Pat Plumb',byId:plumber.id,at:new Date(Date.now()-9*86400000).toISOString()});
const port=4357,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-toolbox-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const axe=async(page,label)=>{await page.waitForFunction(()=>document.title.length>0,null,{timeout:5000}).catch(()=>{});await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const body=(extra={})=>({project:P,requestId:randomUUID(),day:daysBack(0),topic:'Safe isolation',givenBy:'Sam Spark',attendees:['Jo Bloggs'],...extra});
const post=(page,data)=>page.request.post(`${base}/api/toolbox-talks`,{data});
const talks=page=>page.locator('.tt-talk');
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(who,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,acceptDownloads:true});if(who)await context.addCookies([{name:'relay_session',value:sessions[who.id],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: nothing read or kept, and the page goes to sign in with the project kept.
  {
    const {context,page}=await open(null,'light',390);
    check((await page.request.get(`${base}/api/toolbox-talks?project=${P}`)).status()===401,'signed out: reading refused');
    check((await post(page,body())).status()===401,'signed out: recording refused');
    await page.goto(`${base}/toolbox-talks?project=${P}`);await page.waitForURL(/\/signin/);
    check(decodeURIComponent(page.url()).includes(`/toolbox-talks?project=${P}`),'signed out: sign in returns to the same project');
    await context.close();
  }

  // Engineer on a phone, light.
  let recordedId;
  {
    const {context,page,errors}=await open(engineer,'light',390);
    check((await post(page,body({topic:'  '}))).status()===422,'engineer: a talk with no topic is refused');
    check((await post(page,body({attendees:[]}))).status()===422,'engineer: a talk with nobody attending is refused');
    check((await post(page,body({day:daysBack(-1)}))).status()===422,'engineer: a talk in the future is refused');
    check((await post(page,body({day:daysBack(40)}))).status()===422,'engineer: a talk more than a month back is refused');
    check((await post(page,body({attendees:'Jo'}))).status()===422,'engineer: a malformed talk is refused');
    check((await post(page,body({project:'proj-missing'}))).status()===404,'engineer: a project that does not exist is refused');
    check((await post(page,body({project:'proj-004lcp'}))).status()===409,'engineer: a complete project takes no new talks');
    check(records('toolbox-talks').length===1,'engineer: nothing kept by the refused saves');

    await page.goto(`${base}/engineer?project=${P}`);
    const row=page.locator('.eng-row',{has:page.locator('b',{hasText:/^Toolbox talks$/})});
    await row.locator('span',{hasText:/Last:/}).waitFor();
    const rowText=await row.locator('.main>span').innerText();
    check(rowText==='Last: Hot works on the roof plant deck · 9 days ago',`engineer: the home row shows the last talk and how long ago: ${JSON.stringify(rowText)}`);
    check(await row.locator('.main>span').evaluate(e=>e.getBoundingClientRect().height<=40),'engineer: the home row stays within two lines');
    check(await row.evaluate(e=>e.closest('[role="group"]')?.querySelector('h3')?.textContent==='Issues and safety'),'engineer: the row is under Issues and safety');
    await row.click();await page.waitForURL(new RegExp(`/toolbox-talks\\?project=${P}&returnTo=`));
    await talks(page).first().waitFor();
    await page.waitForFunction(()=>document.title.startsWith('Toolbox talks'),null,{timeout:5000}).catch(()=>{});
    check((await page.title()).startsWith('Toolbox talks'),`engineer: the tab is named (${await page.title()})`);
    check(await page.locator('a.back').first().innerText()==='← Back to Site','engineer: Back says Back to Site');
    check(/9 days ago/.test(await page.locator('.tt-stats dd').first().innerText())&&await page.locator('.tt-stats dd.tt-due').count()===1,'engineer: the last talk is 9 days ago and marked as more than a week');
    check(/1 talk/.test(await page.locator('.tt-stats dd').nth(1).innerText()),'engineer: one talk in the last four weeks');

    // Record a talk: empty first, then a starter topic and the same people as last time.
    await page.getByRole('button',{name:'Record a toolbox talk'}).click();
    check(await page.waitForFunction(()=>document.activeElement?.id==='tt-topic',null,{timeout:2000}).then(()=>true,()=>false),'engineer: the form opens on the topic');
    check(await page.getByLabel('Given by').inputValue()==='Sam Spark','engineer: given by starts as the signed-in engineer');
    check(await page.getByLabel('Given on').inputValue()===daysBack(0),'engineer: the day starts as today');
    await page.getByRole('button',{name:'Save toolbox talk'}).click();
    check(/what the talk was about/.test(await page.locator('.tt-form [role="alert"]').innerText()),'engineer: an empty talk says what to do');
    const starters=page.getByRole('group',{name:'Topics to start from'}).getByRole('button');
    check((await starters.first().innerText())==='Hot works on the roof plant deck','engineer: the project\'s own topic is offered first');
    await starters.filter({hasText:/^Working at height$/}).click();
    check(await page.getByLabel('Topic',{exact:true}).inputValue()==='Working at height','engineer: a starter fills the topic');
    await page.getByRole('button',{name:'Save toolbox talk'}).click();
    check(/everyone who attended/.test(await page.locator('.tt-form [role="alert"]').innerText()),'engineer: no attendees says what to do');
    await page.getByRole('button',{name:/^Same people as the last talk \(3\)$/}).click();
    await page.getByLabel('Who attended').press('Control+End');
    await page.getByLabel('Who attended').pressSequentially('\nJo Bloggs\nchris weld');
    check(/^4 names\./.test(await page.locator('#tt-attendees-help').innerText()),`engineer: the count leaves out a name typed twice: ${await page.locator('#tt-attendees-help').innerText()}`);
    await page.getByLabel(/^Notes/).fill('Asked about edge protection on the level 3 slab.');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'engineer 390px: no sideways scroll with the form open');
    check(await page.evaluate(()=>[...document.querySelectorAll('.tt-page button, .tt-page input, .tt-page select, .tt-page summary')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().height>=44)),'engineer 390px: every control is at least 44px tall');
    await axe(page,'engineer 390px light, form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'toolbox-form-light-390.png'),fullPage:true});
    await page.getByRole('button',{name:'Save toolbox talk'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.tt-talk').length===2);
    check(!(await page.locator('.tt-form').count()),'engineer: the form closes after saving');
    check(await page.waitForFunction(()=>document.activeElement?.textContent==='Record a toolbox talk',null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus returns to Record a toolbox talk');
    check(/Toolbox talk recorded: Working at height, 4 people attending/.test(await page.locator('.eng-sr[role="status"]').innerText()),'engineer: a screen reader hears it was saved');
    const first=talks(page).first();
    check((await first.locator('.tt-topic-text').innerText()).trim()==='Working at height','engineer: the new talk is at the top');
    check(/given by Sam Spark · 4 people attending/.test(await first.locator('.tt-meta').first().innerText()),'engineer: who gave it and how many attended');
    check(/today/.test(await page.locator('.tt-stats dd').first().innerText())&&!(await page.locator('.tt-stats dd.tt-due').count()),'engineer: the figures update in place');
    check(/2 talks/.test(await page.locator('.tt-stats dd').nth(1).innerText())&&/7 attending in all · 4 different people/.test(await page.locator('.tt-stats dd').nth(1).innerText()),`engineer: four-week figures: ${await page.locator('.tt-stats dd').nth(1).innerText()}`);
    const kept=records('toolbox-talks').find(t=>t.topic==='Working at height');
    recordedId=kept?.id;
    check(kept&&kept.by==='Sam Spark'&&kept.byId===engineer.id&&kept.attendees.join('|')==='Pat Plumb|Chris Weld|Dana Lee, Northbank Electrical|Jo Bloggs'&&kept.notes.startsWith('Asked about'),'engineer: kept under the signed-in engineer with the names cleaned');
    await page.reload();await talks(page).first().waitFor();
    check((await talks(page).count())===2,'engineer: both talks are there after a reload');
    await first.locator('summary').click();
    check((await first.locator('.tt-names li').allInnerTexts()).length===4,'engineer: the names open under Who attended');

    // A retry of the same save is kept once; the same id with other details is refused.
    const again=body({topic:'Retry talk'});
    const a=await post(page,again),b=await post(page,again);
    check(a.status()===201&&b.status()===201&&(await a.json()).id===(await b.json()).id,'engineer: a retry returns the first save');
    check((await post(page,{...again,topic:'Other words'})).status()===409,'engineer: the same request with different details is refused');
    check(records('toolbox-talks').filter(t=>t.topic==='Retry talk').length===1,'engineer: the retried talk is kept once');

    // Withdraw the retry talk: a reason is needed, it stays listed, struck through.
    await page.reload();await talks(page).first().waitFor();
    check((await page.locator('.tt-talk',{hasText:'Hot works'}).getByRole('button',{name:/^Withdraw/}).count())===0,'engineer: no Withdraw on a talk someone else recorded');
    const retry=page.locator('.tt-talk',{hasText:'Retry talk'});
    await retry.getByRole('button',{name:/^Withdraw: Retry talk/}).click();
    check(await page.waitForFunction(()=>document.activeElement?.id?.startsWith('tt-reason-'),null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus moves to the reason');
    await retry.getByRole('button',{name:'Withdraw record'}).click();
    check(/Say why/.test(await retry.locator('[role="alert"]').innerText()),'engineer: a withdrawal needs a reason');
    await retry.getByLabel('Why withdraw it?').fill('Recorded by mistake while testing');
    await retry.getByRole('button',{name:'Withdraw record'}).click();
    await retry.locator('.tag',{hasText:'Withdrawn'}).waitFor();
    check(/Withdrawn by Sam Spark · .*: Recorded by mistake while testing/.test(await retry.innerText()),'engineer: the withdrawn talk says who, when and why');
    // Focus moves on the frame after the Withdrawn tag is drawn, so wait for it rather than reading at once.
    check(await page.waitForFunction(()=>document.activeElement?.classList.contains('tt-topic')&&document.activeElement.textContent.includes('Retry talk'),null,{timeout:2000}).then(()=>true,()=>false),'engineer: focus goes to the withdrawn talk');
    check(await retry.locator('.tt-topic-text').evaluate(e=>getComputedStyle(e).textDecorationLine.includes('line-through')),'engineer: the withdrawn topic is struck through');
    check(/Talks given\s*2/.test(await page.locator('#tt-list-title').innerText()),'engineer: the count leaves out the withdrawn talk');
    check(records('toolbox-talks').find(t=>t.topic==='Retry talk').withdrawn?.reason==='Recorded by mistake while testing','engineer: the withdrawal is kept with its reason');
    await axe(page,'engineer 390px light, list');
    if(screenshot)await page.screenshot({path:join(screenshot,'toolbox-list-light-390.png'),fullPage:true});

    // The spreadsheet.
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download spreadsheet'}).click()]);
    check(/^relay-toolbox-talks-011LME-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()),`engineer: the spreadsheet is named for the project (${download.suggestedFilename()})`);
    const csv=readFileSync(await download.path(),'utf8');
    check(csv.startsWith('﻿Project number,Project,Topic,Given on,Given by,Attendees')&&csv.split('\r\n').filter(Boolean).length===4,'engineer: the spreadsheet has a header and every talk, withdrawn included');
    check(csv.includes('"Pat Plumb; Chris Weld; Dana Lee, Northbank Electrical; Jo Bloggs"')&&csv.includes('Recorded by mistake while testing'),'engineer: attendees in one cell, and the withdrawal reason');

    await page.goto(`${base}/engineer?project=${P}`);
    await row.locator('span',{hasText:/Last: Working at height · today/}).waitFor();
    check(true,'engineer: the home row shows the new talk');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Another engineer cannot withdraw it, by the page or the API.
  {
    const {context,page}=await open(plumber,'light',390);
    check((await page.request.post(`${base}/api/toolbox-talks/${recordedId}`,{data:{reason:'Not mine'}})).status()===403,'another engineer: withdrawing is refused');
    await page.goto(`${base}/toolbox-talks?project=${P}`);await talks(page).first().waitFor();
    check((await page.locator('.tt-talk',{hasText:'Working at height'}).getByRole('button',{name:/^Withdraw/}).count())===0,'another engineer: no Withdraw on it');
    check((await page.locator('.tt-talk',{hasText:'Hot works'}).getByRole('button',{name:/^Withdraw/}).count())===1,'another engineer: Withdraw on their own talk');
    await context.close();
  }

  // Office on a desk, dark: reached from the project sheet, may withdraw anyone's.
  {
    const {context,page,errors}=await open(manager,'dark',1440);
    await page.goto(`${base}/office#/projects/${P}`);
    const links=page.getByRole('navigation',{name:'On this project'});
    await links.getByRole('link',{name:'Toolbox talks'}).first().click();
    await page.waitForURL(new RegExp(`/toolbox-talks\\?project=${P}&returnTo=`));await talks(page).first().waitFor();
    check(await page.locator('a.back').first().innerText()==='← Back to Office','office: Back says Back to Office');
    check((await page.locator('.tt-talk',{hasText:'Working at height'}).getByRole('button',{name:/^Withdraw/}).count())===1,'office: may withdraw an engineer\'s talk');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'office 1440px: no sideways scroll');
    await page.getByRole('button',{name:'Record a toolbox talk'}).click();
    await axe(page,'office 1440px dark, form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'toolbox-form-dark-1440.png'),fullPage:true});
    // No connection: what was typed stays.
    await page.getByLabel('Topic',{exact:true}).fill('Fire safety and emergency routes');
    await page.getByLabel('Who attended').fill('Jo Bloggs');
    await context.setOffline(true);
    await page.getByRole('button',{name:'Save toolbox talk'}).click();
    await page.locator('.tt-form [role="alert"]').filter({hasText:/No connection/}).waitFor();
    check(await page.getByLabel('Topic',{exact:true}).inputValue()==='Fire safety and emergency routes','office: with no connection the talk stays in the form');
    await context.setOffline(false);
    await page.getByRole('button',{name:'Save toolbox talk'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.tt-talk').length===4);
    check(records('toolbox-talks').find(t=>t.topic==='Fire safety and emergency routes')?.by==='Office Manager','office: may record a talk');
    // Another project's talks are its own; a complete project opens on the project choice.
    await page.getByLabel('Project',{exact:true}).selectOption('proj-014lme');
    await page.locator('.tt-none').waitFor();
    check(/None yet/.test(await page.locator('.tt-stats dd').first().innerText()),'office: another project starts with none');
    check(!(await page.getByRole('link',{name:'Download spreadsheet'}).count()),'office: no spreadsheet with no talks');
    await page.goto(`${base}/toolbox-talks?project=proj-004lcp`);await page.locator('.eng-panel',{hasText:'Choose a project'}).waitFor();
    check(true,'office: a complete project in the address opens on the project choice');
    if(screenshot){await page.goto(`${base}/toolbox-talks?project=${P}`);await talks(page).first().waitFor();await page.screenshot({path:join(screenshot,'toolbox-list-dark-1440.png'),fullPage:true});}
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Help lists it.
  {
    const {context,page}=await open(engineer,'light',390);
    await page.goto(`${base}/help?for=site`);
    // Help shows the latest few entries and the rest under "Show all" (a first visit marks none as new),
    // so open the full list, again if the first click came before the page was ready.
    const whatsNew=page.locator('#help-new'),entry=whatsNew.getByRole('heading',{name:'Toolbox talks',exact:true}),more=whatsNew.getByRole('button',{name:/^Show all/});
    let listed=false;
    for(const until=Date.now()+8000;!listed&&Date.now()<until;){
      if(await entry.count()){listed=true;break;}
      if(await more.count())await more.click().catch(()=>{});
      await page.waitForTimeout(200);
    }
    check(listed,'help: What\'s new lists Toolbox talks');
    await context.close();
  }
  console.log(`Toolbox talks check passed (${checks} checks): refused saves, engineer home row, recording with starters and the same people, figures, reload, retries, withdrawing and who may, spreadsheet, office from the project sheet, other and complete projects, no connection, axe, 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
