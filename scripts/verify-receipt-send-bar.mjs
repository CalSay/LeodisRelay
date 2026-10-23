// Browser check for the defect receipt and the Send bar (2026-10-22). The
// two-site walk found the "Defect sent to the office" receipt had no way back
// to Site, and the fixed Send bar covered the end of "What sending does" on
// Check & send. The receipt now leads with "Back to Site", and the editor's
// bottom space follows the bar's height (notes and Undo make it taller).
// Checks: the receipt's three buttons, Back to Site first, 48px tall, clear of
// the bottom tabs, and that it lands on this site's home with the Site tab on;
// a site update and an inspection on Check & send, and the cards step with
// Undo showing, each scrolled to the end with nothing under the bar, also
// while "Waiting for signal" sits in the bar; no sideways scroll; no page
// errors. Card 3 has no photograph so its removal can be undone.
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
const root=mkdtempSync(join(tmpdir(),'relay-receipt-bar-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft}=require('../apps/web/.test-build/lib/serverStore.js');
const MIN_TARGET=48;
const engineer={id:'entra:rb-engineer',oid:'rb-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const P='proj-011lme';
const jpeg=(await sharp({create:{width:320,height:240,channels:3,background:'#557799'}}).jpeg().toBuffer()).toString('base64');
const png=await sharp({create:{width:24,height:24,channels:3,background:'#997744'}}).png().toBuffer();
const photo=()=>({id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+jpeg,caption:'',capturedAt:new Date().toISOString()});
const ob=(type,location,whatHappened,photos,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos,...extra});
/** The walk's update: progress with two photographs, a defect and a variation, so "What sending does" has three rows. */
function seed(n){
  const principal={...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`};
  const r=createReport(P,principal.name,principal,'progress');
  const observations=[
    ob('update','Flat 1.03','First fix complete',[photo(),photo()]),
    ob('defect','Flat 1.03','Back box loose by the door',[photo()],{affectedTrade:'Electrical'}),
    ob('instruction','Plant room','Two extra sockets by the panel',[]),
  ];
  assert.ok(saveDraft(r.id,{...r,observations},r.version).ok);
  const inspection=createReport(P,principal.name,principal,'handover-inspection',undefined,'Flat 1.03');
  const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  return {session:id,report:r.id,inspection:inspection.id};
}
const port=4481,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-receipt-bar',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const measured=[];
/** Scrolled to the end: the lowest thing on the page, outside the bar, against the top of the bar. */
const endOfPage=(page,bar)=>page.evaluate(async sel=>{
  window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const barEl=document.querySelector(sel);const top=barEl.getBoundingClientRect().top;let lowest=0,what='';
  for(const e of document.querySelectorAll('main *')){
    if(barEl.contains(e))continue;const s=getComputedStyle(e);if(s.position==='fixed'||s.visibility==='hidden')continue;
    const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;
    // Inside a column that scrolls by itself, only the part that column shows counts.
    let bottom=r.bottom;for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){if(/auto|scroll|hidden/.test(getComputedStyle(a).overflowY))bottom=Math.min(bottom,a.getBoundingClientRect().bottom);}
    if(bottom>lowest){lowest=bottom;what=(e.textContent||e.className||e.tagName).trim().slice(0,40);}
  }
  const main=barEl.closest('main');const se=document.scrollingElement;
  return {gap:Math.round(top-lowest),bar:Math.round(barEl.getBoundingClientRect().height),what,debug:`pad ${getComputedStyle(main).paddingBottom} var ${main.style.getPropertyValue('--actionbar-space')} scroll ${Math.round(scrollY)}+${innerHeight}/${document.documentElement.scrollHeight} main ${Math.round(main.getBoundingClientRect().bottom)} se ${se.tagName} ${se.scrollTop}/${se.scrollHeight}-${se.clientHeight} vv ${Math.round(visualViewport.height)} body ${document.body.scrollHeight}`};
},bar);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const {session,report,inspection}=seed(`${scheme}-${width}`);
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    /** The viewport as the engineer sees it, so the fixed bar is where it really is. */
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`)});}};
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const noSideways=async at=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label} ${at}: no sideways scrolling`);
    const clear=async at=>{await page.waitForTimeout(400);const end=await endOfPage(page,'.actionbar');measured.push(`${label} ${at}: bar ${end.bar}px, ${end.gap}px clear`);ok(end.gap>=8,`${label} ${at}: nothing under the Send bar at the end of the page (${end.gap}px, lowest "${end.what}"; ${end.debug})`);};

    // 1. The defect receipt leads back to Site.
    await page.goto(`${base}/engineer?project=${P}`);
    await tap(page.getByRole('button',{name:/Flag a defect/}).first());
    await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
    await page.getByLabel('What needs attention?',{exact:true}).fill(`Socket faceplate cracked ${label}`);
    await page.getByLabel('Where on site?',{exact:true}).fill('Flat 1.03');
    await tap(page.getByRole('button',{name:/^Send defect to /}));
    const receipt=page.locator('.eng-defect-receipt');await receipt.getByRole('heading',{name:'Defect sent to the office'}).waitFor({timeout:20000});
    const actions=receipt.locator('.eng-defect-receipt-actions').locator(':scope>a,:scope>button');
    eq((await actions.allInnerTexts()).map(s=>s.trim()).join(' | '),'Back to Site | Open issue | View project issues',`${label}: Back to Site first, then the issue`);
    for(const a of await actions.all()){const box=await a.boundingBox();ok(box.height>=MIN_TARGET,`${label}: "${(await a.innerText()).trim()}" at least ${MIN_TARGET}px tall (${Math.round(box.height)})`);}
    if(!wide){
      const navTop=await page.locator('.eng-navigation').evaluate(n=>n.getBoundingClientRect().top);
      const last=await actions.last().evaluate(e=>{window.scrollTo(0,document.documentElement.scrollHeight);return e.getBoundingClientRect().bottom;});
      ok(last<=navTop,`${label}: the receipt's buttons end above the bottom tabs (${Math.round(last)} / ${Math.round(navTop)})`);
    }
    await noSideways('receipt');
    await page.evaluate(()=>window.scrollTo(0,0));await shot('defect-receipt');
    await tap(actions.first());
    await page.getByRole('button',{name:/Flag a defect/}).first().waitFor();
    eq(await page.locator('.eng-defect-receipt').count(),0,`${label}: Back to Site leaves the receipt`);
    eq((await page.locator('.eng-navigation [aria-current=page]').innerText()).trim(),'Site',`${label}: and lands on Site`);
    ok(await page.locator('.eng-workspace').getByText('Tetley Hall - Block E').first().isVisible(),`${label}: on the same site`);
    await tap(page.getByRole('button',{name:/Flag a defect/}).first());
    await page.getByLabel('What needs attention?',{exact:true}).waitFor();
    eq(await page.getByLabel('What needs attention?',{exact:true}).inputValue(),'',`${label}: Flag a defect again opens a blank form, not the receipt`);
    await tap(page.locator('.eng-navigation').getByRole('button',{name:'Site'}));

    // 2. A site update on Check & send: the end of "What sending does" is clear of the bar.
    await page.goto(`${base}/reports/${report}`);
    await page.locator('.eng-cardrow').first().waitFor();
    await clear('cards');
    await tap(page.locator('.eng-steps').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check .eng-does').waitFor();
    await page.locator('.actionbar .savestate').getByText(/^(Ready to send|Saved to RELAY)$/).waitFor({timeout:20000});
    eq(await page.locator('#report-check .eng-does .eng-row').count(),3,`${label}: "What sending does" lists the issue, the variation and the office`);
    await clear('update check');
    const does=await page.locator('#report-check .eng-does').evaluate(d=>d.getBoundingClientRect().bottom),barTop=await page.locator('.actionbar').evaluate(b=>b.getBoundingClientRect().top);
    if(!wide)ok(does<barTop,`${label}: "What sending does" ends above the bar once scrolled to the end`);
    await noSideways('update check');
    await shot('update-check-end');
    // No signal: "Waiting for signal" makes the bar taller, and the page makes room for it.
    await context.setOffline(true);
    await tap(page.getByRole('button',{name:'Send to office'}));
    await page.locator('.actionbar .eng-send-waiting').waitFor({timeout:20000});
    await clear('update check, waiting for signal');
    await shot('update-check-waiting');
    await page.locator('.actionbar').getByRole('button',{name:'Don’t send yet'}).click();
    await context.setOffline(false);

    // 3. The cards step with Undo in the bar.
    await tap(page.locator('.eng-steps').getByRole('button',{name:/Cards/}));
    await page.locator('.eng-cardrow').first().waitFor();
    if(!wide)await tap(page.locator('.eng-cardrow').last());
    await tap(page.getByRole('button',{name:'Remove card 3'}).last());
    await page.locator('.actionbar .eng-undo').waitFor();
    await clear('cards with Undo');
    await shot('cards-undo-end');
    await page.locator('.actionbar .eng-undo-button').click();

    // 4. An inspection's Check & send uses the same bar.
    await page.goto(`${base}/reports/${inspection}`);
    await page.locator('.eng-steps').waitFor();
    await tap(page.locator('.eng-steps').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check .eng-does').waitFor();
    await clear('inspection check');
    await noSideways('inspection check');
    await shot('inspection-check-end');

    eq(errors.length,0,`${label}: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
  console.log(measured.join('\n'));
  console.log(`verify-receipt-send-bar: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
