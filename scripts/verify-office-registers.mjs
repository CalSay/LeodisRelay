// Browser check: on a phone the office registers (issues, variations, inbox
// and drafts, team, and the admin roster, notifications and older drafts) show one card per row, with each value labelled, so nothing
// sits off the side of the screen and every action is a full-size button. The
// desk at 1440px keeps the tables as they were, with sortable headings.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves each register at 390px light and 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-registers-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const admin={id:'entra:registers-admin',oid:'registers-admin',name:'Office Admin',email:'admin@example.test',role:'Admin'};
const engineer={id:'entra:registers-engineer',oid:'registers-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:admin,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
// Six open issues, raised on different days; one awaits verification, one is disputed, three have nobody named.
for(let n=1;n<=6;n++)putRecord('issues',{id:`reg-${n}`,reference:`DEMO-011LME-ISS-00${n}`,projectId:'proj-011lme',source:'report',reportedBy:engineer.name,
  location:n===1?'Level 3, Riser 2':'Corridor',description:n===1?'Missing fire stopping to the riser penetration on level 3 by the stair core, both sides of the wall':`Issue number ${n}`,
  actionNeeded:'',confirmation:n===2?'disputed':'confirmed',work:n===3?'awaiting_verification':'assigned',owner:n%2?'Acme Electrical Ltd':'',targetDate:n<=2?daysAgo(5).slice(0,10):'',
  raisedByReport:'',raisedAt:daysAgo(20-n),events:n===3?[{at:daysAgo(2),actor:engineer.name,actorId:engineer.id,kind:'closure_submitted',note:'',photos:[]}]:[],
  ...(n===3?{closureSubmittedBy:engineer.name,closureSubmittedById:engineer.id}:{})});
for(let n=1;n<=3;n++)putRecord('variations',{id:`regv-${n}`,reference:`DEMO-011LME-VO-00${n}`,projectId:'proj-011lme',description:'Extra containment to the plant room ceiling void',location:'Plant room',
  trade:'HVAC',reason:'Client instruction',workDone:n===2,instruction:'pending',source:'office',raisedBy:admin.name,raisedAt:daysAgo(n),quotedValue:n===1?undefined:12000,events:[]});
const r=createReport('proj-011lme',engineer.name,engineer);
putRecord('reports',{...r,state:'submitted',review:'not_required',serverAcknowledgedAt:daysAgo(1),observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}]});
// A draft on site, an older draft with no author account, and a report whose processing failed, so the drafts and admin tables have rows.
const draft=createReport('proj-011lme',engineer.name,engineer);putRecord('reports',{...draft,lastSavedAt:daysAgo(0)});
const legacy=createReport('proj-011lme',engineer.name,engineer);const {authorId:_drop,...unowned}=legacy;putRecord('reports',{...unowned,lastSavedAt:daysAgo(3)});
const failed=createReport('proj-011lme',engineer.name,engineer);
putRecord('reports',{...failed,state:'submitted',review:'not_required',serverAcknowledgedAt:daysAgo(0),delivery:'failed',deliveryErrorStage:'delivery',deliveryError:'Mailbox refused the message because the recipient address could not be resolved on the server',observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Tray fixed',actionNeeded:'',owner:'',photos:[]}]});
const port=4352,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-registers-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
// Anything in a register wider than its panel, or a panel that scrolls sideways.
const spills=page=>page.locator('table.reg').evaluateAll(ts=>ts.filter(t=>t.offsetParent).flatMap(t=>{const p=t.parentElement,out=[];if(p.scrollWidth>p.clientWidth+1)out.push(`panel ${p.scrollWidth}>${p.clientWidth}`);
  for(const el of t.querySelectorAll('td,td *')){const r=el.getBoundingClientRect(),pr=p.getBoundingClientRect();if(r.width&&(r.right>pr.right+1||r.left<pr.left-1))out.push(`${el.tagName}.${el.className} ${Math.round(r.left)}–${Math.round(r.right)}`);}return out;}));
const refs=page=>page.locator('table.reg tbody .ref').allTextContents();
const views=[['#/issues','issues'],['#/variations','variations'],['#/inbox','inbox'],['#/inbox/show/drafts','drafts'],['#/team','team'],['#/admin/roles','admin roles'],['#/admin/delivery','admin delivery'],['#/admin/drafts','admin older drafts']];
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark'])for(const width of [320,390]){
    const label=`${colorScheme} ${width}px`;
    const phone=await browser.newContext({viewport:{width,height:844},colorScheme,isMobile:true,hasTouch:true});await phone.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await phone.newPage();page.on('pageerror',e=>errors.push(e.message));
    for(const [hash,name] of views){
      await page.goto(`${base}/office${hash}`);await page.locator('table.reg tbody tr td:not(.loading)').first().waitFor();await page.waitForTimeout(300);
      assert.ok(await overflow(page)<=0,`${label} ${name}: no sideways scroll (${await overflow(page)}px)`);checks++;
      assert.deepEqual(await spills(page),[],`${label} ${name}: every card fits its panel`);checks++;
      assert.equal(await page.locator('table.reg thead').first().isVisible(),false,`${label} ${name}: column headings give way to labels`);checks++;
      assert.equal(await page.locator('table.reg td.empty').count(),0,`${label} ${name}: the view has rows to show as cards`);checks++;
      if(shot&&width===390&&colorScheme==='light')await page.screenshot({path:join(shot,`registers-${name.replace(/ /g,'-')}-390-light.png`),fullPage:true});
    }
    // The issue register as cards: each value labelled, actions full-size, the card opens its issue.
    await page.goto(`${base}/office#/issues`);await page.locator('table.reg tbody tr').first().waitFor();
    const card=page.locator('table.reg tbody tr',{hasText:'DEMO-011LME-ISS-001'});
    const labels=await card.locator('td[data-label]').evaluateAll(tds=>tds.filter(td=>getComputedStyle(td).display!=='none').map(td=>getComputedStyle(td,'::before').content.replace(/"/g,'')));
    assert.deepEqual(labels,['Project','Raised','Owner','Target','Work','Confirmation'],`${label}: issue card labels`);checks++;
    const title=card.locator('td.c-title .rowtitle');
    assert.ok(await title.evaluate(e=>e.scrollWidth<=e.clientWidth&&e.getBoundingClientRect().height>24),`${label}: a long description wraps in full`);checks++;
    const buttons=await page.locator('table.reg td.c-actions .btn, table.reg td.c-actions .btn-q').evaluateAll(b=>b.map(e=>e.getBoundingClientRect().height));
    assert.ok(buttons.length>=6&&buttons.every(h=>h>=44),`${label}: row actions are at least 44px (${buttons})`);checks++;
    assert.ok(await page.locator('table.reg tbody tr',{hasText:'ISS-003'}).getByRole('button',{name:'Verify'}).isVisible(),`${label}: Verify shows on the card waiting for verification`);checks++;
    await card.getByRole('button',{name:'Reassign'}).tap();
    await page.locator('.ws-dialog').waitFor();
    assert.ok(!(new URL(page.url()).hash).includes('/issue/'),`${label}: a card's button opens its dialog, not the issue`);checks++;
    await page.keyboard.press('Escape');await page.locator('.ws-dialog').waitFor({state:'detached'}).catch(async()=>{await page.locator('.ws-dialog .x').click();});
    await card.locator('td.c-title').tap();
    await page.waitForFunction(()=>location.hash.includes('/issue/reg-1'));checks++;
    // Filters (FE-5a) and the phone order list still drive the register.
    await page.goto(`${base}/office#/issues`);await page.locator('table.reg tbody tr').first().waitFor();
    assert.equal(await page.locator('.filters .sort-chip').isVisible(),false,`${label}: the priority chip gives way to the order list`);checks++;
    const order=page.getByLabel('Order');
    assert.ok(await order.isVisible(),`${label}: an order list replaces the column headings`);checks++;
    await order.selectOption({label:'Raised, newest first'});
    await page.waitForFunction(()=>document.querySelector('table.reg tbody .ref')?.textContent==='DEMO-011LME-ISS-006');
    assert.deepEqual(await refs(page),['006','005','004','003','002','001'].map(n=>`DEMO-011LME-ISS-${n}`),`${label}: newest raised first`);checks++;
    await order.selectOption({label:'Priority'});
    await page.waitForFunction(()=>document.querySelector('table.reg tbody .ref')?.textContent!=='DEMO-011LME-ISS-006');
    await page.getByRole('button',{name:/^Unassigned · /}).tap();
    await page.waitForFunction(()=>document.querySelectorAll('table.reg tbody .ref').length===3);
    assert.deepEqual((await refs(page)).sort(),['002','004','006'].map(n=>`DEMO-011LME-ISS-${n}`),`${label}: the Unassigned filter`);checks++;
    await page.getByRole('button',{name:/^Open · /}).tap();
    await page.getByLabel('Location').fill('riser');
    await page.waitForFunction(()=>document.querySelectorAll('table.reg tbody .ref').length===1);
    assert.deepEqual(await refs(page),['DEMO-011LME-ISS-001'],`${label}: the location search`);checks++;
    const box=await page.getByLabel('Location').boundingBox();
    assert.ok(box.height>=40&&box.x+box.width<=width,`${label}: the location box is full-size and on screen`);checks++;
    assert.ok(await overflow(page)<=0,`${label}: no sideways scroll after filtering`);checks++;
    // Variation cards carry the money with labels, and the totals.
    await page.goto(`${base}/office#/variations`);await page.locator('table.reg tbody tr').first().waitFor();
    const vlabels=await page.locator('table.reg tbody tr').first().locator('td[data-label]').evaluateAll(tds=>tds.map(td=>td.dataset.label));
    assert.deepEqual(vlabels,['Project','Raised','Instruction','Quoted','Instructed','Margin'],`${label}: variation card labels`);checks++;
    assert.ok(await page.locator('table.reg tfoot td[data-label="Quoted"]').isVisible(),`${label}: totals under the cards`);checks++;
    await phone.close();
  }
  for(const colorScheme of ['light','dark']){
    const label=`${colorScheme} 1440px`;
    const desk=await browser.newContext({viewport:{width:1440,height:900},colorScheme});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
    for(const [hash,name] of views){
      await page.goto(`${base}/office${hash}`);await page.locator('table.reg tbody tr td:not(.loading)').first().waitFor();await page.waitForTimeout(300);
      assert.ok(await page.locator('table.reg thead').first().isVisible(),`${label} ${name}: column headings`);checks++;
      assert.equal(await page.locator('table.reg tbody tr').first().evaluate(tr=>getComputedStyle(tr).display),'table-row',`${label} ${name}: rows stay table rows`);checks++;
      assert.ok(await overflow(page)<=0,`${label} ${name}: no sideways scroll`);checks++;
      if(shot&&colorScheme==='dark'&&(name==='issues'||name==='variations'))await page.screenshot({path:join(shot,`registers-${name}-1440-dark.png`)});
    }
    await page.goto(`${base}/office#/issues`);await page.locator('table.reg tbody tr').first().waitFor();
    assert.equal(await page.locator('table.reg thead th').count(),9,`${label}: nine issue columns`);checks++;
    assert.equal(await page.getByLabel('Order').isVisible(),false,`${label}: no order list on the desk`);checks++;
    assert.ok(await page.locator('.filters .sort-chip').isVisible(),`${label}: the priority chip stays`);checks++;
    const row=page.locator('table.reg tbody tr',{hasText:'ISS-003'});
    const tops=await row.locator('td.c-actions .btn, td.c-actions .btn-q').evaluateAll(b=>b.map(e=>Math.round(e.getBoundingClientRect().top)));
    assert.ok(tops.length===2&&new Set(tops).size===1,`${label}: row actions stay on one line`);checks++;
    await page.getByRole('button',{name:/^Raised/}).click();
    await page.waitForFunction(()=>document.querySelector('table.reg tbody .ref')?.textContent==='DEMO-011LME-ISS-001');
    assert.equal(await page.locator('th[aria-sort="ascending"]').textContent(),'Raised↑',`${label}: column sorting still works`);checks++;
    await desk.close();
  }
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} office register checks (issues, variations, inbox, drafts, team, admin; 320px and 390px phones and 1440px desk, light and dark).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
