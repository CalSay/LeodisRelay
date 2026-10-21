// Browser check for an engineer's first day: from the office's welcome
// message, through signing in and the home screen icon, to choosing their site
// and starting their first site update, on a 390px phone, light and dark.
// - Sign-in says which account to use and where it leads; the home screen
//   steps are plain and no longer say offline working is not possible.
// - An account with no RELAY role is told to ask the office.
// - The home screen icon ("/?open=app") opens the company picked last time;
//   the hub at "/" still asks, and a prefetch is not a pick.
// - A new engineer with more than one site is asked "Which site are you on?"
//   rather than being put on the first; the pick is kept, and their first
//   update starts on it. With a draft already, or a project in the link, no
//   question.
// - The Admin's Team tab offers a welcome message for someone not signed in
//   yet, with the link and their email, and none for someone who has.
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
const root=mkdtempSync(join(tmpdir(),'relay-first-day-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {addPerson}=require('../apps/web/.test-build/lib/people.js');
const people={
  // One new engineer per colour scheme: the first run's update would be the second's draft.
  light:{id:'entra:day-one',oid:'day-one',name:'Sam Walker',email:'sam.walker@leodisme.com',role:'Engineer',trade:'Electrical'},
  dark:{id:'entra:day-one-b',oid:'day-one-b',name:'Jo Walker',email:'jo.walker@leodisme.com',role:'Engineer',trade:'P&H'},
  // Already has a draft on Kirkstall Gate: no question, home opens on it.
  Drafter:{id:'entra:day-drafter',oid:'day-drafter',name:'Dee Draft',email:'dee@leodisme.com',role:'Engineer',trade:'HVAC'},
  Admin:{id:'entra:day-admin',oid:'day-admin',name:'Cal Say',email:'callum@leodisme.com',role:'Admin'},
};
const sessions={};
for(const [k,p] of Object.entries(people)){sessions[k]=randomUUID();putRecord('sessions',{id:sessions[k],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});}
createReport('proj-014lme',people.Drafter.name,people.Drafter);
const added=addPerson(people.Admin,{email:'new.starter@leodisme.com',name:'Nina Starter',assignment:'Engineer.PH'});
assert.ok(added.ok!==false,'seeded a new person');
// Signed in last month: the session has gone, the identity stays. Not "new".
putRecord('identities',{id:'entra:john-before',email:'john@leodisme.com',name:'John Before'});
// Used RELAY before on this phone without ever picking a site (it kept the sites for no signal).
people.returning={id:'entra:day-returning',oid:'day-returning',name:'Ray Turner',email:'ray@leodisme.com',role:'Engineer',trade:'Electrical'};
sessions.returning=randomUUID();putRecord('sessions',{id:sessions.returning,principal:people.returning,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4353,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-first-day-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
async function look(page,label,{width=390}={}){
  await page.waitForLoadState('networkidle').catch(()=>{});
  const text=await page.locator('body').innerText();
  check(!/\bNaN\b|\bundefined\b|went wrong/i.test(text),`${label}: no broken values`);
  if(width===390){const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=390,`${label}: no sideways scroll (${w})`);}
  await page.evaluate(axeSource);
  const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));
  check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);
  return text;
}
const shoot=async(page,name)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`),fullPage:true});};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const manifest=await (await fetch(base+'/manifest.webmanifest')).json();
  check(manifest.start_url==='/?open=app' && manifest.id==='/','the home screen icon opens /?open=app and keeps its id');
  for(const scheme of ['light','dark']){
    const tag=`390px ${scheme}`;
    // Signed out: the link in the welcome message.
    let context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    let page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/developments');
    check(new URL(page.url()).searchParams.get('returnTo')==='/developments',`${tag}: the link keeps where it leads through sign-in`);
    let text=await look(page,`${tag} sign in`);
    check(text.includes('Use the same Microsoft account as your work email. RELAY then opens Leodis Developments.'),`${tag}: sign-in says which account and where it leads\n${text}`);
    await page.getByText('Put RELAY on your home screen').click();
    text=await look(page,`${tag} sign in, home screen steps`);
    for(const words of ['Add to Home Screen','Open this page in Safari','Open this page in Chrome','sends it by itself when signal comes back','start your site update and take photos'])check(text.includes(words),`${tag}: home screen steps say "${words}"`);
    check(!/Installation does not enable|previously retained draft text|Offline recovery/.test(text),`${tag}: no out-of-date warning about working offline`);
    await shoot(page,`signin-home-screen-${scheme}-390`);
    await page.goto(base+'/signin?error=role');
    text=await page.locator('body').innerText();
    check(text.includes('Your account does not have the right RELAY access yet. Ask the office to sort it, then sign in again.'),`${tag}: no role reads as ask the office`);
    check(!/exactly one|administrator/i.test(text),`${tag}: no IT words on a missing role`);
    // Opened from the icon while signed out: sign-in, then back to the icon's address.
    await page.goto(base+'/?open=app');
    check(new URL(page.url()).searchParams.get('returnTo')==='/?open=app',`${tag}: the icon's address survives signing in`);
    await context.close();

    // Signed in as the new engineer.
    context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions[scheme],url:base}]);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/?open=app');
    check(new URL(page.url()).pathname==='/',`${tag}: the icon shows the hub before any company was picked`);
    await page.getByRole('heading',{name:'Select your company'}).waitFor();
    check(!(await context.cookies()).some(c=>c.name==='relay-company'),`${tag}: showing the hub picks nothing (prefetch is not a pick)`);
    await page.getByRole('link',{name:'Enter Leodis Developments Ltd'}).click();
    await page.waitForURL(/\/engineer/);
    await page.getByRole('heading',{name:'Which site are you on?'}).waitFor({timeout:15000});
    text=await look(page,`${tag} first day site choice`);
    check(text.includes('Tap your site. RELAY remembers it on this phone'),`${tag}: says the pick is remembered`);
    check(!text.includes('Current project'),`${tag}: no site is chosen for them`);
    check(!(await page.locator('.eng-project-list button[aria-pressed=true]').count()),`${tag}: no site shows as picked`);
    check(!(await page.getByText('Start today’s site update').count()),`${tag}: no update can be started before a site is picked`);
    await shoot(page,`engineer-which-site-${scheme}-390`);
    // Tap 1: their site.
    await page.getByRole('button',{name:/Kirkstall Gate - Phase 2/}).click();
    await page.getByRole('heading',{name:'Kirkstall Gate - Phase 2'}).waitFor();
    text=await look(page,`${tag} home after choosing`);
    check(text.includes('Start today’s site update'),`${tag}: home shows the big button`);
    await shoot(page,`engineer-home-after-choosing-${scheme}-390`);
    // The icon again: straight to Developments, and the site is remembered.
    await page.goto(base+'/?open=app');
    await page.waitForURL(/\/engineer/);
    await page.getByRole('heading',{name:'Kirkstall Gate - Phase 2'}).waitFor({timeout:15000});
    check(!(await page.getByRole('heading',{name:'Which site are you on?'}).count()),`${tag}: not asked again`);
    await page.goto(base+'/');
    await page.getByRole('heading',{name:'Select your company'}).waitFor();
    check(true,`${tag}: the hub at / still lets them choose`);
    // Tap 2: their first site update starts on the site they picked.
    await page.goto(base+'/engineer');
    await page.getByText('Start today’s site update').click();
    await page.waitForURL(/\/reports\//,{timeout:20000});
    await page.waitForLoadState('networkidle').catch(()=>{});
    text=await page.locator('body').innerText();
    check(text.includes('Kirkstall Gate - Phase 2') && !text.includes('Tetley Hall'),`${tag}: the first update is on the site they picked`);
    await shoot(page,`engineer-first-update-${scheme}-390`);
    // A project in the link: no question.
    const fresh=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    await fresh.addCookies([{name:'relay_session',value:sessions[scheme],url:base}]);
    const p2=await fresh.newPage();
    await p2.goto(base+'/engineer?project=proj-011lme');
    await p2.getByRole('heading',{name:'Tetley Hall - Block E'}).waitFor({timeout:15000});
    check(!(await p2.getByRole('heading',{name:'Which site are you on?'}).count()),`${tag}: a link with a project is not asked`);
    await fresh.close();
    await context.close();

    // Someone who used RELAY on this phone before the question existed: not asked.
    context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions.returning,url:base}]);
    await context.addInitScript(id=>{try{if(!localStorage.getItem(`relay-offline-projects:${id}`))localStorage.setItem(`relay-offline-projects:${id}`,'[]');}catch{}},people.returning.id);
    page=await context.newPage();
    await page.goto(base+'/engineer');
    await page.getByText('Start today’s site update').waitFor({timeout:15000});
    check(!(await page.getByRole('heading',{name:'Which site are you on?'}).count()),`${tag}: someone who used RELAY on this phone before is not asked`);
    await context.close();
    // An engineer with a draft already: home on the draft's project, no question.
    context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions.Drafter,url:base}]);
    page=await context.newPage();
    await page.goto(base+'/engineer');
    await page.getByRole('heading',{name:'Kirkstall Gate - Phase 2'}).waitFor({timeout:15000});
    check(!(await page.getByRole('heading',{name:'Which site are you on?'}).count()),`${tag}: someone with a draft is not asked`);
    await context.close();
    assert.deepEqual(errors,[],`${tag}: page errors`);
  }

  // The office: a welcome message for someone added who has not signed in.
  for(const [scheme,width] of [['dark',1440],['light',390]]){
    const tag=`${width}px ${scheme}`;
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
    await context.addCookies([{name:'relay_session',value:sessions.Admin,url:base}]);
    const page=await context.newPage();
    await page.goto(base+'/office#/team');
    await page.getByText('Nina Starter').first().click();
    const box=page.getByRole('textbox',{name:'Welcome message for Nina Starter'});
    await box.waitFor({timeout:15000});
    const words=await box.inputValue();
    check(words.startsWith('Hi Nina,'),`${tag}: welcome message greets them`);
    check(words.includes(`${base}/developments`),`${tag}: welcome message has the link`);
    check(words.includes('new.starter@leodisme.com'),`${tag}: welcome message has their work email`);
    check(words.includes('Put RELAY on your home screen') && words.includes('Start today\'s site update'),`${tag}: welcome message has the steps, in the screens' words`);
    const text=await look(page,`${tag} team welcome`,{width});
    check(text.includes('RELAY does not send it'),`${tag}: says RELAY sends nothing`);
    await page.getByRole('button',{name:'Copy welcome message'}).click();
    await page.getByText('Copied. Paste it into a text, Teams or an email.').waitFor();
    check((await page.evaluate(()=>navigator.clipboard.readText()))===words,`${tag}: Copy puts the message on the clipboard`);
    await shoot(page,`office-welcome-message-${scheme}-${width}`);
    // Signed in before, every session since gone: no welcome message.
    await page.locator('tr.clickable',{hasText:'john@leodisme.com'}).first().click();
    await page.locator('.panel-head .rowsub',{hasText:'john@leodisme.com'}).waitFor();
    check(!(await page.getByRole('button',{name:'Copy welcome message'}).count()),`${tag}: no welcome message for someone who signed in before`);
    // Signed in already (the Admin themselves): no welcome message.
    await page.locator('tr.clickable',{hasText:'callum@leodisme.com'}).first().click();
    await page.locator('.panel-head .rowsub',{hasText:'callum@leodisme.com'}).waitFor();
    check(!(await page.getByRole('button',{name:'Copy welcome message'}).count()),`${tag}: no welcome message for someone who has signed in`);
    await context.close();
  }
  console.log(`First day check passed (${checks} checks): welcome link to sign-in, plain home screen steps, the icon opens the last company, "Which site are you on?" once, first update on the picked site, and the office's welcome message, 390px light and dark plus the office at 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
