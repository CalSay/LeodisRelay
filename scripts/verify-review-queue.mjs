// Browser check for FE-4a: the office shows a review queue only while review
// is in use. Review is off for every project by default, so the "on" case is a
// report still waiting from when review was required; deciding it turns the
// queue off. The rule itself is covered by apps/web/tests/reviewQueue.test.ts.
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
const root=mkdtempSync(join(tmpdir(),'relay-review-queue-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const manager={id:'entra:review-manager',oid:'review-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:review-engineer',oid:'review-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const at=new Date().toISOString();
const sent=(review)=>{const r=createReport('proj-011lme',engineer.name,engineer);const s={...r,state:'submitted',review,serverAcknowledgedAt:at,observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}]};putRecord('reports',s);return s;};
sent('not_required');
const waiting=sent('pending');
putRecord('issues',{id:'issue-review-queue',reference:'DEMO-011LME-ISS-001',projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Riser',description:'Missing fire stopping',actionNeeded:'',confirmation:'provisional',work:'open',owner:'',targetDate:'',raisedByReport:'',raisedAt:at,events:[]});
const port=4333,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-review-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
async function look(page,name){
  await page.goto('about:blank');// a hash change alone would keep the loaded records
  await page.goto(`${base}/office#/inbox`);await page.getByRole('heading',{name:'Inbox'}).waitFor();
  const inbox={review:await page.getByRole('button',{name:/^To review ·/}).count(),returned:await page.getByRole('button',{name:/^Returned ·/}).count()};
  if(shot)await page.screenshot({path:join(shot,`${name}-inbox.png`)});
  await page.goto(`${base}/office#/issues`);await page.getByRole('heading',{name:'Issues'}).waitFor();
  const row=page.locator('table.reg tbody tr').filter({hasText:'DEMO-011LME-ISS-001'});await row.waitFor();
  const issues={chip:await page.getByRole('button',{name:/^Not reviewed ·/}).count(),count:/not reviewed/.test(await page.locator('.pagehead p').innerText()),confirmation:(await row.locator('td').nth(7).textContent()).trim()};
  if(shot)await page.screenshot({path:join(shot,`${name}-issues.png`)});
  await page.goto(`${base}/office#/projects/proj-011lme`);await page.getByText('Reports needing attention').waitFor();
  const register=await page.locator('.col').filter({hasText:'Reports needing attention'}).innerText();
  await page.goto(`${base}/office#/projects/proj-011lme/issue/issue-review-queue`);
  const cell=page.locator('dl.tb > div').filter({hasText:'Confirmation'});await cell.waitFor();
  const sheet=(await cell.textContent()).replace(/\s+/g,' ');
  if(shot)await page.screenshot({path:join(shot,`${name}-issue.png`)});
  await page.goto(`${base}/issues/issue-review-queue`);
  const page2=(await page.locator('.titleblock').textContent()).replace(/\s+/g,' ');
  return {inbox,issues,register,sheet,page:page2};
}
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:'relay_session',value:session,url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));

  // In use: a report still waits for a decision.
  const on=await look(page,'review-on');
  assert.equal(on.inbox.review,1,'To review filter shown while a report waits');checks++;
  assert.equal(on.inbox.returned,1,'Returned filter shown while review is in use');checks++;
  assert.equal(on.issues.chip,1,'Not reviewed filter shown while review is in use');checks++;
  assert.ok(on.issues.count,'Not reviewed count shown while review is in use');checks++;
  assert.match(on.register,/to review/i);checks++;
  assert.equal(on.issues.confirmation,'Not reviewed','Register row says Not reviewed while review is in use');checks++;
  assert.match(on.sheet,/Not reviewed/,'Issue sheet says Not reviewed while review is in use');checks++;
  assert.match(on.page,/ConfirmationNot reviewed/,'Issue page says Not reviewed while review is in use');checks++;

  // Decide it, and review is off everywhere, as it is by default.
  const decided=await page.evaluate(async id=>(await fetch(`/api/reports/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'review',decision:'approve',note:''})})).status,waiting.id);
  assert.equal(decided,200,'Manager approves the waiting report');checks++;
  const off=await look(page,'review-off');
  assert.equal(off.inbox.review,0,'No To review filter with review off');checks++;
  assert.equal(off.inbox.returned,0,'No Returned filter with review off');checks++;
  assert.equal(off.issues.chip,0,'No Not reviewed filter with review off');checks++;
  assert.ok(!off.issues.count,'No not reviewed count with review off');checks++;
  assert.doesNotMatch(off.register,/review/i,'Project register says nothing about review');checks++;
  assert.equal(off.issues.confirmation,'As reported','Register row says As reported with review off');checks++;
  assert.match(off.sheet,/As reported.*does not use review/,'Issue sheet explains As reported');checks++;
  assert.doesNotMatch(off.sheet,/Not reviewed/,'Issue sheet does not say Not reviewed');checks++;
  assert.match(off.page,/ConfirmationAs reported/,'Issue page says As reported with review off');checks++;
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} review queue checks (review in use, then off).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
