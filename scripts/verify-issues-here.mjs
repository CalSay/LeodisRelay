// Browser check for "Where are you?" on the engineer Issues tab (2026-10-22).
// A walk at 390px with Sam on the busy seed (scripts/seed-busy-projects.mjs:
// Tetley Hall has 390 open issues across 15 places) found no way to see the
// issues in the flat you are standing in: Open was one list about 89,000px long,
// with Flat 204 kitchen's issues spread from near the top to the bottom.
// Now Open and All issues offer the places typed on the project's issues, each
// with its count, and picking one lists only that place's issues, every trade.
// Checks, light and dark at 390px, dark at 1440px:
// - Issues, Open, pick the place: three taps; the choice lists every place
//   with the same count lib/issuePlaces.ts gives, and "Every place (390)";
// - the list is exactly the open issues at that place (other trades too), with
//   the place and count in the heading, and the page is short;
// - Back from an issue comes back to the same place; All issues keeps it;
//   Yours and All projects drop it (and All projects hides the choice);
// - an issue's "Every open issue here" opens the same list;
// - 48px controls, no sideways scroll, axe finds nothing, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-issues-here-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {issuePlaces,issuesAtPlace}=require('../apps/web/.test-build/lib/issuePlaces.js');
seedBusyProjects({storagePath,today:londonDay(new Date())});
const rows=kind=>database().prepare('select data from records where kind=?').all(kind).map(r=>JSON.parse(r.data));
const sam=PEOPLE.engineer,P='proj-011lme',PLACE='Flat 204 kitchen';
const onSite=rows('issues').filter(i=>i.projectId===P);
const open=onSite.filter(i=>i.work!=='closed'&&i.confirmation!=='withdrawn');
const places=issuePlaces(open);
const here=issuesAtPlace(open,PLACE),hereAll=issuesAtPlace(onSite,PLACE);
assert.ok(places.length>=10&&here.length>=10,`the seed has many places (${places.length}) and issues at ${PLACE} (${here.length})`);
assert.ok(new Set(here.map(i=>i.reportedById)).size>1,'issues at the place come from more than one engineer');
const session=randomUUID();putRecord('sessions',{id:session,principal:sam,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});

const port=4527,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-issues-here',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(x=>x.target.join(' ')).slice(0,4).join(', ')}`));ok(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const refs=list=>list.map(i=>i.reference).sort().join(',');
try {
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const tap=async l=>{if(wide)await l.click();else await l.tap();};
    const cards=page.locator('.eng-issue-card');
    const shown=async()=>(await cards.evaluateAll(cs=>cs.map(c=>c.querySelector('.eng-issue-meta .lbl').textContent))).sort().join(',');
    await page.goto(`${base}/engineer?project=${P}`);
    let taps=0;
    await tap(page.getByRole('button',{name:'Issues',exact:true}).first());taps++;
    await cards.first().waitFor({timeout:60000});
    await tap(page.getByRole('button',{name:'Open',exact:true}));taps++;
    const picker=page.getByLabel('Where are you?');
    await picker.waitFor({timeout:60000});
    const options=await picker.locator('option').allTextContents();
    ok(options[0]===`Every place (${open.length})`,`${label}: the first choice is every place with its count: "${options[0]}"`);
    ok(options.slice(1).join('|')===places.map(p=>`${p.place} (${p.count})`).join('|'),`${label}: one choice per place typed on the site's open issues, each with its count (${options.length-1})`);
    await cards.nth(open.length-1).waitFor({timeout:60000});
    const before=await page.evaluate(()=>document.documentElement.scrollHeight);
    await picker.selectOption(PLACE);taps++;
    await page.waitForFunction(n=>document.querySelectorAll('.eng-issue-card').length===n,here.length);
    ok(taps===3,`${label}: Issues, Open, the place: ${taps} taps`);
    ok(await shown()===refs(here),`${label}: exactly the ${here.length} open issues at ${PLACE}, every trade`);
    const locs=await cards.evaluateAll(cs=>cs.map(c=>c.querySelector('.eng-issue-copy>p').textContent));
    ok(locs.every(l=>l.toLowerCase().includes('flat 204')),`${label}: every card is at the place`);
    const heading=(await page.locator('.eng-panel h2').first().innerText()).replace(/\s+/g,' ');
    ok(new RegExp(`${PLACE}\\s*·\\s*${here.length} open`,'i').test(heading),`${label}: the heading names the place and count: "${heading}"`);
    const after=await page.evaluate(()=>document.documentElement.scrollHeight);
    ok(after<before/5,`${label}: the page is ${after}px, down from ${before}px for every place`);
    console.log(`${label}: every place ${before}px, ${PLACE} ${after}px (${here.length} issues)`);
    const control=await picker.evaluate(e=>e.getBoundingClientRect().height);
    ok(control>=48,`${label}: the place choice is ${Math.round(control)}px tall`);
    ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),`${label}: no sideways scrolling`);
    await axe(page,`${label} issues at a place`);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-issues-here-${scheme}-${width}.png`),fullPage:!wide});
    // Back from an issue comes back to the same place.
    const first=cards.first();const firstRef=await first.locator('.eng-issue-meta .lbl').textContent();
    await tap(first);
    await page.waitForURL(u=>u.pathname.startsWith('/issues/'),{timeout:20000});
    const hereLink=page.getByRole('link',{name:/Every open issue here/});
    await hereLink.waitFor();
    const linkHeight=await hereLink.evaluate(e=>e.getBoundingClientRect().height);
    ok(linkHeight>=48,`${label}: "Every open issue here" is ${Math.round(linkHeight)}px tall`);
    await axe(page,`${label} issue page`);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-issue-page-${scheme}-${width}.png`)});
    await tap(page.getByRole('link',{name:/Back to Issues/}));
    await page.waitForURL(u=>u.pathname==='/engineer',{timeout:20000});
    await page.waitForFunction(n=>document.querySelectorAll('.eng-issue-card').length===n,here.length,{timeout:60000});
    ok(await picker.inputValue()===PLACE&&await shown()===refs(here),`${label}: Back from ${firstRef} comes back to ${PLACE}`);
    // All issues keeps the place; Yours and All projects drop it.
    await tap(page.getByRole('button',{name:'All issues',exact:true}));
    await page.waitForFunction(n=>document.querySelectorAll('.eng-issue-card').length===n,hereAll.length,{timeout:60000});
    ok(await picker.inputValue()===PLACE&&await shown()===refs(hereAll),`${label}: All issues keeps the place: ${hereAll.length} issues, closed ones too`);
    await page.locator('#eng-issue-scope').selectOption('all');
    await page.waitForFunction(()=>document.querySelectorAll('.eng-panel h2').length>=3,null,{timeout:60000});
    ok(await picker.count()===0,`${label}: All projects has no place choice (each site has its own places)`);
    await page.locator('#eng-issue-scope').selectOption('current');
    await picker.waitFor({timeout:60000});
    ok(await picker.inputValue()==='',`${label}: back on one project, every place again`);
    await picker.selectOption(PLACE);
    await tap(page.getByRole('button',{name:'Yours',exact:true}));
    await page.locator('.eng-yours-count').first().waitFor({timeout:60000});
    await tap(page.getByRole('button',{name:'Open',exact:true}));
    await picker.waitFor({timeout:60000});
    ok(await picker.inputValue()==='',`${label}: Yours drops the place, so Open starts on every place`);
    // An issue's "Every open issue here" opens the same list.
    await page.goto(`${base}/issues/${here.at(-1).id}?returnTo=${encodeURIComponent(`/engineer?project=${P}&view=issues`)}`);
    await tap(page.getByRole('link',{name:/Every open issue here/}));
    await page.waitForURL(u=>u.pathname==='/engineer',{timeout:20000});
    await page.waitForFunction(n=>document.querySelectorAll('.eng-issue-card').length===n,here.length,{timeout:60000});
    ok(await picker.inputValue()===PLACE&&await shown()===refs(here)&&await page.getByRole('button',{name:'Open',exact:true}).getAttribute('aria-pressed')==='true',`${label}: "Every open issue here" opens Open at ${PLACE}`);
    // A place typed differently on the issue still finds its choice; one with none open says so.
    await page.goto(`${base}/engineer?project=${P}&view=issues&show=open&place=${encodeURIComponent('  flat 204   KITCHEN ')}`);
    await page.waitForFunction(n=>document.querySelectorAll('.eng-issue-card').length===n,here.length,{timeout:60000});
    ok(await picker.inputValue()===PLACE,`${label}: a place in the address matches however it is typed`);
    await page.goto(`${base}/engineer?project=${P}&view=issues&show=open&place=${encodeURIComponent('Flat 999')}`);
    await page.getByText('No open issues at Flat 999.').waitFor({timeout:60000});
    ok(await picker.inputValue()==='Flat 999',`${label}: a place with nothing open stays chosen and the list says so`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`issues here verified: ${checks} checks`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
