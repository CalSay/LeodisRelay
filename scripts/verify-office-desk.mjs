// Browser check: the office desk on a laptop and a desktop (1366 and 1920px).
// A variation row opens its variation, the variation register fits without
// scrolling sideways, report stages in the Inbox reader do not run into each
// other, each register's filters clear the same way and an empty list says
// what it means, a project's sheet names the project in the browser tab, and
// Search opened on its own goes Back to the office for the office team.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves each page at 1366px light and 1920px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-desk-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const admin={id:'entra:desk-admin',oid:'desk-admin',name:'Office Admin',email:'admin@example.test',role:'Admin'};
const engineer={id:'entra:desk-engineer',oid:'desk-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:admin,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
for(let n=1;n<=3;n++)putRecord('issues',{id:`desk-${n}`,reference:`DEMO-011LME-ISS-00${n}`,projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Corridor',description:`Cable tray not fixed at bay ${n}`,
  actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Acme Electrical Ltd',targetDate:'',raisedByReport:'',raisedAt:daysAgo(10-n),events:[]});
// Three variations with long "raised by" lines and three buttons each: the widest rows the register has.
for(let n=1;n<=3;n++)putRecord('variations',{id:`deskv-${n}`,reference:`DEMO-011LME-VO-00${n}`,projectId:n===3?'proj-014lme':'proj-011lme',description:'Extra containment to the plant room ceiling void',location:'Plant room',
  trade:'HVAC',reason:'Client instruction',workDone:n===2,instruction:'pending',source:'office',raisedBy:'Office Administrator',raisedAt:daysAgo(n),quotedValue:n===1?undefined:12000,events:[]});
const r=createReport('proj-011lme',engineer.name,engineer);
putRecord('reports',{...r,state:'submitted',review:'not_required',serverAcknowledgedAt:daysAgo(0),observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}]});
const port=4363,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-office-desk-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const save=async(page,name,w,scheme)=>{if(shot&&((w===1366&&scheme==='light')||(w===1920&&scheme==='dark')))await page.screenshot({path:join(shot,`desk-${name}-${scheme}-${w}.png`)});};
// Anything inside a register's panel that sits past the panel's edge, or a panel that scrolls sideways.
const spills=page=>page.locator('table.reg').evaluateAll(ts=>ts.filter(t=>t.offsetParent).flatMap(t=>{const p=t.parentElement,pr=p.getBoundingClientRect(),out=[];if(p.scrollWidth>p.clientWidth+1)out.push(`panel ${p.scrollWidth}>${p.clientWidth}`);
  for(const el of t.querySelectorAll('td .btn,td .tag')){const b=el.getBoundingClientRect();if(b.width&&b.right>pr.right+1)out.push(`${el.textContent} ends at ${Math.round(b.right)} > ${Math.round(pr.right)}`);}return out;}));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [width,height] of [[1366,768],[1920,1080]])for(const colorScheme of ['light','dark']){
    const label=`${colorScheme} ${width}px`;
    const context=await browser.newContext({viewport:{width,height},colorScheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));

    // Variations: fits, and a row opens its own variation in its project.
    await page.goto(`${base}/office#/variations`);await page.locator('table.reg tbody tr.clickable').first().waitFor();
    assert.deepEqual(await spills(page),[],`${label}: the variation register fits its panel`);checks++;
    await save(page,'variations',width,colorScheme);
    await page.locator('table.reg tbody tr',{hasText:'DEMO-011LME-VO-002'}).locator('td.c-title').click();
    await page.waitForURL(/#\/projects\/proj-011lme\/variation\/deskv-2$/);
    await page.locator('.sheet h3',{hasText:'Extra containment to the plant room ceiling void'}).waitFor();checks++;
    assert.equal(await page.title(),'Tetley Hall - Block E · Office · RELAY',`${label}: a project's sheet names the project in the tab`);checks++;
    await page.locator('.sheet .crumbs a',{hasText:'Tetley Hall - Block E'}).click();
    await page.waitForURL(/#\/projects\/proj-011lme$/);await page.locator('.sheet-title h3',{hasText:'Tetley Hall - Block E'}).waitFor();checks++;
    await save(page,'project',width,colorScheme);

    // Variations: an empty filter says what it means; Clear filters puts every row back; the tab starts again.
    await page.goto(`${base}/office#/variations`);await page.locator('table.reg tbody tr.clickable').first().waitFor();
    await page.locator('.filters .chip',{hasText:/^Declined ·/}).click();
    assert.equal(await page.locator('.filters .chip',{hasText:/^Declined ·/}).getAttribute('aria-pressed'),'true',`${label}: the chosen variation filter is marked pressed`);checks++;
    await page.locator('table.reg td.empty',{hasText:'No variations have been declined.'}).waitFor();checks++;
    await page.locator('.filters .chip',{hasText:/^Awaiting instruction ·/}).click();
    await page.locator('.filters label',{hasText:/^Project/}).locator('select').selectOption('proj-014lme');
    assert.equal(await page.locator('table.reg tbody tr.clickable').count(),1,`${label}: the project filter narrows the variations`);checks++;
    await page.locator('.filters').getByRole('button',{name:'Clear filters'}).click();
    assert.equal(await page.locator('table.reg tbody tr.clickable').count(),3,`${label}: Clear filters shows every variation again`);checks++;
    await page.goto(`${base}/office#/variations/show/declined`);await page.locator('table.reg td.empty').waitFor();
    assert.equal(await page.locator('.filters .chip.on').innerText(),'Declined · 0',`${label}: #/variations/show/declined opens on that filter`);checks++;
    await page.locator('.hnav a',{hasText:'Variations'}).click();
    await page.locator('.filters .chip.on',{hasText:/^Awaiting instruction/}).waitFor();checks++;

    // Inbox: stages in the reader keep to their own step; filters and empty lists match the other registers.
    await page.goto(`${base}/office#/inbox`);await page.locator('table.reg tbody tr.clickable').first().click();
    await page.locator('.stages li').first().waitFor();
    const overlaps=await page.locator('.stages li').evaluateAll(lis=>lis.flatMap(li=>{const b=li.getBoundingClientRect();return [...li.querySelectorAll('.tag')].filter(t=>{const r=t.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1;}).map(t=>t.textContent);}));
    assert.deepEqual(overlaps,[],`${label}: each report stage stays inside its own step`);checks++;
    await save(page,'inbox',width,colorScheme);
    await page.locator('.filters .chip',{hasText:/^Processing failed ·/}).click();
    assert.equal(await page.locator('.filters .chip',{hasText:/^Processing failed ·/}).getAttribute('aria-pressed'),'true',`${label}: the chosen inbox filter is marked pressed`);checks++;
    await page.locator('table.reg td.empty',{hasText:'No report failed processing.'}).waitFor();checks++;
    await page.locator('.filters .chip',{hasText:/^All ·/}).click();
    await page.locator('.filters label',{hasText:/^Trade/}).locator('select').selectOption('HVAC');
    await page.locator('table.reg td.empty',{hasText:'No reports received yet for these filters.'}).waitFor();checks++;
    await page.locator('table.reg td.empty').getByRole('button',{name:'Clear filters'}).click();
    assert.equal(await page.locator('table.reg tbody tr.clickable').count(),1,`${label}: Clear filters shows every report again`);checks++;

    // Issues: an empty filter says what it means.
    await page.goto(`${base}/office#/issues`);await page.locator('table.reg tbody tr.clickable').first().waitFor();
    await page.locator('.filters .chip',{hasText:/^Fixed, to check ·/}).click();
    await page.locator('table.reg td.empty',{hasText:'Nothing is waiting to be checked.'}).waitFor();checks++;
    await save(page,'issues',width,colorScheme);

    // Search opened on its own: Back goes to the office.
    await page.goto(`${base}/search?q=tray`);
    assert.equal(await page.locator('a.back').innerText(),'← Back to Office',`${label}: Search goes Back to Office for the office team`);checks++;
    await page.locator('a.back').click();await page.waitForURL(/\/office/);checks++;
    await context.close();
  }
  assert.deepEqual(errors,[],'no page errors');checks++;
  console.log(`office desk verification passed (${checks} checks)`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');rmSync(root,{recursive:true,force:true});
}
