// Browser check for one caption line (2026-10-21): "Check & send" used to list
// "a photograph has no caption" once for every photograph without one, so a
// site update with six photographs opened on six Optional lines before the
// notes the office needs. Now they share one line at the end of the list.
// Seeds today's update with four cards and seven photographs (one captioned)
// and a variation done on a say-so with no photograph and nobody named, then
// on "Check & send" checks: one caption line, last, in words; the variation's
// notes first; nothing stops sending; tapping the line opens the first card
// with an uncaptioned photograph; how tall the list is; 48px targets; no
// sideways scroll; the update still sends. Light and dark at 390px, dark at 1440px.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
// RELAY_CAPTION_REPORT=1 only prints the measurements (used to measure main before the change).
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
const root=mkdtempSync(join(tmpdir(),'relay-caption-line-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft}=require('../apps/web/.test-build/lib/serverStore.js');
const reportOnly=process.env.RELAY_CAPTION_REPORT==='1';
const MIN_TARGET=48;
const engineer={id:'entra:cl-engineer',oid:'cl-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const P='proj-011lme';
const jpeg=(await sharp({create:{width:320,height:240,channels:3,background:'#557799'}}).jpeg().toBuffer()).toString('base64');
const photo=(caption='')=>({id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+jpeg,caption,capturedAt:new Date().toISOString()});
const ob=(type,location,whatHappened,photos,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos,...extra});
/** Today's update for one engineer, as a real day ends: seven photographs, one captioned, and a variation done on a say-so. */
const seed=n=>{
  const principal={...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`};
  const r=createReport(P,principal.name,principal,'progress');
  const observations=[
    ob('update','Level 2 corridor','Containment run complete to grid C',[photo(),photo('Tray at grid C')]),
    ob('defect','Level 2 corridor','Cable tray bracket missing above door D2.14',[photo(),photo(),photo()],{affectedTrade:'Electrical'}),
    ob('instruction','Plant room','Two extra sockets by the panel',[],{workDone:true}),
    ob('update','Flat 3.02','Second fix sockets done',[photo(),photo()]),
  ];
  const saved=saveDraft(r.id,{...r,observations},r.version);assert.ok(saved.ok,JSON.stringify(saved));
  const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  return {session:id,report:r.id,first:observations[0].id};
};
const port=4461,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-caption-line',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{if(reportOnly){if(!value)console.log(`(not met) ${message}`);return;}assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const measured=[];
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const {session,report,first}=seed(`${scheme}-${width}`);
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:true});}};
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};

    await page.goto(`${base}/reports/${report}`);
    await page.locator('.eng-cardrow').first().waitFor();
    await tap(page.locator('.eng-steps').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check').waitFor();
    await page.locator('#report-check .eng-sum').waitFor();
    const rows=page.locator('#report-check .eng-finds .find');
    /** Each line as "Kind message", read from the words rather than the screen (CSS shouts the kind). */
    const lines=()=>rows.evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent.trim()).join(' ')));
    const texts=await lines();
    const listHeight=await page.locator('#report-check .eng-finds').evaluate(e=>Math.round(e.getBoundingClientRect().height));
    const sumDown=await page.locator('#report-check').evaluate(c=>Math.round(c.querySelector('.eng-sum').getBoundingClientRect().top-c.getBoundingClientRect().top));
    measured.push(`${label}: ${texts.length} lines before sending, list ${listHeight}px tall, "In this report" ${sumDown}px down the step`);
    await shot('check');
    if(reportOnly){console.log(texts.join('\n'));await context.close();continue;}

    // One caption line, last, in plain words; the variation's notes come first.
    const captionRows=texts.filter(t=>/caption/i.test(t));
    eq(captionRows.length,1,`${label}: one line for every photograph without a caption`);
    eq(texts.at(-1),'Optional 6 photographs have no caption',`${label}: the caption line is last and counts the six`);
    ok(/^Optional Plant room: a variation with no photograph is harder to price$/.test(texts[0]),`${label}: the variation with no photograph comes first (${texts[0]})`);
    ok(/^Optional Plant room: work already done, but nobody named who asked for it$/.test(texts[1]),`${label}: then the variation nobody asked for (${texts[1]})`);
    eq(texts.length,3,`${label}: three lines in all, where there were eight`);
    eq(await page.locator('#report-check .find-stop').count(),0,`${label}: nothing stops this update being sent`);
    for(const b of await rows.all()){const box=await b.boundingBox();ok(box.height>=MIN_TARGET,`${label}: each line is at least ${MIN_TARGET}px tall (${Math.round(box.height)})`);}
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling`);

    // Tapping the caption line opens the first card with a photograph to caption.
    await tap(rows.last());
    const body=page.locator(wide?`.eng-card-body[data-card-body="${first}"]`:`#slot-${first}.open`);
    await body.waitFor();
    ok(await body.isVisible(),`${label}: the caption line opens card 1`);
    ok(await body.locator('.shot input').first().isVisible(),`${label}: with its caption boxes in view`);

    // Type one caption: the count goes down by one, and nothing else changes.
    await body.locator('.shot input').first().fill('Containment at grid C');
    await tap(page.locator('.eng-steps').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check').waitFor();
    eq((await lines()).at(-1),'Optional 5 photographs have no caption',`${label}: a caption typed takes one off the count`);

    // It still sends with the rest uncaptioned.
    await page.getByText('Saved to RELAY',{exact:true}).waitFor({timeout:20000});
    await tap(page.getByRole('button',{name:'Send to office'}));
    await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
    const sent=await page.evaluate(async id=>(await fetch(`/api/reports/${id}`)).json(),report);
    const cards=(sent.report??sent).observations;
    eq(cards.map(o=>o.photos.length).join(','),'2,3,0,2',`${label}: every photograph went to the office`);
    eq(cards[0].photos[0].caption,'Containment at grid C',`${label}: with the caption that was typed`);
    eq(errors.length,0,`${label}: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
  console.log(measured.join('\n'));
  if(!reportOnly)console.log(`verify-one-caption-line: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
