// Browser check for "Came back from the office" opening an issue on "Update
// this issue" (2026-10-21). An engineer tapping one of their issues on the
// Site page's "Came back from the office" lands with the photograph button,
// the note and "Put forward as fixed" in view, and still sees what is wrong
// and where on the same screen. Opening the issue any other way starts at the
// top as before; the office's view does not change.
// Light and dark at 390px; the office at 1440px dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
// RELAY_MEASURE_ONLY=1 only prints taps and scrolling (used on main for the "before" numbers).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-came-back-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {applyCommand,listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const engineer={id:'entra:cb-engineer',oid:'cb-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:cb-manager',oid:'cb-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme';
const jpeg=async colour=>'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer()).toString('base64');
const photo={id:randomUUID(),dataUrl:await jpeg('#aa7744'),caption:'Riser',capturedAt:new Date().toISOString()};
const ob=(location,whatHappened,actionNeeded)=>({id:randomUUID(),type:'defect',location,whatHappened,actionNeeded,owner:'',affectedTrade:'Electrical',photos:[photo]});
// One short issue, and one written the way engineers often write them: a few lines on what is wrong and what to do.
const SHORT={place:'Level 2 riser',what:'Fire stopping missing round the cable tray',todo:'Fire stop the riser penetrations'};
const LONG={place:'Level 4 east corridor ceiling void',what:'Fire stopping missing round the cable tray where it passes through the compartment wall above the corridor ceiling, both sides, and the tray is not supported for the last two metres',todo:'Fire stop both sides of the wall with the approved collar and batt, add two tray supports, and leave the ceiling tiles out so the office can check it'};
const LONG_LIGHT={...LONG,place:'Level 5 east corridor ceiling void'};
// Too much to fit: the page scrolls only as far as keeps what is wrong below the app bar.
const LONGEST={place:'Level 6 west stair core, at the landing',what:`${LONG.what}. ${LONG.what}`,todo:`${LONG.todo}. ${LONG.todo}`};
const r=createReport(P,engineer.name,engineer,'progress');
const saved=saveDraft(r.id,{...r,observations:[ob(SHORT.place,SHORT.what,SHORT.todo),ob(LONG.place,LONG.what,LONG.todo),ob(LONG_LIGHT.place,LONG.what,LONG.todo),ob(LONGEST.place,LONGEST.what,LONGEST.todo),ob('Flat 3.02','Socket face plate cracked','Replace the face plate')]},r.version).value;
assert.ok((await submitReport(r.id,undefined,saved.version,engineer.name)).ok);
const target=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const issueAt=place=>listIssues(P).find(i=>i.location===place);
// The office answers on all but the face plate, so they are the newest rows under "Came back from the office".
for(const c of [SHORT,LONG,LONG_LIGHT,LONGEST])assert.ok(applyCommand(issueAt(c.place).id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'Over to Northbank, key from the site office',owner:'Northbank Electrical',targetDate:target}).ok);
const port=4437,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-came-back',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const measureOnly=process.env.RELAY_MEASURE_ONLY==='1';
let browser,checks=0;const ok=(value,message)=>{if(measureOnly)return;assert.ok(value,message);checks++;};
const SAFETY_WORDS=/toolbox|permit|deliveries|safety action|safety inspection|tower/i;
const shotFile=new Uint8Array(Buffer.from(photo.dataUrl.split(',')[1],'base64'));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,c] of [['light',SHORT],['dark',LONG],['light',LONG_LIGHT],['light',LONGEST]]){
    const at=`${scheme} ${c===SHORT?'short':c===LONGEST?'longest':'long'}`;
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme,hasTouch:true});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const issue=issueAt(c.place);
    const shot=async(name,fullPage=false)=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}-${at.replace(' ','-')}-390.png`),fullPage});};
    let taps=0;const tap=async l=>{await l.scrollIntoViewIfNeeded();await l.click();taps++;};
    // Where a control sits against the screen the engineer sees, below the sticky app bar: 0 means wholly in view.
    const offScreen=async l=>l.evaluate(e=>{const b=e.getBoundingClientRect(),bar=document.querySelector('.appbar')?.getBoundingClientRect().bottom??0;return Math.round(Math.max(0,b.bottom-innerHeight,bar-b.top));});
    await page.goto(`${base}/engineer?project=${P}`);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();
    const row=page.locator(`.eng-list a.eng-row[href^="/issues/${issue.id}"]`).first();await row.waitFor();
    await tap(row);
    await page.waitForURL(new RegExp(`/issues/${issue.id}`));
    const fixed=page.getByRole('button',{name:'Put forward as fixed'});await fixed.waitFor();
    await page.waitForTimeout(400);
    const camera=page.locator('label.camera'),title=page.locator('h1.issue-eng-title'),where=page.locator('.issue-eng-facts dd').first();
    const landed={camera:await offScreen(camera),fixed:await offScreen(fixed),title:await offScreen(title),where:await offScreen(where),scrollY:await page.evaluate(()=>Math.round(scrollY))};
    await shot('landed');
    // Put it forward as fixed with a photograph and a note.
    await camera.scrollIntoViewIfNeeded();await page.locator('label.camera input[type=file]').setInputFiles({name:'fixed.jpg',mimeType:'image/jpeg',buffer:Buffer.from(shotFile)});taps++;
    await page.locator('.shots img[alt^="New evidence"]').first().waitFor();
    await tap(page.locator('#note'));await page.locator('#note').fill('Fire stopped, sealed round the tray');
    await tap(fixed);
    await page.locator('.tag',{hasText:'Fixed, to check'}).first().waitFor({timeout:15000});
    console.log(`${at}: ${taps} taps from the Site page to put forward as fixed with a photograph and note; on landing, scrolled ${landed.scrollY}px; out of view: photograph button ${landed.camera}px, "Put forward as fixed" ${landed.fixed}px, what is wrong ${landed.title}px, where ${landed.where}px.`);
    if(!measureOnly){
      if(c===LONGEST)ok(landed.scrollY>0&&landed.camera===0,`${at}: scrolls towards the update and shows the photograph button`);
      else ok(landed.camera===0&&landed.fixed===0,`${at}: lands with the photograph button and "Put forward as fixed" in view`);
      ok(landed.title===0&&landed.where===0,`${at}: what is wrong and where are on the same screen`);
      ok(taps===4,`${at}: four taps from the Site page (the issue, photograph, note, Put forward as fixed): ${taps}`);
      ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${at}: no sideways scroll`);
      ok(!SAFETY_WORDS.test(await page.locator('main').innerText()),`${at}: nothing of the hidden extras`);
      // Back goes to the Site page, as before.
      ok(/Back to Site/.test(await page.locator('a.back').innerText()),`${at}: Back says Site`);
    }
    await shot('put-forward');
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  // Opened from the Issues list (not "Came back"), the page starts at the top as before.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light',hasTouch:true});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage();
    const issue=issueAt('Flat 3.02');
    await page.goto(`${base}/engineer?project=${P}`);
    await page.getByRole('button',{name:'Issues',exact:true}).first().click();
    await page.locator(`a[href^="/issues/${issue.id}"]`).first().click();
    await page.getByRole('button',{name:'Put forward as fixed'}).waitFor();await page.waitForTimeout(400);
    const y=await page.evaluate(()=>Math.round(scrollY));
    console.log(`from the Issues list: scrolled ${y}px on landing.`);
    ok(y===0,'from the Issues list the issue page starts at the top');
    await context.close();
  }
  // The office keeps every fact and button, and its links start at the top.
  {
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
    await context.addCookies([{name:'relay_session',value:sessions[manager.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/issues/${issueAt('Flat 3.02').id}?update=1`);await page.locator('.titleblock').waitFor();await page.waitForTimeout(400);
    const text=await page.locator('main').textContent();
    for(const words of ['Work status','Confirmation','Owner','Target date','Raised','Trade affected','History','Who puts it right','Record an update','Confirm observation'])ok(text.includes(words),`office: still shows "${words}"`);
    ok(await page.evaluate(()=>scrollY)===0,'office: the page starts at the top');
    if(shots)await page.screenshot({path:join(shots,`${prefix}-office-issue-dark-1440.png`),fullPage:true});
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }
  console.log(measureOnly?'Measured only.':`Came back to update check passed (${checks} checks): lands on "Update this issue" with what and where in view; four taps; Issues list and office unchanged; light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally { await browser?.close();server.kill();rmSync(root,{recursive:true,force:true}); }
