// Browser check for a site update sent with no signal and then left
// (2026-10-21): "Send to office" with no signal, then the engineer moves to
// another page. A line at the top of that page says "Waiting for signal" in
// the words a defect uses, and once signal is back the update goes to the
// office by itself from there, exactly once, with every card and photograph
// (one taken with no signal too), then says so with a link. Also: a phone
// holding a site update, a defect and an inspection signed with no signal,
// with RELAY open in two tabs, one reloaded part-way and "Try now" tapped
// while it is already going: each arrives exactly once. An update taken
// back to the cards in another tab after Send does not go by itself. 390px light and dark,
// 1440px dark. Simulated in a phone-sized browser (signal switched off, or
// RELAY's answers cut off), not a real phone or real weak signal.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
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
const root=mkdtempSync(join(tmpdir(),'relay-update-anywhere-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {signedContent}=require('../apps/web/.test-build/lib/offlineStart.js');
const P='proj-011lme';
const jpeg=colour=>sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer();
function person(n){
  const p={id:`entra:usa-${n}`,oid:`usa-${n}`,name:`Una Anywhere ${n}`,email:`una${n}@example.test`,role:'Engineer',trade:'Electrical'};
  const session=randomUUID();putRecord('sessions',{id:session,principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  return {...p,session};
}
const reportsBy=(p,type='progress')=>records('reports',P).filter(r=>(r.authorId===p.id||r.author===p.name)&&(r.reportType??'progress')===type);
const issuesFrom=id=>records('issues',P).filter(i=>i.raisedByReport===id);
const issuesNamed=text=>records('issues',P).filter(i=>i.description===text);
const variationsFrom=id=>records('variations',P).filter(v=>JSON.stringify(v).includes(id));
const photosOf=r=>r.observations.reduce((s,o)=>s+o.photos.length,0);
const port=4477,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-update-anywhere',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  let n=0;
  /**
   * A fresh engineer on a fresh phone, with today's update started: a progress
   * card with a photo, a defect with a photo and a variation, all saved.
   * `gate.mode` decides what happens to this report's saves and sends and to
   * photo uploads, from any tab: 'open', 'cut' (no answer, as with no
   * signal) or 'slow'; `gate.puts` / `gate.posts` count those that reached RELAY.
   */
  async function phone(scheme,width){
    const who=person(++n),wide=width>800;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:who.session,url:base}]);
    const gate={mode:'open',puts:0,posts:0,id:''};
    const pass=async route=>{
      const method=route.request().method();
      if(method==='GET')return route.continue();
      if(gate.mode==='cut')return route.abort('internetdisconnected');
      if(gate.mode==='slow')await new Promise(r=>setTimeout(r,1500));
      if(route.request().url().includes(`/api/reports/${gate.id}`)){if(method==='PUT')gate.puts++;if(method==='POST')gate.posts++;}
      return route.continue().catch(()=>undefined);
    };
    await context.route(u=>gate.id&&u.pathname===`/api/reports/${gate.id}`,pass);
    await context.route('**/api/media/**',pass);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const label=`${scheme} ${width}`;
    const shot=async(name,p=page)=>{if(shots){await p.waitForTimeout(300);await p.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:false});}};
    await page.goto(`${base}/engineer?project=${P}`);
    await page.getByRole('button',{name:/Start today’s site update/}).click();await page.waitForURL(/\/reports\/rep-/);
    const id=page.url().split('/reports/')[1].split(/[?#]/)[0];gate.id=id;
    const card=()=>wide?page.locator('#card-editor .eng-card').last():page.locator('.eng-slot.open');
    await card().waitFor();
    await card().getByLabel('Where',{exact:true}).fill('Level 3 corridor');
    await card().locator('textarea').first().fill('Containment complete');
    await card().locator('input[type=file]').first().setInputFiles({name:'a.jpg',mimeType:'image/jpeg',buffer:await jpeg('#996633')});
    await card().getByText('On the server').last().waitFor({timeout:15000});
    const done=async()=>{if(!wide)await card().getByRole('button',{name:'Done with this card'}).click();};
    await done();
    await page.locator('.eng-add-kinds').getByRole('button',{name:'+ Defect'}).first().click();
    await card().getByLabel('Where',{exact:true}).fill('Flat 1.01');
    await card().locator('textarea').first().fill('Cracked socket faceplate');
    await card().locator('input[type=file]').first().setInputFiles({name:'b.jpg',mimeType:'image/jpeg',buffer:await jpeg('#336699')});
    await card().getByText('On the server').last().waitFor({timeout:15000});
    await done();
    await page.locator('.eng-add-kinds').getByRole('button',{name:'+ Variation'}).first().click();
    await card().getByLabel('Where',{exact:true}).fill('Flat 1.01');
    await card().locator('textarea').first().fill('Move a socket 300mm left');
    await card().getByRole('button',{name:'Not yet',exact:true}).click();
    await done();
    await page.locator('.savestate b').filter({hasText:/Saved on server/}).waitFor({timeout:15000});
    return {who,context,page,errors,id,label,shot,gate,wide};
  }
  const toCheck=async page=>{await page.getByRole('button',{name:/Check & send/}).last().click();await page.locator('#report-check').waitFor();};
  const sendButton=page=>page.locator('.actionbar').getByRole('button',{name:/Send to office|Try now/});
  const waitingNote=page=>page.locator('.eng-send-waiting');
  const line=page=>page.locator('.held-send-waiting');
  const sentNote=page=>page.locator('.held-send .note-ok').filter({hasText:/sent to the office by itself/});
  const marker=page=>page.evaluate(()=>localStorage.getItem('relay-send-on-signal'));
  const noSideways=async(page,label)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${label}: no sideways scroll`);

  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    // 1. Sent with no signal, then on to another page: it goes from there, once, photographs and all.
    {
      const {who,context,page,errors,id,label,shot,gate,wide}=await phone(scheme,width);
      await context.setOffline(true);
      if(!wide){
        // A photograph taken with no signal, only on the phone when Send is tapped.
        await page.locator('.eng-cardrow').first().click();
        await page.locator('.eng-slot.open input[type=file]').first().setInputFiles({name:'c.jpg',mimeType:'image/jpeg',buffer:await jpeg('#669933')});
        await page.locator('.eng-slot.open').getByRole('button',{name:'Remove photo 2'}).waitFor();
        await page.locator('.eng-slot.open').getByRole('button',{name:'Done with this card'}).click();
      }
      await toCheck(page);
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      ok(await line(page).count()===0,`${label}: on the report itself only its own waiting note shows, not the line as well`);
      // Off to the Site page. RELAY's answers stay cut off, so it can only wait.
      gate.mode='cut';
      await context.setOffline(false);
      await page.locator('a.back').first().click();
      await page.waitForURL(/\/engineer/);
      await context.setOffline(true);
      await line(page).waitFor({timeout:10000});
      const words=await line(page).innerText();
      ok(/^Waiting for signal\./.test(words),`${label} elsewhere: the line says waiting for signal (${words})`);
      ok(/Your site update is kept on this phone and goes to the office by itself as soon as there is signal, while RELAY is open\./.test(words),`${label} elsewhere: in the defect's words, about the site update (${words})`);
      ok(await page.locator('.held-send-waiting').count()===1,`${label} elsewhere: one line`);
      const tile=page.locator('.eng-tile-main');
      ok(/Send today’s update/.test(await tile.innerText())&&/goes to the office by itself once there is signal/.test(await tile.innerText()),`${label} elsewhere: the home tile says it is not sent yet and goes by itself`);
      ok(getRecord('reports',id).state==='draft',`${label} elsewhere: nothing reached the office yet`);
      await noSideways(page,label);
      await shot('update-waiting-elsewhere');
      // Signal back, on the Site page: nobody taps anything.
      gate.mode='open';
      await context.setOffline(false);
      await sentNote(page).waitFor({timeout:30000});
      const note=await sentNote(page).innerText();
      ok(/^Site update sent to the office by itself once there was signal: [0-9A-Z]+-SPR-\d+\./.test(note),`${label} elsewhere: says it went by itself, with its reference (${note})`);
      ok(await sentNote(page).getByRole('link',{name:'Open it'}).getAttribute('href')===`/reports/${id}`,`${label} elsewhere: links to the sent report`);
      await line(page).waitFor({state:'detached',timeout:5000});
      ok(true,`${label} elsewhere: the waiting line has gone`);
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].id===id&&mine[0].state==='submitted',`${label} elsewhere: exactly one report reached the office (${mine.length})`);
      ok(gate.posts===1,`${label} elsewhere: sent once (${gate.posts} sends)`);
      ok(issuesFrom(id).length===1&&variationsFrom(id).length===1,`${label} elsewhere: one issue, one variation (${issuesFrom(id).length}, ${variationsFrom(id).length})`);
      const photos=wide?2:3;
      ok(mine[0].observations.length===3&&photosOf(mine[0])===photos,`${label} elsewhere: all three cards and ${photos} photographs went (${photosOf(mine[0])})`);
      for(const p of mine[0].observations.flatMap(o=>o.photos))ok((await context.request.get(`${base}${p.dataUrl}`)).ok(),`${label} elsewhere: photograph ${p.id} is on the server`);
      ok(await marker(page)===null,`${label} elsewhere: nothing left waiting on the phone`);
      await page.getByRole('button',{name:/Start today’s site update/}).waitFor({timeout:10000});
      ok(true,`${label} elsewhere: home is back to "Start today’s site update"`);
      await shot('update-sent-elsewhere');
      // Opening it shows it sent, with nothing offered as unsent.
      await sentNote(page).getByRole('link',{name:'Open it'}).click();
      await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:15000});
      ok(!/not in the sent report/i.test(await page.locator('main').innerText()),`${label} elsewhere: the report opens sent, nothing left over`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    if(width>800)continue;
    // 2. Closed before signal came back: opening RELAY on any page sends it.
    {
      const {who,context,page,errors,id,label}=await phone(scheme,width);
      await toCheck(page);
      await context.setOffline(true);
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      await page.close();
      await context.setOffline(false);
      const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
      await other.goto(`${base}/my-week`);
      await sentNote(other).waitFor({timeout:15000});
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].state==='submitted'&&issuesFrom(id).length===1&&variationsFrom(id).length===1,`${label} reopened on My week: it went, once`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    if(scheme!=='light')continue;
    // 3. A site update, a defect and a signed inspection all waiting on one phone,
    // RELAY open in two tabs, one reloaded part-way, "Try now" tapped as it goes.
    {
      const {who,context,page:a,errors,id,label,shot,gate}=await phone(scheme,width);
      const b=await context.newPage();b.on('pageerror',e=>errors.push(e.message));
      // The defect, written in tab B and sent with no signal.
      await b.goto(`${base}/engineer?project=${P}&view=defect`);
      await b.getByLabel('Where on site?',{exact:true}).waitFor();
      await b.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'d.jpg',mimeType:'image/jpeg',buffer:await jpeg('#aa3322')});
      await b.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
      await b.getByLabel('What needs attention?',{exact:true}).fill('Loose trunking lid in riser');
      await b.getByLabel('Where on site?',{exact:true}).fill('Riser cupboard, level 3');
      // An inspection signed on this phone with no signal, held to go up by itself.
      const insp=createReport(P,who.name,who,'handover-inspection');
      const answered=insp.observations.map(o=>o.check?{...o,check:{...o.check,answer:'ok'}}:o);
      await b.evaluate(async held=>{await new Promise((res,rej)=>{const r=indexedDB.open('relay-drafts',2);r.onupgradeneeded=()=>r.result.createObjectStore('unsent',{keyPath:'key'});r.onsuccess=()=>{const tx=r.result.transaction('unsent','readwrite');tx.objectStore('unsent').put(held);tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});},
        {key:`${who.id}::${insp.id}`,reportId:insp.id,principalId:who.id,seq:'signed-1',observations:answered,heldAt:new Date().toISOString(),baseVersion:insp.version,report:insp,heldOffline:true,
         signed:{name:who.name,typed:true,signedAt:new Date().toISOString(),content:signedContent(answered)}});
      await context.setOffline(true);
      await b.getByRole('button',{name:/^Send defect to /}).click();
      await b.getByRole('heading',{name:'Defect not sent yet',exact:true}).waitFor({timeout:10000});
      ok(await line(b).count()===0,`${label} three waiting: the defect screen shows its own words, not the line as well`);
      await toCheck(a);
      await sendButton(a).click();
      await waitingNote(a).waitFor({timeout:10000});
      // Tab B moves on to the Site page; RELAY's answers stay cut off until it gets there.
      gate.mode='cut';
      await context.route('**/api/issues',r=>gate.mode==='cut'&&r.request().method()==='POST'?r.abort('internetdisconnected'):r.continue());
      await context.setOffline(false);
      await b.goto(`${base}/engineer?project=${P}`);
      await context.setOffline(true);
      await line(b).waitFor({timeout:10000});
      const words=await line(b).innerText();
      ok(/Your site update and a defect are kept on this phone and go to the office by themselves as soon as there is signal, while RELAY is open\./.test(words),`${label} three waiting: one line names both (${words})`);
      await shot('three-waiting',b);
      // Signal back slowly: tab B is reloaded while the first try is on its way, and tab A taps "Try now".
      gate.mode='slow';
      await context.setOffline(false);
      await b.waitForTimeout(400);
      await b.reload();
      if(await sendButton(a).isEnabled().catch(()=>false))await sendButton(a).click().catch(()=>undefined);
      gate.mode='open';
      await a.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:40000});
      await b.waitForFunction(()=>!localStorage.getItem('relay-send-on-signal')&&!Object.keys(localStorage).some(k=>k.startsWith('relay-defect:')&&JSON.parse(localStorage.getItem(k)).pending),null,{timeout:40000});
      for(let i=0;i<40&&getRecord('reports',insp.id)?.state!=='submitted';i++)await b.waitForTimeout(500);
      await b.waitForTimeout(2000);
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].state==='submitted',`${label} three waiting: one site update reached the office (${mine.length})`);
      ok(gate.posts===1,`${label} three waiting: the site update was sent once (${gate.posts} sends)`);
      ok(issuesFrom(id).length===1&&variationsFrom(id).length===1,`${label} three waiting: one issue and one variation from it`);
      ok(photosOf(mine[0])===2,`${label} three waiting: both photographs with it`);
      ok(issuesNamed('Loose trunking lid in riser').length===1,`${label} three waiting: the defect raised one issue (${issuesNamed('Loose trunking lid in riser').length})`);
      const sentInsp=getRecord('reports',insp.id);
      ok(sentInsp.state==='submitted'&&sentInsp.signature?.typed===true&&reportsBy(who,'handover-inspection').length===1,`${label} three waiting: the signed inspection went once, signed`);
      ok(sentInsp.observations.every(o=>!o.check||o.check.answer==='ok'),`${label} three waiting: the inspection went with all its answers`);
      ok(await line(b).count()===0&&await line(a).count()===0,`${label} three waiting: no waiting line left in either tab`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    // 4. Taken back to the cards in another tab after Send: changed, so it waits to be sent again by hand.
    {
      const {who,context,page:a,errors,id,label,gate}=await phone(scheme,width);
      await toCheck(a);
      await context.setOffline(true);
      await sendButton(a).click();
      await waitingNote(a).waitFor({timeout:10000});
      gate.mode='cut';
      await context.setOffline(false);
      await a.goto(`${base}/engineer?project=${P}`);
      await line(a).waitFor({timeout:10000});
      const b=await context.newPage();b.on('pageerror',e=>errors.push(e.message));
      // Tab B opens the draft: back on Check & send, still waiting (RELAY cannot be reached).
      await b.goto(`${base}/reports/${id}`);
      await waitingNote(b).waitFor({timeout:10000});
      await b.locator('.eng-steps').getByRole('button',{name:/Cards/}).click();
      await b.locator('.eng-add-kinds').first().waitFor();
      await b.locator('.eng-cardrow').first().click();
      await b.locator('.eng-slot.open textarea').first().fill('Containment complete to grid D');
      await b.locator('.eng-slot.open').getByRole('button',{name:'Done with this card'}).click();
      await line(a).waitFor({state:'detached',timeout:10000});
      ok(await marker(a)===null,`${label} back to the cards in another tab: no longer waiting, and the other tab's line has gone`);
      await b.waitForTimeout(1000);
      await b.goto(`${base}/my-week`);
      gate.mode='open';
      await a.evaluate(()=>window.dispatchEvent(new Event('online')));
      await a.waitForTimeout(4000);
      ok(reportsBy(who)[0].state==='draft'&&gate.posts===0,`${label} back to the cards in another tab: signal back, nothing sent by itself (${gate.posts} sends)`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    // 5. The save on the way to sending reached RELAY but its answer was lost; RELAY closed,
    // then opened again in a new tab (which knows nothing of that save): it still goes, once.
    {
      const {who,context,page,errors,id,label}=await phone(scheme,width);
      await toCheck(page);
      const before=getRecord('reports',id).version;
      let cut=0;
      await page.route(u=>u.pathname===`/api/reports/${id}`,async route=>{
        if(route.request().method()==='PUT'&&!cut){cut++;await route.fetch();return route.abort('internetdisconnected');}
        if(route.request().method()!=='GET')return route.abort('internetdisconnected');
        return route.continue();
      });
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      ok(getRecord('reports',id).version>before&&getRecord('reports',id).state==='draft',`${label} lost save answer: saved on RELAY, not sent yet`);
      await page.close();
      const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
      await other.goto(`${base}/my-week`);
      await sentNote(other).waitFor({timeout:20000});
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].state==='submitted'&&issuesFrom(id).length===1,`${label} lost save answer: reopened, it went once, not refused as changed elsewhere`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
  }
  console.log(`Site update send-anywhere check passed (${checks} checks): sent with no signal and left, it goes by itself from another page once signal is back, exactly once with every card and photograph (one taken with no signal), says so with a link, and the waiting line uses the defect's words; reopened on another page it goes; a site update, a defect and a signed inspection waiting together, two tabs, a reload and "Try now" mid-send each arrive once; taken back to the cards in another tab it does not go; a save whose answer was lost, reopened in a new tab, still goes once. 390px light and dark, 1440px dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit').catch(()=>{});}
  database().close();rmSync(root,{recursive:true,force:true});
}
