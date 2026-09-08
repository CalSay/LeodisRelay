// Production browser regression using an isolated SQLite store and synthetic sessions.
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
const root=mkdtempSync(join(tmpdir(),'relay-engineer-layout-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:layout-engineer',oid:'layout-engineer',name:'Layout Engineer',email:'layout@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const own=createReport('proj-011lme',principal.name,principal);
const observation={id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Existing section',actionNeeded:'',owner:'',photos:[]};
putRecord('reports',{...own,observations:[observation]});
const other=createReport('proj-011lme','Other author',{...principal,id:'entra:other'});
for(const [i,projectId] of ['proj-011lme','proj-014lme'].entries())putRecord('issues',{id:`layout-issue-${i}`,reference:`TEST-ISS-${i}`,projectId,location:'Plant room',description:'Layout scope evidence',actionNeeded:'Inspect',confirmation:'provisional',work:'open',owner:'',targetDate:'',raisedByReport:own.id,raisedAt:new Date().toISOString(),events:[]});
const port=4330,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-layout-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1024,height:900}});await context.addCookies([{name:'relay_session',value:session,url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/engineer?project=proj-011lme');
  await page.getByRole('heading',{name:'On site today'}).waitFor();
  assert.equal(await page.locator(`a[href="/reports/${other.id}"]`).count(),0,'Other author draft must not be linked');
  assert.ok(await page.getByRole('button',{name:/Flag a defect/}).isEnabled());
  assert.ok(await page.getByRole('button',{name:/Team & contacts/}).isDisabled());
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [name,width,height] of [['phone',390,844],['portrait',820,1180],['landscape',1180,820]]){
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow`);
    const columns=await page.locator('.eng-home-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    assert.equal(columns,name==='landscape'?2:1,`${name} layout`);
    if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`),fullPage:true});
  }
  // Individual defect: default trade, local restoration, photo upload, and an
  // intentionally lost receipt. Retry must return the same issue without sending a report.
  await page.getByRole('button',{name:/Flag a defect/}).click();
  assert.equal(await page.getByLabel('Trade affected',{exact:true}).inputValue(),'Electrical');
  await page.getByLabel('What needs attention?',{exact:true}).fill('Missing HVAC support');
  await page.getByLabel('Where on site?',{exact:true}).fill('Level 2 corridor');
  await page.getByLabel('Trade affected',{exact:true}).selectOption('HVAC');
  const sharp=require('sharp');
  const png=await sharp({create:{width:24,height:24,channels:3,background:'#997744'}}).png().toBuffer();
  await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
  await page.goto(base+'/engineer?project=proj-011lme&view=defect');
  await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
  assert.equal(await page.getByLabel('What needs attention?',{exact:true}).inputValue(),'Missing HVAC support');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Defect form phone overflow');
  if(screenshot)await page.screenshot({path:join(screenshot,'defect-phone.png'),fullPage:true});
  await page.setViewportSize({width:1180,height:820});
  if(screenshot)await page.screenshot({path:join(screenshot,'defect-landscape.png'),fullPage:true});
  await page.getByRole('button',{name:'Check defect →',exact:true}).click();
  await page.route('**/api/issues',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort();}else await route.continue();},{times:1});
  await page.getByRole('button',{name:'Send defect',exact:true}).click();
  await page.getByRole('button',{name:'Retry submission',exact:true}).click();
  await page.getByRole('heading',{name:'Defect received',exact:true}).waitFor();
  const received=await context.request.get(base+'/api/issues?projectId=proj-011lme').then(r=>r.json());
  const individual=received.issues.filter(i=>i.description==='Missing HVAC support');
  assert.equal(individual.length,1);assert.equal(individual[0].events.length,1);assert.equal(individual[0].affectedTrade,'HVAC');assert.equal(individual[0].reporterTrade,'Electrical');
  assert.equal((await context.request.get(base+`/api/reports/${own.id}`).then(r=>r.json())).state,'draft');
  await page.getByRole('button',{name:'View project issues',exact:true}).click();
  await page.locator(`a[href="/issues/${individual[0].id}"]`).waitFor();
  if(screenshot)await page.screenshot({path:join(screenshot,'issues-landscape.png'),fullPage:true});
  await page.getByRole('navigation',{name:'Site companion navigation'}).getByRole('button',{name:'Issues',exact:true}).click();
  await page.getByRole('link').filter({hasText:'Layout scope evidence'}).first().waitFor();
  assert.equal(await page.locator('a[href="/issues/layout-issue-1"]').count(),0);
  await page.getByLabel('Project scope').selectOption('all');
  await page.locator('a[href="/issues/layout-issue-1"]').waitFor();
  await page.goto(base+`/reports/${own.id}`);
  await page.getByRole('button',{name:'+ Add section',exact:true}).click();
  await page.locator('.eng-editor-grid div:not([hidden]) > .panel textarea').first().fill('Tablet section survives rotation');
  // Browser locators deliberately target the one visible editor, while hidden sections stay mounted.
  const visible=page.locator('.eng-editor-grid .panel:visible');
  await visible.getByLabel('Where',{exact:true}).fill('Roof');
  try { await page.getByText('Saved on server',{exact:true}).waitFor(); }
  catch(error) { console.error(await page.locator('main').innerText()); throw error; }
  await page.setViewportSize({width:820,height:1180});
  assert.equal(await visible.getByLabel('What happened',{exact:true}).inputValue(),'Tablet section survives rotation');
  await page.locator('.eng-sections button').first().click();
  await page.locator('.eng-sections button').nth(1).click();
  assert.equal(await visible.getByLabel('What happened',{exact:true}).inputValue(),'Tablet section survives rotation');
  await page.reload();await page.locator('.eng-sections button').nth(1).click();
  assert.equal(await visible.getByLabel('What happened',{exact:true}).inputValue(),'Tablet section survives rotation');
  if(screenshot)await page.screenshot({path:join(screenshot,'editor-portrait.png'),fullPage:true});
  await page.setViewportSize({width:1180,height:820});
  if(screenshot)await page.screenshot({path:join(screenshot,'editor-landscape.png'),fullPage:true});
  await page.getByRole('button',{name:'Send to office',exact:true}).click();
  await page.getByText(/Received by Relay/).waitFor();
  const saved=await context.request.get(base+`/api/reports/${own.id}`).then(r=>r.json());
  assert.equal(saved.state,'submitted');assert.equal(saved.observations.length,2);
  assert.equal(saved.observations[1].whatHappened,'Tablet section survives rotation');
  await page.goto(base+'/engineer?project=proj-014lme');
  await page.getByRole('button',{name:'Start a site update',exact:true}).click();
  await page.waitForURL('**/reports/*');
  const created=await context.request.get(base+'/api'+new URL(page.url()).pathname).then(r=>r.json());
  assert.equal(created.projectId,'proj-014lme');assert.equal(created.authorId,principal.id);
  assert.equal(created.authorTrade,'Electrical');
  await page.getByRole('button',{name:'+ Add section',exact:true}).waitFor();
  assert.ok(await page.getByLabel('Trade affected · Coming soon').isDisabled());
  assert.deepEqual(errors,[]);
  console.log('Engineer layouts passed: phone/portrait/landscape, disabled future controls, draft privacy, issue scope, section autosave/rotation/reload and full report submission.');
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
