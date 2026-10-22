// Browser check (2026-10-22): a defect that is another trade's work reaches
// the office saying whose it is. Sam, an electrician, flags a plumber's leak
// from "Flag a defect" at 390px and chooses P&H. The office's "Unassigned
// issues" row names the trade; the Assign box on the office desk and on the
// issue page says the trade and offers the company already doing P&H work on
// this project (not the electrical one) as a one-tap choice. The tap only
// fills Responsible: nothing is assigned until the office presses Assign. A
// defect marked "Other" offers no company.
// Office at 1440px light and dark and 390px light; no sideways scroll.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-other-trade-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const sam={id:'entra:ot-sam',oid:'ot-sam',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const pip={id:'entra:ot-pip',oid:'ot-pip',name:'Pip Pipes',email:'pip@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:ot-mgr',oid:'ot-mgr',name:'Morgan Office',email:'morgan@example.test',role:'Manager'};
const sessions={};
for(const p of [sam,pip,manager]){const id=randomUUID();sessions[p.oid]=id;putRecord('sessions',{id,principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme',PLUMBER='Aire Plumbing Ltd',SPARKS='Northbank Electrical';
const photo=()=>({id:randomUUID(),dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC',caption:'',capturedAt:new Date().toISOString()});
const defect=(location,what,owner,trade)=>({id:randomUUID(),type:'defect',location,whatHappened:what,actionNeeded:'',owner,affectedTrade:trade,photos:[photo()]});
// Earlier issues on the project: the plumber's company and the electrician's, already named by site.
const earlier=createReport(P,pip.name,pip);
const saved=saveDraft(earlier.id,{...earlier,observations:[defect('Flat 2.01','Waste pipe not clipped',PLUMBER,'P&H'),defect('Flat 2.02','Socket loose',SPARKS,'Electrical'),defect('Flat 2.03','Hoarding damaged','',  'Other / non-Leodis')]},earlier.version);
assert.ok(saved.ok,saved.reason);assert.ok((await submitReport(earlier.id,{name:pip.name},saved.value.version)).ok);
const other=listIssues(P).find(i=>i.location==='Flat 2.03');
const png=await sharp({create:{width:24,height:24,channels:3,background:'#336699'}}).png().toBuffer();
const port=4476,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-other-trade',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const flat=s=>s.replace(/\s+/g,' ').trim();
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  const errors=[];
  const open=async(who,scheme,width)=>{const phone=width<700;const context=await browser.newContext({viewport:{width,height:phone?844:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,phone};};
  const shot=async(page,name)=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}.png`),fullPage:true});}};
  const noSideways=async(page,label)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=0,`${label}: no sideways scroll`);

  // Sam flags the leak: the trade is one choice on the form, then it goes.
  const LEAK='Water leaking from joint under sink';
  {
    const {context,page}=await open(sam,'light',390);
    await page.goto(`${base}/engineer?project=${P}`);
    await page.getByRole('button',{name:/Flag a defect/}).first().tap();
    await page.getByLabel('Defect photographs').setInputFiles({name:'leak.png',mimeType:'image/png',buffer:png});
    await page.getByLabel('What needs attention?').fill(LEAK);
    await page.getByLabel('Where on site?').fill('Flat 2.04 kitchen');
    await page.getByLabel('Trade affected').selectOption('P&H');
    await page.getByRole('button',{name:/^Send defect to /}).tap();
    await page.waitForFunction(()=>!document.querySelector('#defect-description'),null,{timeout:15000});
    await context.close();
  }
  const leak=()=>listIssues(P).find(i=>i.description===LEAK);
  eq(leak()?.affectedTrade,'P&H','the leak is recorded as P&H work');
  eq(leak()?.owner,'','nobody is down for it yet');

  for(const [scheme,width] of [['light',1440],['dark',1440],['light',390]]){
    const label=`${scheme} ${width}px`;
    const {context,page,phone}=await open(manager,scheme,width);
    // The overview's Unassigned issues row says whose it is.
    await page.goto(`${base}/office#/projects`);
    const group=page.locator('.act').filter({hasText:'Unassigned issues'});
    await group.locator('.rt').first().waitFor({timeout:20000});
    const rowOf=text=>group.locator('a.rt',{has:page.locator('b',{hasText:text})}).first().locator('xpath=..');
    const row=rowOf(LEAK);
    const words=flat(await row.locator('.rt span').first().innerText());
    ok(/Flat 2\.04 kitchen · P&H · raised /.test(words),`${label}: the Unassigned row names the trade: "${words}"`);
    const hoarding=flat(await rowOf('Hoarding damaged').locator('.rt span').first().innerText());
    ok(hoarding.includes('· Other / non-Leodis ·'),`${label}: an "Other" defect says so: "${hoarding}"`);
    if(phone)await row.evaluate(e=>e.scrollIntoView({block:'center'}));
    await shot(page,`office-unassigned-${scheme}-${width}`);
    // Assign from the row: the trade, and the plumber's company first, one tap.
    await row.getByRole('button',{name:'Assign'}).click();
    const dialog=page.locator('.ws-dialog');
    await dialog.getByText('Trade: P&H').waitFor();checks++;
    const offer=dialog.getByRole('group',{name:'Already doing P&H work on this project'});
    await offer.waitFor({timeout:10000});
    eq(JSON.stringify(await offer.getByRole('button').allInnerTexts()),JSON.stringify([PLUMBER]),`${label}: the box offers the plumber's company, not the electrician's`);
    const box=dialog.locator('input[name="owner"]');
    eq(await box.inputValue(),'',`${label}: Responsible starts empty: nothing is chosen for the office`);
    await offer.getByRole('button',{name:PLUMBER}).click();
    eq(await box.inputValue(),PLUMBER,`${label}: one tap fills Responsible`);
    await page.waitForTimeout(300);
    eq(leak().owner,'',`${label}: the tap assigns nothing on its own`);
    await noSideways(page,`${label} Assign box`);
    await shot(page,`office-assign-${scheme}-${width}`);
    await dialog.getByRole('button',{name:'Cancel'}).click();
    // The issue page's Assign: the same offer, as chips.
    await page.goto(`${base}/issues/${leak().id}`);
    await page.getByRole('region',{name:'Who puts it right'}).getByRole('button',{name:/Assign/}).click();
    await page.getByRole('region',{name:'Who puts it right'}).getByText('Trade: P&H',{exact:true}).waitFor();checks++;
    const chips=page.getByRole('group',{name:'Already doing P&H work here'});
    await chips.waitFor({timeout:10000});
    eq(JSON.stringify(await chips.getByRole('button').allInnerTexts()),JSON.stringify([PLUMBER]),`${label}: the issue page offers the plumber's company`);
    const chip=chips.getByRole('button',{name:PLUMBER});
    if(phone){const b=await chip.boundingBox();ok(b.height>=47.5,`${label}: the chip is a thumb's height (${Math.round(b.height)})`);}
    await chip.click();
    eq(await page.getByLabel('Responsible').inputValue(),PLUMBER,`${label}: the chip fills Responsible`);
    eq(await chip.getAttribute('aria-pressed'),'true',`${label}: the chip shows it is the one in the box`);
    eq(leak().owner,'',`${label}: still nothing assigned until Assign is pressed`);
    await noSideways(page,`${label} issue page`);
    await shot(page,`issue-assign-${scheme}-${width}`);
    // "Other" is many companies: no offer.
    await page.goto(`${base}/issues/${other.id}`);
    // Wait for the companies to arrive, so "no offer" is not just "not loaded yet".
    const read=page.waitForResponse(r=>r.url().includes('/api/locations'));
    await page.getByRole('region',{name:'Who puts it right'}).getByRole('button',{name:/Assign/}).click();
    await (await read).finished();await page.getByLabel('Responsible').waitFor();await page.waitForTimeout(200);
    eq(await page.locator('.eng-suggestions').count(),0,`${label}: an "Other" defect offers no company on the issue page`);
    // And none on the desk's Assign box either.
    await page.goto(`${base}/office#/projects`);
    const otherRow=page.locator('.act').filter({hasText:'Unassigned issues'}).locator('a.rt',{has:page.locator('b',{hasText:'Hoarding damaged'})}).first().locator('xpath=..');
    const deskRead=page.waitForResponse(r=>r.url().includes('/api/locations'));
    await otherRow.getByRole('button',{name:'Assign'}).click();
    await (await deskRead).finished();await page.waitForTimeout(200);
    await page.locator('.ws-dialog').getByText('Trade: Other / non-Leodis').waitFor();checks++;
    eq(await page.locator('.ws-dialog .assign-offer').count(),0,`${label}: an "Other" defect offers no company on the desk`);
    await context.close();
  }
  // The office presses Assign: now it is the plumber's.
  {
    const {context,page}=await open(manager,'light',1440);
    await page.goto(`${base}/office#/projects`);
    const group=page.locator('.act').filter({hasText:'Unassigned issues'});
    await group.locator('a.rt',{has:page.locator('b',{hasText:LEAK})}).first().locator('xpath=..').getByRole('button',{name:'Assign'}).click();
    const dialog=page.locator('.ws-dialog');
    await dialog.getByRole('group',{name:'Already doing P&H work on this project'}).getByRole('button',{name:PLUMBER}).click();
    await dialog.locator('button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('.ws-dialog'),null,{timeout:10000});
    eq(leak().owner,PLUMBER,'pressing Assign gives it to the plumber');
    await context.close();
  }
  eq(errors.length,0,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-other-trade-defect: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
