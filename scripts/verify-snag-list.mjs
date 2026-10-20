// Browser check for the snag list: one project's open issues by location, for
// a company or trade, opened from the office register and the engineer's
// Issues view, and printable without the app chrome.
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
const root=mkdtempSync(join(tmpdir(),'relay-snag-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:snag-engineer',oid:'snag-engineer',name:'Snag Engineer',email:'snag@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:snag-manager',oid:'snag-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// A 4x3 grey PNG, stored inline the way older issues still carry photographs.
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC';
let n=0;
const issue=(extra)=>{n++;const i={id:randomUUID(),reference:`011LME-ISS-${String(n).padStart(3,'0')}`,projectId:'proj-011lme',location:'Level 2 corridor',description:`Issue ${n}`,actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',source:'individual',raisedAt:'2026-10-01T09:00:00.000Z',events:[{at:'2026-10-01T09:00:00.000Z',actor:'Snag Engineer',kind:'raised',note:'',photos:[]}],...extra};putRecord('issues',i);return i;};
const late=issue({description:'Cable tray lid missing above door 2.14',actionNeeded:'Fit the missing lid and fix the cover strap',targetDate:'2026-10-01',events:[{at:'2026-10-01T09:00:00.000Z',actor:'Snag Engineer',kind:'raised',note:'',photos:[{id:randomUUID(),dataUrl:png,caption:'Tray above door 2.14'}]}]});
const fixed=issue({location:'level 2  Corridor',description:'Light fitting loose',work:'awaiting_verification'});
const hvac=issue({location:'Plant room',owner:'Cool Air Ltd',affectedTrade:'HVAC',description:'Duct insulation torn'});
const closed=issue({description:'Closed socket faceplate',work:'closed'});
const nowhere=issue({location:'',description:'Spare cable left in riser'});
const elsewhere=issue({projectId:'proj-014lme',reference:'014LME-ISS-001',description:'Kirkstall issue'});
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-snag-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const items=page=>page.locator('.snag-item');
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Engineer, phone width, light: the Issues view links to a list for their own trade.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/engineer?project=proj-011lme&view=issues`);
    const link=page.getByRole('link',{name:'Snag list · Electrical'});await link.waitFor();
    check(true,'engineer: Issues view offers a snag list for their trade');
    await link.click();await page.waitForURL(/\/issues\/snag-list\?/);await page.locator('.snag-sheet').waitFor();
    const url=new URL(page.url());
    check(url.searchParams.get('project')==='proj-011lme'&&url.searchParams.get('trade')==='Electrical',`engineer: list opens on the project and trade (${url.search})`);
    const text=await page.locator('.snag-sheet').innerText();
    check(text.includes('Tetley Hall - Block E')&&text.includes('Electrical work')&&text.includes('011LME'),`engineer: sheet names the project and trade`);
    check(await items(page).count()===3,`engineer: three open Electrical issues, not closed, HVAC or another project (${await items(page).count()})`);
    check(!text.includes(closed.description)&&!text.includes(hvac.description)&&!text.includes(elsewhere.description),'engineer: closed, other-trade and other-project issues left out');
    const groups=await page.locator('.snag-group h2').allInnerTexts();
    check(groups.length===2&&/Level 2 corridor\s*2/.test(groups[0])&&/No location recorded\s*1/.test(groups[1]),`engineer: grouped by location as written, no location last: ${JSON.stringify(groups)}`);
    const first=await items(page).nth(0).innerText();
    check(first.includes(late.description)&&first.includes('To do: Fit the missing lid')&&/past target/i.test(first)&&first.includes('target 1 Oct 2026'),`engineer: first row has action, owner, target and past-target tag: ${first}`);
    check(/fixed, to check/i.test(await items(page).nth(1).innerText()),'engineer: fixed work marked and listed after work still to do');
    check(await page.locator('.snag-photo').count()===1,'engineer: the raised photograph shows');
    check((await page.locator('.snag-summary').innerText()).includes('2 to put right'),'engineer: summary counts work still to do');
    const box=await page.locator('.snag-sheet').boundingBox();
    check(box&&box.width<=390,'engineer: sheet fits the phone width');
    await page.getByLabel('Show photographs').uncheck();await page.waitForURL(/photos=off/);
    check(await page.locator('.snag-photo').count()===0&&new URL(page.url()).searchParams.get('photos')==='off','engineer: photographs can be left off, and the choice is in the address');
    if(screenshot)await page.screenshot({path:join(screenshot,'snag-light-390.png'),fullPage:true});
    await page.getByRole('link',{name:late.reference}).click();await page.waitForURL(`**/issues/${late.id}**`);
    await page.getByRole('link',{name:/Tetley Hall/}).first().click();await page.waitForURL(/\/issues\/snag-list\?.*photos=off/);await page.locator('.snag-sheet').waitFor();
    check(await items(page).count()===3&&await page.locator('.snag-photo').count()===0,'engineer: back from an issue returns to the same list and choices');
    await page.getByRole('link',{name:/Back to issues/}).click();await page.waitForURL(/\/engineer\?project=proj-011lme&view=issues/);
    check(true,'engineer: back returns to the Issues view');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Office, desktop, dark: the register links to a list for the company picked there.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/issues`);
    await page.getByRole('heading',{name:'Issues'}).waitFor();
    await page.locator('.filters').getByLabel('Project').selectOption('proj-011lme');
    // The register's company filter is free text; the snag list takes it when it names one company exactly.
    await page.locator('.filters').getByLabel('Company').fill('sparks ltd');
    await page.locator('a[href*="owner=Sparks+Ltd"]',{hasText:'Snag list'}).click();await page.waitForURL(/\/issues\/snag-list\?/);await page.locator('.snag-sheet').waitFor();
    const url=new URL(page.url());
    check(url.searchParams.get('project')==='proj-011lme'&&url.searchParams.get('owner')==='Sparks Ltd'&&!url.searchParams.get('trade'),`office: list opens on the project and company chosen in the register (${url.search})`);
    check(await items(page).count()===3&&(await page.locator('.snag-for').innerText())==='Sparks Ltd','office: Sparks Ltd has three open items');
    await page.getByLabel('Company or person').selectOption('Cool Air Ltd');
    check(await items(page).count()===1&&(await items(page).nth(0).innerText()).includes(hvac.description),'office: switching company lists only theirs');
    await page.getByLabel('Company or person').selectOption('Sparks Ltd');
    if(screenshot)await page.screenshot({path:join(screenshot,'snag-dark-1440.png'),fullPage:true});
    // Printed: no app bar, controls or back link; the prototype banner stays; black on white.
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.appbar').isVisible())&&!(await page.locator('.snag-controls').isVisible())&&!(await page.locator('.back').isVisible()),'print: app bar, controls and back link hidden');
    check(await page.locator('.banner').isVisible(),'print: prototype banner still prints');
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.snag-sheet')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white sheet in dark mode (${bg})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'snag-print-dark.png'),fullPage:true});
    const pdf=await page.pdf({format:'A4'});
    check(pdf.length>1000,`print: produces an A4 PDF (${pdf.length} bytes)`);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('link',{name:/Back to issues/}).click();await page.waitForURL(/\/office#\/issues/);
    check(true,'office: back returns to the register');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // No project chosen: the page asks for one rather than listing everything.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/issues/snag-list`);
    await page.getByText('Choose a project to list its open issues').waitFor();
    check(!(await page.getByRole('button',{name:'Print or save as PDF'}).isEnabled()),'no project: printing is not offered yet');
    await page.locator('.snag-controls').getByLabel('Project').selectOption('proj-014lme');
    await page.locator('.snag-sheet').waitFor();
    check(await items(page).count()===1,'no project: choosing one lists its issues');
    assert.deepEqual(errors,[],'empty: page errors');
    await context.close();
  }
  console.log(`Snag list check passed (${checks} checks): engineer and office routes, filters, grouping, photographs, print layout, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
