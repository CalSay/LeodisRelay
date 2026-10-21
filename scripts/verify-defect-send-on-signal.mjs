// Browser check for quick defects sent with no signal (2026-10-21): "Send
// defect" with the phone's signal off says "Defect not sent yet" and "Waiting
// for signal", keeps the defect on the phone, and once signal is back it goes
// to the office by itself, exactly once, like a site update (#105).
// Checks: it goes by itself on the defect screen ("Sent by itself once there
// was signal"); from the Site page after the engineer moved on (a note with a
// link to the issue); when RELAY is opened again after being closed; two tabs
// coming back at once, and "Try again" tapped as it goes by itself, still
// make one issue and one upload; a lost answer then a flicker of signal is
// one issue; a defect never sent is never sent by itself; a refusal is not
// tried again by itself and does not say it will go. "Try again" stays.
// 390px light and dark, 1440px dark. Simulated offline in a phone-sized
// browser, not a real phone or real weak signal.
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
const root=mkdtempSync(join(tmpdir(),'relay-defect-signal-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const MIN_TARGET=48;
const engineer={id:'entra:dsos-engineer',oid:'dsos-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=n=>{const id=randomUUID();putRecord('sessions',{id,principal:{...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const P='proj-011lme';
const png=await sharp({create:{width:24,height:24,channels:3,background:'#997744'}}).png().toBuffer();
const port=4472,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-defect-signal',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900,who=`${scheme}-${width}`;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(who),url:base}]);
    // Every defect upload from this browser, whichever tab, passes this gate: `uploads` says what
    // happens to it, and `posts` counts those that reached RELAY.
    let posts=0,uploads='open';
    await context.route('**/api/issues',async route=>{
      if(route.request().method()!=='POST')return route.continue();
      if(uploads==='cut')return route.abort('internetdisconnected');
      if(uploads==='refuse')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({reason:'You cannot report on this project.'})});
      posts++;
      if(uploads==='lose'){uploads='open';await route.fetch();return route.abort();}
      if(uploads==='slow')await new Promise(r=>setTimeout(r,1200));
      return route.continue();
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async(name,p=page)=>{if(shots){await p.waitForTimeout(300);await p.screenshot({path:join(shots,`${prefix}-defect-signal-${name}-${scheme}-${width}.png`),fullPage:true});}};
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const key=`relay-defect:${engineer.id}-${who}:${P}`;
    const held=(p=page)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)??'null'),key);
    const issuesNamed=async text=>(await context.request.get(`${base}/api/issues?projectId=${P}`).then(r=>r.json())).issues.filter(i=>i.description===text);
    const notSent=(p=page)=>p.getByRole('heading',{name:'Defect not sent yet',exact:true});
    const sentHeading=(p=page)=>p.getByRole('heading',{name:'Defect sent to the office',exact:true});
    /** Fills a defect on `p` and taps send, with the signal (or the upload) cut off. */
    async function flag(text,p=page){
      await p.goto(`${base}/engineer?project=${P}&view=defect`);
      await p.getByLabel('Where on site?',{exact:true}).waitFor();
      await p.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
      await p.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
      await p.getByLabel('What needs attention?',{exact:true}).fill(text);
      await p.getByLabel('Where on site?',{exact:true}).fill('Riser cupboard, level 3');
    }
    const send=(p=page)=>tap(p.getByRole('button',{name:/^Send defect to /}));
    /** No answer from RELAY for defect uploads, whatever the phone says about its signal. */
    const cutUploads=()=>{uploads='cut';},restoreUploads=()=>{uploads='open';};

    // 1. On the defect screen: no signal, then signal back, and it goes by itself.
    const first=`Loose socket ${who}`;
    await flag(first);
    await context.setOffline(true);await send();
    await notSent().waitFor();
    ok(await page.getByText('Waiting for signal.',{exact:true}).isVisible(),`${label}: says it is waiting for signal`);
    ok(await page.getByText(/goes to the office by itself as soon as there is signal/).isVisible(),`${label}: says it goes by itself`);
    eq((await page.locator('.eng-defect [role=alert]').innerText()).trim(),'No signal, or no answer from RELAY. Your defect is kept on this phone.',`${label}: no signal in plain words`);
    const tryAgain=page.getByRole('button',{name:'Try again',exact:true});
    ok(await tryAgain.isVisible(),`${label}: "Try again" is still there`);
    ok((await tryAgain.boundingBox()).height>=MIN_TARGET-0.5,`${label}: "Try again" at least ${MIN_TARGET}px tall`);
    eq((await held()).pending,true,`${label}: kept on the phone, frozen`);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling while waiting`);
    await shot('waiting');
    const before=posts;
    await context.setOffline(false);
    await sentHeading().waitFor({timeout:20000});
    ok(await page.getByText('Sent by itself once there was signal.',{exact:true}).isVisible(),`${label}: says it went by itself`);
    eq((await issuesNamed(first)).length,1,`${label}: one issue once signal is back`);
    eq(posts-before,1,`${label}: one upload once signal is back`);
    eq(await held(),null,`${label}: the phone lets go of it once sent`);
    await shot('sent-by-itself');

    // 2. Sent with no signal, then the engineer moved on: it goes from the Site page, and says so there.
    const second=`Cracked faceplate ${who}`;
    await flag(second);
    await context.setOffline(true);await send();await notSent().waitFor();
    await tap(page.getByRole('button',{name:'Site',exact:true}));
    await page.getByRole('button',{name:/Flag a defect/}).first().waitFor();
    await context.setOffline(false);
    const note=page.locator('.held-send [role=status]').filter({hasText:'Defect sent to the office by itself'});
    await note.waitFor({timeout:20000});
    const [issue]=await issuesNamed(second);
    ok(issue,`${label}: sent from the Site page`);
    ok((await note.innerText()).includes(issue.reference),`${label}: the note names the issue`);
    eq(await note.getByRole('link',{name:'Open it'}).getAttribute('href'),`/issues/${issue.id}`,`${label}: the note opens the issue`);
    ok((await note.getByRole('link',{name:'Open it'}).boundingBox()).height>=MIN_TARGET-0.5,`${label}: "Open it" at least ${MIN_TARGET}px tall`);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling with the note`);
    await shot('sent-from-home');
    await tap(note.getByRole('button',{name:'Dismiss'}));
    eq(await note.count(),0,`${label}: the note can be dismissed`);

    // 3. Closed with no signal, opened again with signal: it goes as RELAY opens.
    const third=`Missing blanking plate ${who}`;
    await flag(third);
    await context.setOffline(true);await send();await notSent().waitFor();
    await page.close();
    await context.setOffline(false);
    let tab=await context.newPage();tab.on('pageerror',e=>errors.push(e.message));
    await tab.goto(`${base}/engineer?project=${P}`);
    await tab.locator('.held-send [role=status]').filter({hasText:'Defect sent to the office by itself'}).waitFor({timeout:20000});
    eq((await issuesNamed(third)).length,1,`${label}: sent as RELAY opens again`);

    // 4. Two tabs on the defect screen coming back at once: one upload, both say it went.
    const fourth=`Damaged trunking lid ${who}`;
    await flag(fourth,tab);
    await cutUploads();await send(tab);await notSent(tab).waitFor();
    const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
    await other.goto(`${base}/engineer?project=${P}&view=defect`);await notSent(other).waitFor();
    ok(true,`${label}: a second tab opens the same defect, not sent yet`);
    let was=posts;
    await restoreUploads();
    await Promise.all([tab,other].map(p=>p.evaluate(()=>window.dispatchEvent(new Event('online')))));
    await sentHeading(tab).waitFor({timeout:20000});
    await sentHeading(other).waitFor({timeout:20000});
    eq((await issuesNamed(fourth)).length,1,`${label}: two tabs make one issue`);
    eq(posts-was,1,`${label}: two tabs make one upload`);
    await other.close();

    // 5. "Try again" tapped just as it goes by itself: one upload.
    const fifth=`Scorched cable ${who}`;
    await flag(fifth,tab);
    await cutUploads();await send(tab);await notSent(tab).waitFor();
    was=posts;
    await restoreUploads();
    // A slow upload, so the phone saying it is online lands while the tap's send is on its way.
    uploads='slow';
    await tap(tab.getByRole('button',{name:'Try again',exact:true}));
    await tab.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));});
    await sentHeading(tab).waitFor({timeout:20000});
    eq((await issuesNamed(fifth)).length,1,`${label}: a tap as it goes by itself is one issue`);
    eq(posts-was,1,`${label}: a tap as it goes by itself is one upload`);
    restoreUploads();

    // 6. The office got it but the answer was lost, then the signal flickered: still one issue.
    const sixth=`Exposed conductor ${who}`;
    await flag(sixth,tab);
    uploads='lose';
    await send(tab);await notSent(tab).waitFor();
    eq((await issuesNamed(sixth)).length,1,`${label}: the office has it though the phone did not hear`);
    await context.setOffline(true);await context.setOffline(false);
    await sentHeading(tab).waitFor({timeout:20000});
    await tab.evaluate(()=>window.dispatchEvent(new Event('online')));await tab.waitForTimeout(500);
    eq((await issuesNamed(sixth)).length,1,`${label}: a lost answer and a flicker of signal are one issue`);

    // 7. Never sent: a defect being written is not sent by itself.
    const seventh=`Not finished yet ${who}`;
    await flag(seventh,tab);
    await tab.waitForFunction(k=>JSON.parse(localStorage.getItem(k)??'null')?.description?.startsWith('Not finished'),key);
    was=posts;
    await tab.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));});
    await tab.waitForTimeout(800);
    eq(posts-was,0,`${label}: a defect not sent is not sent by itself`);
    eq((await issuesNamed(seventh)).length,0,`${label}: no issue for a defect not sent`);

    // 8. Refused as it is: said plainly, not tried again by itself, and not "goes by itself".
    uploads='refuse';
    await send(tab);await notSent(tab).waitFor();
    eq((await tab.locator('.eng-defect [role=alert]').innerText()).trim(),'You cannot report on this project.',`${label}: the refusal in its own words`);
    ok(await tab.getByText('RELAY did not take it.',{exact:true}).isVisible(),`${label}: a refusal does not say it will go by itself`);
    was=posts;
    await tab.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));});
    await tab.waitForTimeout(800);
    eq(posts-was,0,`${label}: a refusal is not tried again by itself`);
    restoreUploads();
    await tap(tab.getByRole('button',{name:'Try again',exact:true}));
    await sentHeading(tab).waitFor({timeout:20000});
    eq((await issuesNamed(seventh)).length,1,`${label}: "Try again" sends it once it can go`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`Defect send-on-signal check passed (${checks} checks): with no signal a defect says "Defect not sent yet" and "Waiting for signal", is kept on the phone and goes by itself once there is signal, on the defect screen, from the Site page (a note linking the issue) and when RELAY opens again; two tabs, or "Try again" as it goes, make one issue and one upload; a lost answer then a flicker is one issue; a defect not sent is never sent by itself; a refusal is not retried by itself; light and dark at 390px, dark at 1440px.`);
} finally {await browser?.close();server.kill();}
