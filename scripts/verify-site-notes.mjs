// Browser check for Notes for the next visit: the engineer home shows the
// latest note, an engineer and the office both leave notes, a note is kept
// after a reload, "Done with" folds it away and "Put back" returns it, a retry
// is not left twice, refused and closed projects are refused, and the page
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
const root=mkdtempSync(join(tmpdir(),'relay-site-notes-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const engineer={id:'entra:sn-engineer',oid:'sn-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:sn-manager',oid:'sn-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const P='proj-011lme';
const hoursAgo=h=>new Date(Date.now()-h*3600000).toISOString();
// Left by a plumber 26 hours ago, and one the office marked done with three days ago.
putRecord('site-notes',{id:'note-seed-1',projectId:P,text:'Riser 3 key is with the site manager, Dave, in the cabin by gate B',by:'Pat Plumb',byId:'entra:pat',byTrade:'P&H',at:hoursAgo(26)});
putRecord('site-notes',{id:'note-seed-2',projectId:P,text:'Level 4 locked off for screeding until Friday',by:'Office Manager',byId:manager.id,byTrade:'Office',at:hoursAgo(120),done:{by:'Office Manager',byId:manager.id,at:hoursAgo(72)}});
const port=4351,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-site-notes-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
// The same axe-core rules as verify-accessibility.mjs, run with the done-with list open.
// A client navigation can leave the title empty for a moment (see verify-help), so wait for it first.
const axe=async(page,label)=>{await page.waitForFunction(()=>document.title.length>0,null,{timeout:5000}).catch(()=>{});await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const post=(page,body)=>page.request.post(`${base}/api/site-notes`,{data:body});
const openTexts=page=>page.locator('section[aria-labelledby="sn-open-title"] .sn-text').allInnerTexts();
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: nothing read or kept, and the page goes to sign in with the project kept.
  {
    const {context,page}=await open(null,'light',390);
    check((await page.request.get(`${base}/api/site-notes?project=${P}`)).status()===401,'signed out: reading refused');
    check((await post(page,{project:P,text:'x',requestId:randomUUID()})).status()===401,'signed out: leaving a note refused');
    await page.goto(`${base}/site-notes?project=${P}`);await page.waitForURL(/\/signin/);
    check(decodeURIComponent(page.url()).includes(`/site-notes?project=${P}`),'signed out: sign in returns to the same project');
    await context.close();
  }

  // Engineer on a phone, light.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    check((await post(page,{project:P,text:'   ',requestId:randomUUID()})).status()===422,'engineer: an empty note is refused');
    check((await post(page,{project:P,text:42,requestId:randomUUID()})).status()===422,'engineer: a malformed note is refused');
    check((await post(page,{project:P,text:'x'.repeat(501),requestId:randomUUID()})).status()===422,'engineer: a note over 500 characters is refused');
    check((await post(page,{project:'proj-missing',text:'x',requestId:randomUUID()})).status()===404,'engineer: a project that does not exist is refused');
    check((await post(page,{project:'proj-004lcp',text:'x',requestId:randomUUID()})).status()===409,'engineer: a complete project takes no new notes');
    check(records('site-notes').length===2,'engineer: nothing kept by the refused saves');

    await page.goto(`${base}/engineer?project=${P}`);
    const row=page.locator('.eng-row',{has:page.locator('b',{hasText:/^Notes for the next visit$/})});
    await row.locator('span',{hasText:/Riser 3 key/}).waitFor();
    const rowText=await row.locator('.main>span').innerText();
    check(rowText.includes('Pat Plumb')&&rowText.includes('…')&&!rowText.includes('notes'),`engineer: the home row shows the start of the latest note and who left it: ${JSON.stringify(rowText)}`);
    check(await row.locator('.main>span').evaluate(e=>e.getBoundingClientRect().height<=40),'engineer: the home row note stays within two lines');
    await row.click();await page.waitForURL(new RegExp(`/site-notes\\?project=${P}&returnTo=`));
    await page.locator('.sn-note').first().waitFor();
    await page.waitForFunction(()=>document.title.startsWith('Notes for the next visit'),null,{timeout:5000}).catch(()=>{});
    check((await page.title()).startsWith('Notes for the next visit'),`engineer: the tab is named (${await page.title()})`);
    check(await page.locator('a.back').first().innerText()==='← Back to Site','engineer: Back says Back to Site');
    check((await openTexts(page)).length===1,'engineer: one open note');
    const meta=await page.locator('.sn-note .sn-meta').first().innerText();
    check(/Pat Plumb · P&H/.test(meta)&&/\((yesterday|2 days ago)\)/.test(meta),`engineer: who left it, their trade and how long ago: ${JSON.stringify(meta)}`);
    check(/\(1\)/.test(await page.locator('.sn-done-list summary').innerText()),'engineer: the note done with is folded away below');

    // Leave a note.
    await page.getByRole('button',{name:'Leave note'}).click();
    check(/Write the note first/.test(await page.locator('.sn-form [role="alert"]').innerText()),'engineer: an empty note says what to do');
    await page.getByLabel('Your note').fill('Containment on level 2 east finished. Ceiling grid goes up Tuesday.');
    await page.getByRole('button',{name:'Leave note'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('section[aria-labelledby="sn-open-title"] .sn-note').length===2);
    check((await openTexts(page))[0].startsWith('Containment on level 2 east'),'engineer: the new note is at the top');
    check(await page.getByLabel('Your note').inputValue()==='','engineer: the box is cleared after saving');
    check(/Note left/.test(await page.locator('.eng-sr[role="status"]').innerText()),'engineer: a screen reader hears it was saved');
    check(await page.evaluate(()=>document.activeElement?.id==='sn-text'),'engineer: focus stays in the box for the next note');
    const kept=records('site-notes').find(n=>n.text.startsWith('Containment'));
    check(kept&&kept.by===engineer.name&&kept.byTrade==='Electrical'&&kept.byId===engineer.id,'engineer: kept under the signed-in engineer and trade');
    await page.reload();await page.locator('.sn-note').first().waitFor();
    check((await openTexts(page)).length===2,'engineer: both notes are there after a reload');

    // A retry of the same save is not left twice; the same id with other words is refused.
    const requestId=randomUUID();
    const first=await post(page,{project:P,text:'Retry note',requestId});const again=await post(page,{project:P,text:'Retry note',requestId});
    check(first.status()===201&&again.status()===201&&(await first.json()).id===(await again.json()).id,'engineer: a retry returns the first save');
    check((await post(page,{project:P,text:'Different words',requestId})).status()===409,'engineer: the same request with different words is refused');
    check(records('site-notes').filter(n=>n.text==='Retry note').length===1,'engineer: the retried note is kept once');

    // The home row now counts the notes.
    await page.goto(`${base}/engineer?project=${P}`);
    await row.locator('span',{hasText:/3 notes/}).waitFor();
    check(true,'engineer: the home row counts the open notes');
    await page.goto(`${base}/site-notes?project=${P}`);await page.locator('.sn-note').first().waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'engineer 390px: no sideways scroll');
    check(await page.evaluate(()=>[...document.querySelectorAll('.sn-page button, .sn-page select, .sn-done-list summary')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().height>=44)),'engineer 390px: every button is at least 44px tall');
    await page.locator('.sn-done-list summary').click();
    await axe(page,'engineer 390px light');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-notes-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }

  // Office on a desk, dark: reached from the project sheet, marks a note done with and puts it back.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/projects/${P}`);
    const links=page.getByRole('navigation',{name:'On this project'});
    await links.getByRole('link',{name:'Notes for the next visit'}).click();
    await page.waitForURL(new RegExp(`/site-notes\\?project=${P}&returnTo=`));await page.locator('.sn-note').first().waitFor();
    check(await page.locator('a.back').first().innerText()==='← Back to Office','office: Back says Back to Office');
    check((await openTexts(page)).length===3,'office: reads the engineers\' notes');
    const target=page.locator('section[aria-labelledby="sn-open-title"] .sn-note',{hasText:'Riser 3 key'});
    await target.getByRole('button',{name:/^Mark done with/}).click();
    await page.waitForFunction(()=>document.querySelectorAll('section[aria-labelledby="sn-open-title"] .sn-note').length===2);
    check(/\(2\)/.test(await page.locator('.sn-done-list summary').innerText()),'office: the note moves to done with');
    const seed=records('site-notes').find(n=>n.id==='note-seed-1');
    check(seed.done?.by==='Office Manager'&&seed.text.startsWith('Riser 3 key'),'office: kept, marked done with by who did it');
    await page.locator('.sn-done-list summary').click();
    const doneRow=page.locator('.sn-done-list .sn-note',{hasText:'Riser 3 key'});
    check(/Marked done with by Office Manager/.test(await doneRow.innerText()),'office: the done-with list says who and when');
    await doneRow.getByRole('button',{name:/^Put back/}).click();
    await page.waitForFunction(()=>document.querySelectorAll('section[aria-labelledby="sn-open-title"] .sn-note').length===3);
    check(!records('site-notes').find(n=>n.id==='note-seed-1').done,'office: put back');
    await page.getByLabel('Your note').fill('Client walk round Thursday at 10.');
    await page.getByRole('button',{name:'Leave note'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('section[aria-labelledby="sn-open-title"] .sn-note').length===4);
    check(/Office Manager · Office/.test(await page.locator('.sn-note .sn-meta').first().innerText()),'office: an office note says Office');
    // Another project's notes are its own.
    await page.getByLabel('Project',{exact:true}).selectOption('proj-014lme');
    await page.locator('.sn-none').waitFor();
    await page.waitForURL(u=>new URL(u).searchParams.get('project')==='proj-014lme',{timeout:5000}).catch(()=>{});
    check(new URL(page.url()).searchParams.get('project')==='proj-014lme','office: the address follows the project');
    check(/No notes on this project/.test(await page.locator('.sn-none').innerText()),'office: another project starts empty');
    // Only live projects are offered; a complete project in the address opens on the project choice.
    check(!(await page.getByLabel('Project',{exact:true}).locator('option').allTextContents()).some(t=>t.includes('004LCP')),'office: a complete project is not offered');
    await page.getByLabel('Project',{exact:true}).selectOption(P);await page.locator('.sn-note').first().waitFor();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'office 1440px: no sideways scroll');
    await page.locator('.sn-done-list summary').click().catch(()=>{});
    await axe(page,'office 1440px dark');
    if(screenshot)await page.screenshot({path:join(screenshot,'site-notes-dark-1440.png'),fullPage:true});
    await page.goto(`${base}/site-notes?project=proj-004lcp`);await page.locator('.eng-panel',{hasText:'Choose a project'}).waitFor();
    check(true,'office: a complete project in the address opens on the project choice');
    await page.getByLabel('Project',{exact:true}).selectOption(P);await page.locator('.sn-note').first().waitFor();
    // No connection: the words stay in the box.
    await context.setOffline(true);
    await page.getByLabel('Your note').fill('Kept while offline');
    await page.getByRole('button',{name:'Leave note'}).click();
    await page.locator('.sn-form [role="alert"]').filter({hasText:/No connection/}).waitFor();
    check(await page.getByLabel('Your note').inputValue()==='Kept while offline','office: with no connection the note stays in the box');
    await context.setOffline(false);
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // The home screen's Help lists it.
  {
    const {context,page}=await open('Engineer','light',390);
    await page.goto(`${base}/help?for=site`);
    // Help draws the latest few entries first and the rest once it knows this person has not seen them, so wait.
    check(await page.getByRole('heading',{name:'Notes for the next visit'}).first().waitFor({timeout:5000}).then(()=>true,()=>false),'help: What\'s new lists Notes for the next visit');
    await context.close();
  }
  console.log(`Site notes check passed (${checks} checks): refused saves, engineer home row, leaving a note, kept after reload, retries, done with and put back, office from the project sheet, other and complete projects, no connection, axe, 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
