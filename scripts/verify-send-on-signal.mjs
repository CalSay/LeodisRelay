// Browser check for sending with no signal (2026-10-21): "Send to office" with
// the phone's signal off says "Waiting for signal" and keeps the report on the
// phone; once signal is back it goes to the office by itself, exactly once
// (one sent report, one issue, one variation). Closed before signal came back,
// the home screen says "Send today's update" until RELAY answers, then it goes
// from there by itself (verify-update-send-anywhere.mjs covers other pages).
// Going back to the cards (step button or the phone's Back), changing the
// signature or "Don't send yet" stops it going by itself. A send whose
// answer was lost on the way back makes one report, not two. 390px light and
// dark, 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-send-on-signal-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const P='proj-011lme';
const jpeg=colour=>sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer();
const people=[];
function person(n){
  const p={id:`entra:sos-${n}`,oid:`sos-${n}`,name:`Sam Signal ${n}`,email:`sam${n}@example.test`,role:'Engineer',trade:'Electrical'};
  const session=randomUUID();putRecord('sessions',{id:session,principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
  people.push(p);return {...p,session};
}
const reportsBy=p=>records('reports',P).filter(r=>r.authorId===p.id||r.author===p.name);
const issuesFrom=id=>records('issues',P).filter(i=>i.raisedByReport===id);
const variationsFrom=id=>records('variations',P).filter(v=>JSON.stringify(v).includes(id));
const port=4471,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-send-on-signal',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  let n=0;
  /** A fresh engineer on a fresh phone, with today's update started: a progress card with a photo, a defect and a variation. */
  async function phone(scheme,width){
    const who=person(++n);
    const context=await browser.newContext({viewport:{width,height:width>800?900:844},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:who.session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    const label=`${scheme} ${width}`;
    const shot=async name=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:false});};
    await page.goto(`${base}/engineer?project=${P}`);
    await page.getByRole('button',{name:/Start today’s site update/}).click();await page.waitForURL(/\/reports\/rep-/);
    const id=page.url().split('/reports/')[1].split(/[?#]/)[0];
    const card=()=>width>800?page.locator('#card-editor .eng-card').last():page.locator('.eng-slot.open');
    await card().waitFor();
    await card().getByLabel('Where',{exact:true}).fill('Level 3 corridor');
    await card().locator('textarea').first().fill('Containment complete');
    await card().locator('input[type=file]').first().setInputFiles({name:'a.jpg',mimeType:'image/jpeg',buffer:await jpeg('#996633')});
    await card().getByText('On the server').last().waitFor({timeout:15000});
    const done=async()=>{if(width<=800)await card().getByRole('button',{name:'Done with this card'}).click();};
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
    return {who,context,page,errors,id,label,shot};
  }
  const toCheck=async page=>{await page.getByRole('button',{name:/Check & send/}).last().click();await page.locator('#report-check').waitFor();};
  const sendButton=page=>page.locator('.actionbar').getByRole('button',{name:/Send to office|Try now/});
  const waitingNote=page=>page.locator('.eng-send-waiting');
  const noSideways=async(page,label)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${label}: no sideways scroll`);

  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    // 1. Sent with no signal, page left open: waits, then goes by itself, once.
    {
      const {who,context,page,errors,id,label,shot}=await phone(scheme,width);
      await toCheck(page);
      await context.setOffline(true);
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      const note=await waitingNote(page).innerText();
      ok(/Waiting for signal\./.test(note)&&/goes to the office by itself as soon as this phone has signal/.test(note),`${label} open page: says it is waiting for signal and goes by itself (${note})`);
      ok(/kept on this phone/.test(note),`${label} open page: says the work is kept on the phone`);
      ok(!/try again when you have signal/i.test(await page.locator('main').innerText()),`${label} open page: no longer asks the engineer to try again`);
      ok(/Not sent yet · goes by itself/.test(await page.locator('.savestate').innerText()),`${label} open page: the bar says not sent yet, goes by itself`);
      ok(await sendButton(page).innerText()==='Try now',`${label} open page: the button offers to try now`);
      ok(getRecord('reports',id).state==='draft',`${label} open page: nothing reached the office while offline`);
      const box=await waitingNote(page).getByRole('button',{name:'Don’t send yet'}).boundingBox();
      ok(box&&box.height>=44,`${label} open page: "Don’t send yet" is a fingertip tall (${box?.height})`);
      await noSideways(page,label);
      await shot('waiting');
      // Signal back: nobody taps anything.
      await context.setOffline(false);
      await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:30000});
      ok(/Sent to the office by itself/.test(await page.locator('main').innerText()),`${label} open page: says it went by itself`);
      await shot('sent-by-itself');
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].id===id&&mine[0].state==='submitted',`${label} open page: exactly one report reached the office (${mine.length})`);
      ok(issuesFrom(id).length===1,`${label} open page: the defect raised one issue (${issuesFrom(id).length})`);
      ok(variationsFrom(id).length===1,`${label} open page: the variation raised one variation (${variationsFrom(id).length})`);
      ok(mine[0].observations.length===3&&mine[0].observations.reduce((s,o)=>s+o.photos.length,0)===2,`${label} open page: all three cards and both photographs went`);
      ok(await page.evaluate(()=>localStorage.getItem('relay-send-on-signal'))===null,`${label} open page: nothing left waiting on the phone`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    if(width>800)continue;
    // 2. Sent with no signal, then RELAY closed: home says so, and opening it sends it.
    {
      const {who,context,page,errors,id,label,shot}=await phone(scheme,width);
      await toCheck(page);
      await context.setOffline(true);
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      await page.close();
      // RELAY opens with no answer for this report yet, so the home screen can be read first.
      const cutOff=`**/api/reports/${id}`,noAnswer=r=>r.request().method()==='GET'?r.continue():r.abort('internetdisconnected');
      await context.route(cutOff,noAnswer);
      await context.setOffline(false);
      const home=await context.newPage();home.on('pageerror',e=>errors.push(e.message));
      await home.goto(`${base}/engineer?project=${P}`);
      const tile=home.locator('.eng-tile-main');
      await tile.filter({hasText:'Send today’s update'}).waitFor({timeout:10000});
      const words=await tile.innerText();
      ok(/Not sent yet: there was no signal/.test(words)&&!/Carry on/.test(words),`${label} closed: home says today’s update is not sent yet, not "Carry on" (${words})`);
      ok(getRecord('reports',id).state==='draft',`${label} closed: nothing went while RELAY was closed`);
      ok(await home.locator('section[aria-labelledby="eng-unfinished-title"] .eng-row',{hasText:/SPR-/}).count()===0,`${label} closed: not listed again under Unfinished reports`);
      if(shots)await home.screenshot({path:join(shots,`${prefix}-home-not-sent-${scheme}-${width}.png`),fullPage:false});
      ok(/goes to the office by itself once there is signal/.test(words),`${label} closed: home says it goes by itself (${words})`);
      // RELAY answers again: it goes from the home screen by itself (2026-10-21), no tap needed.
      await context.unroute(cutOff,noAnswer);
      await home.evaluate(()=>window.dispatchEvent(new Event('online')));
      await home.locator('.held-send .note-ok').filter({hasText:/Site update sent to the office by itself/}).waitFor({timeout:8000});
      ok(true,`${label} closed: once RELAY answered it went from home by itself, and said so`);
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].state==='submitted'&&issuesFrom(id).length===1&&variationsFrom(id).length===1,`${label} closed: one report, one issue, one variation`);
      await home.goto(`${base}/engineer?project=${P}`);await home.getByRole('button',{name:/Start today’s site update/}).waitFor();
      ok(await home.getByText('Send today’s update').count()===0,`${label} closed: home is back to "Start today’s site update"`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      void shot;
      await context.close();
    }
    if(scheme!=='light')continue;
    // 3. "Don't send yet", and going back to the cards, stop it going by itself.
    {
      const {who,context,page,errors,id,label}=await phone(scheme,width);
      await toCheck(page);
      await context.setOffline(true);
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      await waitingNote(page).getByRole('button',{name:'Don’t send yet'}).click();
      ok(await waitingNote(page).count()===0&&await sendButton(page).innerText()==='Send to office',`${label} don’t send yet: the note goes and the button is Send to office again`);
      const marker=()=>page.evaluate(()=>localStorage.getItem('relay-send-on-signal'));
      ok(await marker()===null,`${label} don’t send yet: nothing left waiting on the phone`);
      // Changing the signature after tapping Send: it waits for Send again.
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      await page.getByLabel('Your name').fill('S. Signal');
      ok(await waitingNote(page).count()===0&&await marker()===null,`${label} signature changed: no longer goes by itself`);
      await page.getByLabel('Your name').blur();
      // The phone's own Back from Check & send: the same.
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      await page.goBack();
      await page.locator('.eng-add-kinds').first().waitFor();
      ok(await marker()===null,`${label} phone Back: no longer goes by itself`);
      await toCheck(page);
      await context.setOffline(false);
      await page.waitForTimeout(3000);
      ok(getRecord('reports',id).state==='draft',`${label} don’t send yet: signal back, nothing sent`);
      // Waiting again, then back to the cards to change something.
      await context.setOffline(true);
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      await page.locator('.eng-steps').getByRole('button',{name:/Cards/}).click();
      await page.locator('.eng-add-kinds').first().waitFor();
      ok(await marker()===null,`${label} back to the cards: nothing left waiting on the phone`);
      await context.setOffline(false);
      await page.waitForTimeout(3000);
      ok(getRecord('reports',id).state==='draft',`${label} back to the cards: signal back, nothing sent until Send is tapped again`);
      await page.locator('.eng-cardrow').first().click();
      await page.locator('.eng-slot.open textarea').first().fill('Containment complete to grid C');
      await page.locator('.eng-slot.open').getByRole('button',{name:'Done with this card'}).click();
      await toCheck(page);
      ok(await waitingNote(page).count()===0,`${label} back to the cards: Check & send shows no waiting note`);
      await sendButton(page).click();
      await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:20000});
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].observations[0].whatHappened==='Containment complete to grid C',`${label} back to the cards: the changed version is what was sent`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    // 4. Sent, but the answer was lost on the way back: one report, not two.
    {
      const {who,context,page,errors,id,label}=await phone(scheme,width);
      await toCheck(page);
      let cut=0;
      await page.route(`**/api/reports/${id}`,async route=>{
        if(route.request().method()==='POST'&&!cut){cut++;await route.fetch();await route.abort('internetdisconnected');}
        else await route.continue();
      });
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      ok(getRecord('reports',id).state==='submitted',`${label} lost answer: the send reached the server`);
      await page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:30000});
      const mine=reportsBy(who);
      ok(mine.length===1&&issuesFrom(id).length===1&&variationsFrom(id).length===1,`${label} lost answer: one report, one issue, one variation (${mine.length}, ${issuesFrom(id).length}, ${variationsFrom(id).length})`);
      ok(await page.locator('.sent-elsewhere, [data-sent-elsewhere]').count()===0&&!/changes .*not in the sent report/i.test(await page.locator('main').innerText()),`${label} lost answer: no "sent elsewhere" offer, as nothing differs`);
      ok(await page.evaluate(()=>localStorage.getItem('relay-send-on-signal'))===null,`${label} lost answer: nothing left waiting on the phone`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
    // 5. The save on the way to sending reached the server, but its answer was
    // lost; the phone comes back into view: it still goes, once.
    {
      const {who,context,page,errors,id,label}=await phone(scheme,width);
      await toCheck(page);
      const before=getRecord('reports',id).version;
      let cut=0;
      await page.route(`**/api/reports/${id}`,async route=>{
        if(route.request().method()==='PUT'&&!cut){cut++;await route.fetch();await route.abort('internetdisconnected');}
        else await route.continue();
      });
      await sendButton(page).click();
      await waitingNote(page).waitFor({timeout:10000});
      ok(getRecord('reports',id).version>before&&getRecord('reports',id).state==='draft',`${label} lost save answer: saved on the server, not sent yet`);
      await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
      await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor({timeout:30000});
      const mine=reportsBy(who);
      ok(mine.length===1&&mine[0].state==='submitted'&&issuesFrom(id).length===1,`${label} lost save answer: back in view, it went once`);
      assert.deepEqual(errors,[],`${label}: page errors`);
      await context.close();
    }
  }
  console.log(`Send on signal check passed (${checks} checks): waits with no signal and sends by itself once, from the open page and from home after closing (by itself); Don’t send yet, going back to the cards (button or phone Back) and changing the signature stop it; a lost answer (to the send or to its save) makes one report; 390px light and dark, 1440px dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit').catch(()=>{});}
  database().close();rmSync(root,{recursive:true,force:true});
}
