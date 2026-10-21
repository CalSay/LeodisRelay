// Browser check: on a phone the office desk opens on the office position, so
// a project manager away from a desk sees the four action groups (new
// reports, not yet read, unassigned issues, ready to verify) with their counts
// and buttons, with "Where each project stands" between their counts and the
// groups standing in for the project list. The desk at 1440px keeps its
// layout: the project column on the left, two groups to a row.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the office position at 320px, 390px and 1440px, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-phone-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const manager={id:'entra:phone-manager',oid:'phone-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:phone-engineer',oid:'phone-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const now=new Date().toISOString(),old=new Date(Date.now()-10*86400000).toISOString();
const obs=()=>[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}];
const sent=(over)=>{const r=createReport('proj-011lme',engineer.name,engineer);putRecord('reports',{...r,state:'submitted',review:'not_required',observations:obs(),...over});return r;};
sent({serverAcknowledgedAt:now});                                                      // new, not read
sent({serverAcknowledgedAt:now,acknowledged:{by:'Office Manager',byId:manager.id,at:now}}); // new, read
sent({serverAcknowledgedAt:old});                                          // old, not read
const issue=(id,over)=>putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Riser',description:`Issue ${id}`,actionNeeded:'',confirmation:'confirmed',work:'open',owner:'',targetDate:'',raisedByReport:'',raisedAt:old,events:[],...over});
issue('101',{description:'Missing fire stopping to the riser penetration on level 3'});    // unassigned
issue('102',{description:'Loose tray bracket',owner:'Acme Electrical',work:'awaiting_verification',closureSubmittedBy:engineer.name,closureSubmittedById:engineer.id,events:[{at:old,actor:engineer.name,actorId:engineer.id,kind:'closure_submitted',note:'',photos:[]}]}); // to verify
issue('103',{description:'Label the board',owner:'Acme Electrical',work:'assigned'});  // needs nobody
const port=4336,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-phone-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const group=(page,key)=>page.locator(`.act[data-group="${key}"]`);
const count=async(page,key)=>Number(await group(page,key).locator('.act-n').textContent());
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const visibleCols=page=>page.locator('.cols > .col').evaluateAll(cols=>cols.filter(c=>getComputedStyle(c).display!=='none').map(c=>{const r=c.getBoundingClientRect();return {head:c.querySelector('.col-head h2')?.textContent??'',top:Math.round(r.top+scrollY),left:Math.round(r.left)};}).sort((a,b)=>a.top-b.top||a.left-b.left));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark']){
    for(const width of [320,390]){
      const label=`${colorScheme} ${width}px`;
      const phone=await browser.newContext({viewport:{width,height:844},colorScheme,isMobile:true,hasTouch:true});await phone.addCookies([{name:'relay_session',value:session,url:base}]);
      const page=await phone.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${base}/office#/projects`);await group(page,'verify').waitFor();
      if(shot){await page.screenshot({path:join(shot,`office-phone-${width}-${colorScheme}.png`)});await page.screenshot({path:join(shot,`office-phone-${width}-${colorScheme}-full.png`),fullPage:true});}
      const cols=await visibleCols(page);
      assert.deepEqual(cols.map(c=>c.head),['Overview'],`${label}: the office position alone, its project list standing in for the column`);checks++;
      assert.ok(await group(page,'new').isVisible(),`${label}: the action groups are on screen`);checks++;
      assert.deepEqual([await count(page,'new'),await count(page,'notAck'),await count(page,'unassigned'),await count(page,'verify')],[2,2,1,1],`${label}: each group's count`);checks++;
      // The four counts sit together at the top, each a tap away from its group.
      const tiles=page.locator('.act-strip button');
      assert.equal(await tiles.count(),4,`${label}: four count tiles`);checks++;
      assert.deepEqual(await tiles.locator('b').allTextContents(),['2','2','1','1'],`${label}: tiles carry the counts`);checks++;
      const tileBox=await tiles.first().boundingBox();
      assert.ok(tileBox.y+tileBox.height<=844,`${label}: the counts show without scrolling`);checks++;
      assert.ok(tileBox.height>=44,`${label}: tiles are big enough to tap (${tileBox.height}px)`);checks++;
      await tiles.nth(3).tap();
      await page.waitForFunction(()=>{const r=document.querySelector('.act[data-group="verify"]').getBoundingClientRect();return r.top>=0&&r.top<innerHeight/2;});
      assert.equal(new URL(page.url()).hash,'#/projects',`${label}: a tile scrolls, it does not change the route`);checks++;
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-group')),'verify',`${label}: a tile moves focus to its group`);checks++;
      assert.equal(await page.locator('.act-strip').getAttribute('role'),'group',`${label}: the tiles are announced as one group`);checks++;
      // Rows and buttons are full-size touch targets; nothing is cut off sideways.
      const heights=await page.locator('.act .rmenu .btn').evaluateAll(b=>b.map(e=>e.getBoundingClientRect().height));
      assert.ok(heights.length>=3&&heights.every(h=>h>=40),`${label}: action buttons are at least 40px (${heights})`);checks++;
      const links=await page.locator('.act .act-all').evaluateAll(b=>b.map(e=>e.getBoundingClientRect().height));
      assert.ok(links.every(h=>h>=44),`${label}: "Show all" links are at least 44px (${links})`);checks++;
      const long=group(page,'unassigned').locator('a.rt b').first();
      assert.ok(await long.evaluate(e=>e.scrollWidth<=e.clientWidth),`${label}: a long issue description wraps rather than being cut`);checks++;
      assert.ok(await overflow(page)<=0,`${label}: no horizontal scroll`);checks++;
      assert.equal(await page.locator('.office-latest').count(),0,`${label}: no latest reports table; the Inbox has them`);checks++;
      // A project is one tap away, straight under the counts.
      await page.evaluate(()=>scrollTo(0,0));
      const item=page.locator('.glance-row').first();
      const itemBox=await item.boundingBox(),stripBox=await page.locator('.act-strip').boundingBox(),groupBox=await group(page,'new').boundingBox();
      assert.ok(stripBox.y<itemBox.y&&itemBox.y<groupBox.y,`${label}: the project list sits between the counts and the groups`);checks++;
      assert.ok(itemBox.height>=44,`${label}: a project row is big enough to tap`);checks++;
      await item.tap();
      await page.locator('.cols[data-depth="2"]').waitFor();
      assert.deepEqual((await visibleCols(page)).map(c=>c.head)[0].startsWith('Register'),true,`${label}: a project opens its register`);checks++;
      await page.waitForFunction(()=>scrollY===0);
      const head=await page.locator('.cols[data-depth="2"] > .col:nth-child(2) > .col-head').boundingBox();
      assert.ok(head.y>=0&&head.y<300,`${label}: the register opens at its top (${head.y})`);checks++;
      await phone.close();
    }
    const desk=await browser.newContext({viewport:{width:1440,height:900},colorScheme});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects`);await group(page,'verify').waitFor();
    if(shot)await page.screenshot({path:join(shot,`office-desk-1440-${colorScheme}.png`),fullPage:true});
    const label=`${colorScheme} 1440px`;
    const cols=await visibleCols(page);
    assert.deepEqual(cols.map(c=>c.head),['Projects','Overview'],`${label}: project column and office position side by side`);checks++;
    assert.ok(cols[0].left<cols[1].left&&cols[0].top===cols[1].top,`${label}: the project column stays on the left`);checks++;
    assert.equal(await page.locator('.act-strip').isVisible(),false,`${label}: no count tiles on the desk`);checks++;
    const tops=await page.locator('.act').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size,2,`${label}: two groups to a row`);checks++;
    assert.ok(await page.locator('.glance-row').first().isVisible(),`${label}: where each project stands is shown on the desk too`);checks++;
    assert.ok(await overflow(page)<=0,`${label}: no horizontal scroll`);checks++;
    await desk.close();
  }
  // Acknowledge from a phone: the dialog fits the screen and the counts follow.
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await phone.addCookies([{name:'relay_session',value:session,url:base}]);
  const page=await phone.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/office#/projects`);await group(page,'notAck').waitFor();
  await group(page,'notAck').getByRole('button',{name:'Acknowledge'}).first().tap();
  const dialog=page.locator('.ws-dialog');await dialog.waitFor();
  const box=await dialog.boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=390,'phone: the acknowledge dialog fits the screen');checks++;
  await dialog.getByRole('button',{name:'Acknowledge'}).tap();
  await page.waitForFunction(()=>document.querySelector('.act[data-group="notAck"] .act-n')?.textContent==='1');
  assert.equal(await page.locator('.act-strip button[data-group="notAck"] b').textContent(),'1','phone: the count tile follows');checks++;
  await phone.close();
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} office phone checks (320px and 390px phones, 1440px desk, light and dark; reading order; acknowledge on a phone).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
