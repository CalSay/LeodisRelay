// Browser check for going straight on to the next issue after putting a fix
// forward (2026-10-22). A walk of an electrician putting three fixes forward with
// a photograph and a note found each took five taps: the issue, the photograph,
// the note, "Put forward as fixed", then Back to the list for the next one, and
// after the tap the page stayed as it was, with an empty form and "Record an
// update", and nothing saying it was done.
// Now a box says "Put forward as fixed" and offers the next of the engineer's
// issues on the same site (the top of "Yours"), with where and how many are left;
// the empty form is folded under "Add a note for the office".
// Checks, at 390px light and dark: the box, the Next button in view without
// scrolling and naming the top of "Yours" (never the one just done, never another
// site), focus moves to the box (and stays in a note typed before a slow answer),
// the form is folded; Next opens that issue ready to put forward;
// four taps per fix; the last one says so and offers no Next; with no answer for
// the next issue the box still shows with Back; opened later, a fixed issue shows
// the plain note and the fold still records an update; the office's page keeps
// its own buttons; no sideways scroll, axe, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-fix-forward-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {getIssue}=require('../apps/web/.test-build/lib/issueStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const sam=person('ff-sam','Sam Spark','Engineer','Electrical'),hana=person('ff-hana','Hana Holt','Engineer','HVAC'),jo=person('ff-jo','Jo Office','Manager');
const sessions={};
for(const p of [sam,hana,jo]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const today=londonDay(new Date());
const addDays=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const T='proj-011lme',K='proj-014lme';
const WHAT=['Socket face plate cracked','Light switch loose','Cable tray unsupported','Fire collar missing','Spur not labelled','Downlight not working'];
// Six Electrical issues on Tetley Hall, one newer one on Kirkstall Gate (never offered as next on Tetley Hall),
// and one for another trade (never yours). Sam's list is newest change first: 806, 805 ... 801.
const seed=async(id,project,description,location,day,trade='Electrical',work='assigned')=>{
  const raisedAt=`${addDays(day)}T09:00:00.000Z`,pid=randomUUID();
  await putMedia(pid,{issueId:id,ownerId:sam.id,mime:'image/png'},await sharp({create:{width:640,height:480,channels:3,background:'#7a3b2a'}}).png().toBuffer());
  putRecord('issues',{id,reference:`DEMO-${project===T?'011LME':'014LME'}-ISS-${id}`,projectId:project,source:'individual',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',affectedTrade:trade,location,description,actionNeeded:'',confirmation:'confirmed',work,owner:'Acme Electrical',targetDate:addDays(day+12),raisedAt,
    events:[{at:raisedAt,actor:sam.name,actorId:sam.id,kind:'raised',note:'',photos:[{id:pid,dataUrl:`/api/media/${pid}`,caption:'',capturedAt:raisedAt}]},{at:`${addDays(day)}T10:00:00.000Z`,actor:jo.name,actorId:jo.id,kind:'assigned',to:'Acme Electrical',targetDate:addDays(day+12),note:'',photos:[]}]});
};
for(let n=0;n<6;n++)await seed(String(801+n),T,WHAT[n],`Flat ${n+1}.0${n+1}`,-10+n);
await seed('820',K,'Isolator missing at Kirkstall','Plant room',0);
await seed('830',T,'Basin tap dripping','Flat 9.09',0,'P&H');
// Hana's two, for the dark run and the "no answer" run; one already put forward, for opening later.
await seed('840',T,'Hana: smoke head loose','Flat 7.01',-3);
await seed('841',T,'Hana: earth bond missing','Flat 7.02',-2);
await seed('842',T,'Already put forward','Flat 7.03',-4,'Electrical','awaiting_verification');
{const i=getIssue('830');putRecord('issues',{...i,reportedBy:'Pat Pipe',reportedById:'entra:ff-pat',events:i.events.map(e=>e.kind==='raised'?{...e,actor:'Pat Pipe',actorId:'entra:ff-pat'}:e)});}
for(const id of ['840','841','842']){const i=getIssue(id);putRecord('issues',{...i,reportedBy:hana.name,reportedById:hana.id,affectedTrade:'HVAC',events:i.events.map(e=>e.kind==='raised'?{...e,actor:hana.name,actorId:hana.id}:e)});}

const port=4489,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-fix-forward',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
const png=async colour=>sharp({create:{width:320,height:240,channels:3,background:colour}}).png().toBuffer();
const flat=s=>s.replace(/\s+/g,' ').trim();
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const open=async(who,scheme,width=390)=>{
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:scheme,hasTouch:width===390});
    await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    return {context,page,errors};
  };
  const shot=async(page,name)=>{if(shots)await page.screenshot({path:join(shots,`after-${name}.png`)});};
  const offScreen=async l=>l.evaluate(e=>{const b=e.getBoundingClientRect(),bar=document.querySelector('.appbar')?.getBoundingClientRect().bottom??0;return Math.round(Math.max(0,b.bottom-innerHeight,bar-b.top));});
  const sideways=page=>page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,3).join(', ')}`));ok(!found.length,`${label}: axe found ${found.join('; ')}`);};
  // Every tap the engineer makes is counted here; choosing the photograph counts as one tap.
  let taps=0;const tap=async l=>{await l.click();taps++;};
  // Puts the open issue forward with a photograph and a note.
  const putForward=async(page,colour='#2f6b45')=>{
    await page.getByRole('button',{name:'Put forward as fixed'}).waitFor();
    await page.locator('label.camera input[type=file]').setInputFiles({name:'fixed.png',mimeType:'image/png',buffer:await png(colour)});taps++;
    await page.locator('.shots img[alt^="New evidence"]').first().waitFor();
    await tap(page.locator('#note'));await page.locator('#note').fill('Replaced and tested');
    await tap(page.getByRole('button',{name:'Put forward as fixed'}));
    await page.locator('.issue-eng-done').waitFor({timeout:15000});
  };
  const doneText=async page=>flat(await page.locator('.issue-eng-done').innerText());

  // Sam, light: every Tetley Hall issue, one after another, from the Issues tab.
  {
    const {context,page,errors}=await open(sam,'light');
    await page.goto(`${base}/engineer?project=${T}&view=issues`);
    const first=page.locator('a.eng-issue-card').first();await first.waitFor();
    ok((await first.innerText()).includes('Downlight not working'),`Yours starts with the newest change: ${await first.innerText()}`);
    taps=0;await tap(first);
    const expected=['806','805','804','803','802','801'];
    for(let k=0;k<expected.length;k++){
      const id=expected[k];
      await page.waitForURL(new RegExp(`/issues/${id}\\?`));
      await page.locator('.issue-eng-title',{hasText:getIssue(id).description}).waitFor();
      ok(!(await page.locator('.issue-eng-done').count())&&await page.getByRole('button',{name:'Put forward as fixed'}).isVisible()&&await page.locator('#note').inputValue()==='',`${id}: opens ready to put forward, with an empty note`);
      await putForward(page);
      ok(getIssue(id).work==='awaiting_verification',`${id}: put forward on the server`);
      const box=page.locator('.issue-eng-done');
      ok(await page.evaluate(()=>document.activeElement?.classList.contains('issue-eng-done')),`${id}: focus moves to the box`);
      ok(await page.locator('#note').isHidden(),`${id}: the empty form is folded away`);
      ok(await page.locator('details.issue-eng-add summary',{hasText:'Add a note for the office'}).isVisible(),`${id}: "Add a note for the office" is offered`);
      ok(!(await page.getByRole('button',{name:'Put forward as fixed'}).count()),`${id}: no second Put forward`);
      const left=expected.length-k-1;
      if(left){
        const next=page.locator('a.issue-eng-next');await next.waitFor();
        const nextIssue=getIssue(expected[k+1]);
        const words=flat(await next.innerText());
        ok(words.includes(`Next: ${nextIssue.description}`)&&words.includes(nextIssue.location)&&words.includes(`${left} to do on this site`),`${id}: Next names ${expected[k+1]}, where, and ${left} left: ${words}`);
        ok(!/Kirkstall|Basin|Hana/.test(await doneText(page)),`${id}: never another site, trade or engineer's issue`);
        ok(await offScreen(next)===0&&await offScreen(box.locator('h2'))===0,`${id}: the box and Next are on screen without scrolling`);
        ok(/Back to Issues/.test(await box.locator('a.eng-secondary').innerText()),`${id}: Back to Issues offered`);
        if(k===0){await shot(page,'put-forward-light-390');ok(!(await sideways(page)),'no sideways scroll');await axe(page,'box, light');}
        await tap(next);
      } else {
        await page.locator('.issue-eng-done strong').waitFor();
        ok((await doneText(page)).includes('That was the last one for you on Tetley Hall'),'last: says it was the last one');
        ok(!(await page.locator('a.issue-eng-next').count()),'last: no Next');
        await shot(page,'last-one-light-390');
      }
    }
    console.log(`Six fixes put forward in ${taps} taps from the Issues list: the first issue, then photograph, note, Put forward and Next for each (four a fix; it was five, with Back and the next card).`);
    ok(taps===24,`four taps a fix after the first: ${taps}`);
    // Back goes to the Issues list, now with nothing to do here but Kirkstall's still listed.
    await page.locator('.issue-eng-done a.eng-secondary').click();
    await page.waitForURL(/view=issues/);await page.getByText('6 put forward as fixed, waiting for the office to check').waitFor();
    ok(true,'Back to Issues counts the six as waiting');
    // Opened later: the plain note, and the fold still records an update.
    await page.goto(`${base}/issues/803`);await page.locator('.note',{hasText:'Put forward as fixed. It is waiting for the office to check it.'}).waitFor();
    ok(!(await page.locator('.issue-eng-done').count()),'opened later: no Next box');
    await page.locator('details.issue-eng-add summary').click();
    await page.locator('#note').fill('Label printed too');
    await page.getByRole('button',{name:'Record an update'}).click();
    await page.locator('details.issue-eng-add summary').waitFor();
    for(let n=0;n<20&&getIssue('803').events.at(-1).note!=='Label printed too';n++)await new Promise(r=>setTimeout(r,250));
    ok(getIssue('803').events.at(-1).kind==='progress'&&getIssue('803').work==='awaiting_verification','opened later: the fold records an update and it stays fixed, to check');
    await shot(page,'opened-later-light-390');
    assert.deepEqual(errors,[],'Sam light: page errors');
    await context.close();
  }

  // Hana, dark: no answer for the next issue still says it was put forward, with Back.
  {
    const {context,page,errors}=await open(hana,'dark');
    await page.route('**/api/issues?only=yours',r=>r.abort());
    await page.goto(`${base}/issues/841?returnTo=${encodeURIComponent(`/engineer?project=${T}&view=issues`)}`);
    await putForward(page,'#1f4b65');
    await page.waitForTimeout(800);
    const words=await doneText(page);
    ok(words.includes('Put forward as fixed')&&words.includes('Back to Issues')&&!(await page.locator('a.issue-eng-next').count())&&!words.includes('last one'),`no answer: box with Back, no Next, no "last one": ${words}`);
    await page.unroute('**/api/issues?only=yours');
    // With an answer, Hana's next is her own, never Sam's or the one already waiting.
    // A slow answer: the engineer opens "Add a note for the office" and types before it comes; focus stays in the note.
    await page.route('**/api/issues?only=yours',async r=>{await new Promise(x=>setTimeout(x,2500));await r.continue();});
    await page.goto(`${base}/issues/840?returnTo=${encodeURIComponent(`/engineer?project=${T}&view=issues`)}`);
    await putForward(page,'#1f4b65');
    ok(!(await page.locator('.issue-eng-done strong').count()),'slow answer: the next issue is not known yet');
    await page.locator('details.issue-eng-add summary').click();await page.locator('#note').click();await page.keyboard.type('Also');
    await page.locator('.issue-eng-done strong').waitFor();await page.waitForTimeout(300);
    ok(await page.evaluate(()=>document.activeElement?.id==='note'),'slow answer: focus stays in the note being typed');
    await page.locator('#note').fill('');await page.locator('details.issue-eng-add summary').click();
    ok((await doneText(page)).includes('That was the last one for you on Tetley Hall'),'dark: Hana has none left (the waiting one is not offered)');
    await shot(page,'last-one-dark-390');
    ok(!(await sideways(page)),'dark: no sideways scroll');await axe(page,'box, dark');
    assert.deepEqual(errors,[],'Hana dark: page errors');
    await context.close();
  }

  // The office's issue page keeps its own buttons and shows no box.
  {
    const {context,page,errors}=await open(jo,'dark',1440);
    await page.goto(`${base}/issues/842`);await page.locator('.titleblock').waitFor();
    ok(await page.getByRole('button',{name:'Verify and close'}).isVisible(),'office: Verify and close');
    ok(!(await page.locator('.issue-eng-done,details.issue-eng-add').count()),'office: no engineer box or fold');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }
  console.log(`Fix forward check passed (${checks} checks): Put forward says so and offers the next of yours on the site; four taps a fix; last one said; no answer still shows Back; opened later folds the form; office unchanged; light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally { await browser?.close();server.kill();rmSync(root,{recursive:true,force:true}); }
