// Browser check for the fewest-taps pass (2026-10-21): on a 390px phone, an
// engineer opens RELAY and sends a site update with a progress card and a
// photograph, a defect with a photograph at the same place, and a variation
// somewhere else. Every tap is counted: tapping into a box counts, the typing
// does not, and "Take a photo" counts once (the phone's own camera shutter is
// not RELAY's and is not counted). The cheapest way RELAY offers is taken each
// time, such as a recent place instead of typing it again. Then it checks that
// every button on the way is big enough for a gloved thumb, that what the office
// needs reached it, and that the work was kept on the phone with no signal.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
// RELAY_TAPS_REPORT=1 only prints the counts (used to measure main before the change).
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
const root=mkdtempSync(join(tmpdir(),'relay-fewest-taps-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const reportOnly=process.env.RELAY_TAPS_REPORT==='1';
/** The most taps the round trip may take; it took 16 on main before this pass. */
const MAX_TAPS=14;
/** Smallest tap target on the way, in CSS pixels: a gloved thumb needs room. */
const MIN_TARGET=48;
const sessionFor=name=>{const principal={id:`entra:taps-${name}`,oid:`taps-${name}`,name:`Taps ${name}`,email:`taps-${name}@example.test`,role:'Engineer',trade:'Electrical'};const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4377,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-taps-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#557799'}}).jpeg().toBuffer();
let browser,checks=0;
const ok=(value,message)=>{if(reportOnly&&!value){console.log(`(not met) ${message}`);return;}assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light',hasTouch:true,isMobile:true});
  await context.addCookies([{name:'relay_session',value:sessionFor('phone'),url:base}]);
  // A returning engineer on Tetley Hall, so home opens there rather than asking "Which site are you on?".
  await context.addInitScript(id=>{try{if(!localStorage.getItem(`relay-project:${id}`))localStorage.setItem(`relay-project:${id}`,'proj-011lme');}catch{}},'entra:taps-phone');
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=async name=>{if(screenshot){await page.waitForTimeout(300);await page.screenshot({path:join(screenshot,`${name}-light-390.png`),fullPage:true});}};
  const taps=[];const small=new Map();
  /** Every tappable thing on screen that is smaller than a gloved thumb, by its words. */
  const measure=async where=>{for(const [name,h,w] of await page.evaluate(min=>[...document.querySelectorAll('main button, main a, main label.camera, main summary, .actionbar button')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!e.closest('[hidden]')&&!e.closest('.eng-navigation')&&!e.matches('.back')&&(r.height<min||r.width<min);}).map(e=>{const r=e.getBoundingClientRect();return [(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,40),Math.round(r.height),Math.round(r.width)];}),MIN_TARGET))small.set(`${where}: ${name}`,`${w}×${h}`);};
  // Brought to the middle of the screen first, where a thumb reaches it and the action bar coming back after typing cannot cover it.
  const tap=async(locator,why)=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));await locator.tap();taps.push(why);};
  const open=()=>page.locator('.eng-slot.open');
  const typeInto=async(locator,text,why)=>{await tap(locator,why);await locator.fill(text);};
  /** A new card of a kind: one button where RELAY offers it, otherwise "+ Add a card" and then the kind. */
  const addCard=async(kind)=>{
    const direct=page.locator('.eng-add-kinds').getByRole('button',{name:new RegExp(`^\\+ ${kind}$`)});
    if(await direct.count()){await tap(direct,`+ ${kind}`);}
    else{await tap(page.getByRole('button',{name:'+ Add a card',exact:true}),'+ Add a card');await tap(page.locator('.eng-pick .eng-tile').filter({hasText:kind}),`pick ${kind}`);}
    await open().getByLabel('Where',{exact:true}).waitFor();
  };
  /** Where: a recent place in one tap when RELAY offers it, otherwise tap and type. */
  const where=async place=>{
    const chip=open().locator('.eng-chip').filter({hasText:new RegExp(`^${place}$`)});
    if(await chip.count()&&await chip.first().isVisible())await tap(chip.first(),`recent place ${place}`);
    else await typeInto(open().getByLabel('Where',{exact:true}),place,'Where');
  };
  const photo=async()=>{await open().locator('label.camera').scrollIntoViewIfNeeded();taps.push('Take a photo');await open().locator('input[type=file]').setInputFiles({name:`p${taps.length}.jpg`,mimeType:'image/jpeg',buffer:jpeg});await open().locator('.shot img').last().waitFor();};

  // 1. Open RELAY on the Site page, and start today's site update.
  await page.goto(`${base}/engineer`);
  await page.getByRole('button',{name:/Start today’s site update/}).waitFor();
  await measure('home');await shot('01-home');
  await tap(page.getByRole('button',{name:/Start today’s site update/}),'Start today’s site update');
  await page.waitForURL(/\/reports\//);
  await page.locator('.eng-pick, .eng-slot.open').first().waitFor();
  await shot('02-new-update');

  // 2. A progress card with a photograph.
  if(!await open().count())await tap(page.locator('.eng-pick .eng-tile').filter({hasText:'Progress'}),'pick Progress');
  await open().getByLabel('Where',{exact:true}).waitFor();
  eq(await open().locator('.eng-cardrow .kind').textContent().then(t=>t.trim()),'Progress','the first card is a progress card');
  await where('Level 2 corridor');
  await typeInto(open().locator('textarea').first(),'Containment run complete to grid C','What happened');
  await photo();
  await measure('progress card');await shot('03-progress-card');

  // 3. A defect at the same place, with a photograph.
  const sameHere=page.locator('.eng-slot.open .eng-same-place');
  if(!await page.locator('.eng-add-kinds').count()&&await sameHere.count()){await tap(sameHere,'+ Another card here');await tap(page.locator('.eng-pick .eng-tile').filter({hasText:'Defect'}),'pick Defect');await open().getByLabel('Where',{exact:true}).waitFor();}
  else{await addCard('Defect');await where('Level 2 corridor');}
  eq(await open().getByLabel('Where',{exact:true}).inputValue(),'Level 2 corridor','the defect is at the same place');
  await typeInto(open().locator('textarea').first(),'Cable tray bracket missing above door D2.14','What’s wrong');
  await photo();
  const defectHeight=await open().evaluate(e=>Math.round(e.getBoundingClientRect().height));
  await measure('defect card');await shot('04-defect-card');

  // 4. A variation in the plant room, not done yet.
  await addCard('Variation');
  await where('Plant room');
  await typeInto(open().locator('textarea').first(),'Client wants two extra sockets by the panel','What extra work');
  await tap(open().getByRole('button',{name:'Not yet',exact:true}),'Not yet');
  const variationHeight=await open().evaluate(e=>Math.round(e.getBoundingClientRect().height));
  await measure('variation card');await shot('05-variation-card');

  // 5. Check, then send.
  await tap(page.locator('.actionbar').getByRole('button',{name:/Check & send/}),'Check & send');
  await page.locator('#report-check').waitFor();
  await page.getByText('Saved to RELAY',{exact:true}).waitFor({timeout:20000});
  eq(await page.locator('.find-stop').count(),0,'nothing stops the update being sent');
  await measure('check step');await shot('06-check');
  await tap(page.getByRole('button',{name:'Send to office'}),'Send to office');
  await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
  await shot('07-sent');

  // What the office has: three cards, in the order taken, with their photographs.
  const id=page.url().match(/\/reports\/([^/?#]+)/)[1];
  const sent=await page.evaluate(async id=>(await fetch(`/api/reports/${id}`)).json(),id);
  const cards=(sent.report??sent).observations;
  eq(cards.map(o=>o.type).join(','),'update,defect,instruction','the office gets the progress, the defect and the variation, in order');
  eq(cards.map(o=>o.location).join('|'),'Level 2 corridor|Level 2 corridor|Plant room','each card says where');
  eq(cards.map(o=>o.photos.length).join(','),'1,1,0','the photographs went with their cards');
  eq(cards[1].affectedTrade,'Electrical','the defect names the engineer’s trade without a tap');
  eq(cards[2].workDone,false,'the variation says it is not done yet');

  const result={taps:taps.length,steps:taps,defectCardHeight:defectHeight,variationCardHeight:variationHeight,smallTargets:Object.fromEntries(small)};
  console.log(JSON.stringify(result,null,2));
  ok(taps.length<=MAX_TAPS,`the round trip takes at most ${MAX_TAPS} taps (took ${taps.length})`);
  eq(small.size,0,`every button on the way is at least ${MIN_TARGET}px each way (${[...small].map(([k,v])=>`${k} ${v}`).join('; ')})`);

  // 6. With no signal: a new update keeps its first card on the phone, and a blank card is not left on it.
  if(!reportOnly){
    await page.goto(`${base}/engineer`);
    await page.getByRole('button',{name:/Start today’s site update/}).tap();
    await page.waitForURL(/\/reports\//);await open().getByLabel('Where',{exact:true}).waitFor();
    // The action bar steps aside while a box has the keyboard, so its words are looked for, not looked at.
    // The card it opens on is saved straight away, like any edit.
    await page.getByText('Saved to RELAY',{exact:true}).waitFor({state:'attached',timeout:20000});
    eq(await page.locator('.eng-cardrow').count(),1,'a new update opens on one card');
    // A blank card that is never used goes when the engineer checks: nothing was in it.
    await page.locator('.eng-add-kinds').getByRole('button',{name:'+ Defect'}).tap();
    await open().getByLabel('Where',{exact:true}).fill('Riser 3');
    await context.setOffline(true);
    await open().locator('textarea').first().fill('Fire stopping missing round tray');
    await open().locator('input[type=file]').setInputFiles({name:'off.jpg',mimeType:'image/jpeg',buffer:jpeg});
    await open().locator('.shot img').last().waitFor();
    await page.getByText(/On this phone only/).first().waitFor({state:'attached',timeout:15000});
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).tap();
    await page.locator('#report-check').waitFor();
    eq(await page.locator('.find-stop').count(),0,'the unused blank progress card does not stop the update');
    await page.goBack();await page.locator('.eng-cardrow').first().waitFor();
    eq(await page.locator('.eng-cardrow').count(),1,'only the defect is left on the update');
    await page.reload().catch(()=>{});
    await context.setOffline(false);
    await page.reload();await page.locator('.eng-cardrow').first().waitFor();
    ok(/Riser 3/.test(await page.locator('.eng-cardrow').first().innerText()),'the defect written with no signal is still there after a reload');
    eq(await page.locator('.eng-cardrow').count(),1,'and the blank card has not come back');
    await page.getByText('Saved to RELAY',{exact:true}).waitFor({state:'attached',timeout:30000});
    ok(true,'it went up to the server once there was signal');
  }
  eq(errors.length,0,`no page errors (${errors.join(' | ')})`);
  console.log(`verify-fewest-taps: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
