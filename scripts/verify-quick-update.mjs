// Browser check for the quickest end-of-day update (walk of 22 Oct 2026): an
// engineer at 390px sends one place, one line and two photographs from the Site
// page, and the office reads it under "Today from site". It took 7 taps over 4
// screens on main, none spare; the clutter was on Check & send, which ran to about
// 1,360px for one progress card: a tally with three zeros and a full signature pad
// the page itself said was optional.
// Checks, light and dark at 390 and dark at 1440: the round trip in at most 7 taps;
// Check & send lists only the kinds in the update (Progress 1, no zeros); the
// optional signature is one "Add your signature" button (48px) with no pad until
// it is tapped, which opens the pad and moves focus to it; Check & send at 390 is
// 1,000px or less; an update with a defect too lists both kinds and no zeros;
// a name other than the engineer's keeps it open after a reload; what the office needs reached it (place, line, both photos) and "Today from
// site" shows it; no sideways scroll, no page errors.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
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
const root=mkdtempSync(join(tmpdir(),'relay-quick-update-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
/** The round trip took 7 taps on main: none may be added. */
const MAX_TAPS=7;
/** Check & send for one progress card at 390px: about 1,360px on main 3b03173. */
const MAX_CHECK=1000;
const P='proj-011lme';
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const sessionFor=principal=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const manager=person('quick-jo','Jo Office','Manager');
const port=4481,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-quick-update',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#557799'}}).jpeg().toBuffer();
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const engineer=person(`quick-sam-${scheme}-${width}`,'Sam Spark','Engineer','Electrical');
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(engineer),url:base}]);
    // A returning engineer on Tetley Hall, so home opens there rather than asking "Which site are you on?".
    await context.addInitScript(([id,p])=>{try{if(!localStorage.getItem(`relay-project:${id}`))localStorage.setItem(`relay-project:${id}`,p);}catch{}},[engineer.id,P]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${name}-${scheme}-${width}.png`),fullPage:true});}};
    const taps=[];
    const tap=async(locator,why)=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();taps.push(why);};
    const card=()=>page.locator(wide?'.eng-card-body:not([hidden])':'.eng-slot.open');
    const noSideways=async where=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label} ${where}: no sideways scroll`);

    // 1. Home, start today's update, one place, one line, two photographs.
    await page.goto(`${base}/engineer`);
    const start=page.getByRole('button',{name:/Start today’s site update/});await start.waitFor();
    await tap(start,'Start today’s site update');await page.waitForURL(/\/reports\//);
    const where=card().getByLabel('Where',{exact:true});await where.waitFor();
    await tap(where,'Where');await where.fill('Level 2 corridor');
    const what=card().locator('textarea').first();await tap(what,'What happened');await what.fill('Containment run complete to grid C');
    for(const k of [1,2]){taps.push('Take a photo');await card().locator('input[type=file]').first().setInputFiles({name:`p${k}.jpg`,mimeType:'image/jpeg',buffer:jpeg});await page.waitForFunction(([sel,k])=>document.querySelectorAll(`${sel} .shot img`).length>=k,[wide?'.eng-card-body:not([hidden])':'.eng-slot.open',k]);}
    await page.evaluate(()=>document.activeElement?.blur());

    // 2. Check & send: only what is in the update, and the signature folded.
    await tap(page.locator('.actionbar').getByRole('button',{name:/Check & send/}),'Check & send');
    const check=page.locator('#report-check');await check.waitFor();
    await page.getByText('Saved to RELAY',{exact:true}).waitFor({timeout:20000});
    const sum=(await check.locator('.eng-sum').innerText()).replace(/\s+/g,' ').trim();
    ok(/^Progress 1$/i.test(sum),`${label}: the tally lists only Progress 1, no zeros (${sum})`);
    eq(await check.locator('canvas.sigpad').count(),0,`${label}: no signature pad until it is wanted`);
    ok(/Sign · optional/i.test(await check.innerText()),`${label}: it still says signing is optional`);
    const signOpen=check.getByRole('button',{name:'Add your signature'});
    eq(await signOpen.count(),1,`${label}: one "Add your signature" button`);
    const box=await signOpen.boundingBox();ok(box.height>=48&&box.width>=48,`${label}: the signature button is big enough for a thumb (${Math.round(box.width)}×${Math.round(box.height)})`);
    if(!wide){const h=await check.evaluate(e=>Math.round(e.getBoundingClientRect().height+e.getBoundingClientRect().top+scrollY));ok(h<=MAX_CHECK,`${label}: Check & send is ${MAX_CHECK}px or less (${h}px)`);}
    await noSideways('check');
    await shot('check');
    // Tapping it opens the pad, focus goes to it, and the pad is the one the update had before.
    await signOpen.click();
    await check.locator('canvas.sigpad').waitFor();
    ok(await page.waitForFunction(()=>document.activeElement?.id==='sign-panel',null,{timeout:3000}).then(()=>true,()=>false),`${label}: focus moves to the signature`);
    ok(/do not have to sign a site update/.test(await check.innerText()),`${label}: the pad says signing is optional`);
    eq(await page.getByLabel('Your name',{exact:true}).inputValue(),'Sam Spark',`${label}: the name is filled in`);
    await shot('check-signing');
    await tap(page.getByRole('button',{name:'Send to office'}),'Send to office');
    await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    await shot('sent');
    ok(taps.length<=MAX_TAPS,`${label}: the round trip takes at most ${MAX_TAPS} taps (took ${taps.length}: ${taps.join(', ')})`);
    const id=page.url().match(/\/reports\/([^/?#]+)/)[1];
    const sent=await page.evaluate(async id=>(await fetch(`/api/reports/${id}`)).json(),id);
    const cards=(sent.report??sent).observations;
    eq(cards.map(o=>`${o.type}|${o.location}|${o.whatHappened}|${o.photos.length}`).join(';'),'update|Level 2 corridor|Containment run complete to grid C|2',`${label}: the office gets the place, the line and both photographs`);
    eq((sent.report??sent).state,'submitted',`${label}: sent`);

    // 3. A second update with a defect too: both kinds, still no zeros.
    if(!wide){
      await page.goto(`${base}/engineer`);
      await page.getByRole('button',{name:/Start (today’s|another) site update/}).first().click();await page.waitForURL(/\/reports\//);
      await card().getByLabel('Where',{exact:true}).fill('Plant room');await card().locator('textarea').first().fill('Board dressed');
      await page.locator('.eng-add-kinds').getByRole('button',{name:'+ Defect'}).click();
      await card().getByLabel('Where',{exact:true}).fill('Plant room');await card().locator('textarea').first().fill('Cracked faceplate');
      await page.evaluate(()=>document.activeElement?.blur());
      await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();await check.waitFor();
      const two=(await check.locator('.eng-sum').innerText()).replace(/\s+/g,' ').trim();
      ok(/^Progress 1 Defects 1 go on the issue list$/i.test(two),`${label}: progress and a defect, no zeros (${two})`);
      await shot('check-two-kinds');
      // A name changed from the engineer's own is shown after a reload, not hidden behind the button.
      await check.getByRole('button',{name:'Add your signature'}).click();
      await page.getByLabel('Your name',{exact:true}).fill('S. Spark for Sam');await page.getByLabel('Your name',{exact:true}).blur();
      await page.waitForFunction(async id=>{const r=await (await fetch(`/api/reports/${id}`)).json();return (r.report??r).draftSignature?.name==='S. Spark for Sam';},page.url().match(/\/reports\/([^/?#]+)/)[1],{timeout:20000});
      await page.reload();await check.waitFor();
      eq(await page.getByLabel('Your name',{exact:true}).inputValue().catch(()=>null),'S. Spark for Sam',`${label}: a changed name keeps the signature open after a reload`);
    }
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }

  // 4. The office reads them under "Today from site".
  for(const [scheme,width] of [['dark',1440],['light',390]]){
    const label=`office ${scheme} ${width}`;
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,...(width<900?{hasTouch:true,isMobile:true}:{})});
    await context.addCookies([{name:'relay_session',value:sessionFor(manager),url:base}]);
    const page=await context.newPage();await page.goto(`${base}/office`);
    const head=page.locator('#today-site-h');await head.waitFor();
    const section=head.locator('xpath=ancestor::section[1]');
    if(width<900){const fold=section.getByRole('button',{name:/Show the \d+ site updates?/});if(await fold.count())await fold.first().click();}
    await page.waitForFunction(()=>/Level 2 corridor/.test(document.querySelector('#today-site-h')?.closest('section')?.innerText??''),null,{timeout:15000});
    ok(/Level 2 corridor\s*—\s*Containment run complete to grid C/.test(await section.innerText()),`${label}: Today from site shows the update`);
    if(shots){await head.scrollIntoViewIfNeeded();await page.screenshot({path:join(shots,`office-${scheme}-${width}.png`)});}
    await context.close();
  }
  console.log(`verify-quick-update: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
