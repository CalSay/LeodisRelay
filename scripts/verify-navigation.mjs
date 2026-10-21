// Browser check for the navigation pass: every Back link names where it goes,
// each page names its browser tab, the engineer views reach every project page
// without hunting, and the office desk has no buttons that repeat its own tabs.
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
const root=mkdtempSync(join(tmpdir(),'relay-navigation-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay,weekStart}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:nav-engineer',oid:'nav-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:nav-manager',oid:'nav-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const today=londonDay(new Date()),monday=weekStart(undefined,today),now=new Date().toISOString();
const card=(type,location)=>({id:randomUUID(),type,location,whatHappened:'Cable tray fixed along the corridor',actionNeeded:'',owner:'',photos:[]});
putRecord('reports',{id:randomUUID(),projectId:'proj-011lme',reference:'011LME-SPR-101',visitDate:monday,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[card('update','Level 2 corridor'),card('defect','Plant room')]});
const issue={id:randomUUID(),reference:'011LME-ISS-301',projectId:'proj-011lme',location:'Level 2 corridor',description:'Cable tray lid missing',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Sparks Ltd',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',raisedAt:now,source:'individual',reportedBy:engineer.name,reportedById:engineer.id,events:[{at:now,actor:engineer.name,actorId:engineer.id,kind:'raised',note:'',photos:[]}]};
putRecord('issues',issue);
const port=4339,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-navigation-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  const shot=async(page,name)=>{if(shots)await page.screenshot({path:join(shots,`${name}.png`)});};
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const title=async(page,want,at)=>{await page.waitForFunction(t=>document.title===t,want,{timeout:5000}).catch(()=>{});check(await page.title()===want,`${at}: the tab reads "${want}" (got "${await page.title()}")`);};
  const back=page=>page.locator('a.back').first();
  const noSideways=async(page,at)=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${at}: no sideways scroll`);

  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const at=`engineer ${width}px ${scheme}`;
    const {context,page,errors}=await open('Engineer',scheme,width);
    // Home: every page about the project is one tap from "This project".
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await title(page,'Site · RELAY',`${at} home`);
    const project=page.getByRole('region',{name:'This project'});
    for(const name of ['Site issues','Reports','Site diary','Photographs','Weekly summary','Safety actions'])check(await project.getByText(name,{exact:true}).count()===1,`${at}: This project offers ${name}`);
    check(await page.getByRole('link',{name:/^My week/}).count()===1,`${at}: home still offers My week`);
    await shot(page,`nav-engineer-home-${scheme}-${width}`);
    await project.getByText('Photographs',{exact:true}).click();await page.waitForURL(/\/photos\?/);
    await title(page,'Photographs · RELAY',`${at} photographs`);
    check(await back(page).innerText()==='← Back to Site',`${at}: photographs say Back to Site`);
    await back(page).click();await page.waitForURL(u=>u.pathname==='/engineer');
    check(!new URL(page.url()).searchParams.get('view'),`${at}: Back lands on the Site view`);

    // Reports: one action, then the project's other pages in one even row.
    await page.getByRole('navigation',{name:'Site companion navigation'}).getByRole('button',{name:'Reports'}).click();
    await page.getByRole('heading',{name:'Reports',exact:true}).waitFor();
    await title(page,'Reports · RELAY',`${at} reports`);
    const more=page.getByRole('navigation',{name:'More from these reports'});
    check((await more.getByRole('link').allInnerTexts()).join('|')==='Site diary|Weekly summary|Photographs|Safety actions|My week',`${at}: the Reports view groups its links`);
    check(/visit \w{3},? \d+ \w{3}/.test(await page.locator('.eng-report-link').first().innerText()),`${at}: report dates read as days, not ISO dates`);
    await noSideways(page,`${at} reports`);
    await shot(page,`nav-engineer-reports-${scheme}-${width}`);
    await more.getByRole('link',{name:'Weekly summary'}).click();await page.waitForURL(/\/weekly-summary\?/);
    await title(page,'Weekly summary · RELAY',`${at} weekly summary`);
    check(await back(page).innerText()==='← Back to Reports',`${at}: the weekly summary says Back to Reports`);
    await back(page).click();await page.waitForURL(u=>u.searchParams.get('view')==='reports');
    check(true,`${at}: Back returns to Reports`);

    // Search from Reports, a result, and Back to the results.
    await page.getByRole('link',{name:'Search'}).click();await page.waitForURL(/\/search/);
    await title(page,'Search · RELAY',`${at} search`);
    check(await back(page).innerText()==='← Back to Reports',`${at}: search says Back to Reports`);
    await page.getByLabel('Search for').fill('lid missing');
    const hit=page.locator('main a').filter({hasText:'Cable tray lid missing'}).first();await hit.waitFor();
    await hit.click();await page.waitForURL(/\/issues\//);
    await title(page,'011LME-ISS-301 · Issue · RELAY',`${at} issue`);
    check(await back(page).innerText()==='← Back to Search results',`${at}: the issue says Back to Search results`);
    await back(page).click();await page.waitForURL(/\/search\?q=/);
    check(await page.getByLabel('Search for').inputValue()==='lid missing',`${at}: Back keeps the search`);

    // Issues: snag list, then an issue from it.
    await page.goto(`${base}/engineer?project=proj-011lme&view=issues`);
    await page.getByRole('heading',{name:'Issues',exact:true}).waitFor();
    await title(page,'Issues · RELAY',`${at} issues`);
    await page.getByRole('link',{name:/^Snag list/}).click();await page.waitForURL(/\/issues\/snag-list\?/);
    await title(page,'Snag list · Tetley Hall - Block E · RELAY',`${at} snag list`);
    check(await back(page).innerText()==='← Back to Issues',`${at}: the snag list says Back to Issues`);
    await noSideways(page,`${at} snag list`);
    await back(page).click();await page.waitForURL(u=>u.searchParams.get('view')==='issues');
    check(true,`${at}: Back returns to Issues`);
    // An issue opened from the engineer view keeps the name of where it came from.
    await page.locator('a').filter({hasText:'Cable tray lid missing'}).first().click();await page.waitForURL(/\/issues\//);
    check(await back(page).innerText()==='← Back to Issues',`${at}: an issue from Issues says Back to Issues`);
    // Opened with no return path it goes to the project's issues, and says so.
    await page.goto(`${base}/issues/${issue.id}`);await back(page).waitFor();
    check(await back(page).innerText()==='← Back to Issues',`${at}: with no return path the issue says Back to Issues`);
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }

  for(const [scheme,width] of [['dark',1440],['light',390]]){
    const at=`office ${width}px ${scheme}`;
    const {context,page,errors}=await open('Manager',scheme,width);
    await page.goto(`${base}/office`);await page.locator('.sheet-title').first().waitFor();
    await title(page,'Projects · Office · RELAY',`${at} desk`);
    const actions=await page.locator('.sheet-title .actions').first().locator('a').allInnerTexts();
    check(actions.join('|')==='Site coverage|Issues by company|Safety actions',`${at}: the overview offers pages the tabs do not (${actions.join('|')})`);
    await shot(page,`nav-office-desk-${scheme}-${width}`);
    await page.goto(`${base}/office#/issues`);await page.getByRole('heading',{name:'Issues'}).waitFor();
    await title(page,'Issues · Office · RELAY',`${at} issues tab`);
    await page.getByRole('link',{name:'Issues by company'}).click();await page.waitForURL(/\/companies\?/);
    await title(page,'Issues by company · RELAY',`${at} companies`);
    check(await back(page).innerText()==='← Back to Office',`${at}: companies say Back to Office`);
    // The quick search hands over to the full search, which reads every card.
    await page.goto(`${base}/office#/projects`);await page.locator('.sheet-title').first().waitFor();
    await page.getByLabel('Search',{exact:true}).fill('corridor');
    const all=page.getByRole('link',{name:/Search the words in every report/});await all.waitFor();
    await shot(page,`nav-office-search-${scheme}-${width}`);
    await all.click();await page.waitForURL(/\/search\?/);
    check(await page.getByLabel('Search for').inputValue()==='corridor',`${at}: the full search opens on the same words`);
    await page.locator('main a').filter({hasText:'Cable tray lid missing'}).first().waitFor();
    check(await back(page).innerText()==='← Back to Office',`${at}: the search says Back to Office`);
    await back(page).click();await page.waitForURL(u=>u.pathname==='/office'&&u.hash==='#/projects');
    check(true,`${at}: Back returns to the same office tab`);
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  console.log(`Navigation check passed (${checks} checks): Back names its destination, tab titles, engineer home and Reports links, office overview without repeated tabs, office search to full search, at 390 and 1440px in light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
