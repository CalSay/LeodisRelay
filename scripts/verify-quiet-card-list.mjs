// Browser check for the quieter card list (2026-10-22): on a 390px phone an
// engineer writes one site update across five places with seven photographs
// and sends it. A card that is saved shows a green dot beside its place (the
// word "Saved" is there for screen readers) instead of a line of its own; while
// its save is under way it says "Saving", not that it is not saved; work that
// cannot go up (no signal) still gets its amber line. Taps are counted the same
// way as verify-fewest-taps. Light and dark.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-quiet-cards-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
/** Five places and seven photographs: start, then add, where, what happened and a photo for each place, then check and send. */
const MAX_TAPS=24;
const PLACES=[['Level 1 flats','First fix done in flats 1 to 4',2],['Level 2 corridor','Containment finished to grid C',1],['Roof','Lighting columns set out on the east half',2],['Stair core A','Emergency lights fitted on stair A',1],['Plant room','Main panel dressed, 80% done',1]];
const sessionFor=name=>{const principal={id:`entra:quiet-${name}`,oid:`quiet-${name}`,name:`Quiet ${name}`,email:`quiet-${name}@example.test`,role:'Engineer',trade:'Electrical'};const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4483,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-quiet-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#557799'}}).jpeg().toBuffer();
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const scheme of ['light','dark']){
    const who=`phone-${scheme}`;
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme,hasTouch:true,isMobile:true});
    await context.addCookies([{name:'relay_session',value:sessionFor(who),url:base}]);
    await context.addInitScript(id=>{try{if(!localStorage.getItem(`relay-project:${id}`))localStorage.setItem(`relay-project:${id}`,'proj-011lme');}catch{}},`entra:quiet-${who}`);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(screenshot){await page.waitForTimeout(300);await page.screenshot({path:join(screenshot,`${name}-${scheme}-390.png`),fullPage:true});}};
    // Saves can be held back, to see a card while its save is on the way, or refused as if there were no signal.
    let hold=null,offline=false;
    await page.route(/\/api\/reports\/[^/]+$/,async route=>{if(route.request().method()!=='PUT')return route.fallback();if(offline)return route.abort('internetdisconnected');if(hold)await hold;return route.fallback();});
    const taps=[];
    const tap=async(locator,why)=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));await locator.tap();taps.push(why);};
    const open=()=>page.locator('.eng-slot.open');
    const typeInto=async(locator,text,why)=>{await tap(locator,why);await locator.fill(text);};
    const where=async place=>{const chip=open().locator('.eng-chip').filter({hasText:new RegExp(`^${place}$`)});if(await chip.count()&&await chip.first().isVisible())await tap(chip.first(),`recent place ${place}`);else await typeInto(open().getByLabel('Where',{exact:true}),place,'Where');};
    // Tapping "Take a photo" takes the keyboard away, as on a phone; the camera itself is the phone's.
    const photo=async()=>{await page.evaluate(()=>document.activeElement?.blur());taps.push('Take a photo');await open().locator('input[type=file]').first().setInputFiles({name:`p${taps.length}.jpg`,mimeType:'image/jpeg',buffer:jpeg});await open().locator('.shot img').last().waitFor();};
    const rows=page.locator('.eng-cardrow');
    const saved=()=>page.locator('.savestate',{hasText:'Saved to RELAY'}).waitFor({timeout:20000});

    await page.goto(`${base}/engineer`);
    await tap(page.getByRole('button',{name:/Start today’s site update/}),'Start today’s site update');
    await page.waitForURL(/\/reports\//);await open().getByLabel('Where',{exact:true}).waitFor();
    for(const [i,[place,text,photos]] of PLACES.entries()){
      if(i>0){await tap(page.locator('.eng-add-kinds').getByRole('button',{name:/^\+ Progress$/}),'+ Progress');await open().getByLabel('Where',{exact:true}).waitFor();}
      if(i===2){
        // While the save of what was just written is on its way, the card says so plainly.
        let release;hold=new Promise(r=>release=r);
        await where(place);await typeInto(open().locator('textarea').first(),text,'What happened');
        for(let n=0;n<photos;n++)await photo();
        await page.locator('.savestate',{hasText:'Saving'}).waitFor();
        await page.waitForTimeout(600);
        const row=rows.nth(i);
        eq(await row.locator('.eng-where').innerText(),'Saving','a card whose save is on its way says Saving');
        ok(await row.locator('.eng-where-pending').count()===0,'it is not marked as not saved');
        const tiles=await open().locator('.shot .eng-where').allInnerTexts();
        ok(tiles.length===photos&&tiles.every(t=>t!=='Not saved to RELAY yet'),`its photographs are not marked as not saved (${tiles.join(', ')})`);
        await shot('02-saving');
        hold=null;release();
      } else {
        await where(place);await typeInto(open().locator('textarea').first(),text,'What happened');
        for(let n=0;n<photos;n++)await photo();
      }
      await saved();
    }
    await page.waitForTimeout(300);

    // Every card is saved: a dot beside its place, no line of its own.
    eq(await rows.count(),PLACES.length,'five cards');
    for(let i=0;i<PLACES.length;i++){
      const row=rows.nth(i);
      const lines=await row.evaluate(r=>[...r.querySelectorAll('.eng-where')].map(e=>({said:e.innerText.trim(),mark:e.classList.contains('eng-where-mark'),dot:!!e.querySelector('.dot-ok'),inTop:!!e.closest('.top'),seen:e.querySelector('.shot-where-said')?getComputedStyle(e.querySelector('.shot-where-said')).clipPath:''})));
      eq(lines.length,1,`card ${i+1} says where it is once`);
      const [l]=lines;
      ok(l.mark&&l.inTop&&l.dot,`card ${i+1}: a green dot beside its place (${JSON.stringify(l)})`);
      eq(l.said,'Saved',`card ${i+1}: screen readers hear Saved`);
      ok(l.seen&&l.seen!=='none',`card ${i+1}: the word is not shown on screen`);
    }
    // The folded rows: heading, words and photographs, three lines each.
    const heights=await rows.evaluateAll(rs=>rs.slice(0,-1).map(r=>Math.round(r.getBoundingClientRect().height)));
    ok(heights.every(h=>h<=96),`each folded card is three lines high (${heights.join(', ')}px)`);
    const place=await rows.first().evaluate(r=>{const top=r.querySelector('.top').getBoundingClientRect(),dot=r.querySelector('.eng-where-mark').getBoundingClientRect(),chev=r.querySelector('.chev').getBoundingClientRect();return {inside:dot.top>=top.top-1&&dot.bottom<=top.bottom+1,clear:dot.right<=chev.left};});
    ok(place.inside&&place.clear,`the dot sits on the place's line, clear of + (${JSON.stringify(place)})`);
    await shot('01-five-places');

    // No signal: the card that cannot go up still says so on a line of its own.
    offline=true;
    await rows.nth(1).tap();
    await open().locator('textarea').first().fill('Containment finished to grid D');
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.savestate',{hasText:'On this phone only'}).waitFor({timeout:20000});
    const offRow=rows.nth(1).locator('.eng-where');
    eq(await offRow.innerText(),'Only on this phone · changes','a card that cannot go up says what is only on this phone');
    ok(await rows.nth(1).locator('.eng-where-phone').count()===1&&!(await offRow.evaluate(e=>!!e.closest('.top'))),'on its own amber line');
    eq(await rows.nth(0).locator('.eng-where').innerText(),'Saved','the cards already saved stay saved');
    await shot('03-no-signal');
    offline=false;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await open().locator('textarea').first().fill('Containment finished to grid C');
    await page.evaluate(()=>document.activeElement?.blur());
    await saved();

    // Check, then send: the office gets every place and photograph.
    await tap(page.locator('.actionbar').getByRole('button',{name:/Check & send/}),'Check & send');
    await page.locator('#report-check').waitFor();await saved();
    await shot('04-check');
    await tap(page.getByRole('button',{name:'Send to office'}),'Send to office');
    await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    const id=page.url().match(/\/reports\/([^/?#]+)/)[1];
    const sent=await page.evaluate(async id=>(await fetch(`/api/reports/${id}`)).json(),id);
    const cards=(sent.report??sent).observations;
    eq(cards.map(o=>o.location).join('|'),PLACES.map(p=>p[0]).join('|'),'the office gets every place, in order');
    eq(cards.map(o=>o.photos.length).join(','),PLACES.map(p=>p[2]).join(','),'with its photographs');
    // The no-signal edit above is not counted: it is not part of writing the update.
    ok(taps.length<=MAX_TAPS,`five places with seven photographs take at most ${MAX_TAPS} taps (took ${taps.length})`);
    ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),'no sideways scroll');
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Quiet card list check passed (${checks} checks): saved cards show a dot, saving says Saving, no signal keeps its line, light and dark.`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
