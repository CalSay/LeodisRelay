// Browser check for "Fixed it already?" on the defect receipt (2026-10-22). The
// walk of an engineer who finds a small fault and fixes it there and then found
// the receipt gave no way to say so: "Open issue", then a photograph and "Put
// forward as fixed" on the issue page. The receipt now has "Fixed it already?",
// which opens the camera, then "Put forward as fixed" on the same screen.
// Checks: the button sits under Back to Site; taps from Site to put forward;
// a photo of the fix, removing one, the issue put forward with that photograph
// (awaiting verification, by the engineer, the office still to check it); the
// no-photo way; no signal keeps the photo and says so, then goes on a retry;
// the issue page names who fixed it; 48px targets; no sideways scroll; no page
// errors. Light and dark at 390px, dark at 1440px.
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
const root=mkdtempSync(join(tmpdir(),'relay-fixed-spot-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const MIN_TARGET=48;
const engineer={id:'entra:fs-engineer',oid:'fs-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:fs-manager',oid:'fs-manager',name:'Mia Manager',email:'mia@example.test',role:'Manager'};
const P='proj-011lme';
const png=async colour=>sharp({create:{width:24,height:24,channels:3,background:colour}}).png().toBuffer();
const fault=await png('#997744'),fix=await png('#447799'),fix2=await png('#449977');
const session=principal=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const port=4483,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-fixed-spot',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
const counted=[];
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  const office=session(manager);
  /** The issue as the office reads it. */
  const asOffice=async id=>(await fetch(`${base}/api/issues/${id}`,{headers:{cookie:`relay_session=${office}`}})).json();
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900,n=`${scheme}-${width}`;
    const principal={...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`};
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:session(principal),url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:true});}};
    let taps=0;
    const tap=async locator=>{taps++;await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const tall=async (locator,what)=>{const box=await locator.boundingBox();ok(box&&box.height>=MIN_TARGET,`${label}: ${what} at least ${MIN_TARGET}px tall (${Math.round(box?.height??0)})`);};
    const noSideways=async at=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label} ${at}: no sideways scrolling`);
    /** Site, Flag a defect, a photo, a place and Send: the receipt. Photos and typing are not taps. */
    const flag=async what=>{
      await page.goto(`${base}/engineer?project=${P}`);taps=0;
      await tap(page.getByRole('button',{name:/Flag a defect/}).first());
      taps++;await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'fault.png',mimeType:'image/png',buffer:fault});
      await page.getByLabel('What needs attention?',{exact:true}).fill(`${what} ${label}`);
      await page.getByLabel('Where on site?',{exact:true}).fill('Flat 1.03');
      await tap(page.getByRole('button',{name:/^Send defect to /}));
      const receipt=page.locator('.eng-defect-receipt');await receipt.getByRole('heading',{name:'Defect sent to the office'}).waitFor({timeout:20000});
      const id=new URL(await receipt.getByRole('link',{name:'Open issue'}).getAttribute('href'),base).pathname.split('/').pop();
      return {receipt,id};
    };
    const camera=page.getByLabel('Fixed it already? Take a photo of the fix',{exact:true});

    // 1. With a photograph of the fix.
    let {receipt,id}=await flag('Faceplate loose');
    const order=await receipt.locator('.eng-defect-receipt-actions').evaluate(a=>[...a.children].map(c=>c.className||c.tagName));
    eq(order.slice(0,2).join(' | '),'eng-primary | eng-fixed',`${label}: "Fixed it already?" comes straight under Back to Site`);
    ok(await receipt.getByText('Fixed it already?',{exact:true}).isVisible(),`${label}: the receipt asks "Fixed it already?"`);
    ok(await receipt.getByText('Take a photo of the fix',{exact:true}).isVisible(),`${label}: and says it takes a photo of the fix`);
    await tall(receipt.locator('.eng-fixed-camera'),'"Fixed it already?"');
    await tall(receipt.getByRole('button',{name:'No photo? Put forward as fixed'}),'"No photo? Put forward as fixed"');
    eq(await receipt.getByRole('button',{name:'Put forward as fixed',exact:true}).count(),0,`${label}: no "Put forward as fixed" before a photo is taken`);
    await noSideways('receipt');await shot('fixed-receipt');
    taps++;await camera.setInputFiles({name:'fix.png',mimeType:'image/png',buffer:fix});
    await receipt.getByAltText('Photograph of the fix 1').waitFor();
    ok(await receipt.getByRole('button',{name:'Put forward as fixed',exact:true}).evaluate(e=>document.activeElement===e),`${label}: focus moves to "Put forward as fixed" after the photo`);
    // A second, then removed again: what is sent is what is shown.
    await receipt.getByLabel('Add another photo of the fix',{exact:true}).setInputFiles({name:'fix2.png',mimeType:'image/png',buffer:fix2});
    await receipt.getByAltText('Photograph of the fix 2').waitFor();
    await receipt.getByRole('button',{name:'Remove photo 2'}).click();
    eq(await receipt.getByAltText(/Photograph of the fix/).count(),1,`${label}: a removed photo of the fix goes`);
    const forward=receipt.getByRole('button',{name:'Put forward as fixed',exact:true});
    await tall(forward,'"Put forward as fixed"');
    ok(await forward.evaluate(e=>document.activeElement===e),`${label}: after removing one, focus is on "Put forward as fixed"`);
    eq(await receipt.getByRole('button',{name:'No photo? Put forward as fixed'}).count(),0,`${label}: the no-photo button goes once there is a photo`);
    await noSideways('photo of the fix');await shot('fixed-photo');
    await tap(forward);
    const done=receipt.locator('.eng-fixed-done');await done.waitFor({timeout:20000});
    ok((await done.innerText()).startsWith('Put forward as fixed. The office will check it and close it.'),`${label}: the receipt says it was put forward and the office will check it`);
    ok(await done.evaluate(e=>document.activeElement===e),`${label}: and moves to those words`);
    counted.push(`${label}: ${taps} taps from Site to put forward as fixed (was 6 through Open issue; a Recent places chip adds one to each)`);
    eq(taps,5,`${label}: five taps from Site, each photo counted as a tap`);
    ok(await receipt.getByRole('button',{name:'Back to Site'}).isVisible(),`${label}: Back to Site still there`);
    await noSideways('put forward');await shot('fixed-done');
    let seen=await asOffice(id);
    eq(seen.work,'awaiting_verification',`${label}: the office has it waiting to be checked`);
    eq(seen.closureSubmittedBy,'Sam Sparks',`${label}: put forward by the engineer`);
    const closure=seen.events.find(e=>e.kind==='closure_submitted');
    eq(closure?.photos?.length,1,`${label}: with the one photograph of the fix`);
    ok(seen.events.findIndex(e=>e.kind==='closure_submitted')>0,`${label}: raised first, then put forward: two events`);
    // The issue page says who fixed it, not "Nobody yet".
    await tap(receipt.getByRole('link',{name:'Open issue'}));
    await page.locator('.issue-eng-title').waitFor();
    ok(await page.getByText('Sam Sparks fixed it',{exact:true}).isVisible(),`${label}: the issue names who fixed it`);
    eq(await page.getByText('Nobody yet. The office will say who.').count(),0,`${label}: not "Nobody yet"`);
    ok(await page.getByText('Put forward as fixed. It is waiting for the office to check it.').isVisible(),`${label}: and says it is waiting for the office`);

    // 2. No photo to add.
    ({receipt,id}=await flag('Label missing'));
    await tap(receipt.getByRole('button',{name:'No photo? Put forward as fixed'}));
    await receipt.locator('.eng-fixed-done').waitFor({timeout:20000});
    seen=await asOffice(id);
    eq(seen.work,'awaiting_verification',`${label}: no photo: put forward`);
    eq(seen.events.find(e=>e.kind==='closure_submitted')?.photos?.length,0,`${label}: no photo: with none`);

    // 3. No signal after the receipt: the photo stays and the words say so; it goes on a retry.
    ({receipt,id}=await flag('Cover cracked'));
    await camera.setInputFiles({name:'fix.png',mimeType:'image/png',buffer:fix});
    await receipt.getByAltText('Photograph of the fix 1').waitFor();
    await context.setOffline(true);
    await receipt.getByRole('button',{name:'Put forward as fixed',exact:true}).click();
    const alert=receipt.getByRole('alert');await alert.waitFor();
    ok((await alert.innerText()).startsWith('No signal, so RELAY could not say it was put forward. Your photo is still here'),`${label}: no signal says so (${await alert.innerText()})`);
    eq(await receipt.getByAltText('Photograph of the fix 1').count(),1,`${label}: the photo of the fix is kept`);
    eq((await asOffice(id)).work,'open',`${label}: and nothing changed at the office`);
    await noSideways('no signal');await shot('fixed-no-signal');
    await context.setOffline(false);
    await receipt.getByRole('button',{name:'Put forward as fixed',exact:true}).click();
    await receipt.locator('.eng-fixed-done').waitFor({timeout:20000});
    eq(await receipt.getByRole('alert').count(),0,`${label}: the note goes once it is through`);
    seen=await asOffice(id);
    eq(seen.work,'awaiting_verification',`${label}: retried: put forward`);
    eq(seen.events.filter(e=>e.kind==='closure_submitted').length,1,`${label}: once`);
    eq(errors.length,0,`${label}: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
  console.log(counted.join('\n'));
  console.log(`verify-fixed-on-the-spot: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
