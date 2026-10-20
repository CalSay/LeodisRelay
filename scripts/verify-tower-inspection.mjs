// Browser check for EXP-5's fourth report type: a tower inspection of one
// mobile tower or podium. From the engineer home: name the tower on the tile
// (refused when empty), start, rename it, answer every check (one needing
// action, which asks no Where), sign with a drawing, send. Then the server
// copy (named, no issue raised), the draft PDF's words, Safety actions (the
// tower, its action under its name, and a tower overdue its next inspection),
// the site diary, and the office report sheet. At 390px light and 1440px dark.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-tower-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {TOWER_CHECKLIST,startingCards,REPORT_TYPES}=require('../apps/web/.test-build/lib/reportTypes.js');
const engineer={id:'entra:tower-engineer',oid:'tower-engineer',name:'Toni Tower',email:'toni@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:tower-manager',oid:'tower-manager',name:'Morgan Office',email:'morgan@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});}
// (The visit date is the server's UTC day; the page counts in London time, so around midnight "today" can read "yesterday".)
// A podium inspected ten days ago and not since: due again.
const old=new Date(Date.now()-10*86400000).toISOString().slice(0,10);
const towerType=REPORT_TYPES.find(t=>t.id==='tower-inspection');
putRecord('reports',{id:'rep-old-podium',projectId:'proj-011lme',reportType:'tower-inspection',inspected:'Podium P1, plant room',reference:'011LME-TPI-090',visitDate:old,author:engineer.name,authorId:engineer.id,
  state:'submitted',version:2,revision:1,review:'not_required',serverAcknowledgedAt:new Date(Date.now()-10*86400000).toISOString(),
  observations:startingCards(towerType).map(o=>({...o,check:{...o.check,answer:'ok'}})),signature:{name:engineer.name,dataUrl:'data:image/png;base64,iVBORw0KGgo=',signedAt:new Date().toISOString()}});
const port=4371,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-tower-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const N=TOWER_CHECKLIST.length;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await sleep(500);}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name,full=false)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`),fullPage:full});};
  const contextFor=async(who,scheme,width,height)=>{const c=await browser.newContext({viewport:{width,height},colorScheme:scheme});await c.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);return c;};
  let n=0;const named=[];
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    n++;
    const label=`${scheme} ${width}px`,wide=width>=900;
    const first=`T${n}, level 2 east`,tower=`T${n+4}, level 2 east corridor`;
    const context=await contextFor(engineer,scheme,width,height);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);

    // 1. The home screen offers it; the tile asks which tower before starting.
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const tile=page.getByRole('button',{name:/Do a tower inspection/});
    await tile.waitFor();
    ok(/12 checks on one mobile tower or podium/.test(await tile.innerText())&&/Safety actions/.test(await tile.innerText()),`${label}: the tile says what it asks and where actions go`);
    for(const other of ['Do a safety inspection','Do a handover inspection','Do a first fix inspection','Start a site update'])ok(await page.getByRole('button',{name:new RegExp(other)}).isVisible(),`${label}: "${other}" is still there`);
    await tile.click();
    const input=page.getByLabel('Which tower or podium?');
    await input.waitFor();checks++;
    ok(await input.evaluate(el=>el===document.activeElement),`${label}: focus moves to the tower's name`);
    const reports=()=>records('reports','proj-011lme').filter(r=>r.reportType==='tower-inspection'&&r.state==='draft').length;
    const before=reports();
    await page.getByRole('button',{name:'Start the tower inspection'}).click();
    await page.getByRole('alert').filter({hasText:'Say which tower or podium you are inspecting.'}).waitFor();checks++;
    eq(reports(),before,`${label}: nothing started without a tower`);
    await page.getByRole('button',{name:'Cancel'}).click();
    await tile.waitFor();
    ok(await tile.evaluate(el=>el===document.activeElement),`${label}: Cancel puts focus back on the tile`);
    await tile.click();
    await input.fill(`  ${first}  `);
    eq(await overflow(),false,`${label}: the tile's form has no sideways scroll`);
    await shot(page,`home-name-${scheme}-${width}`);
    await page.getByRole('button',{name:'Start the tower inspection'}).click();
    await page.waitForURL(/\/reports\/rep-/);
    const id=new URL(page.url()).pathname.split('/')[2];
    await page.locator('h1').filter({hasText:'Tower inspection'}).waitFor();checks++;
    ok(/TPI-00\d$/.test(await page.locator('.pagehead .ref').innerText()),`${label}: its own reference series`);
    eq(getRecord('reports',id).inspected,first,`${label}: started with its tower, tidied`);
    ok((await page.locator('.eng-inspected').innerText()).includes(first),`${label}: the tower is shown under the title`);

    // 2. Rename it: the server keeps the new name and the draft's version.
    const version=getRecord('reports',id).version;
    if(process.env.SKIP_RENAME){named.push(first);}else{
    await page.locator('.eng-inspected').getByRole('button',{name:'Rename'}).click();
    const rename=page.locator('#inspected-name');
    ok(await rename.evaluate(el=>el===document.activeElement),`${label}: Rename moves focus to the name`);
    await rename.fill('');
    await page.getByRole('button',{name:'Save name'}).click();
    await page.getByRole('alert').filter({hasText:'Say which tower or podium you are inspecting.'}).waitFor();checks++;
    await rename.fill(tower);
    await page.getByRole('button',{name:'Save name'}).click();
    await page.locator('.eng-inspected b').filter({hasText:tower}).waitFor();checks++;
    eq(getRecord('reports',id).inspected,tower,`${label}: renamed on the server`);
    eq(getRecord('reports',id).version,version,`${label}: renaming is not a save of the checks`);
    ok(await page.locator('.eng-inspected').getByRole('button',{name:'Rename'}).evaluate(el=>el===document.activeElement),`${label}: focus returns to Rename`);
    named.push(tower);}

    // 3. The first check needs action: no Where, the action goes on Safety actions.
    const rows=page.locator('.eng-checkrow');
    eq(await rows.count(),N,`${label}: one row per check`);
    const card=()=>page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card');
    if(!wide)await rows.nth(0).click();
    await card().getByRole('heading',{name:TOWER_CHECKLIST[0].question}).waitFor();checks++;
    await card().getByRole('button',{name:'Action needed'}).click();
    eq(await card().getByLabel('Where',{exact:true}).count(),0,`${label}: an action asks no Where: the tower is where`);
    eq(await card().getByLabel('What needs doing',{exact:true}).getAttribute('placeholder'),'What has to happen before it is used again',`${label}: the prompt is in this inspection's words`);
    await card().getByLabel('What’s wrong',{exact:true}).fill('Tag out of date, last signed three weeks ago');
    await card().getByLabel('What needs doing',{exact:true}).fill('Inspect and re-tag before use');
    await card().getByLabel('Who is to do it',{exact:true}).fill('Leodis Electrical');
    ok(/followed on Safety actions/.test(await card().innerText()),`${label}: the card says the action is followed on Safety actions`);
    eq(await overflow(),false,`${label}: an open check has no sideways scroll`);
    await shot(page,`check-action-${scheme}-${width}`);
    for(let i=1;i<N;i++){
      // Typing hides the bottom bar; leaving the field brings it back and moves the page, so leave it first.
      if(i===1){await card().getByLabel('Who is to do it',{exact:true}).blur();await sleep(300);}
      await page.locator('.eng-next-check:visible').click();
      await card().getByRole('heading',{name:TOWER_CHECKLIST[i].question}).waitFor({timeout:5000}).catch(async e=>{await page.screenshot({path:join(process.env.DEBUG_DIR||root,'fail.png'),fullPage:true});console.log(await page.locator('.eng-slot').evaluateAll(b=>b.map(x=>x.className+' '+x.id)));throw e;});
      await card().getByRole('button',{name:TOWER_CHECKLIST[i].item==='stabilisers'?'Not applicable':'Satisfactory'}).click();
    }
    checks++;
    await page.locator('.eng-review-link:visible').filter({hasText:'All answered'}).click();
    await page.locator('#report-check').waitFor();
    const does=await page.locator('.eng-does').innerText();
    ok(/1 action listed on the inspection/.test(does)&&/followed on Safety actions/.test(does)&&/Nothing is added to the issue register/.test(does),`${label}: it says what sending does: ${does}`);
    let saved;for(let k=0;k<40;k++){saved=getRecord('reports',id);if(saved.observations.filter(o=>o.check?.answer).length===N)break;await sleep(250);}
    eq(saved.observations.filter(o=>o.check?.answer).length,N,`${label}: every answer reached the server`);
    eq(saved.inspected,tower,`${label}: saving the checks keeps the renamed tower`);

    // 4. The draft PDF names the tower.
    if(n===1){
      const pdf=await page.request.get(`${base}/api/reports/${id}/pdf`);
      eq(pdf.status(),200,`${label}: the draft PDF renders`);
      const file=join(root,'tower.pdf');writeFileSync(file,await pdf.body());
      const text=spawnSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
      if(text.status===0){
        const said=text.stdout.replace(/\s+/g,''),says=words=>said.includes(words.replace(/\s+/g,''));
        for(const words of ['TOWER AND PODIUM INSPECTION','TOWER OR PODIUM',tower,'ACTIONS ARISING','Inspect and re-tag before use','Not applicable'])ok(says(words),`${label}: the PDF says "${words}"`);
      } else console.log('pdftotext not found: PDF words not checked');
    }

    // 5. Sign with a drawing and send: nothing raised.
    const send=page.getByRole('button',{name:'Send to office'});
    const pad=page.locator('canvas.sigpad');await pad.scrollIntoViewIfNeeded();
    const box=await pad.boundingBox();
    await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
    for(let x=20;x<box.width-20;x+=12)await page.mouse.move(box.x+x,box.y+box.height/2+Math.sin(x/15)*20);
    await page.mouse.up();
    await page.waitForFunction(()=>!document.querySelector('.actionbar .btn-primary')?.disabled);checks++;
    await send.click();
    await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor();checks++;
    const sent=getRecord('reports',id);
    eq(sent.state,'submitted',`${label}: sent`);
    eq(sent.inspected,tower,`${label}: sent with its tower`);
    eq(records('issues','proj-011lme').filter(i=>i.raisedByReport===id).length,0,`${label}: no issue raised`);
    eq(await page.locator('.eng-inspected button').count(),0,`${label}: a sent inspection cannot be renamed`);
    ok((await page.locator('.eng-inspected').innerText()).includes(tower),`${label}: the sent view names the tower`);
    const refused=await page.request.post(`${base}/api/reports/${id}`,{data:{action:'rename',inspected:'T99'}});
    eq(refused.status(),409,`${label}: the server refuses renaming a sent inspection`);

    // 6. Safety actions: the tower, its action under its name, the overdue podium.
    await page.goto(`${base}/safety-actions?project=proj-011lme`);
    const towers=page.locator('.sa-towers');
    await towers.waitFor();checks++;
    const listed=await towers.innerText();
    ok(listed.includes(tower)&&new RegExp(`${tower.replace(/[.,]/g,'.')} last inspected .*(today|yesterday)`).test(listed),`${label}: the tower is listed, inspected today: ${JSON.stringify(listed)}`);
    ok(/Podium P1, plant room.*1[01] days ago · another is due/s.test(listed),`${label}: the podium not inspected for ten days is due`);
    const action=page.locator('.sa-action').filter({hasText:tower});
    ok(/Inspection tag in place and up to date/.test(await action.innerText()),`${label}: its action is listed under the tower`);
    {const stats=await page.locator(".sa-stats").innerText();ok(/Towers due\s*1\b/i.test(stats),`${label}: one tower due: ${JSON.stringify(stats)}`);}
    eq(await overflow(),false,`${label}: Safety actions has no sideways scroll`);
    await shot(page,`safety-actions-${scheme}-${width}`,true);

    // 7. The site diary names the tower.
    await page.goto(`${base}/diary?project=proj-011lme`);
    const entry=page.locator('.diary-entry').filter({hasText:sent.reference});
    await entry.waitFor();
    {const said=await entry.locator(".diary-inspection").innerText();ok(said.toLowerCase().includes(`tower inspection · ${tower}`.toLowerCase()),`${label}: the diary names the tower: ${JSON.stringify(said)}`);}
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('button',{name:/Do a tower inspection/}).waitFor();checks++;
    assert.deepEqual(errors,[],`${label}: page errors`);
    await context.close();
  }

  // 8. The office sheet names the tower; a manager cannot rename someone's draft.
  const sent=records('reports','proj-011lme').find(r=>r.reportType==='tower-inspection'&&r.state==='submitted'&&r.inspected===named[0]);
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const context=await contextFor(manager,scheme,width,height);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects/proj-011lme/report/${sent.id}`);
    await page.getByText('Tower and Podium Inspection').first().waitFor();checks++;
    ok(await page.locator('.sheet-inspected').filter({hasText:`Tower or podium: ${named[0]}`}).isVisible(),`office ${scheme}: the sheet names the tower`);
    eq(await page.getByText('On this inspection').count(),1,`office ${scheme}: the action stays on the inspection`);
    if(screenshot)await page.screenshot({path:join(screenshot,`office-${scheme}-${width}.png`)});
    assert.deepEqual(errors,[],`office ${scheme}: page errors`);
    await context.close();
  }
  {
    const context=await contextFor(engineer,'light',390,844);
    const page=await context.newPage();
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const draft=await page.evaluate(async()=>{const r=await fetch('/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'proj-011lme',reportType:'tower-inspection',inspected:'T9'})});return r.json();});
    eq(draft.inspected,'T9','the API starts a tower inspection with its tower');
    const none=await page.evaluate(async()=>(await fetch('/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'proj-011lme',reportType:'tower-inspection'})})).status);
    eq(none,422,'the API refuses a tower inspection with no tower');
    const extra=await page.evaluate(async()=>(await fetch('/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'proj-011lme',reportType:'safety-inspection',inspected:'T9'})})).status);
    eq(extra,422,'the API refuses a tower on a safety inspection');
    await context.close();
    const office=await contextFor(manager,'light',1440,900);
    const other=await office.newPage();
    await other.goto(`${base}/office`);
    const status=await other.evaluate(async id=>(await fetch(`/api/reports/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'rename',inspected:'T10'})})).status,draft.id);
    eq(status,403,'only the author renames a draft');
    eq(getRecord('reports',draft.id).inspected,'T9','and the name is unchanged');
    await office.close();
  }
  console.log(`Tower inspection check passed (${checks} checks): named on the tile, renamed, answered, signed, sent with nothing raised, followed on Safety actions with a due tower, and read back at 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
