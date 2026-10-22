// Browser check for the Team tab's "Last sent" column, walked as the office
// gets a new site reporting: a new engineer added who has not signed in, then
// signed in with nothing sent, then their first site update on the new site;
// an engineer already on another site moving to it. 1440px dark and light, and
// a 390px phone light, for the Admin's list and the Manager's.
// - Each person says "Not signed in yet", "Nothing sent yet" with when they
//   signed in, or the site and day of their latest sent report, with no click.
// - The site opens that report. A draft does not count as sent.
// - Whether someone is signed in now moved to their own panel; no "No session"
//   or "Session expired" left on the list.
// - Under it, the days this week they sent a report for and how many sites
//   ("This week: Mon, today · 2 sites"), or "Nothing sent this week".
// - Someone off the list who signed in once and sent a report in the last
//   fortnight stays listed after their session has gone; someone whose last
//   report is older does not.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
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
const root=mkdtempSync(join(tmpdir(),'relay-team-last-sent-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {addPerson}=require('../apps/web/.test-build/lib/people.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {dateShort}=require('../apps/web/.test-build/lib/dates.js');
const people={
  Admin:{id:'entra:last-sent-admin',oid:'last-sent-admin',name:'Cal Say',email:'callum@leodisme.com',role:'Admin'},
  Manager:{id:'entra:last-sent-manager',oid:'last-sent-manager',name:'Office Manager',email:'office.manager@leodisme.com',role:'Manager'},
  // Already reporting from Tetley Hall; signed in last week, no session now.
  Ray:{id:'entra:last-sent-ray',oid:'last-sent-ray',name:'Ray Turner',email:'ray.turner@leodisme.com',role:'Engineer',trade:'Electrical'},
  // New to RELAY, starting on Kirkstall Gate.
  Nina:{id:'entra:last-sent-nina',oid:'last-sent-nina',name:'Nina Starter',email:'nina.starter@leodisme.com',role:'Engineer',trade:'P&H'},
  // Assigned in Microsoft but never put on RELAY's list; signed out since.
  Olly:{id:'entra:last-sent-olly',oid:'last-sent-olly',name:'Olly Offlist',email:'olly.offlist@leodisme.com',role:'Engineer',trade:'HVAC'},
  // The same, but his last report was three weeks ago.
  Gus:{id:'entra:last-sent-gus',oid:'last-sent-gus',name:'Gus Gone',email:'gus.gone@leodisme.com',role:'Engineer',trade:'HVAC'},
};
const sessions={};
const signIn=k=>{sessions[k]=randomUUID();putRecord('sessions',{id:sessions[k],principal:people[k],issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});putRecord('identities',{id:people[k].id,email:people[k].email,name:people[k].name});};
signIn('Admin');signIn('Manager');
for(const k of ['Ray','Nina'])assert.ok(addPerson(people.Admin,{email:people[k].email,name:people[k].name,assignment:k==='Ray'?'Engineer.Electrical':'Engineer.PH'}).ok,`added ${k}`);
for(const k of ['Ray','Olly','Gus'])putRecord('identities',{id:people[k].id,email:people[k].email,name:people[k].name});
const today=londonDay(new Date().toISOString());
const dayBefore=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
let seq=0;
const sent=(who,projectId,number,visitDate,at=`${visitDate}T14:00:00.000Z`,state='submitted')=>{
  const id=`rep-last-sent-${++seq}`;
  putRecord('reports',{id,projectId,reference:`${number}-SPR-${String(seq).padStart(3,'0')}`,visitDate,author:who.name,authorId:who.id,authorTrade:who.trade,state,version:3,revision:1,review:'not_required',
    observations:[{id:randomUUID(),type:'update',location:'Plant room',whatHappened:'First fix pipework started',actionNeeded:'',owner:'',photos:[]}],lastSavedAt:at,
    ...(state==='submitted'?{serverAcknowledgedAt:at,delivery:'filed',signature:{name:who.name,signedAt:at}}:{})});
  return id;
};
sent(people.Ray,'proj-011lme','011LME',dayBefore(3));
const rayYesterday=sent(people.Ray,'proj-011lme','011LME',dayBefore(1));
sent(people.Olly,'proj-014lme','014LME',dayBefore(2));
sent(people.Gus,'proj-014lme','014LME',dayBefore(21));
// What the week line should say for these visit days and sites (Monday to today, London).
const monday=dayBefore((new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7);
const weekWords=(visits)=>{
  const mine=visits.filter(([d])=>d>=monday&&d<=today);
  if(!mine.length)return 'Nothing sent this week';
  const days=[...new Set(mine.map(([d])=>d))].sort().map(d=>d===today?'today':['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(`${d}T12:00:00Z`).getUTCDay()]);
  const sites=new Set(mine.map(([,p])=>p)).size;
  return `This week: ${days.join(', ')}${sites>1?` · ${sites} sites`:''}`;
};

const port=4357,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-last-sent-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
const shoot=async(page,name)=>{if(screenshot){
  // The new people are at the foot of the list, which scrolls inside the desk.
  await page.locator('tr',{hasText:people.Nina.email}).first().evaluate(e=>e.scrollIntoView({block:'center'}));
  await page.mouse.move(0,0);await page.waitForTimeout(300);await page.screenshot({path:join(screenshot,`${name}.png`),fullPage:page.viewportSize().width<700});}};
async function look(page,label,width){
  await page.waitForLoadState('networkidle').catch(()=>{});
  const text=await page.locator('body').innerText();
  check(!/\bNaN\b|\bundefined\b|went wrong/i.test(text),`${label}: no broken values`);
  if(width===390){const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=390,`${label}: no sideways scroll (${w})`);}
  await page.evaluate(axeSource);
  const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));
  check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);
  return text;
}
/** The "Last sent" cell on someone's row, in words. */
const cell=async(page,email)=>{
  const row=page.locator('tr',{hasText:email}).first();
  await row.waitFor();
  // Words as written (a tag shows in capitals on screen), each part of the cell apart; the week line is read on its own.
  return row.locator('td[data-label="Last sent"]').evaluate(td=>[...td.children].filter(c=>!c.hasAttribute('data-week')).map(c=>c.textContent.trim()).join(' ').replace(/\s+/g,' '));
};
/** The line under it for this week, or null when there is none. */
const weekLine=async(page,email)=>{
  const line=page.locator('tr',{hasText:email}).first().locator('td[data-label="Last sent"] [data-week]');
  return (await line.count())?(await line.textContent()).trim():null;
};
const team=async(who,width,scheme)=>{
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
  await context.addCookies([{name:'relay_session',value:sessions[who],url:base}]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/office#/team');
  await page.locator('tr',{hasText:people.Nina.email}).first().locator('td[data-label="Last sent"]').waitFor({timeout:20000});
  // The desk shows the column's heading; a phone shows each value labelled instead.
  if(width>700)await page.locator('th',{hasText:'Last sent'}).first().waitFor();
  return {context,page,errors};
};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});

  // 1. Added, not signed in yet; Ray reporting from Tetley Hall.
  for(const [who,width,scheme] of [['Admin',1440,'dark'],['Admin',1440,'light'],['Manager',1440,'dark'],['Admin',390,'light']]){
    const tag=`${who} ${width}px ${scheme}, before`;
    const {context,page,errors}=await team(who,width,scheme);
    const text=await look(page,tag,width);
    check(!/No session|Session expired/.test(text),`${tag}: no session words on the list`);
    check(await cell(page,people.Nina.email)==='Not signed in yet',`${tag}: Nina reads "Not signed in yet" (${await cell(page,people.Nina.email)})`);
    check(await cell(page,people.Ray.email)==='Tetley Hall - Block E Visit yesterday',`${tag}: Ray reads his site and day (${await cell(page,people.Ray.email)})`);
    check(/^Nothing sent yet Signed in /.test(await cell(page,people.Admin.email)),`${tag}: someone signed in with nothing sent says so (${await cell(page,people.Admin.email)})`);
    const rayWeek=weekWords([[dayBefore(3),'proj-011lme'],[dayBefore(1),'proj-011lme']]);
    check(await weekLine(page,people.Ray.email)===rayWeek,`${tag}: Ray's week reads "${rayWeek}" (${await weekLine(page,people.Ray.email)})`);
    check(await weekLine(page,people.Nina.email)===null && await weekLine(page,people.Admin.email)===null,`${tag}: no week line for someone who has sent nothing`);
    // Off the list, no session: kept while he sent something in the last fortnight.
    check(await cell(page,people.Olly.email)===`Kirkstall Gate - Phase 2 Visit ${dateShort(dayBefore(2),'auto')}`,`${tag}: Olly, off the list, is still there with his site (${await cell(page,people.Olly.email)})`);
    check(await weekLine(page,people.Olly.email)===weekWords([[dayBefore(2),'proj-014lme']]),`${tag}: and his week (${await weekLine(page,people.Olly.email)})`);
    const ollyRow=await page.locator('tr',{hasText:people.Olly.email}).first().innerText();
    check(who==='Admin'?/Not on the checklist/.test(ollyRow):/Engineer · HVAC/.test(ollyRow),`${tag}: Olly reads as off the list${who==='Admin'?'':', with the trade from his report'} (${ollyRow.replace(/\s+/g,' ')})`);
    check(!text.includes(people.Gus.email),`${tag}: Gus, off the list and last sent three weeks ago, is not listed`);
    if(who==='Manager'){
      const signedAt=row=>page.locator('tr',{hasText:row}).first().locator('td[data-label="Signed in at"]').innerText();
      check((await signedAt(people.Manager.email)).includes('Signed in now'),`${tag}: the Manager's list still says who is signed in now`);
      check(!(await signedAt(people.Ray.email)).includes('Signed in now'),`${tag}: and not for someone with no session`);
    }
    await shoot(page,`team-before-${who.toLowerCase()}-${scheme}-${width}`);
    // The site opens the report it was sent in.
    await page.locator('tr',{hasText:people.Ray.email}).first().getByRole('link',{name:'Tetley Hall - Block E'}).click();
    await page.waitForFunction(id=>location.hash.endsWith(`/report/${id}`),rayYesterday);
    check(true,`${tag}: Ray's site opens his latest report`);
    assert.deepEqual(errors,[],`${tag}: page errors`);
    await context.close();
  }

  // 2. Nina signs in and starts an update (a draft is not sent).
  signIn('Nina');
  sent(people.Nina,'proj-014lme','014LME',today,new Date().toISOString(),'draft');
  {
    const tag='Admin 1440px dark, signed in';
    const {context,page,errors}=await team('Admin',1440,'dark');
    check(/^Nothing sent yet Signed in /.test(await cell(page,people.Nina.email)),`${tag}: Nina reads "Nothing sent yet" with when she signed in (${await cell(page,people.Nina.email)})`);
    // Signed in now is on her own panel.
    await page.locator('tr.clickable',{hasText:people.Nina.email}).click();
    await page.locator('.panel-head .rowsub',{hasText:people.Nina.email}).waitFor();
    const panel=await page.locator('.panel',{has:page.locator('.panel-head .rowsub',{hasText:people.Nina.email})}).innerText();
    check(panel.includes('Signed in now'),`${tag}: her panel says she is signed in now`);
    // Ray has no session now: his panel still says he signed in before.
    await page.locator('tr.clickable',{hasText:people.Ray.email}).click();
    await page.locator('.panel-head .rowsub',{hasText:people.Ray.email}).waitFor();
    const rayPanel=await page.locator('.panel',{has:page.locator('.panel-head .rowsub',{hasText:people.Ray.email})}).innerText();
    check(rayPanel.includes('Not signed in now') && !/Not yet/.test(rayPanel),`${tag}: Ray's panel says he signed in before, not now`);
    await look(page,tag,1440);
    await shoot(page,`team-signed-in-admin-dark-1440`);
    assert.deepEqual(errors,[],`${tag}: page errors`);
    await context.close();
  }

  // 3. Nina's first update on Kirkstall Gate arrives, and Ray moves there too.
  const ninaFirst=sent(people.Nina,'proj-014lme','014LME',today,new Date().toISOString());
  sent(people.Ray,'proj-014lme','014LME',today,new Date(Date.now()+1000).toISOString());
  // Then corrects last week's Tetley Hall report: he is still on the new site.
  sent(people.Ray,'proj-011lme','011LME',dayBefore(3),new Date(Date.now()+2000).toISOString());
  for(const [who,width,scheme] of [['Admin',1440,'dark'],['Admin',1440,'light'],['Manager',1440,'light'],['Admin',390,'light']]){
    const tag=`${who} ${width}px ${scheme}, after`;
    const {context,page,errors}=await team(who,width,scheme);
    await look(page,tag,width);
    check(await cell(page,people.Nina.email)==='Kirkstall Gate - Phase 2 Visit today',`${tag}: Nina reads the new site, today (${await cell(page,people.Nina.email)})`);
    check(await cell(page,people.Ray.email)==='Kirkstall Gate - Phase 2 Visit today',`${tag}: Ray reads the new site he moved to (${await cell(page,people.Ray.email)})`);
    const rayWeek=weekWords([[dayBefore(3),'proj-011lme'],[dayBefore(1),'proj-011lme'],[today,'proj-014lme']]);
    check(await weekLine(page,people.Ray.email)===rayWeek,`${tag}: Ray's week now has today and the second site: "${rayWeek}" (${await weekLine(page,people.Ray.email)})`);
    check(await weekLine(page,people.Nina.email)==='This week: today',`${tag}: Nina's week reads "This week: today" (${await weekLine(page,people.Nina.email)})`);
    if(who==='Admin'&&width===1440)await page.locator('tr.clickable',{hasText:people.Nina.email}).click();
    await shoot(page,`team-after-${who.toLowerCase()}-${scheme}-${width}`);
    await page.locator('tr',{hasText:people.Nina.email}).first().getByRole('link',{name:'Kirkstall Gate - Phase 2'}).click();
    await page.waitForFunction(id=>location.hash.endsWith(`/report/${id}`),ninaFirst);
    check(true,`${tag}: Nina's site opens her first update`);
    assert.deepEqual(errors,[],`${tag}: page errors`);
    await context.close();
  }
  // Engineers cannot read the team.
  check((await fetch(base+'/api/office/team',{headers:{cookie:`relay_session=${sessions.Nina}`}})).status===403,'engineers cannot read the team');
  console.log(`Team last sent check passed (${checks} checks): "Not signed in yet", "Nothing sent yet" and the site and day of the latest sent report on the Admin's and Manager's Team lists, linked to the report; drafts not counted; signed in now on the person's panel; the days and sites this week under it; someone off the list kept while they sent in the last fortnight; 1440px dark and light, 390px light.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
