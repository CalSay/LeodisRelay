// Browser check for quicker site update writing (2026-10-21). Two things slowed
// an engineer down on a phone: (1) an update left with an empty card (the one
// "Start today's site update" makes) opened from "Carry on" folded, so it took
// one more tap before they could type; (2) each photo tile was about 290px tall
// with "On the server" written on it, so a few photos pushed the next card far down.
// Checks: the empty last card opens ready to type from "Carry on", once written it
// opens folded again, other cards stay folded; photo tiles are small, two to a row
// on a phone, with Remove at least 48px, on the picture and clear of the caption box;
// "On the server" is read out but not shown; a photo not yet on the server says
// so on the picture; a caption types and saves; Remove still works; 48px
// targets; no sideways scroll. Light and dark at 390px, dark at 1440px.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
// RELAY_QUICK_REPORT=1 only prints the measurements (used to measure main before the change).
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
const root=mkdtempSync(join(tmpdir(),'relay-quicker-update-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft}=require('../apps/web/.test-build/lib/serverStore.js');
const reportOnly=process.env.RELAY_QUICK_REPORT==='1';
const MIN_TARGET=48;
/** One photo tile at 390px: about 290px on main e9df5fb. */
const MAX_TILE=200;
const engineer={id:'entra:qu-engineer',oid:'qu-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const P='proj-011lme';
const jpeg=await sharp({create:{width:320,height:240,channels:3,background:'#557799'}}).jpeg().toBuffer();
const photo=(caption='')=>({id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+jpeg.toString('base64'),caption,capturedAt:new Date().toISOString()});
const ob=(location,whatHappened,photos=[])=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos});
/** Today's update for its own engineer, with these cards, and a session for them. */
const seed=(n,observations)=>{
  const principal={...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`};
  const r=createReport(P,principal.name,principal,'progress');
  const saved=saveDraft(r.id,{...r,observations},r.version);assert.ok(saved.ok,JSON.stringify(saved));
  const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  return {session:id,report:r.id,ids:observations.map(o=>o.id)};
};
const port=4475,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-quicker-update',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{if(reportOnly){if(!value)console.log(`(not met) ${message}`);return;}assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const measured=[];
const saved=(page,id,test)=>page.waitForFunction(async([id,test])=>{const r=await (await fetch(`/api/reports/${id}`)).json();return new Function('r',`return ${test}`)(r.report??r);},[id,test],{timeout:20000});
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const open=async session=>{
      const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
      await context.addCookies([{name:'relay_session',value:session,url:base}]);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      return {context,page,errors};
    };
    const tapper=page=>async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const shotOf=page=>async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:true});}};
    /** From the engineer's home, "Carry on with today's update": the one tap to get back to it. */
    const carryOn=async(page,tap)=>{
      await page.goto(`${base}/engineer?project=${P}`);
      const link=page.getByRole('link',{name:/Carry on with today’s update/});
      await link.waitFor();await tap(link);
      await page.waitForURL(/\/reports\//);await page.locator('.eng-cardrow').first().waitFor();
      await page.waitForTimeout(400);
    };
    const inView=locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=window.innerHeight;});

    // 1. An update with only the empty card the big button made, left and opened again.
    {
      const s=seed(`${scheme}-${width}-empty`,[ob('','')]);
      const {context,page,errors}=await open(s.session),tap=tapper(page),shot=shotOf(page);
      await carryOn(page,tap);
      const what=page.locator(wide?'.eng-card-body:not([hidden]) .eng-card':'.eng-slot.open .eng-card').getByLabel('What happened',{exact:true});
      const ready=await what.count()===1&&await what.isVisible();
      measured.push(`${label}: empty card from "Carry on" ${ready?'opens ready to type':'opens folded (one more tap)'}`);
      ok(ready,`${label}: the empty card opens ready to type`);
      if(!ready&&!reportOnly){await context.close();continue;}
      if(ready){
      if(!wide){
        eq(await page.locator(`#slot-${s.ids[0]} .eng-cardrow`).getAttribute('aria-expanded'),'true',`${label}: its row says it is open`);
        ok(await inView(what),`${label}: "What happened" is on the first screen`);
      }
      await shot('carry-on-empty');
      await what.fill('Containment run complete to grid C');
      await saved(page,s.report,`r.observations[0]?.whatHappened==='Containment run complete to grid C'`);
      ok(true,`${label}: typed straight away and saved on the server`);
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling`);
      // Written now: opened again, it is a card like any other and starts folded on the phone.
      await carryOn(page,tap);
      if(!wide)eq(await page.locator('.eng-slot.open').count(),0,`${label}: once written, the card opens folded again`);
      // The row still folds and opens it.
      if(!wide){
        const row=page.locator(`#slot-${s.ids[0]} .eng-cardrow`);
        await tap(row);eq(await row.getAttribute('aria-expanded'),'true',`${label}: tapping the row opens it`);
        await tap(row);eq(await row.getAttribute('aria-expanded'),'false',`${label}: tapping again folds it`);
      }
      }
      ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
      await context.close();
    }

    // 2. Two written cards and an empty one added last: only the empty one opens, in sight.
    if(!wide){
      const s=seed(`${scheme}-${width}-third`,[ob('Level 2 corridor','Tray run in'),ob('Flat 3.02','Second fix sockets done'),ob('','')]);
      const {context,page,errors}=await open(s.session),tap=tapper(page);
      await carryOn(page,tap);
      const slot=page.locator(`#slot-${s.ids[2]}`);
      const isOpen=await slot.evaluate(e=>e.classList.contains('open'));
      ok(isOpen,`${label}: the empty third card opens ready to type`);
      eq(await page.locator('.eng-slot.open').count(),isOpen?1:0,`${label}: the written cards stay folded`);
      if(isOpen)ok(await inView(slot.getByLabel('Where',{exact:true})),`${label}: the open card's "Where" is in sight`);
      ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
      await context.close();
    }

    // 3. A card with four photographs: small tiles, two to a row on a phone.
    {
      const s=seed(`${scheme}-${width}-photos`,[ob('Level 2 corridor','Containment run complete to grid C',[photo(),photo('Tray at grid C'),photo(),photo()]),ob('Flat 3.02','Second fix sockets done')]);
      const {context,page,errors}=await open(s.session),tap=tapper(page),shot=shotOf(page);
      await carryOn(page,tap);
      const row=page.locator(`#slot-${s.ids[0]} .eng-cardrow`);
      if(!wide)await tap(row);else await tap(page.locator('.eng-cardrow').first());
      const card=page.locator(wide?'.eng-card-body:not([hidden]) .eng-card':'.eng-slot.open .eng-card');
      const tiles=card.locator('.shot');
      await tiles.nth(3).locator('img').waitFor();
      await card.locator('.shot .eng-where').first().waitFor();
      const boxes=await tiles.evaluateAll(ts=>ts.map(t=>{const r=t.getBoundingClientRect();return {top:Math.round(r.top+scrollY),h:Math.round(r.height),x:r.x,w:r.width};}));
      const tallest=Math.max(...boxes.map(b=>b.h)),rows=new Set(boxes.map(b=>b.top)).size;
      const block=await card.locator('.shots').evaluate(e=>Math.round(e.getBoundingClientRect().height));
      measured.push(`${label}: photo tiles ${tallest}px tall, ${rows} rows for 4 photos, photos ${block}px down the card`);
      if(!wide){
        ok(tallest<=MAX_TILE,`${label}: each tile at most ${MAX_TILE}px tall (${tallest}px)`);
        eq(rows,2,`${label}: two tiles to a row`);
      }
      const c=await card.boundingBox();
      ok(boxes.every(b=>b.x>=c.x-0.5&&b.x+b.w<=c.x+c.width+0.5),`${label}: the tiles stay inside the card`);
      // "On the server" is read out on each, but only a dot shows.
      const said=await tiles.locator('.eng-where').allInnerTexts();
      ok(said.length===4&&said.every(t=>t.trim()==='On the server'),`${label}: each photo still says "On the server" to a screen reader (${JSON.stringify(said)})`);
      const shown=await tiles.first().locator('.eng-where').evaluate(e=>Math.round(e.getBoundingClientRect().width));
      ok(shown<=24,`${label}: "On the server" is a dot, not words, on the tile (${shown}px wide)`);
      for(let i=0;i<4;i++){
        const remove=tiles.nth(i).getByRole('button',{name:`Remove photo ${i+1}`,exact:true}),caption=tiles.nth(i).getByLabel(`Caption for photograph ${i+1}`,{exact:true});
        const r=await remove.boundingBox(),t=await caption.boundingBox(),pic=await tiles.nth(i).locator('img').boundingBox();
        ok(r.width>=MIN_TARGET-0.5&&r.height>=MIN_TARGET-0.5,`${label}: Remove photo ${i+1} is at least ${MIN_TARGET}px (${Math.round(r.width)}x${Math.round(r.height)})`);
        ok(t.height>=MIN_TARGET-0.5,`${label}: caption ${i+1} is at least ${MIN_TARGET}px tall`);
        ok(r.y+r.height<=t.y-20,`${label}: Remove photo ${i+1} is clear of its caption box (${Math.round(t.y-r.y-r.height)}px apart)`);
        ok(r.y>=pic.y-0.5&&r.y+r.height<=pic.y+pic.height+0.5,`${label}: Remove photo ${i+1} sits on the picture`);
      }
      eq(await tiles.first().locator('.shot-no').innerText(),'PHOTO 01',`${label}: the photo number is on the picture`);
      await shot('photos');
      // A caption types and saves.
      const caption=tiles.nth(2).getByLabel('Caption for photograph 3',{exact:true});
      await tap(caption);await caption.fill('Bracket at door D2.14');
      await saved(page,s.report,`r.observations[0]?.photos[2]?.caption==='Bracket at door D2.14'`);
      ok(true,`${label}: a caption typed on a small tile is saved`);
      // Remove still takes a photo off (Undo is checked in verify-undo-remove).
      await tap(tiles.nth(3).getByRole('button',{name:'Remove photo 4',exact:true}));
      await page.waitForFunction(()=>document.querySelectorAll('.shots .shot').length===3);
      eq(await tiles.count(),3,`${label}: Remove takes the photo off`);
      await saved(page,s.report,`r.observations[0]?.photos.length===3`);
      // A photo taken with no signal says so on the picture, in words.
      await page.locator('.shot .eng-where').first().waitFor();
      await page.waitForTimeout(500);
      await context.setOffline(true);
      await card.locator('input[type=file]').setInputFiles({name:'no-signal.jpg',mimeType:'image/jpeg',buffer:jpeg});
      await tiles.nth(3).locator('img').waitFor();
      const where=tiles.nth(3).locator('.eng-where');
      await page.waitForFunction(()=>{const w=document.querySelectorAll('.shots .shot')[3]?.querySelector('.eng-where');return w&&!w.classList.contains('eng-where-server');},null,{timeout:15000}).catch(()=>{});
      const words=(await where.innerText()).trim(),width5=await where.evaluate(e=>Math.round(e.getBoundingClientRect().width));
      ok(words!=='On the server'&&width5>60,`${label}: a photo not on the server yet says so on the picture ("${words}", ${width5}px)`);
      await shot('photo-no-signal');
      await context.setOffline(false);
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling`);
      ok(!errors.filter(e=>!/fetch|network|Load failed/i.test(e)).length,`${label}: no page errors: ${errors.join(' | ')}`);
      await context.close();
    }
  }
  console.log(measured.join('\n'));
  if(!reportOnly)console.log(`Quicker update check passed (${checks} checks): an empty card from "Carry on" opens ready to type and saves; written cards open folded; photo tiles small, two to a row, Remove 48px on the picture clear of the caption; "On the server" read out as a dot; a photo with no signal says so; captions and Remove work; no sideways scroll; light and dark at 390px, dark at 1440px.`);
} finally {await browser?.close();server.kill();}
