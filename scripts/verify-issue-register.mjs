// Browser check for FE-5a: the office issue register filters by location text,
// responsible company and verification status, and pages through the whole
// register from the server, so nothing past the first page is out of reach.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the register at 1440px and 1200px, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-issue-register-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const manager={id:'entra:register-manager',oid:'register-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:register-engineer',oid:'register-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const old=new Date(Date.now()-10*86400000).toISOString();
// 130 issues over two projects: more than two pages of the register.
const seeded=[];
for(let n=1;n<=130;n++){
  const work=n%10===0?'awaiting_verification':n%7===0?'closed':n%3===2?'open':'assigned';
  const i={id:`reg-${n}`,reference:`DEMO-${n<=100?'011LME':'014LME'}-ISS-${String(n).padStart(3,'0')}`,projectId:n<=100?'proj-011lme':'proj-014lme',source:'report',
    reportedBy:engineer.name,location:n%5===0?`Level 3, Riser ${n%2?'1':'2'}`:'Corridor',description:`Issue number ${n}`,actionNeeded:'',confirmation:'confirmed',work,
    owner:n%3===0?'Acme Electrical Ltd':n%3===1?'Pipeworks Ltd':'',targetDate:'',raisedByReport:'',raisedAt:old,
    events:work==='awaiting_verification'||work==='closed'?[{at:old,actor:engineer.name,actorId:engineer.id,kind:'closure_submitted',note:'',photos:[]}]:[],
    ...(work==='awaiting_verification'||work==='closed'?{closureSubmittedBy:engineer.name,closureSubmittedById:engineer.id}:{})};
  putRecord('issues',i);seeded.push(i);
}
const open=seeded.filter(i=>i.work!=='closed');
const want=(f)=>open.filter(f).length;
const port=4338,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-register-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const refs=page=>page.locator('table.reg tbody .ref').allTextContents();
const pager=page=>page.locator('nav.pager > span').first().textContent();
// Wait until the register shows the expected total (requests settle after typing).
const showing=async(page,total)=>{
  if(total===0){await page.locator('table.reg td.empty').waitFor();return;}
  await page.locator('nav.pager > span',{hasText:new RegExp(`of ${total}$`)}).waitFor({timeout:10000});
};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark'])for(const width of [1440,1200]){
    const label=`${colorScheme} ${width}px`;
    const desk=await browser.newContext({viewport:{width,height:900},colorScheme});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/issues`);await showing(page,open.length);
    // Pages: 50 a page, every open issue reachable once, in the same order each time.
    assert.equal(await pager(page),`Showing 1–50 of ${open.length}`,`${label}: first page`);checks++;
    assert.equal((await refs(page)).length,50,`${label}: 50 rows on a page`);checks++;
    const seen=new Set(await refs(page));
    const pages=Math.ceil(open.length/50);
    for(let p=2;p<=pages;p++){
      await page.getByRole('button',{name:'Next →'}).click();
      await page.locator('nav.pager',{hasText:`Page ${p} of ${pages}`}).waitFor();
      for(const r of await refs(page))seen.add(r);
    }
    assert.equal(seen.size,open.length,`${label}: every open issue is on one of the pages`);checks++;
    assert.ok(await page.getByRole('button',{name:'Next →'}).isDisabled(),`${label}: no page after the last`);checks++;
    if(shot&&colorScheme==='light'&&width===1440)await page.screenshot({path:join(shot,`register-last-page-${colorScheme}-${width}.png`)});
    await page.getByRole('button',{name:'← Previous'}).click();
    await page.locator('nav.pager',{hasText:`Page ${pages-1} of ${pages}`}).waitFor();checks++;

    // Location text: any order and case; the page goes back to the first.
    await page.getByLabel('Location').fill('RISER 2 level');
    const riser2=want(i=>/Riser 2/.test(i.location));
    await showing(page,riser2);
    assert.equal(await pager(page),`Showing 1–${Math.min(50,riser2)} of ${riser2}`,`${label}: a location search starts on page 1`);checks++;
    assert.ok((await page.locator('table.reg tbody td:nth-child(2) .rowsub').allTextContents()).every(t=>t.includes('Riser 2')),`${label}: only Riser 2 rows`);checks++;
    // Responsible company, typed as free text.
    await page.getByLabel('Company').fill('acme');
    const riserAcme=want(i=>/Riser 2/.test(i.location)&&i.owner.startsWith('Acme'));
    await showing(page,riserAcme);checks++;
    assert.match(await page.locator('.pagehead p').textContent(),new RegExp(`^${riserAcme} open in this search`),`${label}: the heading counts the search`);checks++;
    // Verification status.
    await page.getByLabel('Location').fill('');
    await page.getByLabel('Verification').selectOption('awaiting');
    const acmeWaiting=want(i=>i.owner.startsWith('Acme')&&i.work==='awaiting_verification');
    await showing(page,acmeWaiting);
    assert.ok((await page.locator('table.reg tbody tr').allTextContents()).every(t=>/Acme Electrical Ltd/.test(t)),`${label}: only Acme rows`);checks++;
    assert.equal(await page.locator('table.reg tbody tr').count(),acmeWaiting,`${label}: every Acme issue waiting for verification`);checks++;
    if(shot)await page.screenshot({path:join(shot,`register-filtered-${colorScheme}-${width}.png`)});
    // The snag list takes the company when the text names one exactly.
    await page.getByLabel('Company').fill('Acme Electrical Ltd');
    // Same rows as "acme", so wait for the link rather than the count.
    await page.locator('a[href*="owner=Acme+Electrical+Ltd"]',{hasText:'Snag list'}).waitFor({timeout:10000});checks++;
    // Verified and closed issues are reached from All.
    await page.getByLabel('Verification').selectOption('verified');
    await page.locator('table.reg td.empty',{hasText:'No open issues for these filters'}).waitFor();checks++;
    await page.locator('.filters .chip',{hasText:/^All ·/}).click();
    const acmeClosed=seeded.filter(i=>i.owner.startsWith('Acme')&&i.work==='closed').length;
    await showing(page,acmeClosed);checks++;
    // Clear filters returns the whole register.
    await page.getByRole('button',{name:'Clear filters'}).first().click();
    await showing(page,seeded.length);
    assert.equal(await page.getByLabel('Location').inputValue(),'',`${label}: filters cleared`);checks++;
    // Overdue / Fixed, to check links from the office position still open on their filter.
    await page.goto(`${base}/office#/issues/show/verify`);
    await showing(page,want(i=>i.work==='awaiting_verification'));
    assert.match(await page.locator('.filters .chip.on').first().textContent(),/^Fixed, to check/,`${label}: linked filter`);checks++;
    assert.ok(await overflow(page)<=0,`${label}: no sideways scroll`);checks++;
    if(shot)await page.screenshot({path:join(shot,`register-verify-${colorScheme}-${width}.png`)});
    await desk.close();
  }
  // An action taken in a dialog shows in the register without a reload.
  const desk=await browser.newContext({viewport:{width:1440,height:900}});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
  const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
  const waiting=want(i=>i.work==='awaiting_verification');
  await page.goto(`${base}/office#/issues/show/verify`);await showing(page,waiting);
  // Verify opens "Check this fix" (2026-10-21), which goes on to the next fix; Stop leaves it there.
  await page.locator('table.reg tbody tr').first().getByRole('button',{name:'Verify'}).click();
  await page.locator('dialog.cf-dialog[open]').getByRole('button',{name:'Verify and close'}).click();
  if(waiting>1){await page.waitForFunction(()=>/2 of /.test(document.querySelector('dialog.cf-dialog[open] h2')?.textContent??''));await page.locator('dialog.cf-dialog[open]').getByRole('button',{name:'Stop',exact:true}).click();}
  await showing(page,waiting-1);checks++;
  await desk.close();
  assert.deepEqual(errors,[],'page errors');checks++;
  console.log(`Issue register check passed (${checks} checks): location, company and verification filters, paging through ${open.length} open issues, light and dark at 1440px and 1200px.`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
