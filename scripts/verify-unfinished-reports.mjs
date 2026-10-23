// Browser check for FE-3d: the engineer home lists every unfinished report,
// on every project, with its project and when it was last saved, and says
// when edits on this device have not reached the server yet.
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
const root=mkdtempSync(join(tmpdir(),'relay-unfinished-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:unfinished-engineer',oid:'unfinished-engineer',name:'Unfinished Engineer',email:'unfinished@example.test',role:'Engineer',trade:'Electrical'};
const other={...principal,id:'entra:someone-else',oid:'someone-else',name:'Someone Else'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const card=()=>({id:randomUUID(),type:'update',location:'Riser 2',whatHappened:'Containment fixed',actionNeeded:'',owner:'',photos:[]});
const tetley=createReport('proj-011lme',principal.name,principal);
// An earlier day's update: today's would be opened from the big button and not listed again (verify-engineer-day.mjs).
putRecord('reports',{...tetley,observations:[card()],visitDate:'2026-10-20',lastSavedAt:'2026-10-20T08:15:00.000Z'});
const kirkstall=createReport('proj-014lme',principal.name,principal);
putRecord('reports',{...kirkstall,observations:[card(),card()],lastSavedAt:'2026-10-19T16:40:00.000Z'});
// Not this engineer's, and already sent: neither belongs on the list.
const theirs=createReport('proj-011lme',other.name,other);
const sent=createReport('proj-014lme',principal.name,principal);
putRecord('reports',{...sent,state:'submitted',serverAcknowledgedAt:'2026-10-18T10:00:00.000Z'});
const port=4332,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-unfinished-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
/** Put a copy in the device store the report editor uses (lib/localDraft.ts). */
const hold=(page,held)=>page.evaluate(held=>new Promise((ok,fail)=>{const open=indexedDB.open('relay-drafts',2);open.onupgradeneeded=()=>{const db=open.result;if(!db.objectStoreNames.contains('unsent'))db.createObjectStore('unsent',{keyPath:'key'});};open.onsuccess=()=>{const tx=open.result.transaction('unsent','readwrite');tx.objectStore('unsent').put(held);tx.oncomplete=()=>{open.result.close();ok();};tx.onerror=()=>fail(tx.error);};open.onerror=()=>fail(open.error);}),held);
const list=page=>page.locator('section[aria-labelledby="eng-unfinished-title"] .eng-row');
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('heading',{name:'Unfinished reports'}).waitFor();
    // Drafts saved to RELAY fold into one line when there are several (2026-10-22): open it to read them.
    const unfold=()=>page.locator('details.eng-saved-drafts summary').click();
    await unfold();
    let rows=list(page);
    check(await rows.count()===2,`${scheme}: both drafts listed, not someone else's or a sent one (${await rows.count()})`);
    const first=await rows.nth(0).innerText(),second=await rows.nth(1).innerText();
    check(first.includes('Tetley Hall - Block E')&&/saved Tue,? 20 Oct.*09:15/.test(first),`${scheme}: newest first with project and save time: ${first}`);
    check(second.includes('Kirkstall Gate - Phase 2')&&/saved Mon,? 19 Oct.*17:40/.test(second)&&second.includes('2 cards'),`${scheme}: other project's draft listed: ${second}`);
    check(!(await page.locator('body').innerText()).includes(theirs.reference.split('-').slice(1).join('-')),`${scheme}: another engineer's draft not shown`);
    // Edits on this phone that the server has not acknowledged, and a copy the server cannot be asked about.
    const now=new Date().toISOString();
    await hold(page,{key:`${principal.id}::${kirkstall.id}`,reportId:kirkstall.id,principalId:principal.id,seq:'s1',observations:[card(),card(),card()],heldAt:now,baseVersion:1,report:{...kirkstall,observations:[]}});
    const lost={...createReport('proj-011lme',principal.name,principal),observations:[],lastSavedAt:'2026-10-20T06:30:00.000Z'};
    database().prepare("DELETE FROM records WHERE id=?").run(lost.id);
    await hold(page,{key:`${principal.id}::${lost.id}`,reportId:lost.id,principalId:principal.id,seq:'s2',observations:[card()],heldAt:'2026-10-20T07:00:00.000Z',baseVersion:1,report:lost});
    await hold(page,{key:`${principal.id}::${sent.id}`,reportId:sent.id,principalId:principal.id,seq:'s3',observations:[card()],heldAt:now,baseVersion:1,report:{...sent,state:'draft',observations:[]}});
    await page.route(`**/api/reports/${lost.id}`,route=>route.abort('internetdisconnected'));
    await page.reload();await page.getByText('Not saved to RELAY yet').waitFor();
    // The phone's copies show at once; a copy the server did not list waits for the server's answer (here, no answer).
    await page.getByText('Only on this phone').waitFor();
    rows=list(page);
    check(await rows.count()===3,`${scheme}: two server drafts plus the phone-only copy (${await rows.count()})`);
    const top=await rows.nth(0).innerText();
    check(top.includes('Kirkstall Gate')&&/not saved to RELAY yet/i.test(top)&&top.includes('3 cards')&&/last saved Mon,? 19 Oct/.test(top),`${scheme}: unsent edits flagged: ${top}`);
    // What could be lost comes first, in full; the draft saved to RELAY stays below it.
    const phone=await rows.nth(1).innerText();
    check(/only on this phone/i.test(phone)&&phone.includes('Tetley Hall'),`${scheme}: phone-only copy shown when the server cannot answer: ${phone}`);
    check(!(await page.locator('body').innerText()).includes(sent.reference.split('-').slice(1).join('-')),`${scheme}: stale copy of a sent report left out`);
    check(!(await page.locator('details.eng-saved-drafts').count()),`${scheme}: one draft saved to RELAY is listed, not folded`);
    await rows.nth(2).click();await page.waitForURL(`**/reports/${tetley.id}**`);
    check(true,`${scheme}: a row opens its draft`);
    if(screenshot){await page.goBack();await page.getByText('Only on this phone').waitFor();await page.screenshot({path:join(screenshot,`unfinished-${scheme}-${width}.png`),fullPage:true});}
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log(`Unfinished reports check passed (${checks} checks): every project, last save, unsent and phone-only copies, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
