// Browser check for the report editor usability pass (2026-10-20): on a phone
// an open card is not repeated in its row, "Check & send" appears once, a new
// inspection's unanswered checks are one stop rather than twelve, optional
// suggestions say "Optional", the Draft tag sits beside the title, and the
// send button is not lit by a tap's leftover hover. Wide screens keep the
// card's own heading and Remove.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
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
const root=mkdtempSync(join(tmpdir(),'relay-editor-usability-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
// Safety, permits and deliveries are off unless the office turns them on (lib/featureSwitch.ts); this check needs them on. verify-simpler-home.mjs covers both states.
putRecord('settings',{id:'features',safetyRecords:true});
// One engineer per run, so each starts with no drafts of their own.
const sessionFor=scheme=>{const principal={id:`entra:usability-${scheme}`,oid:`usability-${scheme}`,name:`Usability ${scheme}`,email:`usability-${scheme}@example.test`,role:'Engineer',trade:'Electrical'};const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4361,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-usability-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#886644'}}).jpeg().toBuffer();
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const phone=width<900,label=`${scheme} ${width}`;
    const context=await browser.newContext({viewport:{width,height:phone?844:900},colorScheme:scheme,hasTouch:phone,isMobile:phone});
    await context.addCookies([{name:'relay_session',value:sessionFor(scheme),url:base}]);
    // A returning engineer on Tetley Hall, so home opens there rather than asking "Which site are you on?".
    await context.addInitScript(id=>{try{if(!localStorage.getItem(`relay-project:${id}`))localStorage.setItem(`relay-project:${id}`,'proj-011lme');}catch{}},`entra:usability-${scheme}`);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(screenshot){await page.waitForTimeout(300);await page.screenshot({path:join(screenshot,`${name}-${scheme}-${width}.png`)});}};
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const visible=sel=>page.locator(`${sel}:visible`).count();

    // A site update with one card.
    await page.goto(`${base}/engineer`);await page.getByText('Start today’s site update').click();
    await page.waitForURL(/\/reports\//);await page.locator('.eng-cardrow').first().waitFor();
    const head=await page.evaluate(()=>{const h=document.querySelector('.pagehead h1').getBoundingClientRect(),t=document.querySelector('.pagehead .tag').getBoundingClientRect();return {sameLine:t.top<h.bottom,sub:document.querySelector('.pagehead .sub').textContent};});
    ok(head.sameLine,`${label}: the Draft tag sits beside the title`);
    ok(!/draft/i.test(head.sub),`${label}: the line under the title does not say "draft" again (${head.sub})`);
    // A new update opens on its first card, a progress card, with no picker first.
    const card=phone?page.locator('.eng-slot.open'):page.locator('#card-editor > div:not([hidden])');
    await card.getByLabel('Where',{exact:true}).waitFor();
    eq(await card.locator('.eng-card .head .kind').count(),0,`${label}: the open card does not repeat its kind in a tag`);
    // The light run is first on the project, so it has no recent places; the dark run has the light run's.
    // The hint under recent places went in 2026-10-21 (the chips sit under a free-text box; scripts/verify-recent-places.mjs).
    eq(await card.getByText('Choose a recent place').count(),0,`${label}: no hint line under recent places`);
    if(scheme==='light')eq(await card.locator('.eng-suggestions').count(),0,`${label}: no recent places yet on the first visit`);
    eq(await page.getByRole('button',{name:/Check & send/}).filter({visible:true}).count()-(await page.locator('.eng-steps button:visible',{hasText:'Check & send'}).count()),1,`${label}: one "Check & send" button besides the step tab`);
    if(phone){
      const row=page.locator('.eng-slot.open .eng-cardrow');
      eq(await row.locator('.desc').count(),0,`${label}: the open card's row is only its heading`);
      ok(!/photo/.test(await row.innerText()),`${label}: the open row does not repeat the photo count`);
      ok(!/no description of what happened/.test(await row.innerText())&&!(await row.evaluate(r=>r.classList.contains('late'))),`${label}: a card just added is not marked as stopping it (it is left off at Check & send)`);
      eq(await row.locator('.eng-where').count(),1,`${label}: the open row still says whether the card is on the server`);
      eq(await card.locator('.eng-card > .head').count(),0,`${label}: no heading line holding only Remove`);
      ok(await card.getByRole('button',{name:'Remove card 1'}).isVisible(),`${label}: Remove is at the foot of the card`);
      eq((await card.getByRole('button',{name:'Remove card 1'}).innerText()).trim(),'Remove card 1',`${label}: Remove says what its accessible name says`);
    } else {
      ok(await card.getByRole('button',{name:'Remove card 1'}).isVisible(),`${label}: Remove stays in the card's heading`);
      ok(/card 01/i.test(await card.locator('.eng-card > .head').innerText()),`${label}: the card keeps its heading side by side`);
    }
    await card.getByLabel('Where',{exact:true}).fill('Level 2 corridor');
    await card.locator('textarea').first().fill('Containment run complete');
    await card.locator('input[type=file]').setInputFiles({name:'a.jpg',mimeType:'image/jpeg',buffer:jpeg});
    await card.locator('.shot img').first().waitFor();
    eq(await card.locator('.shot input').first().getAttribute('placeholder'),'Add a caption',`${label}: the caption box fits its placeholder`);
    eq(await overflow(),false,`${label}: no sideways scroll with a card open`);
    await shot('update-card');
    if(phone){await card.locator('.eng-done').click();ok(/Containment run complete/.test(await page.locator('.eng-cardrow').first().innerText()),`${label}: the folded row shows the card again`);}
    await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();
    await page.locator('#report-check').waitFor();
    await page.getByText('Saved on server',{exact:true}).waitFor({timeout:15000});
    const note=page.locator('.find-note').first();
    ok(/optional/i.test(await note.locator('.find-kind').innerText()),`${label}: a suggestion is labelled Optional, not Check`);
    eq(await page.locator('.find-stop').count(),0,`${label}: nothing stops this update`);
    ok(/^The card and its photograph are on the server\.$/.test((await page.locator('.eng-check .eng-where').innerText()).trim()),`${label}: where the work is, in words`);
    const send=page.getByRole('button',{name:'Send to office'});
    // The tap on "Check & send" landed where "Send to office" now is: on a phone it must not look pressed or hovered.
    if(phone){
      const colours=await page.evaluate(()=>{const b=[...document.querySelectorAll('.actionbar .btn-primary')][0];return {now:getComputedStyle(b).backgroundColor,brass:getComputedStyle(document.documentElement).getPropertyValue('--brass').trim()};});
      const probe=await page.evaluate(c=>{const d=document.createElement('div');d.style.background=c;document.body.append(d);const v=getComputedStyle(d).backgroundColor;d.remove();return v;},colours.brass);
      eq(colours.now,probe,`${label}: the send button is its normal colour after the tap`);
    }
    await shot('update-check');
    await send.click();
    await page.locator('.pagehead .tag-sent').waitFor();
    const sentSub=await page.locator('.pagehead .sub').innerText();
    ok(/^Site update · /.test(sentSub)&&!/SPR-/.test(sentSub),`${label}: a sent report names its type under the reference rather than repeating it (${sentSub})`);
    await shot('update-sent');

    // A safety inspection just started.
    await page.goto(`${base}/engineer`);await page.getByText(/Do a safety inspection/).click();
    await page.waitForURL(/\/reports\//);await page.locator('.eng-cardrow').first().waitFor();
    eq(await page.locator('.eng-steps button').nth(1).locator('small').evaluate(e=>e.firstChild.textContent.trim()),'2',`${label}: a new inspection has two things to do before sending, not 13`);
    if(phone){
      // The first check opens by itself, on a phone too (2026-10-21).
      const open=page.locator('.eng-slot.open');
      await open.locator('.eng-answers').waitFor();
      eq(await visible('.eng-slot.open .eng-check-card > .head'),0,`${label}: the open check does not repeat its answer tag`);
      ok(await open.locator('.eng-check-question').evaluate(e=>e.getBoundingClientRect().width<=1),`${label}: the question is not shown twice`);
      eq(await open.getByRole('group',{name:/Work areas tidy/}).count(),1,`${label}: the answers are still named by their question`);
      await open.getByRole('button',{name:/Satisfactory/}).click();
      await shot('inspection-check');
    } else {
      await page.locator('#card-editor .eng-answers:visible').waitFor();
      ok(await page.locator('#card-editor .eng-check-question:visible').count()===1,`${label}: side by side the question stays as the heading`);
      await page.locator('#card-editor > div:not([hidden])').getByRole('button',{name:/Satisfactory/}).click();
    }
    await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();
    await page.locator('#report-check').waitFor();
    const stops=await page.locator('#report-check .find-stop').allInnerTexts();
    eq(stops.length,2,`${label}: one stop for the unanswered checks and one for the signature`);
    ok(/11 checks not answered yet/.test(stops[0]),`${label}: the unanswered checks are counted in one line (${stops[0]})`);
    ok(/2 items need attention/.test(await page.locator('.actionbar').innerText()),`${label}: the bar counts the same two`);
    await page.locator('.find-stop').first().click();
    if(phone){ok(/Safe ways in and out/.test(await page.locator('.eng-slot.open .eng-cardrow').innerText()),`${label}: the stop opens the first check still to answer`);
      // An action with nothing written, opened from its Stop, still says why it stops.
      await page.locator('.eng-slot.open').getByRole('button',{name:/Action needed/}).click();
      ok(/say what is wrong/.test(await page.locator('.eng-slot.open .eng-cardrow').innerText()),`${label}: an open check opened from a Stop says what stops it`);
      await page.locator('.eng-slot.open').getByRole('button',{name:/Not applicable/}).click();}
    else ok(await page.locator('#card-editor > div:not([hidden])').getByText('Safe ways in and out').isVisible(),`${label}: the stop opens the first check still to answer`);
    await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();
    await page.locator('#report-check').waitFor();
    await page.getByText(/All 12 checks are on the server/).waitFor({timeout:15000});
    ok(true,`${label}: an inspection says checks, not cards`);
    eq(await overflow(),false,`${label}: no sideways scroll on the check step`);
    await shot('inspection-check-step');
    eq(errors.length,0,`${label}: no page errors (${errors.join('; ')})`);
    await context.close();
  }
  console.log(`verify-editor-usability: ${checks} checks passed`);
} finally {await browser?.close();server.kill();}
