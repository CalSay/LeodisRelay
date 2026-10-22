// Browser check for FE-3b: the report editor says which cards and photographs
// are on the server and which are still on this phone, and catches up by
// itself when a stopped server comes back.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-uploads-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:upload-engineer',oid:'upload-engineer',name:'Upload Engineer',email:'upload@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4334,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-upload-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
const jpeg=colour=>sharp({create:{width:64,height:48,channels:3,background:colour}}).jpeg().toBuffer();
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
try {
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const report=createReport('proj-011lme',principal.name,principal);
    const cardId=randomUUID();
    putRecord('reports',{...report,observations:[{id:cardId,type:'defect',location:'Riser 2',whatHappened:'Tray loose',actionNeeded:'',owner:'',affectedTrade:'Electrical',photos:[]}],lastSavedAt:new Date().toISOString()});
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/reports/${report.id}`);
    const row=page.locator('.eng-cardrow').first();
    await row.waitFor();
    check((await row.locator('.eng-where').innerText())==='Saved',`${scheme}: a card loaded from the server says so: ${await row.innerText()}`);
    if(width<900)await row.click();
    const slot=width<900?page.locator(`#slot-${cardId}`):page.locator('#card-editor');
    const shots=slot.locator('.shot');
    // A photo taken with the server up goes up with the card.
    await slot.locator('input[type=file]').setInputFiles({name:'first.jpg',mimeType:'image/jpeg',buffer:await jpeg('#997744')});
    await shots.nth(0).locator('.eng-where',{hasText:/^Saved$/}).waitFor({timeout:20000});
    await row.locator('.eng-where',{hasText:/^Saved$/}).waitFor();
    check(getReport(report.id).observations[0].photos.length===1,`${scheme}: the first photo is in the server's copy`);
    // Stop the server: the next photo and the changed words stay on this phone, and say so.
    await stop();
    await slot.locator('input[type=file]').setInputFiles({name:'second.jpg',mimeType:'image/jpeg',buffer:await jpeg('#335577')});
    await shots.nth(1).locator('.eng-where',{hasText:/^Only on this phone$/}).waitFor({timeout:20000});
    await slot.getByLabel('Caption for photograph 1').fill('Bracket missing');
    await row.locator('.eng-where',{hasText:/changes/}).waitFor();
    await page.evaluate(()=>document.activeElement?.blur());
    await page.locator('.savestate',{hasText:'On this phone only'}).waitFor({timeout:20000});
    check((await shots.nth(0).locator('.eng-where').innerText())==='Saved',`${scheme}: the photo already sent stays on the server`);
    const offRow=await row.locator('.eng-where').innerText();
    check(offRow==='Only on this phone · changes and 1 photograph',`${scheme}: the card says what is still to go up: ${offRow}`);
    check(/On this phone only/.test(await page.locator('.savestate').innerText()),`${scheme}: the save state agrees`);
    if(screenshot)await page.screenshot({path:join(screenshot,`uploads-offline-${scheme}-${width}.png`),fullPage:true});
    if(screenshot)await slot.locator('.shots').screenshot({path:join(screenshot,`uploads-offline-photos-${scheme}-${width}.png`)});
    await page.locator('.actionbar .btn-primary').click();
    const summary=page.locator('.eng-check p.eng-where');
    await summary.waitFor();
    check((await summary.innerText())==='1 card and 1 photograph are only on this phone. They go up by themselves when RELAY can be reached.',`${scheme}: the check step says what is only on this phone: ${await summary.innerText()}`);
    // Restart it: without anyone touching the page, everything reaches the server.
    await start();
    await page.locator('.eng-check p.eng-where-server').waitFor({timeout:45000});
    const back=await summary.innerText();
    check(back==='The card and 2 photographs are saved to RELAY.',`${scheme}: after the restart the check step says everything is on the server: ${back}`);
    const saved=getReport(report.id).observations[0];
    check(saved.photos.length===2&&saved.photos[0].caption==='Bracket missing',`${scheme}: the server's copy has both photos and the caption`);
    if(screenshot)await page.screenshot({path:join(screenshot,`uploads-check-${scheme}-${width}.png`),fullPage:true});
    await page.goBack();
    if(width<900&&!(await slot.locator('.shot').first().isVisible()))await row.click();
    check((await row.locator('.eng-where').innerText())==='Saved',`${scheme}: the card is on the server again`);
    check((await shots.locator('.eng-where').allInnerTexts()).every(t=>t==='Saved'),`${scheme}: both photos are on the server`);
    if(screenshot)await page.screenshot({path:join(screenshot,`uploads-online-${scheme}-${width}.png`),fullPage:true});
    const scroll=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    check(!scroll,`${scheme}: no sideways scroll at ${width}px`);
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Photo upload check passed (${checks} checks): cards and photos on the server or on this phone, server stopped and restarted, light and dark.`);
} finally {
  await browser?.close();await stop();database().close();rmSync(root,{recursive:true,force:true});
}
