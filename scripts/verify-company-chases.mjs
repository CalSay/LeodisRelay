// Browser check for chase notes on Issues by company: the office logs what a
// company said and the day they promised, the card shows the latest chase and
// whether the promise was missed, earlier chases fold away, a retry is not
// logged twice, engineers and names not on the page are refused, and the form
// works on a phone and a desk, light and dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-chases-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:ch-engineer',oid:'ch-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:ch-manager',oid:'ch-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(n)=>`${addDays(today,n)}T10:00:00Z`;
const fmtDay=(ymd)=>new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',year:'numeric'});
let seq=0;
const issue=(extra)=>{seq++;putRecord('issues',{id:randomUUID(),reference:`011LME-ISS-${String(seq).padStart(3,'0')}`,projectId:'proj-011lme',location:'Level 2 riser',description:`Seeded issue ${seq}`,actionNeeded:'Make good',confirmation:'confirmed',work:'assigned',owner:'Acme Mechanical Ltd',targetDate:addDays(today,-2),raisedByReport:'',raisedAt:at(-10),affectedTrade:'HVAC',events:[],...extra});};
issue({});issue({});
issue({owner:'Sparks Ltd',affectedTrade:'Electrical'});
issue({owner:'Gone Ltd',confirmation:'withdrawn'});
issue({owner:'Tidy Plumbing',affectedTrade:'P&H',work:'closed',events:[{at:at(-3),actor:manager.name,kind:'verified',note:'',photos:[]}]});
// Sparks were rung last week and promised yesterday: the promise has gone with their work still open.
putRecord('company-chases',{id:'chase-seed-1',companyKey:'sparks ltd',owner:'Sparks Ltd',note:'Rang Jo, said they would finish the containment',promisedBy:addDays(today,-1),by:'Pat Office',byId:'entra:pat',at:at(-6)});
const port=4343,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-chases-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const cardOf=(page,name)=>page.locator('.co-card').filter({has:page.locator('h2',{hasText:new RegExp(`^${name}$`)})});
// The same axe-core rules as verify-accessibility.mjs, run with the chase form and history open.
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const post=(page,body)=>page.request.post(`${base}/api/company-chases`,{data:body});
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const good={owner:'Acme Mechanical Ltd',note:'Rang',promisedBy:'',requestId:randomUUID()};

  // Signed out and engineers cannot keep a chase.
  {
    const {context,page}=await open(null,'light',390);
    check((await post(page,good)).status()===401,'signed out: refused');
    await context.close();
    const e=await open('Engineer','light',390);
    check((await post(e.page,good)).status()===403,'engineer: refused');
    await e.context.close();
  }

  // Office, desktop, dark.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    // The API refuses a name that is not on any issue, and nonsense.
    check((await post(page,{...good,owner:'Nobody Ltd'})).status()===404,'office: a company with no issues is refused');
    check((await post(page,{...good,owner:'Gone Ltd'})).status()===404,'office: a company the page does not show (only a withdrawn issue) is refused');
    check((await post(page,{...good,note:42})).status()===422,'office: a malformed chase is refused');
    check((await post(page,{...good,promisedBy:addDays(today,-1)})).status()===422,'office: a promise already gone is refused');
    check(records('company-chases').length===1,'office: nothing kept by the refused saves');

    await page.goto(`${base}/companies`);await page.locator('.co-list').waitFor();
    const sparks=cardOf(page,'Sparks Ltd');
    check(/Promise missed/i.test(await sparks.locator('.co-tags').innerText())&&await sparks.evaluate(e=>e.classList.contains('co-late')),'office: a missed promise is marked at the top of the card');
    const sparksChase=await sparks.locator('.co-chase').innerText();
    check(sparksChase.includes('Pat Office')&&sparksChase.includes('finish the containment')&&sparksChase.includes(fmtDay(addDays(today,-1)))&&/promised day has gone and 1 issue is still to put right/.test(sparksChase),`office: the last chase, who made it and the missed day: ${JSON.stringify(sparksChase)}`);
    const acme=cardOf(page,'Acme Mechanical Ltd');
    check(/Not chased in RELAY yet/.test(await acme.locator('.co-chase').innerText()),'office: a company never chased says so');
    check((await cardOf(page,'Tidy Plumbing').locator('.co-chase').count())===0,'office: a company with nothing open and no chases has no chase box');

    // Saving with no words says what is missing and keeps the form.
    await acme.getByRole('button',{name:'Log a chase'}).click();
    const form=acme.getByRole('form',{name:'Log a chase for Acme Mechanical Ltd'});
    check(await form.getByLabel('What was said').evaluate(e=>e===document.activeElement),'office: the note box takes focus');
    await form.getByRole('button',{name:'Save chase'}).click();
    check(/what was said/i.test(await form.getByRole('alert').innerText()),'office: an empty note is stopped with a reason');
    const promised=addDays(today,3);
    await form.getByLabel('What was said').fill('Rang Dave, back Thursday to finish level 2');
    await form.getByLabel(/Promised by/).fill(promised);
    if(screenshot)await page.screenshot({path:join(screenshot,'chase-form-dark-1440.png'),fullPage:false});
    await axe(page,'office: dark 1440px with the form open');
    await form.getByRole('button',{name:'Save chase'}).click();
    await acme.locator('.co-chase-last').waitFor();
    const last=await acme.locator('.co-chase').innerText();
    check(last.includes('Office Manager')&&last.includes('Rang Dave, back Thursday')&&new RegExp(`Promised · ${fmtDay(promised)}`,'i').test(last),`office: the new chase and its promise show: ${JSON.stringify(last)}`);
    check(await acme.getByRole('button',{name:'Log a chase'}).evaluate(e=>e===document.activeElement)&&(await acme.getByRole('status').innerText()).includes('Chase saved'),'office: focus returns to Log a chase and the save is announced');
    check((await acme.getByRole('form').count())===0&&(await acme.getByRole('button',{name:'Log a chase'}).count())===1,'office: the form closes and can be opened again');
    // It is kept: a reload shows the same.
    await page.reload();await page.locator('.co-list').waitFor();
    check((await acme.locator('.co-chase-last').innerText()).includes('Rang Dave, back Thursday'),'office: the chase is kept after a reload');
    // A later chase with no date sets the promise aside and folds the first away.
    await acme.getByRole('button',{name:'Log a chase'}).click();
    await acme.getByLabel('What was said').fill('Left a message, no answer');
    await acme.getByRole('button',{name:'Save chase'}).click();
    await acme.locator('.co-chase-earlier').waitFor();
    check((await acme.locator('.co-chase-head .tag').count())===0,'office: a later chase with no date sets the promise aside');
    check(/Left a message/.test(await acme.locator('.co-chase-last').innerText()),'office: the newest chase is on show');
    await acme.locator('.co-chase-earlier summary').click();
    const earlier=await acme.locator('.co-chase-earlier').innerText();
    check(/Earlier chases \(1\)/.test(earlier)&&earlier.includes('Rang Dave')&&earlier.includes(`promised ${fmtDay(promised)}`),`office: earlier chases fold away with their promise: ${JSON.stringify(earlier)}`);
    await axe(page,'office: dark 1440px with earlier chases open and a missed promise');
    // A retry with the same request id is not logged twice; the same id with other words is refused.
    const id=randomUUID();
    const one=await post(page,{...good,note:'Emailed the snag list',requestId:id});const two=await post(page,{...good,note:'Emailed the snag list',requestId:id});
    check(one.status()===201&&two.status()===201&&(await one.json()).id===(await two.json()).id,'office: a retry returns the first save');
    check((await post(page,{...good,note:'Different',requestId:id})).status()===409,'office: the same id with other words is refused');
    check(records('company-chases').length===4,`office: three chases kept beside the seeded one (${records('company-chases').length})`);
    // Chases change no issue.
    const acmeIssues=records('issues').filter(i=>i.owner==='Acme Mechanical Ltd');
    check(acmeIssues.every(i=>i.work==='assigned'&&i.events.length===0&&i.targetDate===addDays(today,-2)),'office: the issues are untouched');
    if(screenshot)await page.screenshot({path:join(screenshot,'chases-dark-1440.png'),fullPage:true});
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Office on a phone, light: the form fits, nothing sideways, fingertip-sized controls.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/companies?q=sparks`);await page.locator('.co-list').waitFor();
    const sparks=cardOf(page,'Sparks Ltd');
    await sparks.getByRole('button',{name:'Log a chase'}).click();
    const heights=await sparks.locator('.co-chase-form button, .co-chase-form input[type=date]').evaluateAll(a=>a.map(x=>Math.round(x.getBoundingClientRect().height)));
    check(heights.length===3&&heights.every(h=>h>=44),`phone: the form's controls are fingertip height: ${JSON.stringify(heights)}`);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`phone: no sideways page scroll with the form open (${width})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'chase-form-light-390.png'),fullPage:true});
    await axe(page,'phone: light 390px with the form open');
    await sparks.getByRole('button',{name:'Cancel'}).click();
    check((await sparks.getByRole('form').count())===0,'phone: Cancel closes the form');
    // With no connection the words stay in the form and a reason is given.
    await sparks.getByRole('button',{name:'Log a chase'}).click();
    await sparks.getByLabel('What was said').fill('Texted Jo');
    await context.setOffline(true);
    await sparks.getByRole('button',{name:'Save chase'}).click();
    await sparks.getByRole('alert').waitFor();
    check(/No connection/.test(await sparks.getByRole('alert').innerText())&&(await sparks.getByLabel('What was said').inputValue())==='Texted Jo','phone: with no connection the note stays and says why');
    await context.setOffline(false);
    await sparks.getByRole('button',{name:'Save chase'}).click();
    await sparks.locator('.co-chase-earlier').waitFor();
    check(/Texted Jo/.test(await sparks.locator('.co-chase-last').innerText())&&(await sparks.locator('.co-tags .tag',{hasText:'Promise missed'}).count())===0,'phone: saved once signal is back, and the missed promise is set aside by the newer chase');
    assert.deepEqual(errors,[],'phone: page errors');
    await context.close();
  }
  console.log(`Chase notes check passed (${checks} checks): office-only saves, refused names and dates, a missed promise, logging a chase with a promise, kept after reload, earlier chases, retries, issues untouched, phone and desktop, light and dark, no connection.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
