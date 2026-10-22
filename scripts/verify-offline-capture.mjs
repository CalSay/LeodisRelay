// Browser check for FE-3e offline capture: with the server out of reach, RELAY
// opens on the offline page (served by the service worker), an engineer starts
// a site update, adds cards and photos and changes a report already held, and
// all of it reaches the server by itself once RELAY opens with signal again.
// Stopping the server stands in for losing signal: the service worker's fetch
// fails exactly as it does on a phone with none.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-offline-capture-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {database,putRecord,records}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport,saveDraft}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:offline-engineer',oid:'offline-engineer',name:'Offline Engineer',email:'offline@example.test',role:'Engineer',trade:'Electrical'};
// One session per run: the light run ends by signing out, which ends its session.
const newSession=()=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4345,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-offline-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
const jpeg=colour=>sharp({create:{width:640,height:480,channels:3,background:colour}}).jpeg().toBuffer();
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const mine=()=>records('reports').filter(r=>r.authorId===principal.id);
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
// A copy the editor left on the phone before signal went: built on the server's version.
async function holdCopy(page,report,extra={}){
  await page.evaluate(async ({report,principal,extra})=>{
    await new Promise((done,fail)=>{
      const open=indexedDB.open('relay-drafts',2);
      open.onupgradeneeded=()=>open.result.createObjectStore('unsent',{keyPath:'key'});
      open.onsuccess=()=>{const tx=open.result.transaction('unsent','readwrite');
        tx.objectStore('unsent').put({key:`${principal}::${report.id}`,reportId:report.id,principalId:principal,seq:1,observations:report.observations,heldAt:new Date().toISOString(),baseVersion:report.version,report,tab:'tab-gone',...extra});
        tx.oncomplete=()=>{open.result.close();done();};tx.onerror=()=>fail(tx.error);};
    });
  },{report,principal:principal.id,extra});
}
const heldKeys=page=>page.evaluate(()=>new Promise(done=>{const open=indexedDB.open('relay-drafts',2);open.onsuccess=()=>{const r=open.result.transaction('unsent').objectStore('unsent').getAllKeys();r.onsuccess=()=>{open.result.close();done(r.result);};};}));
try {
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const before=new Set(mine().map(r=>r.id));
    // A draft already on the server, with a card, that the phone also holds.
    const draft=createReport('proj-011lme',principal.name,principal);
    const kept=saveDraft(draft.id,{...draft,observations:[{id:randomUUID(),type:'update',location:'Level 2',whatHappened:'Containment run',actionNeeded:'',owner:'',photos:[]}]},draft.version).value;
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:newSession(),url:base}]);
    let page=await context.newPage();const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());};watch(page);
    // With signal: RELAY installs its service worker and leaves the person and their projects on the phone.
    await page.goto(`${base}/engineer`);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const left=await page.evaluate(id=>({person:JSON.parse(localStorage.getItem('relay-offline-person')),projects:JSON.parse(localStorage.getItem(`relay-offline-projects:${id}`)||'[]')}),principal.id);
    check(left.person?.id===principal.id&&left.person.name===principal.name&&Object.keys(left.person).length===2,`${scheme}: the phone keeps who is signed in, name and id only`);
    check(left.projects.length>0&&left.projects.every(p=>p.id&&p.projectName&&p.projectNumber&&Object.keys(p).length===3),`${scheme}: and the projects open to them, number and name only`);
    await holdCopy(page,kept);
    let conflict;
    if(scheme==='dark'){
      // A second draft the phone holds, which changes on the server before signal returns.
      const other=createReport('proj-011lme',principal.name,principal);
      conflict=saveDraft(other.id,{...other,observations:[{id:randomUUID(),type:'update',location:'Roof',whatHappened:'Fans set',actionNeeded:'',owner:'',photos:[]}]},other.version).value;
      await holdCopy(page,conflict);
    }
    // No signal. On a phone this is a cold start: a fresh page, so nothing is in the tab's own storage.
    await stop();
    // Meanwhile another device saves the second draft.
    if(conflict)assert.ok(saveDraft(conflict.id,{...conflict,observations:[{...conflict.observations[0],whatHappened:'Fans set, from the laptop'}]},conflict.version).ok);
    await page.close();page=await context.newPage();watch(page);
    await page.goto(`${base}/engineer`);
    await page.getByRole('heading',{name:'Keep reporting. It is saved on this phone.'}).waitFor();
    check((await page.locator('#net').textContent())==='No signal',`${scheme}: says there is no signal`);
    check(/Offline Engineer/.test(await page.locator('#status').innerText()),`${scheme}: knows who is signed in on this phone after a cold start`);
    check(await page.locator('#start-project').inputValue()==='proj-011lme',`${scheme}: offers their current project`);
    check(await page.locator('#start-date').inputValue()===today(),`${scheme}: the visit date is today`);
    check((await page.locator('#drafts .item').count())===(scheme==='dark'?2:1),`${scheme}: lists the reports already held`);
    // Start a site update and capture a defect with a photo.
    await page.getByRole('button',{name:'Start on this phone'}).click();
    await page.locator('#editor-title',{hasText:'New site update · Tetley Hall - Block E'}).waitFor();
    await page.getByRole('button',{name:/^Defect/}).click();
    const defect=page.locator('.card').nth(0);
    await defect.getByLabel('Where').fill('Riser 3, level 4');
    await defect.getByLabel('What’s wrong').fill('Fire stopping missing round tray');
    await defect.getByLabel('What needs doing').fill('Fire stop before close-up');
    await defect.locator('input[type=file]').setInputFiles({name:'riser.jpg',mimeType:'image/jpeg',buffer:await jpeg('#996633')});
    await defect.locator('.shot img').waitFor();
    check((await defect.locator('.where').innerText())==='Only on this phone',`${scheme}: each card says it is only on this phone`);
    // A second card, then removed (asks first).
    await page.getByRole('button',{name:/^Progress/}).click();
    await page.locator('.card').nth(1).getByLabel('Where').fill('Plant room');
    await page.getByRole('button',{name:'Remove card 2'}).click();
    await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
    check((await page.locator('.card').count())===1,`${scheme}: the removed card is gone`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${scheme}: no sideways scroll`);
    if(screenshot)await page.screenshot({path:join(screenshot,`offline-start-${scheme}-${width}.png`),fullPage:true});
    // Change the held copy of the server draft.
    await page.locator('#drafts .item',{hasText:kept.reference}).click();
    await page.locator('#editor-title',{hasText:kept.reference}).waitFor();
    await page.locator('.card').nth(0).getByLabel('What happened').fill('Containment run and lidded');
    await page.locator('.card').nth(0).locator('input[type=file]').setInputFiles({name:'lid.jpg',mimeType:'image/jpeg',buffer:await jpeg('#335577')});
    await page.locator('.card').nth(0).locator('.shot img').waitFor();
    if(conflict){
      await page.locator('#drafts .item',{hasText:conflict.reference}).click();
      await page.locator('#editor-title',{hasText:conflict.reference}).waitFor();
      await page.locator('.card').nth(0).getByLabel('What happened').fill('Fans set and wired');
    }
    await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
    // Still no signal after a reload: everything is still there.
    await page.reload();
    await page.locator('#drafts .item').first().waitFor();
    const rows=await page.locator('#drafts .item').allInnerTexts();
    check(rows.some(r=>/New site update · Tetley Hall - Block E/.test(r)&&/1 card · 1 photo/.test(r)&&/Only on this phone/i.test(r)),`${scheme}: the new report is listed with its card and photo: ${rows.join(' | ')}`);
    await page.locator('#drafts .item',{hasText:'New site update'}).click();
    check(await page.locator('.card').nth(0).getByLabel('What’s wrong').inputValue()==='Fire stopping missing round tray',`${scheme}: the words survive a reload`);
    // The thumbnail is read back from the phone's store after the card is drawn, so wait for it.
    await page.locator('.card .shot img').first().waitFor({timeout:5000}).catch(()=>{});
    check((await page.locator('.card .shot img').count())===1,`${scheme}: and the photo`);
    if(screenshot)await page.screenshot({path:join(screenshot,`offline-held-${scheme}-${width}.png`),fullPage:true});
    check(mine().filter(r=>!before.has(r.id)).length===(scheme==='dark'?2:1),`${scheme}: nothing new reached the server while it was out of reach`);
    // Signal back: the page notices, and RELAY sends it all by itself.
    await start();
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.locator('#back:not([hidden])').waitFor({timeout:15000});
    check((await page.locator('#net').textContent())==='Signal back',`${scheme}: says signal is back`);
    await page.getByRole('link',{name:'Open RELAY'}).click();
    await page.waitForURL(/\/engineer/);
    const note=page.locator('.held-send .note-ok');
    await note.waitFor({timeout:30000});
    const noteText=await note.innerText();
    check(/2 reports from this phone are now saved to RELAY\. They stay drafts until you send them\./.test(noteText),`${scheme}: says what went up: ${noteText}`);
    const fresh=mine().filter(r=>!before.has(r.id)&&r.id!==draft.id&&r.id!==conflict?.id);
    check(fresh.length===1,`${scheme}: one new report on the server, not two`);
    const made=getReport(fresh[0].id);
    check(made.visitDate===today()&&made.state==='draft'&&made.observations.length===1,`${scheme}: the new draft has the visit date and its card`);
    const o=made.observations[0];
    check(o.type==='defect'&&o.location==='Riser 3, level 4'&&o.actionNeeded==='Fire stop before close-up'&&o.photos.length===1,`${scheme}: the defect card and its photo are in the server's copy`);
    const updated=getReport(draft.id);
    check(updated.observations[0].whatHappened==='Containment run and lidded'&&updated.observations[0].photos.length===1,`${scheme}: the held draft's change and photo reached the server`);
    // Both of today's drafts can be found again. The big button carries on
    // with the one the server saved last (the order the engineer page reads
    // drafts in); every other draft of today waits under Unfinished reports
    // with its reference. Which one the server saved last depends on the order
    // the phone sent them, so the check works it out rather than assuming.
    const todays=database().prepare("SELECT id FROM records WHERE kind='reports' AND state='draft' AND project='proj-011lme' AND json_extract(data,'$.authorId')=? AND json_extract(data,'$.visitDate')=? ORDER BY updated DESC,id DESC").all(principal.id,made.visitDate).map(r=>r.id);
    check(todays.includes(made.id)&&todays.includes(draft.id),`${scheme}: both of today's drafts are on the server as drafts`);
    const tile=page.locator('a.eng-tile-main');
    const onTile=id=>page.locator(`a.eng-tile-main[href^="/reports/${id}?"]`);
    const unfinishedRow=id=>page.locator(`section[aria-labelledby="eng-unfinished-title"] a.eng-row[href^="/reports/${id}?"]`);
    await onTile(todays[0]).waitFor({timeout:15000});
    check(/Carry on with today’s update/.test(await tile.innerText()),`${scheme}: the big button carries on with today's update: ${await tile.innerText()}`);
    for(const r of [made,updated,...(conflict?[getReport(conflict.id)]:[])]){
      const ref=r.reference.split('-').slice(1).join('-');
      const row=unfinishedRow(r.id);
      if(r.id===todays[0]){
        check((await tile.count())===1,`${scheme}: ${ref}, saved last, is on the big button`);
        // Listed again only when the list has something to say about it (held, refused, signed).
        // Wait for it to go: the home screen re-reads what the phone holds a moment after the refresh.
        if(r.id!==conflict?.id)check(await row.waitFor({state:'detached',timeout:10000}).then(()=>true,()=>false),`${scheme}: ${ref} is not listed twice`);
      } else {
        // Two or more saved to RELAY fold into one line (2026-10-22), so such a row may be there but folded;
        // the one changed elsewhere could be lost, so it must be listed in full.
        await row.waitFor({state:r.id===conflict?.id?'visible':'attached'});
        check(r.id===conflict?.id||await row.evaluate(a=>!a.closest('details')||!!a.closest('details.eng-saved-drafts')),`${scheme}: ${ref} is listed or in the saved drafts' fold`);
        check((await row.textContent()).includes(ref),`${scheme}: ${ref} is under Unfinished reports with its reference`);
      }
    }
    const keys=await heldKeys(page);
    if(conflict){
      const problem=page.locator('.held-send .note-bad');
      await problem.waitFor();
      check(/changed somewhere else too/.test(await problem.innerText()),`${scheme}: a draft changed elsewhere is not forced over: ${await problem.innerText()}`);
      check(keys.length===1&&keys[0]===`${principal.id}::${conflict.id}`,`${scheme}: only that copy stays on the phone, for its editor to compare: ${keys}`);
      check(getReport(conflict.id).observations[0].whatHappened==='Fans set, from the laptop',`${scheme}: and the server's copy is untouched`);
      if(screenshot)await page.screenshot({path:join(screenshot,`offline-sent-${scheme}-${width}.png`),fullPage:false});
      // Its editor shows both versions to choose from.
      await problem.getByRole('link',{name:'Open it'}).click();
      await page.getByText(/saved from another tab or device|choose what to keep/i).first().waitFor({timeout:20000});
      check(true,`${scheme}: its editor offers the choice`);
    } else {
      check(keys.length===0,`${scheme}: nothing is left held on the phone: ${keys}`);
      if(screenshot)await page.screenshot({path:join(screenshot,`offline-sent-${scheme}-${width}.png`),fullPage:false});
      // Opening RELAY again does not send or announce anything twice.
      await page.reload();await page.locator('.eng-list').first().waitFor();await page.waitForTimeout(1500);
      check(await page.locator('.held-send').count()===0,`${scheme}: nothing is announced twice`);
      check(mine().filter(r=>!before.has(r.id)).length===2,`${scheme}: and no report is made twice`);
      // Signing out takes the person off the phone, so the offline page shows nobody's work.
      await page.getByRole('button',{name:'Sign out'}).click();
      await page.waitForURL(/signin|\/$/);
      const gone=await page.evaluate(id=>[localStorage.getItem('relay-offline-person'),localStorage.getItem(`relay-offline-projects:${id}`)],principal.id);
      check(gone[0]===null&&gone[1]===null,`${scheme}: signing out removes the person and projects from the phone`);
      await page.goto(`${base}/offline.html`);
      await page.locator('#status',{hasText:'Nobody is signed in on this phone'}).waitFor();
      check(await page.locator('#start').isHidden(),`${scheme}: and offers no start`);
    }
    check(errors.length===0,`${scheme}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`Offline capture check passed (${checks} checks): cold start with no signal, start a report, cards and photos on the phone, reload, sent by itself when signal returns, a changed draft left to its editor, sign-out.`);
} finally {
  await browser?.close();await stop();
}
