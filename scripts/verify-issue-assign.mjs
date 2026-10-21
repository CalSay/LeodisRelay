// Browser check: the office assigns an issue from the issue page itself.
// A manager opens an unassigned issue, sees "Who puts it right", is offered
// the companies already named on the project, assigns it with a target date
// and an instruction, and the owner, target date and history update in place;
// Reassign then carries the current owner. An empty owner is refused before
// anything is sent. An engineer sees no Assign, and nor does an issue fixed
// and waiting to be checked (the server refuses that until it is reopened).
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-issue-assign-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {applyCommand,listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const engineer={id:'entra:assign-engineer',oid:'assign-engineer',name:'Assign Engineer',email:'assign-eng@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:assign-manager',oid:'assign-manager',name:'Assign Manager',email:'assign-mgr@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){const id=randomUUID();sessions[p.role]=id;putRecord('sessions',{id,principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const photo=()=>({id:randomUUID(),dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC',caption:'Riser',capturedAt:new Date().toISOString()});
const defect=(location,owner)=>({id:randomUUID(),type:'defect',location,whatHappened:`Fire stopping missing at ${location}`,actionNeeded:'Make good',owner,affectedTrade:'Electrical',photos:[photo()]});
const report=createReport('proj-011lme',engineer.name,engineer);
const saved=saveDraft(report.id,{...report,observations:[defect('Level 3 riser',''),defect('Level 2 riser',''),defect('Level 1 riser','Northbank Electrical')]},report.version);assert.ok(saved.ok,saved.reason);
const sent=await submitReport(report.id,{name:engineer.name},saved.value.version);assert.ok(sent.ok,sent.reason);
const byLocation=l=>listIssues('proj-011lme').find(i=>i.location===l);
const first=byLocation('Level 3 riser'),second=byLocation('Level 2 riser'),fixed=byLocation('Level 1 riser');
// The third is put forward as fixed, so it waits to be checked and cannot be reassigned.
assert.ok(applyCommand(fixed.id,{kind:'submit_closure',actor:engineer.name,actorId:engineer.id,note:'Done'}).ok);
const port=4343,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-assign-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const londonDay=offset=>new Date(Date.now()+offset*864e5).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const shortDay=day=>{const [y,m,d]=day.split('-').map(Number);return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${y}`;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const cell=(page,label)=>page.locator('.tb-cell').filter({has:page.locator('dt',{hasText:new RegExp(`^${label}$`)})}).locator('dd');
  for(const [scheme,width,issue,target] of [['light',390,first,londonDay(7)],['dark',1440,second,londonDay(14)]]){
    const tag=`${scheme} ${width}px`;
    const {context,page,errors}=await open('Manager',scheme,width);
    await page.goto(`${base}/issues/${issue.id}`);
    const panel=page.getByRole('region',{name:'Who puts it right'});
    await panel.waitFor();
    eq(await cell(page,'Owner').innerText(),'Not yet assigned',`${tag}: unassigned to start`);
    eq(await cell(page,'Target date').innerText(),'No target date',`${tag}: the target date is shown, even when there is none`);
    ok((await panel.innerText()).includes('Nobody is down to put this right yet.'),`${tag}: the panel says nobody is down for it`);
    if(screenshot)await page.screenshot({path:join(screenshot,`assign-before-${scheme}-${width}.png`),fullPage:true});
    await panel.getByRole('button',{name:'Assign'}).click();
    const ownerBox=panel.getByLabel('Responsible');
    eq(await ownerBox.evaluate(e=>e===document.activeElement),true,`${tag}: the form opens with Responsible ready to type in`);
    await page.waitForFunction(()=>document.querySelectorAll('#assign-owners option').length>0);
    const offered=await page.locator('#assign-owners option').evaluateAll(o=>o.map(x=>x.value));
    ok(offered.includes('Northbank Electrical'),`${tag}: the companies named on the project are suggested (${offered.join(', ')})`);
    // An empty owner is refused before anything is sent.
    await panel.getByRole('button',{name:'Assign'}).click();
    eq(await panel.getByRole('alert').innerText(),'Name who is responsible.',`${tag}: an empty owner is refused`);
    eq(await cell(page,'Owner').innerText(),'Not yet assigned',`${tag}: and nothing changed`);
    await ownerBox.fill('Northbank Electrical');
    await panel.getByLabel('Target date').fill(target);
    await panel.getByLabel('Instruction').fill('Access via the east stair; call Dan on site');
    if(screenshot)await page.screenshot({path:join(screenshot,`assign-form-${scheme}-${width}.png`),fullPage:true});
    eq(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tag}: no sideways scroll with the form open`);
    await page.addScriptTag({content:axeSource});
    const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('.issue-assign'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`));
    eq(found.join('\n'),'',`${tag}: axe finds nothing in the open form`);
    await panel.getByRole('button',{name:'Assign'}).click();
    await panel.getByRole('button',{name:'Reassign'}).waitFor();
    eq(await cell(page,'Owner').innerText(),'Northbank Electrical',`${tag}: the owner updates in place`);
    eq(await cell(page,'Target date').innerText(),shortDay(target),`${tag}: so does the target date`);
    eq(await cell(page,'Work status').innerText(),'Assigned',`${tag}: the work moves to assigned`);
    ok((await panel.innerText()).includes(`Northbank Electrical, by ${shortDay(target).replace(/ \d{4}$/,'')}`)||(await panel.innerText()).includes(`Northbank Electrical, by ${shortDay(target)}`),`${tag}: the panel names the owner and date`);
    const last=page.locator('.reg .row').last();
    eq(await last.locator('.row-code').innerText(),'Assigned',`${tag}: the history records the assignment`);
    ok((await last.innerText()).includes(`To Northbank Electrical, by ${shortDay(target)}`),`${tag}: and says who it went to and by when`);
    ok((await last.innerText()).includes('Access via the east stair; call Dan on site'),`${tag}: with the instruction`);
    ok((await last.innerText()).includes(manager.name),`${tag}: attributed to the manager signed in`);
    // Reassign starts from the current owner and date.
    await panel.getByRole('button',{name:'Reassign'}).click();
    eq(await panel.getByLabel('Responsible').inputValue(),'Northbank Electrical',`${tag}: Reassign starts from the current owner`);
    eq(await panel.getByLabel('Target date').inputValue(),target,`${tag}: and the current target date`);
    await panel.getByRole('button',{name:'Cancel'}).click();
    await panel.getByRole('button',{name:'Reassign'}).waitFor();
    eq(listIssues('proj-011lme').find(i=>i.id===issue.id).owner,'Northbank Electrical',`${tag}: the record on the server has the owner`);
    if(screenshot)await page.screenshot({path:join(screenshot,`assign-after-${scheme}-${width}.png`),fullPage:true});
    // The desk's issue history says the same.
    await page.goto(`${base}/office#/projects/proj-011lme/issue/${issue.id}`);
    const hist=page.locator('.hist').filter({hasText:'To Northbank Electrical'});
    await hist.first().waitFor();
    ok((await hist.first().innerText()).includes('Access via the east stair'),`${tag}: the desk's history names who it went to, with the instruction`);
    // Fixed and waiting to be checked: no Assign, as the server would refuse it.
    await page.goto(`${base}/issues/${fixed.id}`);
    await page.locator('.reg .row').first().waitFor();
    eq(await page.getByRole('region',{name:'Who puts it right'}).count(),0,`${tag}: no Assign on an issue fixed and waiting to be checked`);
    assert.deepEqual(errors,[],`${tag}: no page errors`);
    await context.close();
  }
  // An engineer reads the owner and target date but cannot assign.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/issues/${first.id}`);
    // The engineer's page says who is fixing it on the first screen and folds the history (2026-10-21).
    const who=page.locator('.issue-eng-facts div').filter({hasText:'Who is fixing it'}).locator('dd');await who.waitFor();
    eq(await page.getByRole('region',{name:'Who puts it right'}).count(),0,'engineer: no Assign');
    ok((await who.innerText()).startsWith('Northbank Electrical'),'engineer: sees the owner');
    await page.locator('details.issue-more summary').click();await page.locator('.reg .row').first().waitFor();
    ok((await page.locator('.reg .row').last().innerText()).includes('To Northbank Electrical'),'engineer: and who it went to in the history');
    const refused=await page.evaluate(async([id])=>(await fetch(`/api/issues/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'assign',owner:'Someone',note:''})})).status,[first.id]);
    eq(refused,403,'engineer: the server refuses an assignment');
    assert.deepEqual(errors,[],'engineer: no page errors');
    await context.close();
  }
  console.log(`Passed ${checks} assign-from-the-issue checks (manager 390px light and 1440px dark, engineer 390px).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
