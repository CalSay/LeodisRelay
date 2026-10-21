// Browser check for open issues by company: the office's view of what each
// company or person still has to put right across every project, opened from
// the office overview and the issue register, with counts, the oldest item,
// recent closures, issues with nobody named, finding a company, a snag list
// opened and come back from, office-only access, phone and desktop, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-companies-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:co-engineer',oid:'co-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:co-manager',oid:'co-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(n)=>`${addDays(today,n)}T10:00:00Z`;
let seq=0;
const issue=(extra)=>{seq++;const i={id:randomUUID(),reference:`011LME-ISS-${String(seq).padStart(3,'0')}`,projectId:'proj-011lme',location:'Level 2 riser',description:`Seeded issue ${seq}`,actionNeeded:'Make good',confirmation:'confirmed',work:'assigned',owner:'Acme Mechanical Ltd',targetDate:'',raisedByReport:'',raisedAt:at(-3),affectedTrade:'HVAC',events:[{at:at(-3),actor:engineer.name,kind:'raised',note:'',photos:[]}],...extra};putRecord('issues',i);return i;};
const verified=(n)=>[{at:at(-30),actor:engineer.name,kind:'raised',note:'',photos:[]},{at:at(n),actor:manager.name,kind:'verified',note:'Checked',photos:[]}];
const acmeOldest=issue({raisedAt:at(-20),targetDate:addDays(today,-10),description:'Duct hanger missing'});
issue({raisedAt:at(-5)});
issue({projectId:'proj-014lme',reference:'014LME-ISS-001',work:'awaiting_verification',raisedAt:at(-25),targetDate:addDays(today,-15)});
const withdrawn=issue({confirmation:'withdrawn',reference:'011LME-ISS-090'});
issue({owner:'Sparks Ltd',affectedTrade:'Electrical',targetDate:addDays(today,7)});
issue({owner:'sparks  ltd',affectedTrade:'Electrical',raisedAt:at(-2)});
issue({owner:'Sparks Ltd',affectedTrade:'Electrical',work:'closed',events:verified(-3)});
issue({owner:'Tidy Plumbing',affectedTrade:'P&H',work:'closed',events:verified(-5)});
issue({owner:'Long Gone Co',work:'closed',events:verified(-60)});
issue({owner:'',targetDate:addDays(today,-1)});
const port=4342,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-companies-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const cardOf=(page,name)=>page.locator('.co-card').filter({has:page.locator('h2',{hasText:new RegExp(`^${name}$`)})});
const num=async(card,label)=>(await card.locator('.co-nums div').filter({has:card.page().locator('dt',{hasText:label})}).locator('dd').innerText()).trim();
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: sent to sign in with the search kept, and the API refuses.
  {
    const {context,page}=await open(null,'light',390);
    await page.goto(`${base}/companies?q=acme`);await page.waitForURL(/\/signin/);
    check(new URL(page.url()).searchParams.get('returnTo')==='/companies?q=acme','signed out: sign-in keeps the address');
    const res=await page.request.get(`${base}/api/company-issues`);
    check(res.status()===401,`signed out: the API refuses (${res.status()})`);
    await context.close();
  }

  // Engineer: an office view, so the page sends them on and the API refuses.
  {
    const {context,page}=await open('Engineer','light',390);
    await page.goto(`${base}/companies`);await page.waitForURL(u=>!u.pathname.startsWith('/companies'));
    check(true,`engineer: sent away from the page (${new URL(page.url()).pathname})`);
    const res=await page.request.get(`${base}/api/company-issues`);
    check(res.status()===403,`engineer: the API refuses (${res.status()})`);
    await context.close();
  }

  // Office, desktop, dark: opened from the office overview.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects`);
    await page.getByRole('link',{name:'By company'}).click();await page.waitForURL(/\/companies\?/);await page.locator('.co-list').waitFor();
    check(true,'office: the overview links to open issues by company');
    const names=await page.locator('.co-card h2').allInnerTexts();
    check(JSON.stringify(names)===JSON.stringify(['Acme Mechanical Ltd','Sparks Ltd','Tidy Plumbing']),`office: past target first, one Sparks for two spellings, a recent closure shown, an old one not: ${JSON.stringify(names)}`);
    const acme=cardOf(page,'Acme Mechanical Ltd');
    check(await num(acme,'To put right')==='2'&&await num(acme,'Past target')==='1'&&await num(acme,'Fixed, to check')==='1',`office: Acme counts, the withdrawn issue left out and fixed work waiting for the office not late, as on the register`);
    check(await acme.evaluate(e=>e.classList.contains('co-late'))&&/1 past target/i.test(await acme.locator('.co-top .tag').innerText()),'office: a company with late work is marked');
    const oldest=await acme.locator('.co-oldest').innerText();
    check(oldest.includes(acmeOldest.reference)&&/20 days since it was raised/.test(oldest),`office: the oldest item and its age: ${JSON.stringify(oldest)}`);
    const projects=await acme.locator('.co-projects li').allInnerTexts();
    check(projects.length===2&&projects[0].includes('011LME')&&projects[0].includes('2 to put right · 1 past target')&&projects[1].includes('014LME')&&projects[1].includes('1 to check')&&!projects[1].includes('past target'),`office: one line per project, most late first: ${JSON.stringify(projects)}`);
    check(/HVAC/.test(await acme.locator('.co-trades').innerText()),'office: the trade is shown');
    const sparks=cardOf(page,'Sparks Ltd');
    check(await num(sparks,'To put right')==='2'&&await num(sparks,'Closed, 4 weeks')==='1',`office: Sparks has two to do and one closed lately`);
    const tidy=cardOf(page,'Tidy Plumbing');
    check(/All clear/i.test(await tidy.locator('.co-top').innerText())&&/Nothing open/.test(await tidy.innerText()),'office: a company with only closed work is all clear');
    const stats=await page.locator('.co-stats').innerText();
    check(/Companies with work\s*2/i.test(stats)&&/4 issues to put right/.test(stats)&&/Past target\s*1/i.test(stats)&&/Fixed, to check\s*1/i.test(stats)&&/Closed lately\s*2/i.test(stats),`office: headline counts: ${JSON.stringify(stats)}`);
    const unassigned=await page.locator('.co-unassigned').innerText();
    check(/1 open issue with nobody named, 1 past target/.test(unassigned),`office: issues with nobody named: ${JSON.stringify(unassigned)}`);
    check(!(await page.locator('main').innerText()).includes(withdrawn.reference),'office: the withdrawn issue is nowhere on the page');
    if(screenshot)await page.screenshot({path:join(screenshot,'companies-dark-1440.png'),fullPage:true});
    // Finding a company narrows the cards and the address keeps it.
    await page.getByLabel('Find a company or person').fill('  SPARKS ');
    await page.waitForURL(/q=SPARKS/);
    check((await page.locator('.co-card').count())===1&&/1 of 3 match/.test(await page.locator('.co-count').innerText()),'office: finding a company narrows the list');
    await page.getByLabel('Find a company or person').fill('acme');await page.waitForURL(/q=acme/);
    // A snag list opened from a project line is for that company and project, and Back comes here.
    await page.getByRole('link',{name:'Snag list for Acme Mechanical Ltd on Tetley Hall'}).click();
    await page.waitForURL(/\/issues\/snag-list\?/);await page.locator('.snag-sheet').waitFor();
    const params=new URL(page.url()).searchParams;
    check(params.get('project')==='proj-011lme'&&params.get('owner')==='Acme Mechanical Ltd','office: the snag list opens on that project and company');
    check(/2 to put right/.test(await page.locator('.snag-summary').innerText()),'office: the snag list shows the same two items');
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/companies\?q=acme/);await page.locator('.co-list').waitFor();
    // The other project's snag list agrees on what is late and what is waiting to be checked.
    await page.getByRole('link',{name:'Snag list for Acme Mechanical Ltd on Kirkstall Gate - Phase 2'}).click();
    await page.waitForURL(/\/issues\/snag-list\?/);await page.locator('.snag-sheet').waitFor();
    const late=await page.locator('.snag-summary').innerText();
    check(/0 to put right/.test(late)&&!/past target/.test(late)&&/1 marked fixed/.test(late),`office: the snag list counts the same as the company line: ${JSON.stringify(late)}`);
    await page.goBack();await page.locator('.co-list').waitFor();
    check((await page.getByLabel('Find a company or person').inputValue())==='acme'&&(await page.locator('.co-card').count())===1,'office: Back from the snag list keeps the search');
    // The oldest item opens its issue.
    await acme.locator('.co-oldest a').click();await page.waitForURL(`**/issues/${acmeOldest.id}**`);
    check(true,'office: the oldest item opens its issue');
    await page.goBack();await page.locator('.co-list').waitFor();
    await page.getByRole('link',{name:/^← Back to /}).click();await page.waitForURL(/\/office/);
    check(true,'office: Back returns to the office');
    // The issue register also links here.
    await page.goto(`${base}/office#/issues`);
    await page.getByRole('link',{name:'By company'}).click();await page.waitForURL(/\/companies\?/);await page.locator('.co-list').waitFor();
    check(new URL(page.url()).searchParams.get('returnTo')==='/office#/issues','office: the issue register links here and Back returns to it');
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Office on a phone, light: one column, nothing sideways, touch-size links.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/companies`);await page.locator('.co-list').waitFor();
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`phone: no sideways page scroll at 390px (${width})`);
    const columns=await page.locator('.co-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    check(columns===1,`phone: one card to a row (${columns})`);
    const heights=await page.locator('.co-snag').evaluateAll(a=>a.map(x=>x.getBoundingClientRect().height));
    check(heights.length>0&&heights.every(h=>h>=44),`phone: snag list links are touch height: ${JSON.stringify(heights)}`);
    const stats=await page.locator('.co-stats').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    check(stats===2,`phone: the counts sit two across (${stats})`);
    if(screenshot)await page.screenshot({path:join(screenshot,'companies-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'phone: page errors');
    await context.close();
  }
  console.log(`Open issues by company check passed (${checks} checks): office-only access, counts, oldest item, recent closures, nobody named, finding a company, snag list and back, phone and desktop, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
