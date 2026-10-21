// Browser check for the simpler engineer Issues list (2026-10-21). On a 390px
// phone each issue card says what is wrong, where, its status and who is
// fixing it by when; trade, reporter and source lines are left to the issue
// page's History. Filters, the photo and the link to the issue still work, and
// the office registers are unchanged. Light and dark at 390px, plus 1440px dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
// RELAY_MEASURE_ONLY=1 only prints card heights (used on main for the "before" numbers).
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
const root=mkdtempSync(join(tmpdir(),'relay-simpler-issue-list-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {applyCommand,listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const engineer={id:'entra:sl-engineer',oid:'sl-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:sl-other',oid:'sl-other',name:'Hana Heat',email:'hana@example.test',role:'Engineer',trade:'HVAC'};
const manager={id:'entra:sl-manager',oid:'sl-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,other,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme';
const jpeg=async colour=>'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer()).toString('base64');
const photo={id:randomUUID(),dataUrl:await jpeg('#aa7744'),caption:'Riser',capturedAt:new Date().toISOString()};
const ob=(location,whatHappened,trade,withPhoto=true)=>({id:randomUUID(),type:'defect',location,whatHappened,actionNeeded:'',owner:'',affectedTrade:trade,photos:withPhoto?[photo]:[]});
const send=async(who,obs)=>{const r=createReport(P,who.name,who,'progress');const saved=saveDraft(r.id,{...r,observations:obs},r.version).value;const res=await submitReport(r.id,undefined,saved.version,who.name);if(!res.ok)console.error(JSON.stringify(res));return res;};
assert.ok((await send(engineer,[ob('Level 2 riser','Fire stopping missing round the cable tray','Electrical'),ob('Flat 3.02','Socket face plate cracked','Electrical')])).ok);
assert.ok((await send(other,[ob('Plant room','Duct lagging torn at the bend','HVAC')])).ok);
const target=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const riser=listIssues(P).find(i=>i.location==='Level 2 riser');
assert.ok(applyCommand(riser.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'Over to Northbank',owner:'Northbank Electrical',targetDate:target}).ok);
const port=4433,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-simpler-issue-list',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const measureOnly=process.env.RELAY_MEASURE_ONLY==='1';
let browser,checks=0;const ok=(value,message)=>{if(measureOnly)return;assert.ok(value,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const context=await browser.newContext({viewport:{width,height:844},colorScheme:scheme,hasTouch:width<700});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const at=`${scheme} ${width}px`;
    await page.goto(`${base}/engineer?project=${P}`);
    await page.getByRole('button',{name:'Issues',exact:true}).first().click();
    await page.locator('.eng-issue-card').first().waitFor();
    const cards=page.locator('.eng-issue-card');
    // The tab opens on "Yours" (2026-10-21): Sam's two, not Hana's HVAC one. "Open" lists every trade.
    ok(await cards.count()===2&&!(await page.locator('main').innerText()).includes('Duct lagging'),`${at}: "Yours" lists Sam's two`);
    await page.getByRole('button',{name:'Open',exact:true}).click();await cards.nth(2).waitFor();
    const heights=await cards.evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().height)));
    const listTop=await page.locator('.eng-issue-list').first().evaluate(e=>Math.round(e.getBoundingClientRect().top+scrollY));
    console.log(`${at}: ${heights.length} open issue cards, heights ${heights.join(', ')}px (total ${heights.reduce((a,b)=>a+b,0)}px), list starts ${listTop}px down.`);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-issues-${scheme}-${width}.png`),fullPage:true});
    if(!measureOnly){
      // Before (main 5107b78) three cards took 1,131px at 390px, mostly a full-width photo each.
      if(width<700)ok(heights.reduce((a,b)=>a+b,0)<600,`${at}: three cards fit in under 600px`);
      ok(heights.length===3,`${at}: three open issues listed: ${heights.length}`);
      const card=cards.filter({hasText:'Fire stopping missing round the cable tray'});
      const text=await card.textContent();
      for(const words of [riser.reference,'Level 2 riser','Assigned'])ok(text.includes(words),`${at}: the card shows "${words}"`);
      ok(/Northbank Electrical, by \d/.test(text),`${at}: who is fixing it and by when, on one line: ${text}`);
      ok(await card.locator('img').count()===1,`${at}: the card still shows its photo`);
      const unassigned=await cards.filter({hasText:'Socket face plate cracked'}).innerText();
      ok(/Nobody yet/.test(unassigned),`${at}: an unassigned issue says nobody is fixing it yet: ${unassigned}`);
      const all=await page.locator('.eng-issue-list').first().innerText();
      ok(!/Reported by |Trade not recorded|From a site update|Defect flagged on its own|Open issue →/.test(all),`${at}: no trade, reporter or source lines on the cards`);
      ok(!(await cards.filter({hasText:'Duct lagging'}).innerText()).includes('HVAC'),`${at}: no trade tag on the card`);
      ok(!all.includes('Tetley Hall'),`${at}: the project name is not repeated on every card (it heads the list)`);
      // Filters still work: "Yours" (which replaced "Reported by me") keeps only Sam's issues.
      await page.getByRole('button',{name:'Yours'}).click();await page.waitForFunction(()=>document.querySelectorAll('.eng-issue-card').length===2);
      ok(await cards.count()===2&&!(await page.locator('.eng-issue-list').first().innerText()).includes('Duct lagging'),`${at}: "Yours" keeps only Sam's issues`);
      await page.getByRole('button',{name:'All issues'}).click();await cards.nth(2).waitFor();
      ok(await cards.count()===3,`${at}: "All issues" lists all three`);
      if(width<700){
        const small=await page.evaluate(()=>[...document.querySelectorAll('.eng-issue-tabs button, .eng-issue-card')].filter(e=>e.getBoundingClientRect().height<48).map(e=>e.textContent.trim()));
        ok(small.length===0,`${at}: filter buttons and cards are 48px or taller (${small.join(', ')})`);
        ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${at}: no sideways scroll`);
      }
      // The card still opens the issue, where trade and reporter sit under History.
      await card.click();await page.waitForURL(new RegExp(`/issues/${riser.id}`));
      await page.locator('details.issue-more summary').click();
      const fold=await page.locator('details.issue-more').innerText();
      ok(fold.includes('Sam Sparks')&&/Trade affected/i.test(fold),`${at}: the issue page still has the reporter and trade under History`);
    }
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  // The office register keeps reporter and trade.
  if(!measureOnly){
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light'});
    await context.addCookies([{name:'relay_session',value:sessions[manager.oid],url:base}]);
    const page=await context.newPage();
    await page.goto(`${base}/issues/${riser.id}`);await page.locator('.titleblock').waitFor();
    const text=await page.locator('main').textContent();
    for(const words of ['Trade affected','Sam Sparks','Northbank Electrical'])ok(text.includes(words),`office: the issue page still shows "${words}"`);
    ok(await page.locator('details.issue-more').count()===0,'office: nothing folded');
    await context.close();
  }
  console.log(measureOnly?'Measured only.':`Simpler issue list check passed (${checks} checks): cards say what, where, status and who by when; no trade, reporter or source lines; filters and links work; office unchanged; light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally { await browser?.close();server.kill();rmSync(root,{recursive:true,force:true}); }
