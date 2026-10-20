// Browser check for site information: the office adds a project's address,
// hours, access, safety notes and contacts; an engineer finds them from the
// home screen with dial and map links; a save made on an older copy is shown
// the newer one; the copy kept on the phone shows with no connection and on
// the offline screen, and goes on sign out. Phone and desktop, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-site-info-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:site-engineer',oid:'site-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:site-manager',oid:'site-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const PROJECT='proj-011lme';
const port=4342,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-site-info-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const noSideways=async(page,width,label)=>{const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=width,`${label}: no sideways page scroll at ${width}px (${w})`);};

  // Signed out: sent to sign in with the address kept; the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/site-info?project=${PROJECT}`);await page.waitForURL(/\/signin/);
    check(new URL(page.url()).searchParams.get('returnTo')===`/site-info?project=${PROJECT}`,'signed out: sign-in keeps the address');
    const res=await page.request.get(`${base}/api/site-info?projectId=${PROJECT}`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer before anything is recorded: reads, cannot write.
  {
    const {context,page}=await open('Engineer','light',390);
    const read=await page.request.get(`${base}/api/site-info?projectId=${PROJECT}`);
    const body=await read.json();
    check(read.ok()&&body.info===null&&body.canEdit===false,`engineer: reads an empty record and may not edit: ${JSON.stringify(body)}`);
    const write=await page.request.put(`${base}/api/site-info`,{data:{projectId:PROJECT,version:0,address:'Nowhere'}});
    check(write.status()===403,`engineer: the API refuses a save (${write.status()})`);
    const tender=await page.request.get(`${base}/api/site-info?projectId=proj-nope`);
    check(tender.status()===404,`engineer: an unknown project is refused (${tender.status()})`);
    await page.goto(`${base}/site-info?project=${PROJECT}`);await page.getByText('The office has not added anything for this site yet.').waitFor();
    check(await page.getByRole('button',{name:/site information/i}).count()===0,'engineer: no edit button');
    await context.close();
  }

  // Office, desktop, dark: from the project sheet, add everything, then a refused number and a conflict.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects/${PROJECT}`);
    await page.getByRole('link',{name:'Site information'}).click();await page.waitForURL(/\/site-info\?/);
    check(new URL(page.url()).searchParams.get('project')===PROJECT,'office: the project sheet opens its site information');
    await page.getByText('Nothing recorded for this site yet.').waitFor();
    await page.getByRole('button',{name:'Add site information'}).click();
    check(await page.getByText(/Do not put door codes, keysafe numbers or alarm codes here/).isVisible(),'office: the form warns against codes');
    await page.getByRole('textbox',{name:'Address'}).fill('Tetley Hall, Block E\nKirkstall Road\nLeeds LS4 2AB');
    await page.getByRole('textbox',{name:'Site hours'}).fill('Monday to Friday 7.30am to 5pm');
    await page.getByRole('textbox',{name:'Getting in and parking'}).fill('Park on Kirkstall Road. Sign in at the welfare cabin by gate 2.');
    await page.getByRole('textbox',{name:'Safety and induction'}).fill('Site induction on first visit. Hard hat, boots, hi-vis and gloves.');
    const rows=page.locator('.site-contact-row');
    await rows.nth(0).getByLabel('Name').fill('Jo Bloggs');await rows.nth(0).getByLabel('Role').fill('Site manager');await rows.nth(0).getByLabel('Phone').fill('ring the gate');
    await page.getByRole('button',{name:'Save site information'}).click();
    await page.getByRole('alert').filter({hasText:'does not look like a phone number'}).waitFor();
    check(await page.getByRole('textbox',{name:'Address'}).inputValue()!=='','office: a refused number keeps the form as typed');
    await rows.nth(0).getByLabel('Phone').fill('07700 900123');
    await page.getByRole('button',{name:'Add a contact'}).click();
    await rows.nth(1).getByLabel('Name').fill('Gatehouse');await rows.nth(1).getByLabel('Phone').fill('+44 113 496 0000');
    await page.getByRole('button',{name:'Add a contact'}).click();
    check(await rows.count()===3,'office: a third contact row can be added');
    await rows.nth(2).getByRole('button',{name:'Remove'}).click();
    check(await rows.count()===2,'office: and removed');
    await page.getByRole('button',{name:'Save site information'}).click();
    await page.getByText('Saved. Everyone on the project now sees this version.').waitFor();
    const text=await page.locator('main').innerText();
    check(text.includes('Kirkstall Road')&&text.includes('Monday to Friday')&&text.includes('welfare cabin')&&text.includes('hi-vis'),'office: every section shows what was saved');
    check(await page.getByRole('link',{name:'Call Jo Bloggs on 07700 900123'}).getAttribute('href')==='tel:07700900123','office: the contact has a dial link');
    check(/Office Manager changed address, contacts, site hours, getting in and parking and safety and induction|Office Manager changed address, site hours/.test(await page.locator('.site-history').innerText()),'office: the change is in the history');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-info-office-dark-1440.png'),fullPage:true});
    // Someone else saves while this person is editing.
    await page.getByRole('button',{name:'Edit site information'}).click();
    await page.getByRole('textbox',{name:'Site hours'}).fill('Monday to Saturday 8am to 4pm');
    const current=await (await page.request.get(`${base}/api/site-info?projectId=${PROJECT}`)).json();
    const other=await page.request.put(`${base}/api/site-info`,{data:{projectId:PROJECT,version:current.info.version,...current.info,access:'Use gate 3 from Monday.'}});
    check(other.ok(),'office: another save lands first');
    await page.getByRole('button',{name:'Save site information'}).click();
    await page.getByRole('alert').filter({hasText:'saved a newer copy while you were editing'}).waitFor();
    check(await page.locator('.site-newer').innerText().then(t=>t.includes('Use gate 3 from Monday.')),'office: the newer copy is shown');
    check(await page.getByRole('textbox',{name:'Site hours'}).inputValue()==='Monday to Saturday 8am to 4pm','office: this person\'s change is still in the form');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-info-conflict-dark-1440.png'),fullPage:true});
    await page.getByRole('textbox',{name:'Getting in and parking'}).fill('Use gate 3 from Monday. Park on Kirkstall Road.');
    await page.getByRole('button',{name:'Save site information'}).click();
    await page.getByText('Saved. Everyone on the project now sees this version.').waitFor();
    const saved=await (await page.request.get(`${base}/api/site-info?projectId=${PROJECT}`)).json();
    check(saved.info.version===3&&saved.info.hours.startsWith('Monday to Saturday')&&saved.info.access.startsWith('Use gate 3'),`office: saving again after seeing it keeps both: ${JSON.stringify([saved.info.version,saved.info.hours,saved.info.access])}`);
    await page.getByRole('link',{name:'← Back'}).click();await page.waitForURL(/\/office/);
    check(true,'office: Back returns to the office');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Engineer on a phone, light: from the home screen, read-only, dial and map links, offline copy.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/engineer?project=${PROJECT}`);
    const row=page.locator('a.eng-row').filter({hasText:'Site information'});
    await row.filter({hasText:'2 contacts'}).waitFor();
    check((await row.innerText()).includes('Tetley Hall, Block E'),'engineer: the home row shows the first line of the address and the contacts');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-info-home-light-390.png'),fullPage:true});
    await row.click();await page.waitForURL(/\/site-info\?/);await page.locator('.site-sections').waitFor();
    check(await page.getByRole('button',{name:/Edit site information/}).count()===0,'engineer: no edit button');
    check((await page.getByRole('link',{name:'Open in Maps'}).getAttribute('href')).startsWith('https://www.google.com/maps/search/?api=1&query=Tetley%20Hall%2C%20Block%20E%2C%20Kirkstall%20Road'),'engineer: the address opens in maps');
    check(await page.getByRole('link',{name:'Call Gatehouse on +44 113 496 0000'}).getAttribute('href')==='tel:+441134960000','engineer: an international number dials');
    check(/Updated .* by Office Manager\./.test(await page.locator('.site-stamp').innerText()),'engineer: says who updated it and when');
    await noSideways(page,390,'engineer');
    const call=await page.getByRole('link',{name:/^Call Jo Bloggs/}).boundingBox();
    check(call.height>=48,`engineer: the call button is a full touch target (${call.height}px)`);
    if(screenshot)await page.screenshot({path:join(screenshot,'site-info-engineer-light-390.png'),fullPage:true});
    // No connection: choosing the project again shows the copy kept on the phone.
    await context.setOffline(true);
    await page.getByLabel('Project').selectOption('proj-014lme');
    await page.getByRole('alert').filter({hasText:'no saved copy yet'}).waitFor();
    check(true,'offline: a project never opened says there is no copy');
    await page.getByLabel('Project').selectOption(PROJECT);
    await page.getByText(/No connection\. Showing the copy kept on this device/).waitFor();
    check((await page.locator('main').innerText()).includes('Use gate 3 from Monday.'),'offline: the kept copy shows the latest saved version');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-info-offline-light-390.png'),fullPage:true});
    await context.setOffline(false);
    // The offline screen lists the kept copy, with dial links.
    await page.goto(`${base}/offline.html`);
    const sites=page.locator('#sites');await sites.getByText('Site information kept on this phone').waitFor();
    const offlineText=await sites.innerText();
    check(offlineText.includes('Tetley Hall - Block E')&&offlineText.includes('Kirkstall Road')&&offlineText.includes('hi-vis'),'offline screen: the kept site information is there');
    check(await sites.getByRole('link',{name:'Call 07700 900123'}).getAttribute('href')==='tel:07700900123','offline screen: with dial links');
    // Signing out clears the kept copies.
    await page.goto(`${base}/engineer?project=${PROJECT}`);await row.filter({hasText:'2 contacts'}).waitFor();
    await page.getByRole('button',{name:'Sign out'}).click();await page.waitForURL(/\/signin/);
    const left=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('relay-site-info:')));
    check(left.length===0,`sign out: no kept copies are left (${JSON.stringify(left)})`);
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Office on a phone, light: the form fits.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/site-info?project=${PROJECT}`);await page.getByRole('button',{name:'Edit site information'}).click();
    await noSideways(page,390,'office phone form');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-info-form-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'office phone: page errors');
    await context.close();
  }
  console.log(`Site information check passed (${checks} checks): access rules, office editing with refused input and a conflicting save, engineer home and page with dial and map links, offline copy, offline screen, sign out, phone and desktop, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
