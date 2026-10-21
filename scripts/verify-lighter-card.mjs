// Browser check for the lighter card (2026-10-21): a card in a site update no
// longer opens with four big Kind buttons. The kind was already chosen by
// "Start today's site update" or "+ Defect" and the like, and the card's
// heading says it, so the buttons only come out from "Change kind", which sits
// with Remove at the foot of the card (in the heading on a wide screen).
// Measures, on a 390px phone, how far down the card "Take a photo" sits; checks
// the kind can still be changed (and is saved), that picking one folds the
// buttons away, that "+ Variation" makes a variation, that "+ Access" turns a
// blank last card into access instead of adding another, focus, 48px targets,
// no sideways scroll, and the wide editor.
// Light and dark at 390px, dark at 1440px.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
// RELAY_CARD_REPORT=1 only prints the measurements (used to measure main before the change).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-lighter-card-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const reportOnly=process.env.RELAY_CARD_REPORT==='1';
/**
 * From the top of a new progress card to the top of "Take a photo", 390px.
 * It was 732px on main 3cde9ab with four Kind buttons at the top of the card;
 * folding them behind "Change kind" must save at least 140px of that.
 */
const BEFORE_PHOTO_OFFSET=732,MIN_SAVED=140;
const MIN_TARGET=48;
const engineer={id:'entra:lc-engineer',oid:'lc-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
/** One engineer per run, so each starts today's update afresh rather than carrying on the last run's. */
const sessionFor=n=>{const id=randomUUID();putRecord('sessions',{id,principal:{...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const P='proj-011lme';
// Yesterday's sent update, so the card offers recent places as it would on a real day.
{
  const r=createReport(P,engineer.name,engineer,'progress');
  const ob=(type,location,whatHappened)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[]});
  const saved=saveDraft(r.id,{...r,observations:[ob('update','Level 2 corridor','Containment to grid C'),ob('update','Flat 3.02','Second fix sockets'),ob('update','Plant room','Panel dressed')]},r.version).value;
  const sent=await submitReport(r.id,undefined,saved.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));
  const yesterday=new Date(Date.now()-86400000).toISOString();
  for(const kind of ['reports','snapshots'])putRecord(kind,{...getRecord(kind,r.id),visitDate:yesterday.slice(0,10),serverAcknowledgedAt:yesterday});
}
const port=4433,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-lighter-card',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{if(reportOnly){if(!value)console.log(`(not met) ${message}`);return;}assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const SAFETY_WORDS=/toolbox|permit|deliveries|safety action|safety inspection|tower/i;
const measured=[];
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(`${scheme}-${width}`),url:base}]);
    // A returning engineer on Tetley Hall, so home opens there rather than asking "Which site are you on?".
    await context.addInitScript(id=>{try{if(!localStorage.getItem(`relay-project:${id}`))localStorage.setItem(`relay-project:${id}`,'proj-011lme');}catch{}},`${engineer.id}-${scheme}-${width}`);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:true});}};
    const card=()=>page.locator(wide?'.eng-card-body:not([hidden]) .eng-card':'.eng-slot.open .eng-card');
    const kindTag=()=>page.locator(wide?'.eng-cardrow[aria-current="true"] .kind':'.eng-slot.open .eng-cardrow .kind');
    const kindIs=async()=>(await kindTag().textContent()).trim().toLowerCase();
    const changeKind=()=>card().getByRole('button',{name:'Change kind',exact:true});
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};

    // A new site update from the big button: one progress card, open.
    await page.goto(`${base}/engineer`);
    const big=page.getByRole('button',{name:/Start today’s site update/});
    await big.waitFor();await tap(big);
    await page.waitForURL(/\/reports\//);
    await card().getByLabel('Where',{exact:true}).waitFor();
    const reportId=page.url().match(/\/reports\/([^/?#]+)/)[1];
    const photoOffset=await card().evaluate(c=>{const cam=c.querySelector('label.camera');return Math.round(cam.getBoundingClientRect().top-c.getBoundingClientRect().top);});
    const cardHeight=await card().evaluate(c=>Math.round(c.getBoundingClientRect().height));
    measured.push(`${label}: "Take a photo" ${photoOffset}px down the card, card ${cardHeight}px tall`);
    await shot('new-card');
    if(reportOnly){await context.close();continue;}

    // The kind is one line, and the four buttons are folded away.
    eq(await card().locator('.kindrow').count(),0,`${label}: no Kind buttons on a new card`);
    eq(await kindIs(),'progress',`${label}: the card's heading says Progress`);
    eq(await changeKind().getAttribute('aria-expanded'),'false',`${label}: "Change kind" says it is closed`);
    if(!wide)ok(photoOffset<=BEFORE_PHOTO_OFFSET-MIN_SAVED,`${label}: "Take a photo" moved up at least ${MIN_SAVED}px (from ${BEFORE_PHOTO_OFFSET}px, now ${photoOffset}px)`);
    const lineBox=await changeKind().boundingBox();
    ok(lineBox.height>=MIN_TARGET&&lineBox.width>=MIN_TARGET,`${label}: "Change kind" is at least ${MIN_TARGET}px (${Math.round(lineBox.width)}×${Math.round(lineBox.height)})`);

    // Change kind: the four buttons come out, Progress picked, focus on it.
    await tap(changeKind());
    const row=card().locator('.kindrow');
    await row.waitFor();
    eq(await row.getByRole('button').count(),4,`${label}: four kinds to choose from`);
    eq(await row.locator('[aria-pressed="true"]').textContent().then(t=>t.replace('✓','').trim()),'Progress',`${label}: Progress is the one picked`);
    eq(await card().getByRole('button',{name:'Change kind',exact:true}).getAttribute('aria-expanded'),'true',`${label}: "Change kind" says it is open`);
    ok(await row.locator('[aria-pressed="true"]').evaluate(e=>e===document.activeElement),`${label}: focus goes to the kind picked`);
    for(const b of await row.getByRole('button').all()){const box=await b.boundingBox();ok(box.height>=MIN_TARGET,`${label}: kind button at least ${MIN_TARGET}px tall`);}
    await shot('choosing-kind');

    // Pick Defect: buttons fold away, the card asks a defect's questions, focus back on "Change kind".
    await tap(row.getByRole('button',{name:/Defect/}));
    await card().getByLabel('What’s wrong',{exact:true}).waitFor();
    eq(await card().locator('.kindrow').count(),0,`${label}: picking a kind folds the buttons away`);
    eq(await kindIs(),'defect',`${label}: the heading says Defect`);
    ok(await changeKind().evaluate(e=>e===document.activeElement),`${label}: focus is back on "Change kind"`);
    eq(await card().getByRole('group',{name:/Trade affected/}).getByRole('button',{name:'Electrical',exact:true}).getAttribute('aria-pressed'),'true',`${label}: the defect starts with the engineer's own trade`);

    // Opening the buttons and tapping the kind already picked just folds them away.
    await tap(changeKind());await row.waitFor();
    await tap(row.getByRole('button',{name:/Defect/}));
    eq(await card().locator('.kindrow').count(),0,`${label}: tapping the same kind folds the buttons away`);
    eq(await kindIs(),'defect',`${label}: still a defect`);

    // Fill it in so it is not dropped as blank, and see the change is saved.
    await card().getByLabel('Where',{exact:true}).fill('Level 2 corridor');
    await card().getByLabel('What’s wrong',{exact:true}).fill('Cable tray bracket missing above door D2.14');
    await page.waitForFunction(async id=>{const r=await (await fetch(`/api/reports/${id}`)).json();const o=(r.report??r).observations;return o.length===1&&o[0].type==='defect'&&o[0].whatHappened.startsWith('Cable tray');},reportId,{timeout:20000});
    ok(true,`${label}: the change to a defect is saved on the server`);
    await shot('defect-card');

    // A card from "+ Variation" says Variation, with no buttons out.
    await tap(page.locator('.eng-add-kinds').getByRole('button',{name:/^\+ Variation$/}));
    await card().getByLabel('What extra work, and why',{exact:true}).waitFor();
    eq(await card().locator('.kindrow').count(),0,`${label}: no Kind buttons on a card from "+ Variation"`);
    eq(await kindIs(),'variation',`${label}: the new card says Variation`);

    // "+ Access" straight after, with nothing on the variation yet, turns that blank card into access rather than adding a second.
    await tap(page.locator('.eng-add-kinds').getByRole('button',{name:/^\+ Access$/}));
    await card().getByLabel('What was blocked, and by whom',{exact:true}).waitFor();
    eq(await page.locator('.eng-cardrow').count(),2,`${label}: a blank card is reused, not left under a new one`);
    eq(await kindIs(),'access',`${label}: the blank card is now Access`);

    // Nothing sideways, no hidden extras, no errors.
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling`);
    ok(!SAFETY_WORDS.test(await page.locator('main').innerText()),`${label}: the switched-off safety extras stay hidden`);
    eq(errors.join(' | '),'',`${label}: no page errors`);
    await context.close();
  }
  console.log(measured.join('\n'));
  if(!reportOnly)console.log(`Lighter card check passed (${checks} checks): no Kind buttons on an open card, "Change kind" at its foot; the four buttons come out only when asked and fold away once a kind is picked, the change is saved, "+ Variation" makes a variation and "+ Access" reuses a blank last card, focus and 48px targets, no sideways scroll, light and dark at 390px and dark at 1440px.`);
} finally {await browser?.close();server.kill();}
