// Browser check for the office's switch for safety, permits and deliveries
// (lib/featureSwitch.ts): off by default, nothing of toolbox talks, permits,
// deliveries, the safety and tower inspections or Safety actions shows on any
// screen, their pages say they are switched off and their API refuses; the
// Admin turns them on from the Admin tab and every one comes back with what
// was recorded before; a Manager cannot change the switch.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
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
const root=mkdtempSync(join(tmpdir(),'relay-simpler-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:sh-engineer',oid:'sh-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:sh-manager',oid:'sh-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const admin={id:'entra:sh-admin',oid:'sh-admin',name:'Cal Admin',email:'admin@example.test',role:'Admin'};
const sessions={};
for(const p of [engineer,manager,admin]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});}
const P='proj-011lme',today=londonDay(new Date()),now=new Date().toISOString();
// Records made while the switch was on, to prove off hides and on brings back, never deletes.
putRecord('toolbox-talks',{id:'sh-talk',projectId:P,day:today,topic:'Safe isolation',givenBy:engineer.name,attendees:['Sam Spark','Pat Pipe'],at:now,byId:engineer.id,by:engineer.name});
putRecord('deliveries',{id:'sh-delivery',projectId:P,supplier:'Edmundson Electrical',items:'Cable tray, 20 lengths',day:today,receivedBy:engineer.name,condition:'short',problem:'Four lengths missing',at:now,byId:engineer.id,by:engineer.name});
const port=4353,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-simpler-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const SAFETY=['/safety-actions','/toolbox-talks','/permits','/deliveries'];
// "Delivery" alone is a sent report reaching the project manager, so only "deliveries" counts.
const SAFETY_WORDS=/toolbox|permit|deliveries|safety action|safety inspection|tower/i;
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  const shot=async(page,name)=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}.png`),fullPage:true});};
  const open=async(role,scheme='light',width=390)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const api=(role,path,init={})=>fetch(base+path,{...init,headers:{cookie:`relay_session=${sessions[role]}`,'content-type':'application/json',...(init.headers??{})}});
  const text=async page=>(await page.locator('main').innerText());
  // Help's own What's new line for this change names what was switched off, so it is left out of the search.
  const helpText=async page=>page.locator('main').evaluate(m=>{const c=m.cloneNode(true);c.querySelectorAll('.help-new li').forEach(li=>{if(/A simpler RELAY/.test(li.textContent))li.remove();});return c.innerText??c.textContent;});

  // ---------------------------------------------------------------- off, the default
  check(getRecord('settings','features')===undefined,'off: nothing stored, so the default applies');
  for(const path of SAFETY){
    const r=await api('Engineer',`/api${path}?project=${P}`);
    check(r.status===404&&(await r.json()).switchedOff===true,`off: GET /api${path} refused (${r.status})`);
  }
  {
    const r=await api('Engineer','/api/toolbox-talks',{method:'POST',body:JSON.stringify({projectId:P,topic:'x',attendees:['A']})});
    check(r.status===404,`off: recording a toolbox talk refused (${r.status})`);
    const d=await api('Engineer','/api/deliveries/sh-delivery',{method:'POST',body:JSON.stringify({kind:'sorted',note:'rest came'})});
    check(d.status===404,`off: sorting a delivery refused (${d.status})`);
    const s=await api('Engineer','/api/reports',{method:'POST',body:JSON.stringify({projectId:P,reportType:'safety-inspection'})});
    check(s.status===422&&(await s.json()).switchedOff===true,`off: starting a safety inspection refused (${s.status})`);
    const t=await api('Engineer','/api/reports',{method:'POST',body:JSON.stringify({projectId:P,reportType:'tower-inspection',inspected:'T1'})});
    check(t.status===422,`off: starting a tower inspection refused (${t.status})`);
    const h=await api('Engineer','/api/reports',{method:'POST',body:JSON.stringify({projectId:P,reportType:'handover-inspection'})});
    check(h.ok,`off: a handover inspection still starts (${h.status})`);
    const w=await (await api('Engineer',`/api/weekly-summary?projectId=${P}`)).json();
    check(w.site.talks.length===0&&w.site.deliveries.length===0,'off: the weekly summary API leaves talks and deliveries out');
    const m=await (await api('Engineer','/api/my-week')).json();
    check(m.totals.records===0,'off: My week counts no talks, permits or deliveries');
    const b=await (await api('Engineer',`/api/before-handover?projectId=${P}`)).json();
    check(b.safety.length===0&&b.totals.safety===0,'off: Before handover counts no safety actions');
    const m403=await api('Manager','/api/admin/features',{method:'POST',body:JSON.stringify({safetyRecords:true})});
    check(m403.status===403,`off: a Manager cannot turn them on (${m403.status})`);
    const bad=await api('Admin','/api/admin/features',{method:'POST',body:JSON.stringify({safetyRecords:'yes'})});
    check(bad.status===422,`off: the switch takes only on or off (${bad.status})`);
  }
  {
    const {context,page,errors}=await open('Engineer');
    await page.goto(`${base}/engineer?project=${P}`);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();await page.waitForTimeout(500);
    await shot(page,'switch-off-engineer-home-light-390');
    const home=await text(page);
    check(!SAFETY_WORDS.test(home.replace(/handover inspection/gi,'')),`off: the Site page says nothing of safety, permits or deliveries (${home.match(SAFETY_WORDS)?.[0]})`);
    for(const path of SAFETY)check(await page.locator(`a[href^="${path}"]`).count()===0,`off: the Site page has no link to ${path}`);
    const types=await page.evaluate(()=>JSON.parse(localStorage.getItem('relay-offline-types')||'[]').map(t=>t.id));
    check(types.join('|')==='handover-inspection|first-fix-inspection',`off: the no-signal page can start only handover and first fix (${types})`);
    await page.getByRole('button',{name:'Reports',exact:true}).first().click();await page.getByRole('heading',{name:'Reports',level:1}).waitFor();
    check(await page.locator('a[href^="/safety-actions"]').count()===0,'off: Reports has no Safety actions link');
    for(const path of SAFETY){
      await page.goto(`${base}${path}?project=${P}&returnTo=${encodeURIComponent(`/engineer?project=${P}`)}`);
      check(await page.getByRole('heading',{level:1}).innerText().then(t=>/is not in use\.$/.test(t)),`off: ${path} says it is not in use`);
      check(/ask the office/.test(await text(page))&&await page.getByRole('link',{name:'Back to Site'}).count()===1,`off: ${path} says to ask the office and goes Back to Site`);
      if(path==='/deliveries')await shot(page,'switch-off-page-light-390');
    }
    await page.goto(`${base}/my-week`);await page.locator('.mw-foot').waitFor();
    check(!SAFETY_WORDS.test(await text(page)),'off: My week says nothing of them');
    await page.goto(`${base}/weekly-summary?project=${P}`);await page.locator('.week-foot').waitFor();
    check(!SAFETY_WORDS.test(await text(page)),'off: the weekly summary says nothing of them');
    await page.goto(`${base}/handover?project=${P}`);await page.locator('.ho-foot').waitFor();
    check(await page.locator('#ho-safety').count()===0&&await page.locator('.ho-stats a').count()===4,'off: Before handover has no safety section or figure');
    await page.goto(`${base}/help?for=site`);await page.locator('.help-new li').first().waitFor();
    if(await page.getByRole('button',{name:/^Show all/}).count())await page.getByRole('button',{name:/^Show all/}).click();
    check(!SAFETY_WORDS.test(await helpText(page)),`off: Help (site) says nothing else of them (${(await helpText(page)).match(SAFETY_WORDS)?.[0]})`);
    check(await page.locator('.help-new h3',{hasText:'A simpler RELAY, built round the site report'}).count()===1,'off: What\'s new names the simpler RELAY');
    assert.deepEqual(errors,[],'off engineer: page errors');
    await context.close();
  }
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office`);await page.getByRole('heading',{name:'Office position'}).waitFor();await page.waitForTimeout(800);
    await shot(page,'switch-off-office-dark-1440');
    check(await page.locator('a[href^="/safety-actions"]').count()===0,'off: the office overview has no Safety actions button');
    await page.goto(`${base}/office#/projects/${P}`);await page.getByRole('heading',{name:/^Register · Tetley Hall/}).waitFor();await page.waitForTimeout(800);
    const desk=await page.locator('body').innerText();
    check(!/Short delivery|Safety, permits and deliveries|Toolbox talks/.test(desk),'off: the project sheet and register show no delivery line or safety links');
    await page.goto(`${base}/help?for=office`);await page.locator('.help-new li').first().waitFor();
    if(await page.getByRole('button',{name:/^Show all/}).count())await page.getByRole('button',{name:/^Show all/}).click();
    check(!SAFETY_WORDS.test(await helpText(page)),`off: Help (office) says nothing else of them (${(await helpText(page)).match(SAFETY_WORDS)?.[0]})`);
    assert.deepEqual(errors,[],'off manager: page errors');
    await context.close();
  }

  // ---------------------------------------------------------------- the Admin turns them on
  {
    const {context,page,errors}=await open('Admin','light',1440);
    await page.goto(`${base}/admin#/admin/features`);
    const panel=page.locator('.adm-switch');await panel.waitFor();
    check(/Off: RELAY keeps to site reports, issues and variations/.test(await panel.innerText()),'Admin tab: says what off means');
    await shot(page,'switch-admin-off-light-1440');
    await panel.getByRole('button',{name:'Turn them on'}).click();
    await page.locator('.adm-switch').getByRole('button',{name:'Turn them off'}).waitFor({timeout:10000});
    check(getRecord('settings','features')?.safetyRecords===true&&getRecord('settings','features')?.changedBy==='Cal Admin','Admin tab: turning on is stored with who did it');
    check(records('settings-audit').length===1,'Admin tab: the change is audited');
    assert.deepEqual(errors,[],'admin: page errors');
    await context.close();
  }

  // ---------------------------------------------------------------- on
  {
    for(const path of SAFETY){const r=await api('Engineer',`/api${path}?project=${P}`);check(r.ok,`on: GET /api${path} answers (${r.status})`);}
    const w=await (await api('Engineer',`/api/weekly-summary?projectId=${P}`)).json();
    check(w.site.talks.length===1&&w.site.deliveries.length===1,'on: the talk and delivery recorded before come back on the weekly summary');
    const {context,page,errors}=await open('Engineer');
    await page.goto(`${base}/engineer?project=${P}`);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();await page.waitForTimeout(800);
    await shot(page,'switch-on-engineer-home-light-390');
    const group=page.getByRole('group',{name:'Safety, permits and deliveries'});
    check(await group.count()===1,'on: the Site page has the safety, permits and deliveries group');
    check(/1 to sort/.test(await group.innerText()),'on: the delivery recorded before is still to sort');
    const types=await page.evaluate(()=>JSON.parse(localStorage.getItem('relay-offline-types')||'[]').map(t=>t.id));
    check(types.length===4,`on: the no-signal page can start all four inspections (${types})`);
    await page.goto(`${base}/toolbox-talks?project=${P}`);
    check(await page.getByText('Safe isolation').first().waitFor({timeout:10000}).then(()=>true,()=>false),'on: Toolbox talks lists the talk recorded before');
    await page.goto(`${base}/help?for=site`);await page.locator('.help-new li').first().waitFor();
    if(await page.getByRole('button',{name:/^Show all/}).count())await page.getByRole('button',{name:/^Show all/}).click();
    check(await page.locator('.help-new h3',{hasText:'Toolbox talks'}).count()===1&&await page.locator('.help-card h3',{hasText:'A tower or podium'}).count()===1,'on: Help lists them again');
    assert.deepEqual(errors,[],'on engineer: page errors');
    await context.close();
    const office=await open('Manager','dark',1440);
    await office.page.goto(`${base}/office#/projects/${P}`);await office.page.getByRole('heading',{name:/^Register · Tetley Hall/}).waitFor();
    await office.page.getByText('Short delivery from Edmundson Electrical').first().waitFor({timeout:15000});
    check(true,'on: the office sees the short delivery in Needs attention');
    check(await office.page.locator('a[href^="/safety-actions"]').count()>0,'on: the office has Safety actions links');
    assert.deepEqual(office.errors,[],'on manager: page errors');
    await office.context.close();
  }

  // ---------------------------------------------------------------- and off again
  {
    const r=await api('Admin','/api/admin/features',{method:'POST',body:JSON.stringify({safetyRecords:false})});
    check(r.ok&&getRecord('settings','features')?.safetyRecords===false,'off again: the Admin turns them off');
    check(records('toolbox-talks').length===1&&records('deliveries').length===1,'off again: nothing recorded was deleted');
    check((await api('Engineer',`/api/deliveries?project=${P}`)).status===404,'off again: the API refuses again');
  }
  console.log(`Simpler home switch check passed (${checks} checks): with safety, permits and deliveries off by default, no screen, Help entry, register or summary shows them, their pages say they are not in use and their API refuses, safety and tower inspections cannot be started online or offline; the Admin turns them on from the Admin tab (a Manager cannot), everything recorded before comes back, and off again deletes nothing.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
