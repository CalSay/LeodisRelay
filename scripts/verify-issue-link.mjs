// Browser check for FE-5b: when a card is linked to an issue already raised,
// the picker shows each open issue's description and a thumbnail where it has
// a photograph, on defect and access cards and on variation cards (which used
// to be a plain drop-down of references). Nearest location first, the linked
// issue always listed, "Show all" for the rest, and the link survives a reload.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-issue-link-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:link-engineer',oid:'link-engineer',name:'Link Engineer',email:'link@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
// A 4x3 grey PNG, stored inline the way older issues still carry photographs.
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC';
let n=0;
const issue=(extra)=>{n++;const i={id:randomUUID(),reference:`011LME-ISS-${String(n).padStart(3,'0')}`,projectId:'proj-011lme',location:'Level 1 corridor',description:`Issue ${n} on level 1`,actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',source:'individual',raisedAt:'2026-10-01T09:00:00.000Z',events:[{at:'2026-10-01T09:00:00.000Z',actor:'Link Engineer',kind:'raised',note:'',photos:[]}],...extra};putRecord('issues',i);return i;};
const others=[];for(let k=0;k<7;k++)others.push(issue({}));
const riser=issue({location:'Level 3 riser',description:'Fire stopping missing around the cable tray where it passes through the riser wall, both sides',owner:'',events:[{at:'2026-10-01T09:00:00.000Z',actor:'Link Engineer',kind:'raised',note:'',photos:[{id:randomUUID(),dataUrl:png,caption:'Riser wall'}]}]});
const closed=issue({location:'Level 3 riser',description:'Closed riser issue',work:'closed'});
const draft=createReport('proj-011lme',principal.name,principal);
const defect={id:randomUUID(),type:'defect',location:'Level 3 riser',whatHappened:'Fire stopping still missing',actionNeeded:'Make good',owner:'',affectedTrade:'Electrical',photos:[]};
const variation={id:randomUUID(),type:'instruction',location:'Level 1 corridor',whatHappened:'Extra socket asked for by the client',actionNeeded:'',owner:'',photos:[]};
putRecord('reports',{...draft,observations:[defect,variation]});
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-link-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`)});};
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const tag=`${scheme} ${width}px`;
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const open=async(i)=>{const row=page.locator('.eng-cardrow').nth(i);await row.waitFor();if(await row.getAttribute('aria-expanded')!=='true')await row.click();};
    await page.goto(`${base}/reports/${draft.id}`);
    // Defect card: the picker lists issues as pictures and words.
    await open(0);
    const defectGroup=page.getByRole('group',{name:'Is this something already raised?'});
    await defectGroup.waitFor();
    const rows=defectGroup.locator('.eng-linkrow');
    eq(await rows.count(),1+6,`${tag}: "this is new" plus six issues before "Show all"`);
    const first=rows.nth(1);
    ok((await first.innerText()).includes('Fire stopping missing around the cable tray'),`${tag}: the issue at the card's location is listed first, by its description`);
    ok(/ISS-008 · Level 3 riser · unassigned/.test(await first.innerText()),`${tag}: short reference, location and owner under the description`);
    eq(await first.locator('.thumb img').count(),1,`${tag}: an issue with a photograph shows a thumbnail`);
    await page.waitForFunction(()=>{const img=document.querySelector('.eng-linkrow .thumb img');return img&&img.complete&&img.naturalWidth>0;});
    const box=await first.locator('.thumb').boundingBox();
    ok(box&&box.width>=48&&box.height>=48,`${tag}: thumbnail is big enough to recognise (${box?.width}px)`);
    eq(await rows.nth(2).locator('.thumb.empty').innerText(),'No photo',`${tag}: an issue without a photograph says so rather than showing a blank box`);
    eq(await defectGroup.getByText('Closed riser issue').count(),0,`${tag}: closed issues are not offered`);
    const clamp=await first.locator('b').evaluate(b=>getComputedStyle(b).webkitLineClamp);
    eq(clamp,'2',`${tag}: long descriptions are cut at two lines`);
    const toggle=page.getByRole('button',{name:'Show all 8 open issues'});
    await toggle.click();
    eq(await rows.count(),1+8,`${tag}: "Show all" lists every open issue`);
    eq(await overflow(),false,`${tag}: no sideways scroll with the picker open`);
    await defectGroup.evaluate(e=>e.scrollIntoView({block:'center'}));await shot(page,`link-defect-${scheme}-${width}`);
    if(scheme==='light'){
      await first.click();
      eq(await first.getAttribute('aria-pressed'),'true',`${tag}: tapping an issue links it`);
      await page.getByText("This will be added to that issue's history rather than raising a new one.").waitFor();
      await page.getByText('Saved on server',{exact:true}).waitFor({state:'attached'});
    }
    // Variation card: the same picture list replaces the old drop-down.
    await open(1);
    const varGroup=page.getByRole('group',{name:'Is this on an issue already? · optional'});
    await varGroup.waitFor();
    eq(await page.locator('.eng-card:visible select').count(),0,`${tag}: no plain drop-down on the variation card`);
    const varRows=varGroup.locator('.eng-linkrow');
    eq(await varRows.count(),1+6,`${tag}: variation picker lists "No" plus six issues`);
    const varText=await varRows.nth(1).innerText();ok(/Issue \d on level 1/.test(varText),varText+" "+`${tag}: variation picker shows descriptions`);
    eq(await varGroup.getByText('Fire stopping missing around').count(),0,`${tag}: an issue elsewhere on site waits behind "Show all" when seven issues are nearer the card's place`);
    await page.getByRole('button',{name:'Show all 8 open issues'}).click();
    eq(await varGroup.locator('.thumb img').count(),1,`${tag}: variation picker shows the thumbnail where one exists`);
    await page.getByRole('button',{name:'Show fewer issues'}).click();
    if(scheme==='light'){
      // The linked issue stays listed even when it falls past the first six.
      const last=others[6];
      await page.getByRole('button',{name:'Show all 8 open issues'}).click();
      await varGroup.getByRole('button',{name:new RegExp(last.description)}).click();
      await page.getByRole('button',{name:'Show fewer issues'}).click();
      eq(await varGroup.getByRole('button',{name:new RegExp(last.description)}).getAttribute('aria-pressed'),'true',`${tag}: linked issue still listed and marked after "Show fewer"`);
      await page.getByText('Saved on server',{exact:true}).waitFor({state:'attached'});
      await page.waitForTimeout(1200);
      await page.reload();
      await open(1);
      eq(await varGroup.getByRole('button',{name:new RegExp(last.description)}).getAttribute('aria-pressed'),'true',`${tag}: variation link survives a reload`);
      await open(0);
      eq(await defectGroup.locator('.eng-linkrow').nth(1).getAttribute('aria-pressed'),'true',`${tag}: defect link survives a reload`);
      // "No" clears the link.
      await open(1);
      await varGroup.getByRole('button',{name:/^No/}).click();
      eq(await varGroup.locator('.eng-linkrow[aria-pressed=true]').count(),1,`${tag}: one answer at a time`);
      eq(await varGroup.getByRole('button',{name:/^No/}).getAttribute('aria-pressed'),'true',`${tag}: "No" unlinks the variation`);
      await page.waitForTimeout(1200);await page.getByText('Saved on server',{exact:true}).waitFor({state:'attached'});
      await page.reload();await open(1);
      eq(await varGroup.getByRole('button',{name:/^No/}).getAttribute('aria-pressed'),'true',`${tag}: the unlink is saved too`);
    }
    eq(await overflow(),false,`${tag}: no sideways scroll on the variation card`);
    await varGroup.evaluate(e=>e.scrollIntoView({block:'center'}));await shot(page,`link-variation-${scheme}-${width}`);
    assert.deepEqual(errors,[],`${tag}: no page errors`);
    await context.close();
  }
  console.log(`Passed ${checks} issue link picker checks (390px light, 1440px dark).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
