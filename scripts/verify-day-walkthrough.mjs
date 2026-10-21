// Browser check for a working day across RELAY, end to end, where features
// built separately meet. An engineer on a phone opens the site home, reads the
// notes for the next visit, records the morning toolbox talk, a hot works permit
// and a delivery that came short, does a weekly safety inspection (signed by typing)
// and a tower inspection (each with one action), sends a site update with a
// defect linked to an existing issue, a new defect (signed out partway and back
// in) and a progress card added with no signal, closes the permit, then checks
// the home screen, My week and Safety actions (starting the podium's inspection
// from there), and the home screen with no signal. The office, on a phone and a
// desktop, reads the overview and Needs attention, the project's register, the
// Inbox and the report, the new issue, Safety actions, Before handover and the
// snag list, the Weekly summary, logs a chase, sorts the short delivery, downloads
// the issue, permit and delivery spreadsheets and opens the PDF. Counts are
// compared between pages.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-day-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,getRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport,renameInspected}=require('../apps/web/.test-build/lib/serverStore.js');
const {leaveNote}=require('../apps/web/.test-build/lib/siteNoteStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const {SAFETY_CHECKLIST,TOWER_CHECKLIST}=require('../apps/web/.test-build/lib/reportTypes.js');
const engineer={id:'entra:day-engineer',oid:'day-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:day-other',oid:'day-other',name:'Priya Pipe',email:'priya@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:day-manager',oid:'day-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,other,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme';
const daysAgo=n=>new Date(Date.now()-n*86400000);
const jpeg=colour=>sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer();
const photo=async colour=>[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await jpeg(colour)).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const sig='data:image/png;base64,'+(await sharp({create:{width:200,height:60,channels:4,background:'#ffffff00'}}).png().toBuffer()).toString('base64');
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const answered=(action)=>(o,i)=>({...o,check:{...o.check,answer:action&&i===action.at?'action':'ok'},...(action&&i===action.at?{whatHappened:action.wrong,actionNeeded:action.doing,owner:action.who}:{})});
// The week before: sent the way the app sends them, then dated back.
async function sendAs(who,type,observations,ago,inspected){
  const r=createReport(P,who.name,who,type);
  let saved=saveDraft(r.id,{...r,observations:typeof observations==='function'?r.observations.map(observations):observations},r.version).value;
  if(inspected)saved=renameInspected(r.id,inspected).value;
  if(type!=='progress')putRecord('reports',{...saved,draftSignature:{name:who.name,dataUrl:sig}});
  const sent=await submitReport(r.id,type==='progress'?undefined:{name:who.name,dataUrl:sig},saved.version,who.name);
  assert.ok(sent.ok,JSON.stringify(sent));
  const at=new Date(daysAgo(ago).setUTCHours(14,30,0,0)).toISOString();
  for(const kind of ['reports','snapshots'])putRecord(kind,{...getRecord(kind,r.id),visitDate:at.slice(0,10),serverAcknowledgedAt:at});
}
await sendAs(other,'tower-inspection',answered(),9,'Podium P1, plant room');
await sendAs(other,'safety-inspection',answered({at:6,wrong:'Fire exit on level 1 blocked by pallets',doing:'Clear the exit route',who:'Main contractor'}),8);
await sendAs(other,'progress',[ob('update','Level 3 plant room','Booster set installed'),
  ob('defect','Level 2 riser','Fire stopping missing round pipework',{actionNeeded:'Fire stop before boarding',owner:'Firestop North Ltd',affectedTrade:'P&H',photos:await photo('#aa7744')}),
  ob('defect','Level 1 corridor','Ceiling tile damaged by drill',{actionNeeded:'Replace tile',owner:'Ceilings R Us',affectedTrade:'Other',photos:await photo('#7788aa')})],3);
await sendAs(other,'progress',[ob('update','Level 4','First fix complete')],1);
const work=async()=>{while(await runOneJob());};
await work();
leaveNote({projectId:P,text:'Gate code changed to 4721. Site manager wants the level 2 riser fire stopping checked before Friday.',requestId:randomUUID()},manager);
leaveNote({projectId:P,text:'Tower T3 has moved to the east stair.',requestId:randomUUID()},other);
const port=4402,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-day-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const openIssues=()=>records('issues',P).filter(i=>i.work!=='closed'&&i.confirmation!=='withdrawn').length;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await sleep(500);}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`),fullPage:true});};
  const contextFor=async(who,scheme,width,height)=>{const c=await browser.newContext({viewport:{width,height},colorScheme:scheme,acceptDownloads:true});await c.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);return c;};
  const noSideways=async(page,label)=>ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${label}: no sideways scroll`);

  // ---------------- The engineer's day, on a phone ----------------
  const ec=await contextFor(engineer,'light',390,844);
  const page=await ec.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const home=`${base}/engineer?project=${P}`;
  await page.goto(home);await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // 1. Morning: the home screen says what is waiting.
  const row=name=>page.locator('.eng-row').filter({has:page.locator('b',{hasText:name})});
  await row('Safety actions').filter({hasText:/open/}).waitFor();
  ok(/1 open · 1 tower due/.test(await row('Safety actions').innerText()),`home: safety actions open and the podium due: ${await row('Safety actions').innerText()}`);
  ok(/2 notes/.test(await row('Notes for the next visit').innerText()),'home: two notes waiting');
  await shot(page,'engineer-home-morning-light-390');
  await row('Notes for the next visit').click();await page.getByText('Gate code changed to 4721').waitFor();
  ok(true,'notes: the office\'s note is there');
  await page.getByRole('link',{name:'← Back to Site'}).click();await page.waitForURL(home);
  // The morning briefing: a toolbox talk recorded from the home screen, which then shows it.
  await row('Toolbox talks').filter({hasText:/None recorded yet/}).waitFor();
  await row('Toolbox talks').click();await page.getByRole('button',{name:'Record a toolbox talk'}).click();
  await page.getByRole('group',{name:'Topics to start from'}).getByRole('button',{name:'Safe isolation'}).click();
  await page.getByLabel('Who attended').fill('Jo Bloggs\nAli Khan, Northbank Electrical');
  await page.getByRole('button',{name:'Save toolbox talk'}).click();await page.locator('.tt-talk').first().waitFor();
  ok(records('toolbox-talks',P).length===1,'toolbox talk: the morning briefing is kept');
  await page.getByRole('link',{name:'← Back to Site'}).click();await page.waitForURL(home);
  await row('Toolbox talks').filter({hasText:'Last: Safe isolation · today'}).waitFor();
  ok(true,'home: the toolbox talk row shows this morning\'s briefing');
  // The hot works permit the site manager issued for the riser, recorded from the home screen.
  await row('Permits to work').filter({hasText:/None recorded yet/}).waitFor();
  await row('Permits to work').click();await page.getByRole('button',{name:'Record a permit'}).click();
  await page.getByText('Hot works',{exact:true}).click();
  await page.getByLabel('The work and where').fill('Brazing LTHW flow and return, level 3 riser');
  await page.getByLabel('Issued by').fill('Dana Reid, Northbank Construction');
  await page.getByLabel(/^Permit number/).fill('HW-0142');
  await page.getByRole('button',{name:'Save permit'}).click();await page.locator('.pt-permit').first().waitFor();
  ok(records('permits',P).length===1&&records('permits',P)[0].byId===engineer.id,'permit: the hot works permit is kept under the engineer');
  await page.getByRole('link',{name:'← Back to Site'}).click();await page.waitForURL(home);
  await row('Permits to work').locator('.main>span',{hasText:/^1 open$/}).waitFor();checks++;
  // The cable comes two reels short: recorded, and the home screen marks it until it is sorted.
  await row('Deliveries').click();await page.getByRole('button',{name:'Record a delivery'}).click();
  await page.getByLabel('Supplier',{exact:true}).fill('Edmundson Electrical');
  await page.getByLabel('What arrived').fill('6 x 100m reels 2.5mm T&E');
  await page.getByText('Short or part delivery',{exact:true}).click();
  await page.getByLabel('What was short?').fill('2 reels short, rest promised Thursday');
  await page.getByRole('button',{name:'Save delivery'}).click();await page.locator('.dl-delivery').first().waitFor();
  ok(records('deliveries',P).length===1&&records('deliveries',P)[0].condition==='short','delivery: the short delivery is kept');
  await page.getByRole('link',{name:'← Back to Site'}).click();await page.waitForURL(home);
  await row('Deliveries').filter({hasText:'1 to sort'}).waitFor();
  ok(await row('Deliveries').evaluate(a=>a.classList.contains('late')),'home: the Deliveries row is marked while one is to sort');
  await shot(page,'engineer-home-records-light-390');

  // 2. A weekly safety inspection, then a tower inspection, each with one action.
  const card=()=>page.locator('.eng-slot.open .eng-card');
  async function inspect(tile,list,tower,wrong,typed){
    await page.goto(home);
    await page.getByRole('button',{name:tile}).click();
    if(tower){await page.getByLabel('Which tower or podium?').fill(tower);await page.getByRole('button',{name:'Start the tower inspection'}).click();}
    await page.waitForURL(/\/reports\/rep-/);await page.locator('.eng-checkrow').first().click();
    await card().getByRole('heading',{name:list[0].question}).waitFor();
    await card().getByRole('button',{name:'Action needed'}).click();
    if(await card().getByLabel('Where',{exact:true}).count())await card().getByLabel('Where',{exact:true}).fill('Level 2 riser');
    await card().getByLabel('What’s wrong',{exact:true}).fill(wrong);
    await card().getByLabel('What needs doing',{exact:true}).fill('Put right before work starts');
    await card().getByLabel('Who is to do it',{exact:true}).fill('Main contractor');
    await card().getByLabel('Who is to do it',{exact:true}).blur();await sleep(300);
    for(let i=1;i<list.length;i++){
      await page.locator('.eng-next-check:visible').click();
      await card().getByRole('heading',{name:list[i].question}).waitFor({timeout:5000});
      await card().getByRole('button',{name:list[i].item==='stabilisers'?'Not applicable':'Satisfactory'}).click();
    }
    await page.locator('.eng-review-link:visible').filter({hasText:'All answered'}).click();await page.locator('#report-check').waitFor();
    if(typed){
      await page.getByRole('radio',{name:'Type my name instead'}).click();
      await page.getByRole('textbox',{name:'Your full name'}).fill(engineer.name);
      await page.locator('#report-check input[type=checkbox]').check();
    } else {
      const pad=page.locator('canvas.sigpad');await pad.scrollIntoViewIfNeeded();const box=await pad.boundingBox();
      await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
      for(let x=20;x<box.width-20;x+=12)await page.mouse.move(box.x+x,box.y+box.height/2+Math.sin(x/15)*20);
      await page.mouse.up();
    }
    await page.waitForFunction(()=>!document.querySelector('.actionbar .btn-primary')?.disabled);
    await page.getByRole('button',{name:'Send to office'}).click();
    await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:20000});
    return page.url().split('/reports/')[1].split(/[?#]/)[0];
  }
  const safetyId=await inspect(/Do a safety inspection/,SAFETY_CHECKLIST,null,'Extension lead with a cut sheath',true);
  ok(getRecord('reports',safetyId).signature?.typed,'safety inspection: sent with a typed signature');
  const towerId=await inspect(/Do a tower inspection/,TOWER_CHECKLIST,'T3, east stair','Toe board missing on the top lift',false);
  ok(getRecord('reports',towerId).inspected==='T3, east stair','tower inspection: sent, naming the tower');

  // 3. A site update: the riser defect again (linked to its issue), a new defect, then progress with no signal.
  const before=openIssues();
  const riser=records('issues',P).find(i=>/Fire stopping/.test(i.description));
  await page.goto(home);
  await page.getByRole('button',{name:/Start a site update/}).click();await page.waitForURL(/\/reports\//);
  const updateId=page.url().split('/reports/')[1].split(/[?#]/)[0];
  await page.getByRole('button',{name:/Something wrong/}).click();
  let open=page.locator('.eng-slot.open');
  await open.getByLabel('Where',{exact:true}).fill('Level 2 riser');
  await open.getByRole('button',{name:/Fire stopping missing round pipework/}).click();
  await open.getByLabel(/What’s wrong/).first().fill('Fire stopping still missing round the pipework');
  await open.locator('input[type=file]').first().setInputFiles({name:'riser.jpg',mimeType:'image/jpeg',buffer:await jpeg('#996633')});
  await open.getByText('On the server').last().waitFor({timeout:15000});
  await open.getByRole('button',{name:'Done with this card'}).click();
  await page.getByRole('button',{name:/Add a card/}).click();
  await page.getByRole('button',{name:/Something wrong/}).click();
  open=page.locator('.eng-slot.open');
  await open.getByLabel('Where',{exact:true}).fill('Flat 2.04 kitchen');
  await open.getByLabel(/What’s wrong/).first().fill('Socket faceplate cracked');
  await open.getByLabel(/What needs doing/).first().fill('Replace faceplate');
  // Signed out partway: the card is kept on the phone, and saves by itself once signed in again.
  const session=live=>putRecord('sessions',{id:sessions[engineer.oid],principal:engineer,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+(live?7200000:-1000)).toISOString()});
  session(false);
  await open.getByLabel(/What’s wrong/).first().fill('Socket faceplate cracked, kitchen side');
  await page.evaluate(()=>document.activeElement?.blur());
  const saveState=page.locator('.savestate b');
  await saveState.filter({hasText:/Signed out/}).waitFor({timeout:15000});
  ok(/kept on this phone/i.test(await page.evaluate(()=>document.body.innerText))&&await page.getByRole('link',{name:/Sign in again/}).count()>0,'site update: signed out, it says the card is kept and offers to sign in again');
  await shot(page,'engineer-signed-out-light-390');
  session(true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await saveState.filter({hasText:'Saved on server'}).waitFor({timeout:40000});
  ok(getRecord('reports',updateId).observations.some(o=>o.whatHappened==='Socket faceplate cracked, kitchen side'),'site update: once signed in again the card saved by itself');
  await open.locator('input[type=file]').first().setInputFiles({name:'socket.jpg',mimeType:'image/jpeg',buffer:await jpeg('#aa3333')});
  await open.getByText('On the server').last().waitFor({timeout:15000});
  await open.getByRole('button',{name:'Done with this card'}).click();
  // Signal goes in the corridor.
  await ec.setOffline(true);
  await page.getByRole('button',{name:/Add a card/}).click();
  await page.getByRole('button',{name:/Work done or progressed/}).click();
  open=page.locator('.eng-slot.open');
  await open.getByLabel('What happened',{exact:true}).fill('Containment on level 2 lidded');
  await open.getByLabel('Where',{exact:true}).fill('Level 2 corridor');
  await open.locator('input[type=file]').first().setInputFiles({name:'lid.jpg',mimeType:'image/jpeg',buffer:await jpeg('#335577')});
  await open.getByText(/Only on this phone/).first().waitFor({timeout:10000});
  ok(true,'site update: a card added with no signal is kept on the phone');
  await open.getByRole('button',{name:'Done with this card'}).click();
  // Signal back: it goes up by itself, then sign and send.
  await ec.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  for(let k=0;k<60&&getRecord('reports',updateId).observations.length<3;k++)await sleep(250);
  ok(getRecord('reports',updateId).observations.length===3,'site update: the card reached the server once signal returned');
  await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();await page.locator('#report-check').waitFor();
  await page.getByText(/All 3 cards and 3 (photos|photographs) are on the server/).waitFor({timeout:20000});checks++;
  const pad=page.locator('canvas.sigpad');await pad.scrollIntoViewIfNeeded();const box=await pad.boundingBox();
  await page.mouse.move(box.x+20,box.y+40);await page.mouse.down();for(let x=20;x<box.width-20;x+=12)await page.mouse.move(box.x+x,box.y+40+Math.sin(x/15)*20);await page.mouse.up();
  await sleep(500);
  await page.getByRole('button',{name:'Send to office'}).click();await page.locator('.tag-sent').first().waitFor({timeout:20000});
  await work();
  ok(openIssues()===before+1,`site update: one new issue, the linked one adds to ${riser.reference} (${before} -> ${openIssues()})`);
  ok(getRecord('issues',riser.id).events.length===2,'site update: the linked defect is a second entry on the existing issue');
  // The brazing is done and the fire watch kept: the permit is closed.
  await page.goto(`${base}/permits?project=${P}&returnTo=${encodeURIComponent('/engineer?project='+P)}`);
  const permit=page.locator('.pt-permit',{hasText:'Brazing LTHW'});
  await permit.getByRole('button',{name:/^Close permit/}).click();
  await permit.locator('.pt-check input').check();
  await permit.getByLabel(/^Closing note/).fill('Fire watch by Jo until 15:10');
  await permit.getByRole('button',{name:'Close permit',exact:true}).click();
  await permit.locator('.tag',{hasText:'Closed'}).waitFor();
  ok(records('permits',P)[0].closed?.byId===engineer.id,'permit: closed with the fire watch confirmed');
  assert.deepEqual(errors,[],'engineer: page errors');

  // 4. Afternoon: the home screen, My week and Safety actions agree.
  await page.goto(home);
  await row('Site issues').filter({hasText:/open/}).waitFor();
  const issues=openIssues();
  ok((await row('Site issues').innerText()).includes(`${issues} open`),`home: Site issues says ${issues} open`);
  ok((await page.locator('#eng-project-title').locator('..').innerText()).includes(`${issues} open issues`),'home: This project agrees');
  await row('Safety actions').filter({hasText:/open/}).waitFor();
  ok(/2 open · 1 tower due/.test(await row('Safety actions').innerText()),`home: two safety actions now open: ${await row('Safety actions').innerText()}`);
  ok(await row('Safety actions').evaluate(a=>a.classList.contains('late')),'home: the Safety actions row is marked while actions are open');
  ok(/Socket faceplate cracked/.test(await page.locator('.eng-list').filter({hasText:'you raised it'}).innerText()),'home: the new issue came back from the office list');
  await noSideways(page,'home');
  await shot(page,'engineer-home-afternoon-light-390');
  await page.goto(`${home}&view=issues`);await page.getByText('Socket faceplate cracked').waitFor();
  ok(await page.locator('.eng-panel a[href^="/issues/"]').count()===issues,'Issues: lists the same number as the home screen');
  ok(await page.getByRole('button',{name:/Assigned to me/}).count()===0,'Issues: no unfinished "Assigned to me" button');
  await shot(page,'engineer-issues-light-390');
  await page.goto(`${base}/my-week?returnTo=${encodeURIComponent('/engineer?project='+P)}`);await page.locator('.mw-days').waitFor();
  ok(/Reports sent\s*3\s*3 other site records/i.test(await page.locator('.mw-stats').innerText()),`My week: three reports sent today, and the talk, permit (recorded and closed) and delivery: ${await page.locator('.mw-stats').innerText()}`);
  const today=page.locator('.mw-today');
  for(const what of ['Toolbox talk: Safe isolation','Permit recorded: Hot works HW-0142','Permit closed: Hot works HW-0142','Delivery: Edmundson Electrical'])
    ok(await today.getByRole('link',{name:what}).count()===1,`My week: today lists "${what}"`);
  await today.getByRole('link',{name:'Delivery: Edmundson Electrical'}).click();await page.waitForURL(/\/deliveries\?project=/);
  await page.getByRole('link',{name:'← Back to My week'}).first().click();await page.waitForURL(/\/my-week/);
  await page.locator('.mw-days').waitFor();checks++;
  await shot(page,'engineer-my-week-light-390');
  await page.goto(`${base}/safety-actions?project=${P}`);await page.locator('.sa-stats').waitFor();
  const saStats=await page.locator('.sa-stats').innerText();
  ok(/Open actions\s*2/i.test(saStats)&&/Towers due\s*1/i.test(saStats),`Safety actions: matches the home screen: ${JSON.stringify(saStats)}`);
  // The podium is due: start its inspection from here, named as last time, and come back.
  const podium=page.getByRole('button',{name:'Inspect Podium P1, plant room'});
  ok(await podium.evaluate(b=>b.classList.contains('btn-primary')),'Safety actions: the podium due has a gold Inspect button');
  ok(!(await page.getByRole('button',{name:'Inspect T3, east stair'}).evaluate(b=>b.classList.contains('btn-primary'))),'Safety actions: the tower inspected today has a plain one');
  ok(await page.getByRole('button',{name:/^Do a safety inspection on 011LME /}).count()===1,'Safety actions: offers the weekly safety inspection');
  await noSideways(page,'Safety actions with start buttons');
  await shot(page,'engineer-safety-actions-light-390');
  await podium.click();await page.waitForURL(/\/reports\/rep-/);await page.locator('.eng-checkrow').first().waitFor();
  const podiumId=page.url().split('/reports/')[1].split(/[?#]/)[0];
  ok(getRecord('reports',podiumId).reportType==='tower-inspection'&&getRecord('reports',podiumId).inspected==='Podium P1, plant room','Safety actions: Inspect starts a tower inspection naming the podium');
  // The phone's own Back, then the editor's Back link: either way the page knows of the draft.
  const carriesOn=async how=>{
    await page.waitForURL(/\/safety-actions\?project=/);
    const cont=page.getByRole('link',{name:/^Continue the tower inspection of Podium P1, plant room on /});await cont.waitFor();
    ok(await cont.count()===1&&await page.getByRole('button',{name:/^Inspect /}).count()===0,`Safety actions: after ${how}, it carries on with the draft rather than starting another`);
    return cont;
  };
  await page.goBack();
  await (await carriesOn('the browser\'s Back')).click();await page.waitForURL(new RegExp(podiumId));
  await page.getByRole('link',{name:/Back to Safety actions/}).first().click();
  await carriesOn('Back to Safety actions');
  // 5. No signal in the riser: the home screen says it cannot check rather than showing nothing open.
  await page.goto(home);await row('Site issues').filter({hasText:/open/}).waitFor();await sleep(500);
  // Playwright's offline switch does not reach the service worker's own fetch, so the
  // reload is the page the worker cached and every API call fails, as on a phone that
  // still has RELAY open. If that changes, abort /api/** with page.route instead.
  await ec.setOffline(true);
  await page.reload();
  await page.getByText('No signal, so RELAY cannot check with the office just now.').waitFor({timeout:15000});checks++;
  ok(!/0 open/.test(await row('Site issues').innerText())&&!/0 on file/.test(await row('Reports').innerText()),'no signal: no counts of nothing');
  ok(!/\b0 open issues\b/.test(await page.locator('main').innerText()),'no signal: This project shows no zero');
  await row('Notes for the next visit').filter({hasText:'copy on this phone'}).waitFor();
  ok(/2 notes · copy on this phone/.test(await row('Notes for the next visit').innerText()),'no signal: notes come from the copy on the phone');
  await shot(page,'engineer-home-no-signal-light-390');
  await ec.setOffline(false);
  assert.deepEqual(errors.filter(e=>!/fetch|network/i.test(e)),[],'engineer: page errors');
  await ec.close();

  // ---------------- The office, on a phone and on a desktop ----------------
  const newIssue=records('issues',P).find(i=>/faceplate/.test(i.description));
  const update=getRecord('reports',updateId),safety=getRecord('reports',safetyId);
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    const label=`office ${scheme} ${width}px`;
    const context=await contextFor(manager,scheme,width,height);
    const p=await context.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    // Overview: safety actions counted; this week's notifications only.
    await p.goto(`${base}/office`);
    const safetyButton=p.getByRole('link',{name:/^Safety actions · \d+ open$/});await safetyButton.waitFor();
    ok((await safetyButton.innerText())==='Safety actions · 2 open',`${label}: the overview counts open safety actions`);
    const week=await p.locator('dl.tb').filter({hasText:'Received this week'}).locator('dd').first().innerText();
    const [received,pending]=[Number(week.match(/^\d+/)[0]),Number(week.match(/(\d+) PM notification/)?.[1]??0)];
    ok(pending<=received,`${label}: no more notifications pending than reports received this week: ${JSON.stringify(week)}`);
    // Needs attention: the podium due and the two open actions, one line for the project, ahead of overdue issues.
    const also=p.locator('.sheet > .rmenu').last();
    await also.getByText('2 safety actions open').waitFor();checks++;
    ok(await also.getByText('Podium P1, plant room: tower inspection due').count()===1,`${label}: Also needs attention has the podium due`);
    const bell=p.getByRole('button',{name:/^Attention \d+$/});
    await bell.click();
    const pop=p.locator('.attn-pop');
    const titles=await pop.locator('.mini b').allInnerTexts();
    const tower=titles.indexOf('Podium P1, plant room: tower inspection due'),actions=titles.indexOf('2 safety actions open');
    ok(tower===0&&actions===1,`${label}: Attention leads with the podium due, then the open actions: ${JSON.stringify(titles.slice(0,4))}`);
    ok(!titles.includes('Weekly safety inspection due'),`${label}: no weekly inspection due, one was sent today`);
    ok(Number((await bell.innerText()).match(/\d+/)[0])===titles.length,`${label}: the Attention count is the number of lines`);
    const SHORT='Short delivery from Edmundson Electrical, not sorted yet';
    ok(titles.includes(SHORT),`${label}: Attention has the short delivery`);
    ok(!titles.some(t=>/permit/i.test(t)),`${label}: no permit line, the permit was closed in time`);
    await pop.getByRole('link',{name:'2 safety actions open'}).click();
    await p.waitForURL(/\/safety-actions\?project=/);await p.locator('.sa-stats').waitFor();
    ok(/Open actions\s*2/i.test(await p.locator('.sa-stats').innerText())&&/Towers due\s*1/i.test(await p.locator('.sa-stats').innerText()),`${label}: the line opens the project's Safety actions, with the same counts`);
    await p.getByRole('link',{name:/Back to Office/}).first().click();
    await safetyButton.waitFor();checks++;
    if(width===390){
      // On a phone the project opens as its register: Needs action has the same safety and delivery lines, and counts them.
      await p.goto('about:blank');await p.goto(`${base}/office#/projects/${P}`);
      const group=p.locator('.grp',{hasText:'Safety, permits and deliveries'});await group.waitFor();
      const lines=await p.locator('.col').filter({has:group}).locator('a.arow[href^="/safety-actions"], a.arow[href^="/permits"], a.arow[href^="/deliveries"]').allInnerTexts();
      ok(lines.length===3&&Number(await group.locator('i').innerText())===3&&lines.some(l=>l.includes(SHORT))&&lines.some(l=>l.includes('Podium P1, plant room: tower inspection due')),`${label}: the register lists the podium, the safety actions and the delivery: ${JSON.stringify(lines)}`);
      const chip=await p.getByRole('button',{name:/^Needs action · \d+$/}).innerText();
      ok(Number(chip.match(/\d+/)[0])>=3,`${label}: Needs action counts them: ${chip}`);
      await noSideways(p,`${label} register`);
      await shot(p,`office-register-${scheme}-${width}`);
    }
    if(width===1440){
      // The short delivery, picked up from Needs attention: sorted with a note, and the line goes.
      await bell.click();await p.locator('.attn-pop').getByRole('link',{name:SHORT}).click();
      await p.waitForURL(/\/deliveries\?project=/);
      const edm=p.locator('.dl-delivery',{hasText:'Edmundson Electrical'});
      await edm.getByRole('button',{name:/^Mark sorted/}).click();
      await edm.getByLabel('How was it sorted?').fill('Rang Edmundson: the 2 reels come Thursday');
      await edm.getByRole('button',{name:'Mark sorted',exact:true}).click();
      await edm.locator('.tag',{hasText:'sorted'}).waitFor();checks++;
      const [dl]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download spreadsheet'}).click()]);
      ok(/Edmundson Electrical/.test(readFileSync(await dl.path(),'utf8'))&&/2 reels come Thursday/.test(readFileSync(await dl.path(),'utf8')),`${label}: the deliveries spreadsheet has the delivery and how it was sorted`);
      await p.getByRole('link',{name:/Back to Office/}).first().click();await safetyButton.waitFor();
      await bell.click();await p.locator('.attn-pop .mini').first().waitFor();
      ok(!(await p.locator('.attn-pop .mini b').allInnerTexts()).includes(SHORT),`${label}: the delivery has left Attention once sorted`);
      await bell.click();
      await p.goto(`${base}/permits?project=${P}`);await p.locator('.pt-permit').first().waitFor();
      const [pf]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download spreadsheet'}).click()]);
      ok(/HW-0142/.test(readFileSync(await pf.path(),'utf8'))&&/Fire watch by Jo/.test(readFileSync(await pf.path(),'utf8')),`${label}: the permits spreadsheet has the permit and its closing note`);
      // The project's own sheet: the same two lines under its Needs attention.
      await p.goto('about:blank');await p.goto(`${base}/office#/projects/${P}`);
      const sheetAttn=p.locator('.sheet > .rmenu').first();
      await sheetAttn.getByText('2 safety actions open').waitFor();checks++;
      ok(await sheetAttn.getByText('Podium P1, plant room: tower inspection due').count()===1,`${label}: the project sheet's Needs attention has the podium due`);
    }
    await noSideways(p,`${label} overview`);
    await shot(p,`office-overview-${scheme}-${width}`);
    // Inbox: the site update, read in the reader.
    await p.goto('about:blank');await p.goto(`${base}/office#/inbox`);
    await p.getByText(update.reference).first().click();
    await p.getByText('Socket faceplate cracked').first().waitFor();checks++;
    await shot(p,`office-reader-${scheme}-${width}`);
    // The new issue: unassigned, on the office's attention list.
    await p.goto('about:blank');await p.goto(`${base}/office#/projects/${P}/issue/${newIssue.id}`);
    await p.getByText(newIssue.reference).first().waitFor();checks++;
    // Issues register: the same open count as the engineer saw; download it.
    await p.goto('about:blank');await p.goto(`${base}/office#/issues`);
    const download=p.getByRole('link',{name:new RegExp(`Download ${issues} issues as a spreadsheet`)});
    await download.waitFor();checks++;
    const [file]=await Promise.all([p.waitForEvent('download'),download.click()]);
    const csv=readFileSync(await file.path(),'utf8');
    ok(csv.includes(newIssue.reference)&&csv.trim().split('\n').length===issues+1,`${label}: the spreadsheet holds the ${issues} open issues`);
    // Safety actions, Before handover and the snag list agree.
    await p.goto(`${base}/safety-actions?project=${P}`);await p.locator('.sa-stats').waitFor();
    ok(/Open actions\s*2/i.test(await p.locator('.sa-stats').innerText()),`${label}: Safety actions, 2 open`);
    ok(await p.locator('.sa-start, .sa-tower-start').count()===0,`${label}: Safety actions has no start buttons for the office`);
    await p.goto(`${base}/handover?project=${P}`);await p.getByText('Safety actions still open').waitFor();
    const handover=await p.locator('main').innerText();
    const tile=name=>Number(handover.match(new RegExp(`${name}\\s*(\\d+)`,'i'))?.[1]);
    ok(tile('Safety actions')===2&&tile('Our snags')+tile('Other trades')===issues,`${label}: Before handover agrees: ${tile('Our snags')} + ${tile('Other trades')} issues, ${tile('Safety actions')} safety actions`);
    await p.goto(`${base}/issues/snag-list?project=${P}`);
    await p.getByText(`${issues} to put right`).waitFor();checks++;
    // The Weekly summary for the site meeting has the day's talk, permit and delivery.
    await p.goto(`${base}/weekly-summary?project=${P}`);
    const siteWeek=p.locator('.week-section',{has:p.getByRole('heading',{name:/^Toolbox talks, permits and deliveries/})});await siteWeek.waitFor();
    const said=await siteWeek.innerText();
    ok(/Safe isolation/.test(said)&&/Hot works HW-0142\s*Closed/i.test(said)&&new RegExp(width===390?'Short · to sort':'Short · sorted','i').test(said),`${label}: the Weekly summary lists the talk, the closed permit and the delivery: ${JSON.stringify(said)}`);
    await shot(p,`office-weekly-summary-${scheme}-${width}`);
    // A chase to the company that owns the old riser issue.
    if(width===390){
      await p.goto(`${base}/companies`);
      const firm=p.locator('.co-card').filter({has:p.locator('h2',{hasText:/^Firestop North Ltd$/})});
      await firm.getByRole('button',{name:'Log a chase'}).click();
      await firm.getByLabel('What was said').fill('Rang the office, back Friday to fire stop the riser');
      await firm.getByRole('button',{name:'Save chase'}).click();
      await firm.getByText('Chase saved').waitFor();checks++;
      ok(/back Friday/.test(await firm.locator('.co-chase').innerText()),`${label}: the chase shows on the company`);
    }
    // The PDF: RELAY's own header and a named tab.
    await p.goto(`${base}/reports/${safety.id}/pdf`);
    // The viewer's own page count; the PDF's footer has the same words once its text layer draws.
    await p.getByText(/^Page 1 of \d+$/).waitFor({timeout:30000});checks++;
    await p.waitForFunction(()=>document.title==='Report PDF · RELAY');checks++;
    ok(!(await p.getByRole('link',{name:'Companies',exact:true}).isVisible()),`${label}: the PDF page has the shared header, not the old Home / Companies bar`);
    ok(await p.getByRole('link',{name:'← Back to report'}).isVisible(),`${label}: the PDF page says where Back goes`);
    await noSideways(p,`${label} PDF`);
    await shot(p,`office-pdf-${scheme}-${width}`);
    await p.getByRole('link',{name:'View the document'}).click();await p.waitForURL(/\/preview/);
    await p.getByRole('link',{name:'← Back to report'}).waitFor();checks++;
    await p.waitForFunction(ref=>document.title===`${ref} document · RELAY`,safety.reference);checks++;
    assert.deepEqual(errs,[],`${label}: page errors`);
    await context.close();
  }
  console.log(`Day walkthrough check passed (${checks} checks): engineer home, notes, toolbox talk, permit opened and closed, short delivery, safety and tower inspections, site update with a linked defect, signed out and back, a card added with no signal, My week, Safety actions, home with no signal; office overview, Needs attention, register on a phone, delivery sorted, Inbox, the new issue, issue, permit and delivery spreadsheets, Safety actions, Before handover, snag list, Weekly summary, chase and PDF, at 390px and 1440px.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
