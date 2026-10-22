// Browser check for "At this place" on an office issue sheet (2026-10-22).
// A walk at 1440px as the office on the busy seed (scripts/seed-busy-projects.mjs),
// asking "what's the state of Flat 204 kitchen on Tetley Hall?", found the
// answer split over three screens the office had to know about: the Issues
// register (choose the project, type the place), Photographs (its own Find box)
// and Search (every project, open and closed together). An issue's sheet gave
// its place as plain text. Now a line under the title reads
// "At Flat 204 kitchen: 31 open issues · Photographs".
// Checks, light and dark at 1440px and light at 390px:
// - the count is the register's own (lib/issueQuery.ts openAtPlace = queryIssues);
// - the open issues link opens the register on that project and place, filled
//   in, listing exactly those issues, and Back from an issue comes back to it;
// - Photographs opens that project's photographs found by the place, and its
//   Back returns to the issue's sheet;
// - an issue with no place has no line; a closed issue alone at its place says
//   "no open issues";
// - no sideways scroll, axe finds nothing (the project list's group headings
//   are left out, as in verify-issue-figures), no page errors.
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
const root=mkdtempSync(join(tmpdir(),'relay-issue-at-place-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {openAtPlace,queryIssues}=require('../apps/web/.test-build/lib/issueQuery.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today});
const rows=kind=>database().prepare('select data from records where kind=?').all(kind).map(r=>JSON.parse(r.data));
const P='proj-011lme',PLACE='Flat 204 kitchen';
const issues=rows('issues');
const here=openAtPlace(issues,P,PLACE);
const register=queryIssues(issues,{view:'open',projectId:P,location:PLACE,page:1,pageSize:1000},{day:today});
assert.equal(here.length,register.total,'the count is what the register lists');
assert.ok(here.length>=10,`the seed has open issues at ${PLACE} (${here.length})`);
const picked=here[0];
// Two hand-made issues: one with no place, one closed and alone at its place.
const base0=issues.find(i=>i.projectId===P);
const noPlace={...base0,id:'iss-no-place',reference:'011LME-ISS-9001',location:'',work:'assigned',confirmation:'confirmed'};
const lonely={...base0,id:'iss-lonely',reference:'011LME-ISS-9002',location:'Lift motor room 9',work:'closed',confirmation:'confirmed'};
putRecord('issues',noPlace);putRecord('issues',lonely);
const session=randomUUID();putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});

const port=4531,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-issue-at-place',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run({exclude:[['.project-group-title']]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(x=>x.target.join(' ')).slice(0,4).join(', ')}`));ok(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const noSideways=async(page,label)=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scroll`);
const sheetOf=id=>`${base}/office#/projects/${P}/issue/${id}`;
try {
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  for(const [scheme,width] of [['light',1440],['dark',1440],['light',390]]){
    const label=`${scheme} ${width}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const line=page.locator('.sheet-here');
    await page.goto(sheetOf(picked.id));
    await line.waitFor({timeout:60000});
    const text=(await line.textContent()).replace(/\s+/g,' ').trim();
    ok(text===`At ${PLACE}: ${here.length} open issues · Photographs`,`${label}: the line names the place and the register's count: "${text}"`);
    await noSideways(page,label);
    await axe(page,`${label} sheet`);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-issue-at-place-sheet-${scheme}-${width}.png`)});
    if(wide){
      // The open issues: the register on that project and place.
      await line.getByRole('link',{name:`${here.length} open issues`}).click();
      await page.waitForFunction(()=>location.hash.startsWith('#/issues/show/open/'));
      const regRows=page.locator('.issue-reg tbody tr');
      await page.waitForFunction(n=>document.querySelectorAll('.issue-reg tbody tr').length===n,Math.min(here.length,50),{timeout:60000});
      const filters=page.locator('.issue-search');
      ok(await filters.locator('select').first().inputValue()===P,`${label}: the register's project is filled in`);
      ok(await filters.locator('input').first().inputValue()===PLACE,`${label}: the register's place is filled in`);
      ok((await page.locator('.filters .chip.on').first().textContent()).trim()===`Open · ${here.length}`,`${label}: Open shows the same count`);
      const listed=(await regRows.locator('td:first-child').allTextContents()).map(t=>t.trim().match(/^\S+-ISS-\d+/)?.[0]).sort();
      ok(listed.join(',')===here.map(i=>i.reference).sort().join(','),`${label}: the register lists exactly the open issues there\n${listed.slice(0,3)}\n${here.map(i=>i.reference).sort().slice(0,3)}`);
      await axe(page,`${label} register`);
      if(shots)await page.screenshot({path:join(shots,`${prefix}-issue-at-place-register-${scheme}-${width}.png`)});
      // Back from an issue comes back to the same list.
      await regRows.nth(2).click();
      await line.waitFor({timeout:60000});
      await page.goBack();
      await page.waitForFunction(n=>document.querySelectorAll('.issue-reg tbody tr').length===n,Math.min(here.length,50),{timeout:60000});
      ok(await filters.locator('input').first().inputValue()===PLACE,`${label}: Back from an issue keeps the place`);
      // The bare tab starts again from every project.
      await page.getByRole('link',{name:/^Issues/}).first().click();
      await page.waitForFunction(()=>location.hash==='#/issues');
      await page.waitForFunction(()=>!document.querySelector('.issue-search input')?.value);
      ok(await filters.locator('select').first().inputValue()==='',`${label}: the Issues tab itself clears the project and place`);
      // Photographs: that project, found by the place; Back returns to the sheet.
      await page.goto(sheetOf(picked.id));
      await line.waitFor({timeout:60000});
      await line.getByRole('link',{name:'Photographs'}).click();
      await page.waitForURL(/\/photos\?/);
      const url=new URL(page.url());
      ok(url.searchParams.get('project')===P&&url.searchParams.get('q')===PLACE,`${label}: Photographs opens that project found by the place (${url.search})`);
      const find=page.getByLabel('Find');await find.waitFor({timeout:60000});
      ok(await find.inputValue()===PLACE,`${label}: the Find box holds the place`);
      await page.locator('.photos-tile').first().waitFor({timeout:60000});
      const wheres=await page.locator('.photos-where').allTextContents();
      ok(wheres.length>0,`${label}: photographs from the place are shown (${wheres.length})`);
      await page.getByRole('link',{name:/Back/}).first().click();
      await page.waitForURL(u=>u.pathname==='/office');
      await line.waitFor({timeout:60000});
      ok(page.url().endsWith(`/issue/${picked.id}`),`${label}: Back from Photographs returns to the issue's sheet`);
      // No place: no line. A closed issue alone at its place: no open issues.
      await page.goto(sheetOf(noPlace.id));
      await page.locator('.sheet-title h3').waitFor({timeout:60000});
      await page.waitForTimeout(500);
      ok(await line.count()===0,`${label}: an issue with no place has no line`);
      await page.goto(sheetOf(lonely.id));
      await line.waitFor({timeout:60000});
      const lonelyText=(await line.textContent()).replace(/\s+/g,' ').trim();
      ok(lonelyText==='At Lift motor room 9: no open issues · Photographs',`${label}: a closed issue alone at its place: "${lonelyText}"`);
    }
    ok(!errors.length,`${label}: no page errors ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`issue at place: ${checks} checks passed`);
} catch(e){console.error(output.slice(-2000));throw e;}
finally { await browser?.close(); server.kill(); rmSync(root,{recursive:true,force:true}); }
