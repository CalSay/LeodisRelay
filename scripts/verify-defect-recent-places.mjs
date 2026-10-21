// Browser check for the quick defect (2026-10-21): "Flag a defect" offers the
// same recent places as a site update card (#107's compact chips, from the
// same list), under "Where on site?", and the form's button sends the defect
// straight away, naming the site, instead of opening a check screen that
// repeated the form. Where stays free text.
// Checks: three chips from yesterday's update, no count, a tap fills Where and
// is held in the device draft, the place in the box is not offered again,
// typing anything is kept, a project with no places shows no chips, 48px
// targets, no sideways scroll; nothing sent while the description is empty;
// one tap from the form sends it, with the chip's place on the issue; with no
// signal it says "Defect not sent yet", survives a reload, and "Try again"
// with signal sends it exactly once; a lost receipt retried is still one
// issue.
// Light and dark at 390px, dark at 1440px.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-defect-places-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const MIN_TARGET=48;
const engineer={id:'entra:dp-engineer',oid:'dp-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=n=>{const id=randomUUID();putRecord('sessions',{id,principal:{...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const P='proj-011lme',EMPTY='proj-014lme';
const ob=(location,whatHappened)=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
async function sentYesterday(project,places){
  const r=createReport(project,engineer.name,engineer,'progress');
  const saved=saveDraft(r.id,{...r,observations:places.map((p,i)=>ob(p,`Work ${i+1}`))},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));
  const yesterday=new Date(Date.now()-86400000).toISOString();
  for(const kind of ['reports','snapshots'])putRecord(kind,{...getRecord(kind,r.id),visitDate:yesterday.slice(0,10),serverAcknowledgedAt:yesterday});
}
await sentYesterday(P,['Level 2 corridor','Flat 3.02','Plant room']);
const png=await sharp({create:{width:24,height:24,channels:3,background:'#997744'}}).png().toBuffer();
const port=4437,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-defect-places',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(`${scheme}-${width}`),url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-defect-${name}-${scheme}-${width}.png`),fullPage:true});}};
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const places=()=>page.getByRole('group',{name:'Recent places',exact:true});
    // Sorted: each run's sent defects reorder the places, newest first.
    const chipTexts=async()=>(await places().locator('.eng-chip').allInnerTexts()).map(s=>s.trim()).sort();
    const where=()=>page.getByLabel('Where on site?',{exact:true});
    const describe=()=>page.getByLabel('What needs attention?',{exact:true});
    const sendButton=()=>page.getByRole('button',{name:/^Send defect to /});
    const issuesNamed=async text=>(await context.request.get(`${base}/api/issues?projectId=${P}`).then(r=>r.json())).issues.filter(i=>i.description===text);
    const held=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'null'),`relay-defect:${engineer.id}-${scheme}-${width}:${P}`);

    // From the Site page: the tile opens the form with the recent places under Where.
    await page.goto(`${base}/engineer?project=${P}`);
    await tap(page.getByRole('button',{name:/Flag a defect/}).first());
    await where().waitFor();await places().waitFor();
    assert.deepEqual(await chipTexts(),['Flat 3.02','Level 2 corridor','Plant room'],`${label}: the three places from yesterday's update`);checks++;
    eq(await places().locator('.eng-suggestions-head span').count(),1,`${label}: no count beside "Recent places"`);
    ok(await places().evaluate(g=>g.closest('.field')?.querySelector('#defect-location')!==null),`${label}: the chips sit with "Where on site?"`);
    eq(await page.getByRole('button',{name:/Check defect/}).count(),0,`${label}: no "Check defect" step`);
    eq((await sendButton().innerText()).trim(),'Send defect to Tetley Hall - Block E',`${label}: the button names the site`);
    for(const b of [...await places().getByRole('button').all(),sendButton()]){const box=await b.boundingBox();ok(box.height>=MIN_TARGET-0.5,`${label}: "${(await b.innerText()).trim().slice(0,24)}" at least ${MIN_TARGET}px tall (${Math.round(box.height)})`);}
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling`);
    await shot('form');

    // Nothing goes while the description is empty.
    await tap(sendButton());
    const alert=page.locator('.eng-defect [role=alert]');await alert.waitFor();
    ok(await alert.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=window.innerHeight;}),`${label}: the reason it was not sent is brought into view`);
    // Tapped again without fixing it: the same reason comes back into view.
    await sendButton().evaluate(e=>e.scrollIntoView({block:'center'}));await tap(sendButton());await page.waitForTimeout(300);
    ok(await alert.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=window.innerHeight;}),`${label}: the same reason is brought into view again`);
    eq((await issuesNamed('')).length,0,`${label}: nothing sent without a description`);

    await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
    const text=`Cracked socket faceplate ${scheme} ${width}`;
    await describe().fill(text);
    await tap(places().getByRole('button',{name:'Flat 3.02',exact:true}));
    eq(await where().inputValue(),'Flat 3.02',`${label}: a chip fills "Where on site?"`);
    assert.deepEqual(await chipTexts(),['Level 2 corridor','Plant room'],`${label}: the place in the box is not offered again`);checks++;
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)??'null')?.location==='Flat 3.02',`relay-defect:${engineer.id}-${scheme}-${width}:${P}`);
    ok(true,`${label}: the chip's place is held in the draft on the device`);
    await where().fill('  plant   ROOM ');
    assert.deepEqual(await chipTexts(),['Flat 3.02','Level 2 corridor'],`${label}: a typed place matches whatever its case or spacing`);checks++;
    await where().fill('Riser cupboard, level 3');
    eq((await chipTexts()).length,3,`${label}: a new place typed in leaves all three offered`);
    eq((await held()).location,'Riser cupboard, level 3',`${label}: free text kept as typed`);
    await tap(places().getByRole('button',{name:'Flat 3.02',exact:true}));
    await shot('filled');

    // One tap sends it.
    await tap(sendButton());
    await page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor();
    const sent=await issuesNamed(text);
    eq(sent.length,1,`${label}: one issue raised`);
    eq(sent[0].location,'Flat 3.02',`${label}: the issue has the chip's place`);
    await shot('sent');

    // No signal: kept on the phone, says so, survives a reload, goes once with "Try again".
    await page.goto(`${base}/engineer?project=${P}&view=defect`);
    await where().waitFor();await places().waitFor();
    const offlineText=`Loose trunking lid ${scheme} ${width}`;
    await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
    await describe().fill(offlineText);
    await tap(places().getByRole('button',{name:'Plant room',exact:true}));
    await context.setOffline(true);
    await tap(sendButton());
    await page.getByRole('heading',{name:'Defect not sent yet',exact:true}).waitFor();
    ok(await page.getByText(/it will only go once/).isVisible(),`${label}: no signal says it will only go once`);
    eq((await page.locator('.eng-defect [role=alert]').innerText()).trim(),'No signal, or no answer from RELAY. Your defect is kept on this phone.',`${label}: no signal in plain words`);
    eq((await held()).pending,true,`${label}: the unsent defect is held on the device`);
    await shot('no-signal');
    // Reloaded with RELAY still out of reach for uploads (it would otherwise go by itself, verify-defect-send-on-signal).
    // Uploads stay cut off until the tap, then only the tap's own goes through.
    let cut=true;
    await context.route('**/api/issues',route=>route.request().method()==='POST'&&cut?route.abort('internetdisconnected'):route.continue());
    await context.setOffline(false);
    await page.reload();
    await page.getByRole('heading',{name:'Defect not sent yet',exact:true}).waitFor();
    ok(true,`${label}: still "not sent yet" after a reload`);
    const again=page.getByRole('button',{name:'Try again',exact:true});
    await again.evaluate(e=>e.scrollIntoView({block:'center'}));
    cut=false;
    // Signal is back, so it may go by itself a moment before the tap lands: either way it goes once.
    await Promise.race([(wide?again.click():again.tap()).catch(()=>{}),page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor()]);
    await context.unroute('**/api/issues');
    await page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor();
    eq((await issuesNamed(offlineText)).length,1,`${label}: sent once when signal is back`);

    // A lost receipt: the office got it, the phone did not hear. "Try again" still makes one issue.
    await page.goto(`${base}/engineer?project=${P}&view=defect`);
    await where().waitFor();
    const lostText=`Missing fire stopping ${scheme} ${width}`;
    await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
    await describe().fill(lostText);await where().fill('Level 2 corridor');
    // The first upload reaches RELAY but its answer is lost; later ones are cut off until "Try again",
    // so it does not go by itself first (verify-defect-send-on-signal covers that).
    let lost=0,hold=true;
    await page.route('**/api/issues',async route=>{if(route.request().method()!=='POST')return route.continue();if(!lost++){await route.fetch();return route.abort();}return hold?route.abort('internetdisconnected'):route.continue();});
    await tap(sendButton());
    await page.getByRole('heading',{name:'Defect not sent yet',exact:true}).waitFor();
    hold=false;
    await Promise.race([tap(page.getByRole('button',{name:'Try again',exact:true})).catch(()=>{}),page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor()]);
    await page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor();
    eq((await issuesNamed(lostText)).length,1,`${label}: a lost receipt tried again is still one issue`);

    // A project with nothing recorded yet: no chips, the box is still there.
    await page.goto(`${base}/engineer?project=${EMPTY}&view=defect`);
    await where().waitFor();await page.waitForTimeout(800);
    eq(await places().count(),0,`${label}: no recent places on a project with none`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`Quick defect check passed (${checks} checks): recent places under "Where on site?" from the site update's list, a tap fills it and is held on the device, the place in the box not offered again, free text kept, none on an empty project; no check screen, the button names the site and sends in one tap; nothing sent without a description; no signal held, survives a reload and goes once; a lost receipt tried again is one issue; 48px targets; no sideways scroll; light and dark at 390px, dark at 1440px.`);
} finally {await browser?.close();server.kill();}
