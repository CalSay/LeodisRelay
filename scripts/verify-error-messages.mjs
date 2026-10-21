// Browser check for what people see when something goes wrong (2026-10-21).
// Forces the failures a site engineer or the office will meet and checks that
// each message says what happened, whether the work is safe and what to do,
// shows no raw status code, and that the work is still there afterwards:
// signed out partway through a report, the server answering with an error
// page or slowly, photographs of the wrong type, too big or refused, a box
// over the length limit, a spreadsheet or PDF that will not come, a PDF this
// browser cannot draw, SharePoint not answering while a report is filed,
// a page that does not exist and a page that breaks.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
// RELAY_ERRORS_BEFORE=1 only takes the screenshots (for the "before" set on main).
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
const root=mkdtempSync(join(tmpdir(),'relay-errors-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const worker=require('../apps/web/.test-build/lib/reportWorker.js');
const {GraphError}=require('../apps/web/.test-build/lib/sharepoint/graph.js');
const BEFORE=process.env.RELAY_ERRORS_BEFORE==='1';
const engineer={id:'entra:errors-engineer',oid:'errors-engineer',name:'Erin Engineer',email:'erin@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:errors-manager',oid:'errors-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions=new Map();
const session=(principal,live=true)=>{const id=sessions.get(principal.id)??randomUUID();sessions.set(principal.id,id);putRecord('sessions',{id,principal,issuedAt:new Date(Date.now()-7200000).toISOString(),expiresAt:new Date(Date.now()+(live?3600000:-1000)).toISOString()});return id;};
const now=new Date().toISOString();
// A sent report on a SharePoint project whose filing has failed once and is being tried again.
const filed=createReport('proj-011lme',engineer.name,engineer);
const sentRow={...filed,state:'submitted',review:'not_required',serverAcknowledgedAt:now,delivery:'rendered',projectSnapshot:{...filed.projectSnapshot,source:{siteId:'s',listId:'l',itemId:'1'}},
  observations:[{id:randomUUID(),type:'update',location:'Level 2 corridor',whatHappened:'Containment complete to the riser',actionNeeded:'',owner:'',photos:[]}]};
// What the worker records when SharePoint does not answer: the helper where this branch has it, as main recorded it otherwise.
const spFailure=worker.sharePointFailure?worker.sharePointFailure(new GraphError(503),false):{status:'failed',error:new GraphError(503).message};
putRecord('reports',{...sentRow,sharepoint:{...spFailure}});putRecord('snapshots',sentRow);
// One open issue, so the office register has a spreadsheet to download.
putRecord('issues',{id:'err-1',reference:'DEMO-011LME-ISS-001',projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Level 2 corridor',description:'Cable tray loose',
  actionNeeded:'Refix the tray',confirmation:'confirmed',work:'assigned',owner:'Acme Electrical Ltd',targetDate:'',raisedByReport:'',raisedAt:now,affectedTrade:'Electrical',events:[]});
const port=4391,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-errors-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const photo=async colour=>({name:`site-${colour.slice(1)}.jpg`,mimeType:'image/jpeg',buffer:await sharp({create:{width:900,height:700,channels:3,background:colour}}).jpeg().toBuffer()});
const HTML_502='<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>';
let browser,checks=0;const failures=[];
const ok=(value,message)=>{if(BEFORE)return;assert.ok(value,message);checks++;};
const shotDir=process.env.RELAY_SCREENSHOT_DIR;if(shotDir)mkdirSync(shotDir,{recursive:true});
// No raw status codes, stack traces or developer words as the message.
const RAW=/\((?:4|5)\d\d\)|HTTP \d{3}|Microsoft Graph|TypeError|ChunkLoadError|stack|undefined|Application error|client-side exception|Invalid PDF|getOrInsertComputed|fetch failed/i;
const T=ms=>BEFORE?Math.min(ms,8000):ms;
// On main (BEFORE) a step that cannot finish still leaves its screenshot.
async function step(label,fn,rescue){try{await fn();}catch(e){if(BEFORE){failures.push(`${label}: ${e.message.split('\n')[0]}`);await rescue?.().catch(()=>{});return;}throw e;}}
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    const label=`${scheme} ${width}`;const phone=width<900;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,acceptDownloads:true,...(phone?{hasTouch:true,isMobile:true}:{})});
    await context.addCookies([{name:'relay_session',value:session(engineer),url:base}]);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shotDir){await page.waitForTimeout(300);await page.screenshot({path:join(shotDir,`${BEFORE?'before':'after'}-${name}-${scheme}-${width}.png`),fullPage:false});}};
    const state=page.locator('.savestate b');
    const problem=page.locator('.eng-save-problem, .note.note-bad').first();
    const visibleText=()=>page.evaluate(()=>document.body.innerText);
    const card=()=>page.locator(phone?'.eng-slot.open':'#card-editor > div:not([hidden])');
    const box=()=>card().locator('textarea').first();
    // On a phone the bottom bar steps aside while a box has the keyboard, so each edit ends by leaving the box.
    const write=async text=>{await box().fill(text);await page.evaluate(()=>document.activeElement?.blur());};
    const saved=()=>state.filter({hasText:'Saved on server'}).waitFor({timeout:T(40000)});
    const draft=createReport('proj-011lme',engineer.name,engineer);

    await step(`${label}: open a draft`,async()=>{
      await page.goto(`${base}/reports/${draft.id}`);
      await page.locator('.eng-tile').first().click();
      await card().getByLabel('Where',{exact:true}).fill('Level 2 corridor');
      await write('Containment run complete to the riser.');
      await saved();
    });

    // 1. Signed out partway through: the work stays, it says so, and signing in again lets it save.
    await step(`${label}: signed out`,async()=>{
      session(engineer,false);
      await write('Containment run complete to the riser. Second fix lighting started.');
      await state.filter({hasText:/signed out|Not saved/i}).waitFor({timeout:T(15000)});
      await shot('signed-out');
      const said=await visibleText();
      ok(/Signed out/i.test(await state.innerText()),`${label}: the save state says signed out: ${await state.innerText()}`);
      ok(/kept on this phone/i.test(said)&&/You have been signed out/i.test(said),`${label}: says the work is kept on this phone`);
      const again=page.getByRole('link',{name:/Sign in again/});
      ok(await again.count()>0&&await again.first().getAttribute('target')==='_blank',`${label}: offers sign in again in a new tab`);
      ok(!RAW.test(said),`${label}: no raw error text when signed out`);
      ok((await box().inputValue()).includes('Second fix lighting'),`${label}: what was typed is still in the box`);
      session(engineer,true);
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await saved();
      ok(getReport(draft.id).observations[0].whatHappened.includes('Second fix lighting'),`${label}: once signed in again it saved by itself`);
      ok(await page.getByRole('link',{name:/Sign in again/}).count()===0,`${label}: the sign-in prompt goes once signed in`);
    },()=>{session(engineer,true);return shot('signed-out');});

    // 2. The server answers with a proxy's error page: no code, work kept, it tries again by itself.
    await step(`${label}: server error`,async()=>{
      await page.route('**/api/reports/*',r=>r.request().method()==='PUT'?r.fulfill({status:502,contentType:'text/html',body:HTML_502}):r.continue());
      await write('Containment run complete. Second fix lighting started in 2.04.');
      await state.filter({hasText:/not answering|Not saved/i}).waitFor({timeout:T(15000)});
      await shot('server-error');
      const said=await visibleText();
      ok(/RELAY’s server/i.test(said)&&/kept on this phone/i.test(said)&&/tries again by itself/i.test(said),`${label}: says the server is at fault, the work is kept and it tries again`);
      ok(!RAW.test(said)&&!/502|Bad Gateway/.test(said),`${label}: no status code on a server error`);
      await page.unroute('**/api/reports/*');
      await saved();
      ok(getReport(draft.id).observations[0].whatHappened.includes('in 2.04'),`${label}: the server error cleared and it saved by itself`);
    },async()=>{await shot('server-error');await page.unroute('**/api/reports/*');});

    // 3. A slow server: after a while it says it is still saving and the work is on this phone.
    await step(`${label}: slow server`,async()=>{
      await page.route('**/api/reports/*',async r=>{if(r.request().method()==='PUT'){await new Promise(d=>setTimeout(d,11000));await r.continue().catch(()=>{});}else await r.continue();});
      await write('Containment run complete. Second fix lighting started in 2.04 and 2.05.');
      await state.filter({hasText:/Still saving/}).waitFor({timeout:T(15000)});
      await shot('slow');
      ok(/kept on this phone/i.test(await state.innerText()),`${label}: a slow save says the work is on this phone: ${await state.innerText()}`);
      await saved();await page.unroute('**/api/reports/*');
    },async()=>{await shot('slow');await page.unroute('**/api/reports/*');});

    // 4. Photographs: one fine, one of the wrong type, one too big, chosen together.
    await step(`${label}: photograph type and size`,async()=>{
      await card().locator('input[type=file]').setInputFiles([await photo('#557799'),{name:'drawing.gif',mimeType:'image/gif',buffer:Buffer.from('GIF89a')},{name:'huge.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(21*1024*1024,1)}]);
      await card().locator('.note-bad').waitFor({timeout:T(10000)});
      await shot('photo-type-size');
      const said=await card().locator('.note-bad').innerText();
      ok(/1 photograph added/i.test(said)&&/drawing\.gif/.test(said)&&/huge\.jpg/.test(said),`${label}: adds the good photograph and names the two that were not: ${said}`);
      ok(/JPEG, PNG or WebP/.test(said)&&/20 MB/.test(said),`${label}: says why each was not added`);
      ok(await card().locator('.shot').count()===1,`${label}: the good photograph is on the card`);
      await saved();
    },()=>shot('photo-type-size'));

    // 5. A photograph the server will not take: it names the card and says what to do.
    await step(`${label}: photograph refused`,async()=>{
      await page.route('**/api/media/**',r=>r.request().method()==='PUT'?r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({reason:'The file is not a supported photograph.'})}):r.continue());
      await card().locator('input[type=file]').setInputFiles([await photo('#997755')]);
      await state.filter({hasText:/Not saved/}).waitFor({timeout:T(15000)});
      await shot('photo-refused');
      const said=await visibleText();
      ok(/Level 2 corridor/.test(said)&&/photograph/i.test(said)&&/Remove it/i.test(said),`${label}: a refused photograph names its card and says to remove it`);
      ok(/kept on this phone/i.test(said),`${label}: and says the rest is kept`);
      await page.unroute('**/api/media/**');
      await write('Containment run complete. Second fix lighting started in 2.04 and 2.05. Checked.');
      await saved();
      ok(getReport(draft.id).observations[0].photos.length===2,`${label}: once the upload works both photographs are saved`);
    },async()=>{await shot('photo-refused');await page.unroute('**/api/media/**');});

    // 6. A box over the length limit: said beside the box and on the save, nothing cut off.
    await step(`${label}: too long`,async()=>{
      const long='Cable tray inspected. '.repeat(460);
      await write(long);
      await card().getByText(/over 10,000 characters/).waitFor({timeout:T(10000)});
      await state.filter({hasText:/Not saved/}).waitFor({timeout:T(15000)});
      await shot('too-long');
      const said=await visibleText();
      ok(/Level 2 corridor/.test(said)&&/Shorten it/i.test(said),`${label}: names the card that is too long and says to shorten it`);
      ok((await box().inputValue()).length===long.length,`${label}: nothing was cut off`);
      await write('Containment run complete. Second fix lighting started.');
      await saved();
    },async()=>{await shot('too-long');await write('Short again.').catch(()=>{});});

    // 7. A report that does not exist, and a page that does not exist.
    await step(`${label}: not found`,async()=>{
      await page.goto(`${base}/reports/no-such-report`);
      await page.getByText(/could not be found|could not be loaded/).waitFor({timeout:T(15000)});
      await shot('report-missing');
      ok(/could not be found/.test(await visibleText()),`${label}: a missing report says it could not be found`);
      await page.goto(`${base}/no-such-page`);
      await page.waitForLoadState('networkidle');
      await shot('not-found');
      ok(await page.getByRole('heading',{level:1,name:/page is not here/i}).count()===1,`${label}: page not found has a plain heading`);
      ok(await page.getByRole('link',{name:/Go to your home page/}).count()===1,`${label}: and a way home`);
      ok(!/404|This page could not be found\./.test(await visibleText()),`${label}: no 404 code as the message`);
    });

    // 8. A page that breaks: the general error page, with a way to try again.
    await step(`${label}: general error page`,async()=>{
      // The real answer with its lists taken out: the page breaks while drawing it.
      await page.route('**/api/weekly-summary**',async r=>{const res=await r.fetch();const body=await res.json();for(const k of Object.keys(body))if(Array.isArray(body[k]))body[k]=null;await r.fulfill({response:res,json:body});});
      await page.goto(`${base}/weekly-summary?project=proj-011lme`);
      await page.waitForTimeout(1500);
      await shot('error-page');
      ok(await page.getByRole('heading',{level:1,name:/could not show this page/i}).count()===1,`${label}: the error page has a plain heading`);
      ok(await page.getByRole('button',{name:'Try again'}).count()===1&&await page.getByRole('link',{name:/Go to your home page/}).count()===1,`${label}: and try again and a way home`);
      const said=await visibleText();
      ok(/kept on this device/i.test(said)&&!RAW.test(said),`${label}: says saved work is safe, no raw error: ${said.slice(0,300)}`);
      await page.unroute('**/api/weekly-summary**');
    },async()=>{await shot('error-page');await page.unroute('**/api/weekly-summary**');});

    ok(!errors.some(e=>!/unexpected|Cannot read|map is not a function|is not iterable|undefined/.test(e)),`${label}: no other page errors: ${errors.join(' | ')}`);
    await context.close();

    // The office: a spreadsheet that will not come, a PDF that will not come or cannot be drawn, SharePoint not answering.
    const office=await browser.newContext({viewport:{width,height},colorScheme:scheme,acceptDownloads:true,...(phone?{hasTouch:true,isMobile:true}:{})});
    await office.addCookies([{name:'relay_session',value:session(manager),url:base}]);
    const desk=await office.newPage();
    const oshot=async name=>{if(shotDir){await desk.waitForTimeout(300);await desk.screenshot({path:join(shotDir,`${BEFORE?'before':'after'}-${name}-${scheme}-${width}.png`),fullPage:false});}};
    const deskText=()=>desk.evaluate(()=>document.body.innerText);

    await step(`${label}: spreadsheet fails`,async()=>{
      await desk.route('**/api/issues/export**',r=>r.fulfill({status:503,contentType:'text/html',body:'<h1>Service Unavailable</h1>'}));
      await desk.goto(`${base}/office#/issues`);
      const link=desk.getByRole('link',{name:/as a spreadsheet/}).first();
      await link.waitFor({timeout:T(20000)});
      await link.click().catch(()=>{});
      await desk.getByText(/spreadsheet could not be downloaded/i).waitFor({timeout:T(10000)});
      await oshot('download-failed');
      const said=await deskText();
      ok(/Try again in a minute/i.test(said)&&!RAW.test(said)&&!/503|Service Unavailable/.test(said),`${label}: a failed spreadsheet says so in plain words`);
      await desk.unroute('**/api/issues/export**');
      const [download]=await Promise.all([desk.waitForEvent('download',{timeout:T(15000)}),link.click()]);
      ok(/\.csv$/.test(download.suggestedFilename()),`${label}: and downloads once the server answers: ${download.suggestedFilename()}`);
    },async()=>{await oshot('download-failed');await desk.unroute('**/api/issues/export**');});

    await step(`${label}: PDF fails`,async()=>{
      await desk.route('**/api/reports/*/pdf**',r=>r.fulfill({status:500,contentType:'text/html',body:'Internal Server Error'}));
      await desk.goto(`${base}/reports/${filed.id}/pdf`);
      await desk.locator('[role=alert]').first().waitFor({timeout:T(15000)});
      await oshot('pdf-failed');
      const said=await deskText();
      ok(/PDF could not be opened/i.test(said)&&/Try again/.test(said)&&!RAW.test(said),`${label}: a PDF that will not come says so: ${said.slice(0,200)}`);
      await desk.unroute('**/api/reports/*/pdf**');
      // Bytes this browser cannot draw: say so and offer the download instead.
      await desk.route('**/api/reports/*/pdf',r=>r.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.7 not really a PDF'}));
      await desk.goto(`${base}/reports/${filed.id}/pdf`);
      await desk.locator('[role=alert]').first().waitFor({timeout:T(15000)});
      await oshot('pdf-cannot-show');
      const shown=await deskText();
      ok(/could not be shown here/i.test(shown)&&!RAW.test(shown),`${label}: a PDF that cannot be drawn says so in plain words: ${shown.slice(0,200)}`);
      ok(await desk.getByRole('link',{name:/Download the PDF/}).count()===1,`${label}: and offers the download`);
      await desk.unroute('**/api/reports/*/pdf');
    },async()=>{await oshot('pdf-failed');await desk.unroute('**/api/reports/*/pdf**');});

    await step(`${label}: SharePoint not answering`,async()=>{
      await desk.goto(`${base}/office#/projects/proj-011lme/report/${filed.id}`);
      await desk.locator('ol.stages').waitFor({timeout:T(20000)});
      await oshot('sharepoint-retrying');
      const said=await desk.locator('ol.stages').innerText();
      ok(/Trying SharePoint again/i.test(said)&&/tries again by itself/i.test(said)&&/safe in RELAY/i.test(said),`${label}: SharePoint not answering says RELAY tries again and the report is safe: ${said}`);
      ok(!RAW.test(said),`${label}: no Graph status as the message`);
    },()=>oshot('sharepoint-retrying'));
    await office.close();
  }
  if(BEFORE)console.log(`Screenshots taken. Steps that could not run on this build:\n${failures.join('\n')}`);
  else console.log(`verify-error-messages: ${checks} checks passed`);
} finally {
  await browser?.close();
  server.kill();
}
