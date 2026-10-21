// Browser check for Help and what's new: the guide, the "New" marks kept per
// person on the device (none for someone opening Help for the first time, who
// is new to RELAY and gets How it works first), the two tabs, and the ways in from the engineer home,
// the office desk (also on a phone) and the app bar.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
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
const root=mkdtempSync(join(tmpdir(),'relay-help-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {whatsNewFor}=require('../apps/web/.test-build/lib/helpGuide.js');
const engineer={id:'entra:help-engineer',oid:'help-engineer',name:'Help Engineer',email:'help@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:help-manager',oid:'help-manager',name:'Help Manager',email:'helpm@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// The office's safety, permits and deliveries switch is at its default, off, so their entries are left out (lib/featureSwitch.ts).
const siteCount=whatsNewFor('site',undefined,false).length,officeCount=whatsNewFor('office',undefined,false).length;
const port=4341,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-help-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const noSideways=async(page,width,label)=>{const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=width,`${label}: no sideways scroll at ${width}px (${w})`);};

  // Signed out: sent to sign in, keeping where they were going.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/help?for=office`);await page.waitForURL(/\/signin/);
    check(decodeURIComponent(page.url()).includes('returnTo=/help?for=office'),`signed out: sign-in keeps the Help address (${page.url()})`);
    await context.close();
  }

  // Engineer, phone width, light: from the home screen.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const row=page.getByRole('link',{name:/How RELAY works and what’s new/});await row.waitFor();
    await row.getByText('Start here').waitFor();
    check(!(await page.getByText(/new to you/).count()),`engineer: home says "Start here", not ${siteCount} new, to someone who has never opened Help`);
    await row.click();await page.waitForURL(/\/help\?/);await page.locator('.help-new li').first().waitFor();
    check(new URL(page.url()).searchParams.get('for')==='site','engineer: opens on the site tab');
    check(await page.title()==='Help · RELAY',`engineer: tab named (${await page.title()})`);
    check(await page.getByRole('button',{name:'On site'}).getAttribute('aria-pressed')==='true','engineer: "On site" is selected');
    check(/How RELAY works/.test(await page.locator('h1').innerText()),'engineer: heading');
    await page.locator('.help-first').waitFor();
    check(/^How it works/.test(await page.locator('.help-section-title').first().innerText()),'engineer: on a first visit How it works comes first');
    check((await page.locator('.help-new li.is-new').count())===0&&!(await page.locator('main').innerText()).toLowerCase().includes('new to you'),'engineer: on a first visit nothing is marked New, as all of it is new to them');
    check((await page.locator('.help-new li').count())===6,'engineer: on a first visit the latest six are shown');
    const text=await page.locator('main').innerText();
    check(text.includes(whatsNewFor('site',undefined,false)[0].title)&&!text.includes('Issues by company'),'engineer: site entries, no office-only entries or links');
    check(text.includes('Your first site update')&&text.includes('Send to office')&&text.includes('Make a correction'),'engineer: the guide names the real buttons');
    check(text.includes('Fixed, to check')&&text.includes('Action needed')&&text.includes('Not emailed'),'engineer: the words explained');
    check((await page.locator('.help-steps li').count())===4,'engineer: four steps to a first update');
    await noSideways(page,390,'engineer');
    if(screenshot)await page.screenshot({path:join(screenshot,'help-site-light-390.png'),fullPage:true});
    // A page opened from Help comes back to it, on the same tab.
    await page.locator('.help-links').getByRole('link',{name:/^My week/}).click();await page.waitForURL(/\/my-week\?/);
    await page.getByRole('link',{name:'← Back to Help'}).click();await page.waitForURL(/\/help\?for=site/);await page.locator('.help-new li').first().waitFor();
    check(true,'engineer: My week opened from Help offers Back to Help');
    check((await page.locator('.help-new li.is-new').count())===0&&!(await page.locator('.help-section-title').first().innerText()).toLowerCase().includes('new to you'),'engineer: nothing is New on the next visit');
    check(/^What’s new/.test(await page.locator('.help-section-title').first().innerText())&&!(await page.locator('.help-first').count()),'engineer: on the next visit What\'s new comes first again');
    check((await page.locator('.help-new li').count())===6,'engineer: once seen, six are shown');
    await page.getByRole('button',{name:`Show all ${siteCount}`}).click();
    check((await page.locator('.help-new li').count())===siteCount,'engineer: Show all lists every entry');
    // The office tab: office-only entries are still new to this person.
    await page.getByRole('button',{name:'In the office'}).click();await page.waitForURL(/for=office/);
    const office=await page.locator('main').innerText();
    check(office.includes('Issues by company')&&office.includes('Closing an issue'),'engineer: the office tab explains the office side');
    check(!(await page.locator('main a[href^="/companies"],main a[href^="/coverage"],main a[href^="/office"]').count()),'engineer: the office tab offers no page an engineer cannot open');
    check((await page.locator('.help-new li.is-new').count())===officeCount-whatsNewFor('office',undefined,false).filter(e=>e.audience==='all').length,'engineer: only the office-only entries are new on the office tab');
    await page.goto(`${base}/engineer?project=proj-011lme`);await page.getByRole('link',{name:/How RELAY works and what’s new/}).waitFor();
    await page.waitForTimeout(300);
    check(!(await page.getByText(/new to you/).count())&&!(await page.getByText('Start here').count()),'engineer: home no longer shows a new count or Start here');
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Engineer, desktop, dark: back to home, and printable.
  {
    const {context,page,errors}=await open('Engineer','dark',1440);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('link',{name:/How RELAY works and what’s new/}).click();await page.waitForURL(/\/help\?/);await page.locator('.help-new li').first().waitFor();
    if(screenshot)await page.screenshot({path:join(screenshot,'help-site-dark-1440.png'),fullPage:true});
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
    await page.waitForFunction(n=>document.querySelectorAll('.help-new li').length===n,siteCount);
    check(true,'print: the whole list is shown for printing');
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.appbar').isVisible())&&!(await page.locator('.help-tabs').isVisible())&&!(await page.locator('.back').isVisible()),'print: app bar, tabs and back link hidden');
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.help-card')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white cards in dark mode (${bg})`);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('link',{name:'← Back to Site'}).click();await page.waitForURL(/\/engineer\?project=proj-011lme$/);
    check(true,'desktop: Back to Site returns to the home screen');
    assert.deepEqual(errors,[],'desktop: page errors');
    await context.close();
  }

  // Manager, desktop, dark: from the office desk's Help.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects`);
    let help=page.locator('.tbtn-help');await help.waitFor();await page.waitForTimeout(300);
    check(!(await page.locator('.tbtn-help .tbtn-new').count()),'manager: no count on Help for someone who has never opened it');
    // Someone who opened Help before the last two entries were added.
    const older=whatsNewFor('office',undefined,false).slice(2).map(e=>e.id);
    await page.evaluate(([id,seen])=>localStorage.setItem(`relay-help-seen:${id}`,JSON.stringify(seen)),[manager.id,older]);
    await page.reload();help=page.locator('.tbtn-help');await help.waitFor();
    await page.waitForFunction(()=>document.querySelector('.tbtn-help .tbtn-new')?.textContent==='2');
    check(true,'manager: Help shows the 2 added since their last visit');
    await help.click();
    await page.getByRole('link',{name:/How RELAY works and what’s new/}).click();await page.waitForURL(/\/help\?/);await page.locator('.help-new li').first().waitFor();
    check(new URL(page.url()).searchParams.get('for')==='office','manager: opens on the office tab');
    const text=await page.locator('main').innerText();
    check(text.includes('Your day in the office')&&text.includes('Seen by the office')&&text.includes('Site coverage'),'manager: the office guide and office links');
    if(screenshot)await page.screenshot({path:join(screenshot,'help-office-dark-1440.png'),fullPage:true});
    await page.locator('.help-links').getByRole('link',{name:/^Issues by company/}).click();await page.waitForURL(/\/companies\?/);
    await page.getByRole('link',{name:'← Back to Help'}).click();await page.waitForURL(/\/help\?for=office/);
    check(true,'manager: Issues by company opened from Help comes back to Help');
    await page.getByRole('link',{name:'← Back to Office'}).click();await page.waitForURL(/\/office/);
    await page.locator('.tbtn-help').waitFor();await page.waitForTimeout(300);
    check(!(await page.locator('.tbtn-help .tbtn-new').count()),'manager: the count is gone once seen');
    // Other pages carry Help in the app bar.
    await page.goto(`${base}/projects`);await page.locator('.appbar').waitFor();
    check(await page.locator('.appbar').getByRole('link',{name:'Help'}).isVisible(),'manager: the app bar offers Help');
    assert.deepEqual(errors,[],'manager: page errors');
    await context.close();
  }

  // Manager, phone, light: Help stays in reach on the office desk.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/office#/projects`);
    const help=page.locator('.tbtn-help');await help.waitFor();
    check(await help.isVisible(),'office phone: Help is shown');
    await help.click();await page.getByRole('link',{name:/How RELAY works and what’s new/}).click();await page.waitForURL(/\/help\?/);await page.locator('.help-new li').first().waitFor();
    await noSideways(page,390,'office phone');
    if(screenshot)await page.screenshot({path:join(screenshot,'help-office-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'office phone: page errors');
    await context.close();
  }
  console.log(`Help check passed (${checks} checks): home, office desk and app bar routes, both tabs, New marks kept per person, Back to Help, print, light and dark, 390 and 1440px.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
