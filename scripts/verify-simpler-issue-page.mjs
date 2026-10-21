// Browser check for the simpler issue page (2026-10-21). On a 390px phone an
// engineer opening an issue sees what is wrong, where, what needs doing and
// who is fixing it by when, with the photograph button and "Put forward as
// fixed" on the first screen; history and office detail are folded away, not
// gone. Putting it forward with a photograph takes the same taps and says what
// happens next. The office (Manager) still sees everything as before.
// Light and dark at 390px; the office at 390px light and 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-simpler-issue-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {applyCommand,listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const engineer={id:'entra:si-engineer',oid:'si-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:si-manager',oid:'si-manager',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const P='proj-011lme';
const jpeg=async colour=>'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:colour}}).jpeg().toBuffer()).toString('base64');
const photo={id:randomUUID(),dataUrl:await jpeg('#aa7744'),caption:'Riser',capturedAt:new Date().toISOString()};
const ob=(location,whatHappened,actionNeeded)=>({id:randomUUID(),type:'defect',location,whatHappened,actionNeeded,owner:'',affectedTrade:'Electrical',photos:[photo]});
const r=createReport(P,engineer.name,engineer,'progress');
const saved=saveDraft(r.id,{...r,observations:[ob('Level 2 riser','Fire stopping missing round the cable tray','Fire stop the riser penetrations'),ob('Level 3 riser','Fire stopping missing round the cable tray','Fire stop the riser penetrations'),ob('Flat 3.02','Socket face plate cracked','Replace the face plate')]},r.version).value;
assert.ok((await submitReport(r.id,undefined,saved.version,engineer.name)).ok);
const target=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA',{timeZone:'Europe/London'});
const issues={};
for(const [scheme,place] of [['light','Level 2 riser'],['dark','Level 3 riser']]){
  const found=listIssues(P).find(i=>i.location===place);issues[scheme]={...found};
  assert.ok(applyCommand(found.id,{kind:'assign',actor:manager.name,actorId:manager.id,note:'Over to Northbank, key from the site office',owner:'Northbank Electrical',targetDate:target}).ok);
  assert.ok(applyCommand(found.id,{kind:'progress',actor:engineer.name,actorId:engineer.id,note:'Northbank on site, half done',photos:[]}).ok);
}
const port=4431,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-simpler-issue',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const measureOnly=process.env.RELAY_MEASURE_ONLY==='1';
let browser,checks=0;const ok=(value,message)=>{if(measureOnly)return;assert.ok(value,message);checks++;};
const SAFETY_WORDS=/toolbox|permit|deliveries|safety action|safety inspection|tower/i;
const shotFile=new Uint8Array(Buffer.from(photo.dataUrl.split(',')[1],'base64'));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme,hasTouch:true});
    await context.addCookies([{name:'relay_session',value:sessions[engineer.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const issue=issues[scheme],place=issue.location;
    const shot=async(name,fullPage=true)=>{if(shots)await page.screenshot({path:join(shots,`${prefix}-${name}-${scheme}-390.png`),fullPage});};
    let taps=0;const tap=async l=>{await l.scrollIntoViewIfNeeded();await l.click();taps++;};
    // How far down the page a control sits: 0 means it is on the first screen.
    const scrollTo=async l=>{const y=await l.evaluate(e=>e.getBoundingClientRect().bottom+scrollY);return Math.max(0,Math.round(y-844));};
    await page.goto(`${base}/engineer?project=${P}`);
    await tap(page.getByRole('button',{name:'Issues',exact:true}).first());
    await tap(page.locator(`a[href^="/issues/${issue.id}"]`).first());
    await page.waitForURL(new RegExp(`/issues/${issue.id}`));
    const fixed=page.getByRole('button',{name:'Put forward as fixed'});await fixed.waitFor();
    await page.evaluate(()=>scrollTo(0,0));
    const camera=page.locator('label.camera');
    const before={camera:await scrollTo(camera),fixed:await scrollTo(fixed),height:await page.evaluate(()=>document.documentElement.scrollHeight)};
    await shot('issue-first-screen',false);await shot('issue');
    const first=await page.evaluate(()=>{const out=[];for(const el of document.querySelectorAll('main *')){const b=el.getBoundingClientRect();if(b.top<844&&b.bottom>0&&el.checkVisibility()&&el.children.length===0&&el.textContent.trim())out.push(el.textContent.trim());}return out.join(' | ');});
    // Put it forward as fixed with a photograph.
    await camera.scrollIntoViewIfNeeded();await page.locator('label.camera input[type=file]').setInputFiles({name:'fixed.jpg',mimeType:'image/jpeg',buffer:Buffer.from(shotFile)});taps++;
    await page.locator('.shots img[alt^="New evidence"]').first().waitFor();
    await tap(page.locator('#note'));await page.locator('#note').fill('Fire stopped, sealed round the tray');
    await tap(fixed);
    await page.locator('.tag',{hasText:'Fixed, to check'}).first().waitFor({timeout:15000});
    console.log(`${scheme}: ${taps} taps from home to put forward as fixed with a photograph; on opening, the photograph button is ${before.camera}px below the first screen and "Put forward as fixed" ${before.fixed}px; page ${before.height}px tall.`);
    if(scheme==='light')console.log(`first screen: ${first}`);
    await shot('issue-put-forward');
    if(!measureOnly){
      // Plain, on the first screen: what is wrong, where, what needs doing, who and by when.
      ok(before.camera===0&&before.fixed===0,`${scheme}: the photograph button and "Put forward as fixed" are on the first screen`);
      for(const words of ['Fire stopping missing round the cable tray',place,'Fire stop the riser penetrations','Northbank Electrical'])ok(first.includes(words),`${scheme}: first screen shows "${words}"`);
      ok(/Northbank Electrical, by \d/.test(first),`${scheme}: who is fixing it and by when, on one line`);
      ok(!/Work status|Confirmation|Trade affected|Reporting trade/.test(first),`${scheme}: no office grid or trade lines on the first screen`);
      ok(taps===5,`${scheme}: five taps from home (Issues, the issue, photograph, note, Put forward as fixed): ${taps}`);
      // Folded, not gone.
      const fold=page.locator('details.issue-more');
      ok(await fold.count()===1&&!(await fold.evaluate(d=>d.open)),`${scheme}: history and detail are folded`);
      ok(/History · 4/.test(await fold.locator('summary').innerText()),`${scheme}: the fold says how many entries the history has`);
      await tap(fold.locator('summary'));
      const inside=await fold.innerText();
      for(const words of ['Confirmation','Raised','Trade affected','Sam Sparks','Put forward as fixed','Over to Northbank, key from the site office','Northbank on site, half done','Fire stopped, sealed round the tray'])ok(inside.includes(words),`${scheme}: the fold holds "${words}"`);
      ok(await fold.locator('.issue-event-source a').count()>=1,`${scheme}: the history still links the report that raised it`);
      ok(await page.getByText(/waiting for the office to check/i).count()>0,`${scheme}: says it is waiting for the office to check`);
      ok(await page.getByRole('button',{name:'Put forward as fixed'}).count()===0,`${scheme}: no second "Put forward as fixed"`);
      ok(await page.getByRole('region',{name:'Who puts it right'}).count()===0&&await page.getByRole('button',{name:/Verify and close|Confirm observation/}).count()===0,`${scheme}: no office buttons for the engineer`);
      const small=await page.evaluate(()=>[...document.querySelectorAll('main button, main summary, main label.camera')].filter(e=>e.offsetParent!==null&&e.getBoundingClientRect().height<48).map(e=>e.textContent.trim()));
      ok(small.length===0,`${scheme}: buttons are 48px or taller (${small.join(', ')})`);
      ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${scheme}: no sideways scroll`);
      ok(!SAFETY_WORDS.test(await page.locator('main').innerText()),`${scheme}: nothing of the hidden extras`);
      await shot('issue-history-open');
    }
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  // The office keeps every fact on the page.
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions[manager.oid],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const other=listIssues(P).find(i=>i.location==='Flat 3.02');
    await page.goto(`${base}/issues/${other.id}`);await page.locator('.titleblock').waitFor();
    const text=await page.locator('main').textContent();
    for(const words of ['Work status','Confirmation','Owner','Target date','Raised','Trade affected','History','Who puts it right','Record an update','Put forward as fixed','Confirm observation'])ok(text.includes(words),`office ${scheme} ${width}px: still shows "${words}"`);
    ok(await page.locator('details.issue-more').count()===0,`office ${scheme} ${width}px: nothing folded`);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-office-issue-${scheme}-${width}.png`),fullPage:true});
    await page.goto(`${base}/issues/${issues.light.id}`);await page.getByRole('button',{name:'Verify and close'}).waitFor();
    ok(true,`office ${scheme} ${width}px: can verify and close the issue put forward`);
    assert.deepEqual(errors,[],`office ${scheme}: page errors`);
    await context.close();
  }
  console.log(measureOnly?'Measured only.':`Simpler issue page check passed (${checks} checks): first screen says what, where, what to do and who by when; photograph and "Put forward as fixed" without scrolling; history and detail folded; office unchanged; light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally { await browser?.close();server.kill();rmSync(root,{recursive:true,force:true}); }
