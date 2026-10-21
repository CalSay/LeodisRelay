// Browser check: the September office work, on today's office screens.
// A manager opens a sent report in the Inbox and uses Quick actions on its
// cards: a defect moves to our contract, a variation is marked within
// contract, and a progress card gets a note; each change is listed under its
// card and the records change on the server. The Variations tab files the
// within-contract variation under its own filter and adds a variation raised
// by the office. The Admin adds a person and sets their name under People,
// and the office then shows the engineer by that name. An engineer cannot
// record a correction or add a variation.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-september-office-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const {listVariations}=require('../apps/web/.test-build/lib/variationStore.js');
const {listCorrections}=require('../apps/web/.test-build/lib/corrections.js');
const engineer={id:'entra:sept-engineer',oid:'sept-engineer',name:'sept.engineer',email:'sept.engineer@leodisme.com',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:sept-manager',oid:'sept-manager',name:'Sept Manager',email:'sept-mgr@example.test',role:'Manager'};
const admin={id:'entra:sept-admin',oid:'sept-admin',name:'Sept Admin',email:'sept-admin@example.test',role:'Admin'};
const sessions={};
for(const p of [engineer,manager,admin]){const id=randomUUID();sessions[p.role]=id;putRecord('sessions',{id,principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});putRecord('identities',{id:p.id,email:p.email,oid:p.oid,name:p.name,microsoftName:p.name});}
const photo=()=>({id:randomUUID(),dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC',caption:'Riser',capturedAt:new Date().toISOString()});
const card=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const report=createReport('proj-011lme',engineer.name,engineer);
const saved=saveDraft(report.id,{...report,observations:[
  card('update','Level 2','First fix containment run'),
  card('defect','Level 3 riser','Fire stopping missing round the tray',{actionNeeded:'Fire stop before close-up',owner:'Northbank Electrical',affectedTrade:'Electrical',photos:[photo()]}),
  card('instruction','Plant room','Client asked for two extra sockets',{variationReason:'Client instruction'}),
]},report.version);assert.ok(saved.ok,saved.reason);
const sent=await submitReport(report.id,{name:engineer.name},saved.value.version);assert.ok(sent.ok,sent.reason);
const defectIssue=listIssues('proj-011lme').find(i=>i.raisedByReport===report.id);
const variation=listVariations('proj-011lme').find(v=>v.raisedByReport===report.id);
assert.ok(defectIssue&&variation,'the report raised an issue and a variation');
const port=4441,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-september-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const axe=async(page,selector)=>{await page.addScriptTag({content:axeSource});return page.evaluate(async s=>(await window.axe.run(document.querySelector(s),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')+' '+(n.any[0]?.message??'')+' '+n.html.slice(0,120)).join(', ')}`),selector);};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const api=async(role,path,init={})=>fetch(base+path,{...init,headers:{cookie:`relay_session=${sessions[role]}`,'content-type':'application/json',origin:base,...(init.headers??{})}});

  // An engineer is refused both office acts, before anything changes.
  eq((await api('Engineer','/api/corrections',{method:'POST',body:JSON.stringify({reportId:report.id,observationId:saved.value.observations[0].id,action:'note',targetType:'observation',note:'x'})})).status,403,'an engineer cannot record a correction');
  eq((await api('Engineer','/api/variations',{method:'POST',body:JSON.stringify({requestId:randomUUID(),projectId:'proj-011lme',description:'x'})})).status,403,'an engineer cannot add a variation');

  // Only the Admin changes people: the server refuses a Manager, whatever the screen shows.
  eq((await api('Manager','/api/admin/people',{method:'POST',body:JSON.stringify({action:'rename',email:engineer.email,name:'Not Allowed'})})).status,403,'a manager cannot rename someone');
  eq((await api('Manager','/api/admin/people',{method:'POST',body:JSON.stringify({action:'assignment',email:engineer.email,assignment:'Admin'})})).status,403,'a manager cannot change a role');
  eq((await api('Manager','/api/admin/people',{method:'POST',body:JSON.stringify({action:'add',email:'someone.new@leodisme.com',name:'Some One',assignment:'Manager'})})).status,403,'a manager cannot add someone');

  // A Manager reads the same Team tab, with nothing to change.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/office#/team`);
    await page.getByRole('heading',{name:'Who can sign in'}).waitFor();
    eq(await page.getByRole('button',{name:'Add person'}).count(),0,'a manager has no Add person button on Team');
    eq(await page.locator('a[href="#/admin"]').count(),0,'a manager has no Admin tab');
    eq(errors.join('\n'),'','no page errors on the manager\'s Team tab');
    await context.close();
  }

  // The Admin names the engineer under People, on the Team tab. An old link to Admin > People opens it.
  {
    const {context,page,errors}=await open('Admin','light',1440);
    await page.goto(`${base}/office#/admin/roles`);
    await page.getByRole('heading',{name:'Team',exact:true}).waitFor();
    eq(await page.locator('.hnav a.on').innerText().then(t=>t.startsWith('Team')),true,'an old Admin > People link opens the Team tab');
    await page.goto(`${base}/office#/team`);
    const panel=page.locator('.panel',{has:page.getByRole('heading',{name:'Who can sign in'})});
    await panel.waitFor();
    eq(await page.getByRole('heading',{name:'Who can sign in'}).count(),1,'one list of people on Team');
    await page.goto(`${base}/office#/admin`);
    await page.getByRole('heading',{name:'Notifications waiting'}).waitFor();
    eq(await page.locator('.filters a.chip',{hasText:'People'}).count(),0,'Admin no longer repeats People');
    await page.goto(`${base}/office#/team`);
    await panel.waitFor();
    await page.getByRole('button',{name:'Add person'}).first().click();
    await page.getByLabel('Work email').fill(engineer.email);
    await page.getByLabel('Name in RELAY').fill('Sam Spark');
    await page.getByLabel('Role').selectOption('Engineer.Electrical');
    const found=await axe(page,'.view');
    eq(found.join('\n'),'','axe finds nothing on People with the add form open');
    if(screenshot)await page.screenshot({path:join(screenshot,'people-add-light-1440.png'),fullPage:true});
    await page.locator('form').getByRole('button',{name:'Add person'}).click();
    await page.locator('.toast',{hasText:'Sam Spark added'}).waitFor();
    const row=panel.locator('tr',{hasText:engineer.email});
    await row.waitFor();
    ok((await row.innerText()).includes('Sam Spark'),'the person is listed by their new name');
    await row.click();
    await page.getByRole('heading',{name:'Sam Spark'}).waitFor();
    ok((await page.locator('.panel',{has:page.getByRole('heading',{name:'Sam Spark'})}).innerText()).includes('Added as Engineer · Electrical'),'their change log says who added them and as what');
    const names=await (await api('Manager','/api/people/names')).json();
    eq(names.names[engineer.id],'Sam Spark','the name is served by account for the office screens');
    eq(errors.join('\n'),'','no page errors on People');
    await context.close();
  }

  // The manager corrects the report from the Inbox reader.
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const tag=`${scheme} ${width}px`;
    const {context,page,errors}=await open('Manager',scheme,width);
    await page.goto(`${base}/office#/inbox/${report.id}`);
    const reader=page.locator('.sheet',{has:page.getByRole('heading',{name:/^Visit /})});
    await reader.waitFor();
    ok((await reader.locator('.sheet-title').innerText()).includes('Sam Spark'),`${tag}: the reader shows the engineer by the name set in RELAY`);
    eq(await reader.getByRole('button',{name:'Quick actions'}).count(),3,`${tag}: every card offers quick actions`);
    eq(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tag}: no sideways scroll`);
    if(scheme==='light'){
      const defect=reader.locator('.hist',{hasText:'Fire stopping missing'});
      await defect.getByRole('button',{name:'Quick actions'}).click();
      await defect.getByRole('button',{name:'Falls under our contract'}).click();
      ok((await defect.locator('.ro-qa').innerText()).includes('moves from Northbank Electrical to Leodis M&E (our contract)'),`${tag}: it says what will change before anything is saved`);
      const found=await axe(page,'.ro-qa');
      eq(found.join('\n'),'',`${tag}: axe finds nothing in the open quick actions`);
      if(screenshot)await page.screenshot({path:join(screenshot,`quick-actions-${scheme}-${width}.png`),fullPage:true});
      await defect.getByLabel(/^Why\?/).fill('On the M&E spec, rev C');
      await defect.getByRole('button',{name:'Confirm change'}).click();
      await page.locator('.toast',{hasText:'moved to Leodis M&E (our contract)'}).waitFor();
      await defect.locator('.ro-qa-clog').waitFor();
      ok((await defect.locator('.ro-qa-clog').innerText()).includes('On the M&E spec, rev C'),`${tag}: the change is listed under the card with the reason`);
      eq(listIssues('proj-011lme').find(i=>i.id===defectIssue.id).owner,'Leodis M&E (our contract)',`${tag}: the issue's owner changed on the server`);

      const vo=reader.locator('.hist',{hasText:'two extra sockets'});
      await vo.getByRole('button',{name:'Quick actions'}).click();
      await vo.getByRole('button',{name:'Falls under our contract'}).click();
      await vo.getByRole('button',{name:'Confirm change'}).click();
      await page.locator('.toast',{hasText:'marked within contract'}).waitFor();
      await vo.locator('.ro-qa-clog').waitFor();
      eq(listVariations('proj-011lme').find(v=>v.id===variation.id).instruction,'within_contract',`${tag}: the variation is within contract on the server`);
      await page.waitForFunction(()=>[...document.querySelectorAll('.hist')].some(h=>h.textContent.includes('two extra sockets')&&h.textContent.includes('Within contract · not charged')));
      ok(true,`${tag}: the card says it is within contract and not charged`);

      const progress=reader.locator('.hist',{hasText:'First fix containment run'});
      await progress.getByRole('button',{name:'Quick actions'}).click();
      eq(await progress.getByRole('button',{name:'Save note'}).isDisabled(),true,`${tag}: an empty note cannot be saved`);
      await progress.getByLabel(/^Note/).fill('Good photos; add the room number next time');
      await progress.getByRole('button',{name:'Save note'}).click();
      await page.locator('.toast',{hasText:'Note saved'}).waitFor();
      eq(listCorrections({reportId:report.id}).length,3,`${tag}: three corrections are recorded against the report`);
      await reader.locator('.sheet-title .ro-qa-chip',{hasText:'3 corrected'}).waitFor();
      ok(true,`${tag}: the reader counts the corrected cards`);
    } else {
      eq(await reader.locator('.ro-qa-clog').count(),3,`${tag}: the change logs are there when the report is opened again`);
      if(screenshot)await page.screenshot({path:join(screenshot,`corrected-report-${scheme}-${width}.png`),fullPage:true});
    }
    eq(errors.join('\n'),'',`${tag}: no page errors in the Inbox`);
    await context.close();
  }

  // Variations: the within-contract filter, and a variation added by the office.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/office#/variations`);
    await page.getByRole('heading',{name:'Variations'}).waitFor();
    await page.getByRole('button',{name:/^Within contract · 1$/}).click();
    const rows=page.locator('table.reg tbody tr');
    eq(await rows.count(),1,'the within-contract filter lists the one variation');
    ok((await rows.first().innerText()).includes('Not charged'),'and says it is not charged');
    const before=listVariations('proj-011lme').length;
    await page.getByRole('button',{name:'Add variation'}).click();
    const dialog=page.locator('.ws-dialog');
    await dialog.waitFor();
    await dialog.locator('select[name=projectId]').selectOption('proj-011lme');
    await dialog.locator('textarea[name=description]').fill('Move the distribution board 600 mm left');
    await dialog.locator('input[name=location]').fill('Level 1 corridor');
    const found=await axe(page,'.ws-dialog');
    eq(found.join('\n'),'','axe finds nothing in the Add a variation dialog');
    if(screenshot)await page.screenshot({path:join(screenshot,'add-variation-light-1440.png')});
    await dialog.getByRole('button',{name:'Add variation'}).click();
    await page.locator('.toast',{hasText:'It needs a quote.'}).waitFor();
    const added=listVariations('proj-011lme').filter(v=>v.source==='office');
    eq(listVariations('proj-011lme').length,before+1,'one variation was added, not two');
    eq(added.length,1,'raised by the office');
    eq(added[0].raisedById,manager.id,'attributed to the manager signed in');
    eq(added[0].instruction,'pending','and waiting for a quote');
    await page.waitForURL(new RegExp(`#/projects/proj-011lme/variation/${added[0].id}$`));
    ok(true,'the office lands on the new variation');
    eq(errors.join('\n'),'','no page errors on Variations');
    await context.close();
  }
  console.log(`Passed ${checks} September office checks (People, quick actions, within contract, add a variation; 390px light and 1440px dark).`);
} finally {
  await browser?.close();
  server.kill();
}
