// Browser check for "Today from site" on the office overview (walk of 22 Oct 2026):
// the end of the day's read across every project in one place. Before, the office
// opened each project's Latest from site, or each report in the Inbox, to see what
// every site did today.
//
// Records: Tetley Hall has three site updates today (two electricians, Sid at 11:00
// and Sam at 16:00, and Hana, HVAC, at 09:00) and an inspection; Sam's access
// problem is his fifth card, so it shows only if held-up lines come first. Kirkstall
// Gate's last update was yesterday, so it has no block. Hunslet Depot has one quiet
// update today. A fix put forward 23.5 hours ago waits "1 day" (a calendar day), not
// the 0 whole days the overview used to say.
// Checks, light and dark at 1440 and light at 390: the section's day and count;
// on a phone each project's cards fold under its bar (the day fits on one screen,
// what needs the office follows, each fold opens and says so);
// one edged block a project with an update today, in the overview's project order;
// each block's headline (updates and inspections, access problems, what was
// raised); the cards by trade then as sent, every update today and not only each
// trade's newest; access lines first; an update opens its report and a project's
// name its sheet; the fix's wait; no sideways scroll, no page errors, and axe finds
// nothing on the overview. RELAY_SCREENSHOT_DIR=<dir> saves the overview.
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
const root=mkdtempSync(join(tmpdir(),'relay-today-from-site-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {dayShort}=require('../apps/web/.test-build/lib/dates.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const manager=person('today-manager','Jo Office','Manager');
const sam=person('today-sam','Sam Spark','Engineer','Electrical');
const sid=person('today-sid','Sid Socket','Engineer','Electrical');
const hana=person('today-hana','Hana Duct','Engineer','HVAC');
const pat=person('today-pat','Pat Pipe','Engineer','P&H');
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,h)=>`${ymd}T${String(h).padStart(2,'0')}:00:00.000Z`;
const card=(type,location,whatHappened)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:type==='update'||type==='access'?'':'Sort it',owner:'',photos:[]});
const sent=(projectId,who,visitDate,hour,observations,type)=>{const r=createReport(projectId,who.name,who,type);const out={...r,authorTrade:who.trade,visitDate,state:'submitted',review:'not_required',serverAcknowledgedAt:at(visitDate,hour),observations};putRecord('reports',out);return out;};

const T='proj-011lme',K='proj-014lme',H='proj-009lcp';
const samToday=sent(T,sam,today,15,[card('update','Level 1 corridor','Containment installed along the full run'),card('update','Flat 204 kitchen','First fix complete, boxes set'),
  card('update','Riser 2','Cable pulled to the distribution board'),card('update','Plant room','Board dressed and labelled'),card('access','Level 2 west','Blocked by stacked plasterboard, moved to level 3'),card('defect','Flat 311 bathroom','Cracked faceplate')]);
const sidToday=sent(T,sid,today,10,[card('update','Stair core B','Emergency lighting first fix done')]);
const hanaToday=sent(T,hana,today,8,[card('update','Level 3 ceiling void','Ductwork hangers fitted'),card('instruction','Plant room','Extra grille asked for'),card('instruction','Roof','Second fan asked for')]);
sent(T,sam,today,12,[{...card('update','','Scaffold tag in date'),check:{question:'Scaffold tagged',answer:'ok'}}],'safety-inspection');
sent(T,pat,addDays(today,-1),14,[card('update','Basement','Yesterday’s pipework, not today’s')]);
sent(K,pat,addDays(today,-1),14,[card('update','Bin store','Kirkstall yesterday')]);
const quiet=sent(H,hana,today,11,[card('update','Welfare kitchen','Extract fan fitted and tested')]);
// Put forward 23.5 hours ago: yesterday on the calendar (unless run in the half hour before midnight), but not a whole day.
const putAt=new Date(Date.now()-23.5*3600000).toISOString();
const waited=Math.round((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${londonDay(putAt)}T12:00:00Z`))/86400000);
const ev=(kind,when,who,note='')=>({at:when,actor:who.name,actorId:who.id,kind,note,photos:[]});
putRecord('issues',{id:'801',reference:'DEMO-011LME-ISS-801',projectId:T,source:'individual',reportedBy:sam.name,reportedById:sam.id,reporterTrade:'Electrical',affectedTrade:'Electrical',location:'Level 2 riser',
  description:'Fire collar missing on the riser',actionNeeded:'',confirmation:'confirmed',work:'awaiting_verification',owner:'Acme Electrical',targetDate:addDays(today,7),raisedAt:at(addDays(today,-5),9),
  closureSubmittedBy:sam.name,closureSubmittedById:sam.id,events:[ev('raised',at(addDays(today,-5),9),sam),ev('closure_submitted',putAt,sam,'Done')]});

const port=4524,base=`http://127.0.0.1:${port}`;let output='';
// A check server left running by an earlier run would answer in this one's place, with other data.
assert.ok(await fetch(base+'/signin').then(()=>false,()=>true),`Port ${port} is already in use: stop the server an earlier run left behind.`);
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-today-from-site',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const flat=s=>s.replace(/\s+/g,' ').trim();
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  for(const [scheme,width] of [['light',1440],['dark',1440],['light',390]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height:phone?844:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const todayIds=new Set([samToday.id,sidToday.id,hanaToday.id,quiet.id]);let cardReads=0;
    page.on('request',r=>{const m=new URL(r.url()).pathname.match(/^\/api\/reports\/([^/]+)$/);if(m&&todayIds.has(m[1]))cardReads++;});
    await page.goto(`${base}/office`);
    const section=page.locator('section.today-site');await section.waitFor();
    const folds=section.locator('button.today-fold');
    if(phone){
      // On a phone the cards fold under each project's bar, so the whole day fits on a screen and what needs the office follows.
      await folds.first().waitFor();
      check(await folds.count()===2&&await section.locator('.from-site-visit').count()===0,`${label}: each project's cards start folded (${await folds.count()} folds)`);
      const words=(await folds.allInnerTexts()).map(flat);
      check(words.join('|')==='Show the 3 site updates|Show the site update',`${label}: each fold says how many updates it holds (${words.join(' | ')})`);
      check(await folds.first().getAttribute('aria-expanded')==='false',`${label}: the fold says it is closed`);
      const box=await section.boundingBox();
      check(box.height<844,`${label}: the folded day fits on one screen (${Math.round(box.height)}px)`);
      const notSeen=await page.locator('.act').first().boundingBox();
      check(notSeen.y>=box.y+box.height,`${label}: what needs the office comes straight after the day`);
      await axe(page,`${label} folded`);
      if(shot)await section.screenshot({path:join(shot,`today-from-site-folded-${scheme}-${width}.png`)});
      check(cardReads===0,`${label}: folded cards are not loaded, not even for a moment before the fold (${cardReads} reads)`);
      for(let n=0;n<2;n++)await folds.nth(n).click();
      check(await folds.first().getAttribute('aria-expanded')==='true'&&flat(await folds.first().innerText())==='Hide the site updates',`${label}: an open fold says so and offers to hide`);
      await section.locator('.from-site-visit').first().waitFor();
      await page.waitForFunction(()=>!document.querySelector('.today-site .loading'),null,{timeout:15000});
      const reads=cardReads;
      await folds.first().click();
      check(await folds.first().getAttribute('aria-expanded')==='false'&&flat(await folds.first().innerText())==='Show the 3 site updates'&&!(await blocks0(section).locator('.from-site-visit').first().isVisible()),`${label}: Hide folds the cards away again`);
      await folds.first().click();
      check(await blocks0(section).locator('.from-site-visit').first().isVisible()&&await section.locator('.loading').count()===0&&cardReads===reads,`${label}: opening again shows the cards at once, without reading the reports again (${cardReads-reads} reads)`);
    }else check(await folds.count()===0,`${label}: the desk shows the cards open, with no fold`);
    await section.locator('.from-site-visit').first().waitFor();
    await page.waitForFunction(()=>!document.querySelector('.today-site .loading'),null,{timeout:15000});
    const head=flat(await section.locator('.r').first().textContent());
    check(head.includes(dayShort(today))&&head.includes('4 updates'),`${label}: the section names today and counts its 4 updates (${head})`);
    const blocks=section.locator('section.today-project');
    const names=(await blocks.locator('.today-project-h b').allInnerTexts()).map(flat);
    check(names.join('|')==='Tetley Hall - Block E|Hunslet Depot - Welfare Block',`${label}: one block a project with an update today, in the overview's order; Kirkstall's was yesterday (${names.join(' | ')})`);
    const tetley=blocks.nth(0),hunslet=blocks.nth(1);
    const found=flat(await tetley.locator('.today-found').innerText());
    check(found.includes('3 site updates, 1 inspection')&&found.includes('1 access problem')&&found.includes('raised 1 defect and 2 variations'),`${label}: Tetley Hall's day in one line (${found})`);
    check(await tetley.locator('.today-found .late').count()===1&&await tetley.locator('.today-found .soon').count()===1,`${label}: the access problem and what was raised are marked`);
    const quietFound=flat(await hunslet.locator('.today-found').innerText());
    check(quietFound.includes('1 site update')&&quietFound.includes('nothing held up')&&quietFound.includes('no defects or variations'),`${label}: a quiet day says so (${quietFound})`);
    const heads=(await tetley.locator('.from-site-h').allInnerTexts()).map(flat);
    check(heads.length===3&&heads[0].startsWith('Electrical Sid Socket')&&heads[1].startsWith('Electrical Sam Spark')&&heads[2].startsWith('HVAC Hana Duct'),`${label}: both electricians and HVAC, by trade then as sent (${heads.join(' | ')})`);
    check(heads[1].includes('sent ')&&heads[1].includes(shortRef(samToday.reference)),`${label}: each says when it was sent and its reference (${heads[1]})`);
    const samLines=(await tetley.locator('.from-site-visit').nth(1).locator('li').allInnerTexts()).map(flat);
    check(/^Access ?Level 2 west/i.test(samLines[0]??''),`${label}: the access problem comes first, not cut off by "and N more" (${samLines.join(' | ')})`);
    const samShown=await tetley.locator('.from-site-visit').nth(1).locator('li').count();
    check(samShown===(phone?2:3),`${label}: ${phone?2:3} lines a card, the rest in the report (${samShown})`);
    const text=flat(await section.innerText());
    check(!text.includes('not today’s')&&!text.includes('Kirkstall yesterday')&&!text.includes('Scaffold tag'),`${label}: yesterday's updates and the inspection's checks are not read as today's`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=0,`${label}: no sideways scroll`);
    // The fix's wait, in calendar days.
    const fixRow=flat(await page.locator('.act').filter({hasText:'Fixed, to check'}).locator('.rt').first().innerText());
    check(fixRow.includes(waited===1?'waiting 1 day':waited===0?'waiting since today':`waiting ${waited} days`)&&!fixRow.includes('waiting 0 days'),`${label}: a fix put forward on yesterday's date waits ${waited} calendar day (${fixRow})`);
    if(scheme==='light'&&width===1440)await axe(page,label);
    if(shot){await section.scrollIntoViewIfNeeded();await page.screenshot({path:join(shot,`today-from-site-${scheme}-${width}.png`)});await section.screenshot({path:join(shot,`today-from-site-section-${scheme}-${width}.png`)});}
    // An update opens its report; the project's name opens its sheet.
    await tetley.locator('.from-site-h').nth(1).click();
    await page.waitForFunction(ref=>location.hash.includes('/report/')&&document.querySelector('.ws-main')?.textContent?.includes(ref),samToday.reference,{timeout:15000}).catch(()=>{});
    check(page.url().includes(`/report/${samToday.id}`),`${label}: an update opens its report (${page.url()})`);
    await page.goto(`${base}/office`);await section.locator('.today-project-h').first().waitFor();
    await blocks.nth(1).locator('.today-project-h').click();
    await page.waitForFunction(()=>/#\/projects\/[^/]+$/.test(location.hash),null,{timeout:15000}).catch(()=>{});
    check(page.url().endsWith(`#/projects/${H}`),`${label}: a project's name opens its sheet (${page.url()})`);
    check(errors.length===0,`${label}: no page errors (${errors.join('; ')})`);
    await context.close();
  }
  console.log(`verify-today-from-site: ${checks} checks passed`);
} finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit').catch(()=>{});}
  try{database().close();}catch{}
  rmSync(root,{recursive:true,force:true});
}
function blocks0(section){return section.locator('section.today-project').first();}
function shortRef(reference){return reference.split('-').slice(1).join('-')||reference;}
