// Browser check for FE-4b: the office position shows the four groups a project
// manager acts on (new reports, not yet read, unassigned issues, ready to
// verify), each with its count, and each group opens its filtered list.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the office position at 1440px and 1200px, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-actions-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const manager={id:'entra:actions-manager',oid:'actions-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:actions-engineer',oid:'actions-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const now=new Date().toISOString(),old=new Date(Date.now()-10*86400000).toISOString();
const obs=()=>[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}];
const sent=(over)=>{const r=createReport('proj-011lme',engineer.name,engineer);putRecord('reports',{...r,state:'submitted',review:'not_required',observations:obs(),...over});return r;};
sent({serverAcknowledgedAt:now});                                                      // new, not read
sent({serverAcknowledgedAt:now,acknowledged:{by:'Office Manager',byId:manager.id,at:now}}); // new, read
sent({serverAcknowledgedAt:old});                                          // old, not read
const issue=(id,over)=>putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Riser',description:`Issue ${id}`,actionNeeded:'',confirmation:'confirmed',work:'open',owner:'',targetDate:'',raisedByReport:'',raisedAt:old,events:[],...over});
issue('101',{description:'Missing fire stopping'});                                    // unassigned
issue('102',{description:'Loose tray bracket',owner:'Acme Electrical',work:'awaiting_verification',closureSubmittedBy:engineer.name,closureSubmittedById:engineer.id,events:[{at:old,actor:engineer.name,actorId:engineer.id,kind:'closure_submitted',note:'',photos:[]}]}); // to verify
issue('103',{description:'Label the board',owner:'Acme Electrical',work:'assigned'});  // needs nobody
const port=4335,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-actions-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const group=(page,key)=>page.locator(`.act[data-group="${key}"]`);
const count=async(page,key)=>Number(await group(page,key).locator('.act-n').textContent());
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const onChip=page=>page.locator('.filters .chip.on').first().textContent();
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark']){
    for(const width of [1440,1200]){
      const desk=await browser.newContext({viewport:{width,height:900},colorScheme});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
      const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${base}/office#/projects`);await group(page,'verify').waitFor();
      const label=`${colorScheme} ${width}px`;
      assert.deepEqual(await page.locator('.act h4').allTextContents(),['New reports','Not yet read','Unassigned issues','Fixed, to check'],`${label}: four groups in order`);checks++;
      assert.deepEqual([await count(page,'new'),await count(page,'notAck'),await count(page,'unassigned'),await count(page,'verify')],[2,2,1,1],`${label}: each group's count`);checks++;
      assert.equal(await group(page,'notAck').locator('.rmenu > div').first().locator('b').textContent().then(t=>t.includes('Site Engineer')),true,`${label}: unread rows name the engineer`);checks++;
      assert.equal(await group(page,'unassigned').getByText('Missing fire stopping').count(),1,`${label}: the unassigned issue is listed`);checks++;
      assert.equal(await group(page,'verify').getByRole('button',{name:'Verify'}).count(),1,`${label}: verify has its button`);checks++;
      assert.equal(await page.locator('.rmenu').filter({hasText:'Label the board'}).count(),0,`${label}: an issue that needs nobody is not listed`);checks++;
      const cols=2;
      const tops=await page.locator('.act').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().top)));
      assert.equal(new Set(tops).size,4/cols,`${label}: two groups to a row`);checks++;
      assert.ok(await overflow(page)<=0,`${label}: no horizontal scroll`);checks++;
      if(shot)await page.screenshot({path:join(shot,`office-actions-${width}-${colorScheme}.png`),fullPage:true});
      await desk.close();
    }
  }
  // Each group opens its own filtered list.
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});await ctx.addCookies([{name:'relay_session',value:session,url:base}]);
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const open=async key=>{await page.goto(`${base}/office#/projects`);await group(page,key).locator('.act-all').click();};
  await open('new');await page.getByRole('heading',{name:'Inbox'}).waitFor();
  assert.match(await onChip(page),/^New · 2$/,'new reports open the Inbox on New');checks++;
  assert.equal(await page.locator('table.reg tbody tr.clickable').count(),2,'the Inbox lists the two new reports');checks++;
  await open('notAck');await page.getByRole('heading',{name:'Inbox'}).waitFor();
  assert.match(await onChip(page),/^Not yet read · 2$/,'not yet read opens the Inbox on Not yet read');checks++;
  await page.locator('table.reg tbody tr.clickable').first().click();await page.getByText('Loading report').waitFor({state:'detached'});
  assert.match(await onChip(page),/^Not yet read/,'opening a report keeps the filter');checks++;
  await open('unassigned');await page.getByRole('heading',{name:'Issues'}).waitFor();
  assert.match(await onChip(page),/^Unassigned · 1$/,'unassigned opens Issues on Unassigned');checks++;
  await open('verify');await page.getByRole('heading',{name:'Issues'}).waitFor();
  assert.match(await onChip(page),/^Fixed, to check · 1$/,'fixed, to check opens Issues on Fixed, to check');checks++;
  // Acknowledging from the group takes the report out of it.
  await page.goto(`${base}/office#/projects`);await group(page,'notAck').waitFor();
  await group(page,'notAck').getByRole('button',{name:'Acknowledge'}).first().click();
  await page.locator('.ws-dialog').getByRole('button',{name:'Acknowledge'}).click();
  await page.waitForFunction(()=>document.querySelector('.act[data-group="notAck"] .act-n')?.textContent==='1');
  assert.equal(await count(page,'notAck'),1,'acknowledging takes the report out of Not yet read');checks++;
  assert.equal(await count(page,'new'),2,'it stays among the new reports');checks++;
  await ctx.close();
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} office action checks (1440px and 1200px, light and dark; filtered lists; acknowledge).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
