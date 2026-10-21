// Browser check for UI-1: the office desk opens on the office position across
// the full width, not on an empty register column (on a phone, the office
// position alone: its "Where each project stands" list is the project list). Choosing a project brings
// the register back; going back to all projects removes it again.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the desk at 1440px and the phone at 390px, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-landing-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const manager={id:'entra:landing-manager',oid:'landing-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:landing-engineer',oid:'landing-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const at=new Date().toISOString();
const r=createReport('proj-011lme',engineer.name,engineer);
putRecord('reports',{...r,state:'submitted',review:'not_required',serverAcknowledgedAt:at,observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}]});
putRecord('issues',{id:'issue-office-landing',reference:'DEMO-011LME-ISS-001',projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Riser',description:'Missing fire stopping',actionNeeded:'',confirmation:'provisional',work:'open',owner:'',targetDate:'',raisedByReport:'',raisedAt:at,events:[]});
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-landing-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const visibleCols=page=>page.locator('.cols > .col').evaluateAll(cols=>cols.filter(c=>getComputedStyle(c).display!=='none').map(c=>{const r=c.getBoundingClientRect();return {head:c.querySelector('.col-head h2')?.textContent??'',width:r.width,top:r.top,left:r.left};}).sort((a,b)=>a.top-b.top||a.left-b.left));
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark']){
    const desk=await browser.newContext({viewport:{width:1440,height:900},colorScheme});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects`);await page.getByRole('heading',{name:'Office position'}).waitFor();
    if(shot)await page.screenshot({path:join(shot,`office-landing-1440-${colorScheme}.png`)});
    const landing=await visibleCols(page);
    assert.equal(landing.length,2,`${colorScheme}: landing shows projects and the office position only`);checks++;
    assert.ok(landing[1].width>1000,`${colorScheme}: office position takes the rest of the width (${Math.round(landing[1].width)}px)`);checks++;
    assert.equal(await page.getByText('Select a project to see its reports').count(),0,`${colorScheme}: no empty register column`);checks++;
    assert.ok(await overflow(page)<=0,`${colorScheme}: no horizontal scroll on the desk`);checks++;
    await page.locator('.cols .item').filter({hasText:'011LME'}).first().click();await page.getByText('Reports needing attention').waitFor();
    const project=await visibleCols(page);
    assert.equal(project.length,3,`${colorScheme}: a chosen project shows its register`);checks++;
    assert.match(project[1].head,/^Register/,`${colorScheme}: middle column is the register`);checks++;
    if(shot)await page.screenshot({path:join(shot,`office-project-1440-${colorScheme}.png`)});
    await page.goto(`${base}/office#/projects`);await page.getByRole('heading',{name:'Office position'}).waitFor();
    assert.equal((await visibleCols(page)).length,2,`${colorScheme}: back to all projects drops the register`);checks++;
    await desk.close();

    const phone=await browser.newContext({viewport:{width:390,height:844},colorScheme,isMobile:true,hasTouch:true});await phone.addCookies([{name:'relay_session',value:session,url:base}]);
    const p=await phone.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(`${base}/office#/projects`);await p.locator('.glance-row').first().waitFor();
    const cols=await visibleCols(p);
    assert.deepEqual(cols.map(c=>c.head),['Overview'],`${colorScheme}: phone opens on the office position, whose project list stands in for the column`);checks++;
    assert.ok(await overflow(p)<=0,`${colorScheme}: no horizontal scroll on the phone`);checks++;
    if(shot)await p.screenshot({path:join(shot,`office-landing-390-${colorScheme}.png`)});
    await phone.close();
  }
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} office landing checks (1440px and 390px, light and dark).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
