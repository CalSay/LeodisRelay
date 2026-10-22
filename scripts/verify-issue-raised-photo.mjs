// Browser check for the raised photograph on the engineer's issue page (2026-10-22).
// A walk at 390px of an open issue, one the office sent back and one 30 days
// past its target found "Put forward as fixed" on the first screen in all three,
// but no photograph of the fault anywhere until History was opened. Now the
// photograph taken when it was raised sits small under "Who is fixing it", and
// opens larger in a tab of its own; an older photo kept inline is shown, not
// linked. An issue past its target says how many days past, as the office does.
// Checks at 390x844, light and dark: the photograph, the office's reason, the
// camera button and "Put forward as fixed" all on the first screen; the larger
// copy loads; History still holds the photograph; no row without a photograph;
// no "past target" before the target; 48px buttons; axe on the facts; no
// sideways scroll; a very long description opened from "Came back from the
// office" keeps the photograph button in view; the office's page unchanged; no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the screens.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-raised-photo-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const sam=person('rp-sam','Sam Spark','Engineer','Electrical'),pat=person('rp-pat','Pat Wire','Engineer','Electrical'),jo=person('rp-jo','Jo Office','Manager');
const sessions={};for(const p of [sam,pat,jo]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const today=londonDay(new Date());const addDays=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const T='proj-011lme';
const png=colour=>sharp({create:{width:640,height:480,channels:3,background:colour}}).png().toBuffer();
const photo=async(colour,id,when,owner,caption='')=>{const pid=randomUUID();await putMedia(pid,{issueId:id,ownerId:owner.id,mime:'image/png'},await png(colour));return {id:pid,dataUrl:`/api/media/${pid}`,caption,capturedAt:when};};
const inline=async(colour,when)=>({id:randomUUID(),dataUrl:'data:image/png;base64,'+(await sharp({create:{width:160,height:120,channels:3,background:colour}}).png().toBuffer()).toString('base64'),caption:'',capturedAt:when});
const issue=async(id,description,location,actionNeeded,raisedDay,target,events,photos)=>{const r=`${addDays(raisedDay)}T09:00:00.000Z`;
  putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:T,source:'report',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',affectedTrade:'Electrical',location,description,actionNeeded,confirmation:'confirmed',work:'in_progress',owner:'Acme Electrical',targetDate:addDays(target),raisedAt:r,
    events:[{at:r,actor:sam.name,actorId:sam.id,kind:'raised',note:description,photos:await photos(id,r)},{at:`${addDays(raisedDay)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'assigned',to:'Acme Electrical',targetDate:addDays(target),note:'Key from the site office',photos:[]},...events]});};
const REASON='The plate is new but the back box is still loose. Fix the back box and send a photo with the plate off.';
await issue('931','Fire stopping missing round the cable tray','Level 2 riser','Fire stop the riser penetrations',-3,4,[],async(id,r)=>[await photo('#7a3b2a',id,r,sam,'Riser cable tray'),await photo('#3b5a7a',id,r,sam)]);
await issue('932','Socket face plate cracked','Flat 3.02, kitchen','Replace the face plate',-6,4,[
  {at:`${addDays(-2)}T14:00:00.000Z`,actor:pat.name,actorId:pat.id,kind:'closure_submitted',note:'New face plate fitted',photos:[await photo('#2f6b45','932',addDays(-2),pat)]},
  {at:`${addDays(-1)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'reopened',note:REASON,photos:[]}],async(id,r)=>[await photo('#7a3b2a',id,r,sam)]);
const visits=[];for(let i=0;i<5;i++)visits.push({at:`${addDays(-50+i*8)}T11:00:00.000Z`,actor:pat.name,actorId:pat.id,kind:'progress',note:`Visit ${i+1}: waiting on parts`,photos:[]});
await issue('933','Emergency light not working','Stair B, level 1','Replace the fitting',-60,-30,visits,async(id,r)=>[await inline('#7a3b2a',r)]);
const LONG='Fire stopping missing round the cable tray where it passes through the compartment wall above the corridor ceiling, both sides, and the tray is not supported for the last two metres';
const LONG_TODO='Fire stop both sides of the wall with the approved collar and batt, add two tray supports, and leave the ceiling tiles out so the office can check it';
await issue('935',`${LONG}. ${LONG}`,'Level 6 west stair core, at the landing',`${LONG_TODO}. ${LONG_TODO}`,-2,5,[],async(id,r)=>[await photo('#7a3b2a',id,r,sam)]);
await issue('934','Cable tray lid missing','Level 4 corridor','Fit the lid',-1,0,[],async()=>[]);
const port=4593,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-raised-photo',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
try{
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  for(const scheme of ['light','dark'])for(const [who,id,name] of [[sam,'931','open'],[pat,'932','sent-back'],[sam,'933','past-target'],[sam,'934','no-photo']]){
    const label=`${name} ${scheme}`;
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme,hasTouch:true});
    await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/issues/${id}`);await page.locator('.issue-eng-title').waitFor();
    // Below the first screen by this many pixels: 0 means on it.
    const below=async l=>Math.max(0,Math.round(await l.evaluate(e=>e.getBoundingClientRect().bottom+scrollY)-844));
    const facts=page.locator('.issue-eng-facts').first(),row=facts.locator('.issue-eng-shots');
    const fixed=page.getByRole('button',{name:'Put forward as fixed'});
    ok(await below(page.locator('label.camera'))===0&&await below(fixed)===0,`${label}: "Add photograph" and "Put forward as fixed" on the first screen`);
    if(name==='no-photo'){
      ok(await row.count()===0&&!/Photograph/.test(await facts.innerText()),`${label}: no photograph row when none was taken`);
    }else{
      const want=name==='open'?2:1;
      await page.waitForFunction(()=>[...document.querySelectorAll('.issue-eng-shots img')].every(i=>i.complete&&i.naturalWidth>0));
      ok(await row.locator('img').count()===want,`${label}: ${want} photograph(s) from when it was raised`);
      ok(await below(row)===0,`${label}: the photograph is on the first screen`);
      ok((await facts.locator('dt').allInnerTexts()).includes(want===1?'Photograph':'Photographs'),`${label}: labelled ${want===1?'Photograph':'Photographs'}`);
      const box=await row.locator('img').first().boundingBox();ok(box.width>=76&&box.height>=56,`${label}: big enough to tap and see (${Math.round(box.width)}x${Math.round(box.height)})`);
      if(name==='past-target'){
        ok(await row.locator('a').count()===0&&await row.locator('figure img[alt^="Photograph 1 of 1 from when it was raised"]').count()===1,`${label}: an inline photo is shown with words, not linked`);
      }else{
        const link=row.locator('a').first();
        ok(await link.getAttribute('target')==='_blank'&&/larger \(opens in a new tab\)$/.test(await link.getAttribute('aria-label')),`${label}: opens larger in a new tab, and says so`);
        if(name==='open')ok(/: Riser cable tray, larger/.test(await link.getAttribute('aria-label')),`${label}: the caption is read out`);
        const res=await page.request.get(base+await link.getAttribute('href'));ok(res.ok()&&/^image\//.test(res.headers()['content-type']),`${label}: the larger copy loads (${res.status()})`);
      }
    }
    const who2=await facts.locator('div',{has:page.locator('dt',{hasText:'Who is fixing it'})}).locator('dd').innerText();
    if(name==='past-target')ok(/^Acme Electrical, by \d+ \w+ \d{4}, 30 days past target$/.test(who2)&&await facts.locator('.late').count()===1,`${label}: says 30 days past target (${who2})`);
    else ok(!/past target/.test(who2),`${label}: no "past target" before the target date (${who2})`);
    if(name==='sent-back'){const word=page.locator('.eng-word-box');ok(await word.count()===1&&await below(word)===0,`${label}: the office's reason is still on the first screen`);}
    if(shots)await page.screenshot({path:join(shots,`after-${name}-${scheme}-390.png`),fullPage:true});
    // Still in History, as before.
    const fold=page.locator('details.issue-more');await fold.locator('summary').click();
    if(name!=='no-photo')ok(await fold.locator('.shots img').count()>=1,`${label}: History still has the photograph`);
    const small=await page.evaluate(()=>[...document.querySelectorAll('main button, main summary, main label.camera')].filter(e=>e.offsetParent!==null&&e.getBoundingClientRect().height<48).map(e=>e.textContent.trim()));
    ok(small.length===0,`${label}: buttons 48px or taller (${small.join(', ')})`);
    ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${label}: no sideways scroll`);
    await page.evaluate(axeSource);
    const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('.issue-eng-facts'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,3).join(', ')}`));
    ok(!found.length,`${label}: axe found ${found.join('; ')}`);
    assert.deepEqual(errors,[],`${label}: page errors`);
    await context.close();
  }
  // A very long description, opened from "Came back from the office" (?update=1): the photograph button stays in
  // view and the photograph moves under the buttons for that visit; opened plainly, it stays under the facts.
  for(const landing of [true,false]){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    await context.addCookies([{name:'relay_session',value:sessions[sam.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/issues/935${landing?'?update=1':''}`);await page.locator('.issue-eng-shots img').waitFor();await page.waitForTimeout(300);
    const where=await page.evaluate(()=>{const s=document.querySelector('.issue-eng-shots'),u=document.querySelector('.issue-eng-update');return !!(u.compareDocumentPosition(s)&Node.DOCUMENT_POSITION_FOLLOWING);});
    if(landing){
      const cam=await page.locator('label.camera').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight);
      ok(cam&&where,`longest, came back: photograph button in view (${cam}) and the photograph under the buttons (${where})`);
      const view=await page.evaluate(()=>({y:scrollY,title:document.querySelector('.issue-eng-title').getBoundingClientRect().top>=document.querySelector('.appbar').getBoundingClientRect().bottom}));
      ok(view.y>0&&view.title,`longest, came back: scrolled towards the update (${view.y}px) with what is wrong still below the app bar`);
      const fixedTop=await page.getByRole('button',{name:'Put forward as fixed'}).evaluate(e=>e.getBoundingClientRect().top);
      ok(fixedTop>0,`longest, came back: "Put forward as fixed" not scrolled away above (${Math.round(fixedTop)})`);
      if(shots)await page.screenshot({path:join(shots,'after-longest-came-back-light-390.png'),fullPage:true});
    }else ok(!where,'longest, opened plainly: the photograph stays under the facts');
    assert.deepEqual(errors,[],`longest ${landing}: page errors`);
    await context.close();
  }
  // The office's page is as before.
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
  await context.addCookies([{name:'relay_session',value:sessions[jo.oid],url:base}]);
  const page=await context.newPage();await page.goto(`${base}/issues/933`);await page.locator('.titleblock').waitFor();
  ok(await page.locator('.issue-eng-shots').count()===0&&/30 days past target/.test(await page.locator('.titleblock').textContent()),'office: page unchanged, still says days past target');
  if(shots)await page.screenshot({path:join(shots,'after-office-issue-dark-1440.png'),fullPage:true});
  await context.close();
  console.log(`Raised photograph check passed (${checks} checks): the photograph from when it was raised, the office's reason, "Add photograph" and "Put forward as fixed" on the first screen at 390px; larger copy opens; days past target; History unchanged; office unchanged; light and dark.`);
}catch(e){console.error(output.slice(-3000));throw e;}
finally{await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});}
