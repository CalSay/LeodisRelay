// Browser check that what the office wrote back reaches the engineer where
// they look (2026-10-21): a "Came back from the office" row shows who wrote,
// when, and a line or two of it; the issue page shows all of it above "Put
// forward as fixed" (still on the first screen of a 390px phone), and a
// variation shows it under the office's answer. A long note opens cut, with
// "Show all of it". Once the engineer adds something, it is answered and left
// in the history. A note the office left on a sent report shows on its row.
// Notes RELAY writes itself (a returned report's "needs triage") never show.
// 390px light and dark, 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-words-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport,acknowledgeReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues,applyCommand,disputeIssuesFromReport}=require('../apps/web/.test-build/lib/issueStore.js');
const {listVariations,applyVariationCommand}=require('../apps/web/.test-build/lib/variationStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const engineer={id:'entra:ow-engineer',oid:'ow-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:ow-manager',oid:'ow-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme';
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const photo=[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:'#aa7744'}}).jpeg().toBuffer()).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const r=createReport(P,engineer.name,engineer,'progress');
const saved=saveDraft(r.id,{...r,observations:[
  ob('update','Level 4','First fix complete'),
  ob('defect','Level 2 riser','Fire stopping missing',{actionNeeded:'Fire stop',owner:'Firestop Ltd',affectedTrade:'Other',photos:photo}),
  ob('defect','Plant room','Tray bracket loose',{actionNeeded:'Refix',owner:'Leodis',affectedTrade:'Electrical',photos:photo}),
  ob('defect','Flat 2.04','Socket faceplate cracked',{actionNeeded:'Replace',owner:'Leodis',affectedTrade:'Electrical',photos:photo}),
  ob('defect','Stair core','Light fitting missing',{actionNeeded:'Fit it',owner:'Leodis',affectedTrade:'Electrical',photos:photo}),
  ob('instruction','Flat 3.02','Extra double socket asked for by the client',{workDone:false}),
]},r.version).value;
{const sent=await submitReport(r.id,undefined,saved.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));}
while(await runOneJob());
const issue=d=>listIssues(P).find(i=>i.description===d);
const office={actor:manager.name,actorId:manager.id};
const SHORT='Still a gap at the top of the riser. Can you send a photo of the top?';
const LONG='The fire stopping contractor says the plant room bracket was refixed last week, but the photograph we have shows the old bracket still in place. '.repeat(5)+'Please check it on your next walk round and send a photo either way.';
const fire=issue('Fire stopping missing'),tray=issue('Tray bracket loose'),socket=issue('Socket faceplate cracked'),light=issue('Light fitting missing');
// The office returns the report for correction: RELAY marks its issues disputed with a note of its own, which is never shown as someone writing.
disputeIssuesFromReport(r.id,manager.name,manager.id);
assert.ok(listIssues(P).every(i=>i.confirmation==='disputed'&&i.events.at(-1).note.includes('needs triage')),'the issues are disputed with RELAY\'s own note');
assert.ok(applyCommand(fire.id,{kind:'submit_closure',actor:engineer.name,actorId:engineer.id,note:'Done'}).ok);
assert.ok(applyCommand(fire.id,{kind:'reopen',...office,note:SHORT}).ok);
assert.ok(applyCommand(tray.id,{kind:'note',...office,note:LONG}).ok);
assert.ok(applyCommand(socket.id,{kind:'note',...office,note:'Which flat was this in?'}).ok);
assert.ok(applyCommand(socket.id,{kind:'progress',actor:engineer.name,actorId:engineer.id,note:'Flat 2.04, replaced today'}).ok);
const variation=listVariations(P)[0];
assert.ok(applyVariationCommand(variation.id,{kind:'note',...office,note:'Client wants two of these, can you say where the second goes?'}).ok);
assert.ok(acknowledgeReport(r.id,manager,'Thanks, good photos of the riser').ok);
const port=4423,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-office-words',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width,height] of [['light',390,844],['dark',390,844],['dark',1440,900]]){
    const at=`${scheme} ${width}`;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async(name,full=true)=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-${width}.png`),fullPage:full});};
    const noSideScroll=async where=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${at} ${where}: no sideways scroll`);
    const goHome=async()=>{await page.goto(`${base}/engineer?project=${P}`);await page.getByRole('heading',{name:'Came back from the office'}).waitFor();await page.locator('.eng-list .eng-row',{hasText:'Fire stopping missing'}).waitFor();};
    const row=text=>page.locator('.eng-list .eng-row',{hasText:text});
    await goHome();
    {
      const word=row('Fire stopping missing').locator('.eng-word');
      ok(await word.count()===1&&(await word.innerText()).replace(/\s+/g,' ').includes(`Olive Office wrote on`)&&(await word.innerText()).includes(SHORT),`${at} home: the sent-back issue says who wrote, when, and what`);
      const long=row('Tray bracket loose').locator('.eng-word');
      const box=await long.boundingBox(),line=await long.evaluate(e=>parseFloat(getComputedStyle(e).lineHeight));
      ok(box&&box.height<=line*2+2,`${at} home: a long note takes two lines at most (${box?.height}px, line ${line}px)`);
      ok(await row('Light fitting missing').locator('.eng-word').count()===0&&!/needs triage/.test(await page.locator('.eng-list').first().innerText()),`${at} home: RELAY's own "needs triage" note is not shown as someone writing`);
      ok(await row('Socket faceplate cracked').locator('.eng-word').count()===0,`${at} home: a note the engineer has answered is not repeated`);
      ok((await row('Extra double socket').locator('.eng-word').innerText()).includes('can you say where the second goes'),`${at} home: the variation shows the office's note`);
      ok((await row(/Site update SPR-/).locator('.eng-word').innerText()).includes('Thanks, good photos of the riser'),`${at} home: a note left on a sent report shows on its row`);
      await noSideScroll('home');
      await page.getByRole('heading',{name:'Came back from the office'}).scrollIntoViewIfNeeded();
      await shot('home-came-back',false);
    }
    // Opened from its row: the note is above the buttons, and "Put forward as fixed" is on the first screen.
    await row('Fire stopping missing').click();await page.waitForURL(/\/issues\/iss-/);
    {
      const box=page.locator('.eng-word-box');await box.waitFor();
      ok((await box.innerText()).includes(SHORT)&&/Olive Office wrote on/.test(await box.innerText()),`${at} issue: the office's note is at the top`);
      const button=page.getByRole('button',{name:'Put forward as fixed'});
      const [b,u]=[await box.boundingBox(),await page.locator('.issue-eng-update').boundingBox()];
      ok(b.y<u.y,`${at} issue: the note sits above "Update this issue"`);
      const bb=await button.boundingBox();
      ok(bb.y+bb.height<=height,`${at} issue: "Put forward as fixed" is on the first screen (bottom ${Math.round(bb.y+bb.height)}px of ${height})`);
      const title=await page.locator('.issue-eng-title').boundingBox();
      ok(title.y>=0,`${at} issue: the title stays in view`);
      ok(await page.locator('.eng-word-more').count()===0,`${at} issue: a short note has no "Show all of it"`);
      await noSideScroll('issue');
      await shot('issue-sent-back',false);
    }
    // A long note opens cut, under the dispute line, which no longer sends the engineer to History.
    await goHome();await row('Tray bracket loose').click();await page.waitForURL(/\/issues\/iss-/);
    {
      const note=page.locator('.eng-word-note');await note.waitFor();
      ok(/The office is checking whether this needs fixing/.test(await page.locator('main').innerText()),`${at} long: the dispute line is kept under the note`);
      const cut=(await note.boundingBox()).height;
      const more=page.getByRole('button',{name:'Show all of it'});
      ok(await more.count()===1&&(await more.boundingBox()).height>=48,`${at} long: "Show all of it", a full fingertip tall`);
      const bb=await page.getByRole('button',{name:'Put forward as fixed'}).boundingBox();
      ok(bb.y+bb.height<=height,`${at} long: "Put forward as fixed" still on the first screen (bottom ${Math.round(bb.y+bb.height)}px)`);
      await shot('issue-long-cut',false);
      await more.click();
      ok((await note.boundingBox()).height>cut+10&&await page.getByRole('button',{name:'Show less'}).getAttribute('aria-expanded')==='true',`${at} long: "Show all of it" opens the whole note`);
      await noSideScroll('long note');
    }
    // Disputed by RELAY with no word from anyone: no box, and the line still points to History.
    await goHome();await row('Light fitting missing').click();await page.waitForURL(/\/issues\/iss-/);
    {
      await page.getByText('The office is checking whether this needs fixing. Open History for why.').waitFor();
      ok(await page.locator('.eng-word-box').count()===0,`${at} disputed: no note box for RELAY's own note`);
    }
    // A variation shows the note under the office's answer.
    await goHome();await row('Extra double socket').click();await page.waitForURL(/\/variations\//);
    {
      const box=page.locator('.eng-word-box');await box.waitFor();
      ok((await box.innerText()).includes('can you say where the second goes'),`${at} variation: the office's note is shown`);
      const band=await page.locator('.eng-band').first().boundingBox(),b=await box.boundingBox();
      ok(b.y>band.y&&b.y<(await page.getByRole('heading',{name:'History'}).boundingBox()).y,`${at} variation: under the office's answer, above History`);
      await shot('variation',false);
    }
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  // Answering it: an update from the engineer leaves the note in the history, on the page and on home.
  {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage();
    await page.goto(`${base}/issues/${fire.id}`);await page.locator('.eng-word-box').waitFor();
    await page.locator('#note').fill('Photo of the top on its way');
    await page.getByRole('button',{name:'Record an update'}).click();
    await page.locator('.eng-word-box').waitFor({state:'detached',timeout:10000});
    ok(true,'answered: the note leaves the top of the issue once the engineer records an update');
    await page.locator('details.issue-more summary').click();
    ok((await page.locator('details.issue-more').innerText()).includes(SHORT),'answered: the office\'s note is still in History');
    await page.goto(`${base}/engineer?project=${P}`);await page.locator('.eng-list .eng-row',{hasText:'Fire stopping missing'}).waitFor();
    ok(await page.locator('.eng-list .eng-row',{hasText:'Fire stopping missing'}).locator('.eng-word').count()===0,'answered: the home row no longer repeats it');
    // The office's own issue page is unchanged.
    await context.clearCookies();await context.addCookies([{name:'relay_session',value:sessions[manager.oid],url:base}]);
    await page.goto(`${base}/issues/${tray.id}`);await page.getByText('History').first().waitFor();
    ok(await page.locator('.eng-word-box').count()===0,'office: its issue page does not show the engineer box');
    await context.close();
  }
  console.log(`Office words check passed (${checks} checks): who wrote, when and what on Came back rows (two lines at most), at the top of the issue with "Put forward as fixed" on the first screen, a long note cut with "Show all of it", on a variation, answered notes left in History, 390px light and dark and 1440px dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit').catch(()=>{});}
  database().close();rmSync(root,{recursive:true,force:true});
}
