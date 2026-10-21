// Browser check for the office's Monday look back: each project on the office
// overview ("Where each project stands") has "Last week's summary", which opens
// that project's Weekly summary on last week. The row itself still opens the
// project, the row is no taller on the desk, the summary keeps the week when
// another project is picked, says "last week" in its heading, and Back returns
// to the overview. Desk 1440 dark and light, 1280, and a 390 phone.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the overview and the summary.
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
const root=mkdtempSync(join(tmpdir(),'relay-lastweek-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay,weekStart,shiftWeek}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:lw-engineer',oid:'lw-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:lw-manager',oid:'lw-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
// Dates relative to today, so the check passes whatever day it runs.
const today=londonDay(new Date()),monday=weekStart(undefined,today),lastMonday=shiftWeek(monday,-1),twoBack=shiftWeek(monday,-2);
const now=new Date().toISOString();
const card=(location,whatHappened)=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
const report=(projectId,reference,visitDate,words)=>{const r={id:randomUUID(),projectId,reference,visitDate,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[card('Plant room',words)]};putRecord('reports',r);return r;};
const tetleyLast=report('proj-011lme','011LME-SPR-201',lastMonday,'Containment fixed along the plant room wall');
const tetleyNow=report('proj-011lme','011LME-SPR-202',monday,'Cable pulled to the plant room board');
const kirkstallLast=report('proj-014lme','014LME-SPR-301',lastMonday,'Risers boxed in on level 2');
const tetleyOlder=report('proj-011lme','011LME-SPR-200',twoBack,'Boxes set out in flat 204');
const port=4341,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-last-week-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const overflow=(page)=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(scheme,width,phone=false)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});await context.addCookies([{name:'relay_session',value:session,url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const range=(page)=>page.locator('.week-range').innerText();

  for(const [scheme,width] of [['dark',1440],['light',1440],['dark',1280],['light',390]]){
    const phone=width<700,label=`${scheme} ${width}`;
    const {context,page,errors}=await open(scheme,width,phone);
    await page.goto(`${base}/office`);
    const rows=page.locator('.glance-row');await rows.first().waitFor();
    const tetley=rows.filter({hasText:'011LME'});
    // Every project has its own link, named for the project.
    const links=page.locator('.glance-week');
    check(await links.count()===await rows.count()&&await rows.count()===3,`${label}: one "Last week's summary" a project row (${await links.count()})`);
    const link=page.getByRole('link',{name:"Last week's summary for Tetley Hall - Block E"});
    check(await link.count()===1&&(await link.innerText()).startsWith("Last week’s summary"),`${label}: the link says what it opens and names the project for a screen reader`);
    const href=new URL(await link.getAttribute('href'),base);
    check(href.pathname==='/weekly-summary'&&href.searchParams.get('project')==='proj-011lme'&&href.searchParams.get('week')===lastMonday&&href.searchParams.get('returnTo')==='/office#/projects',`${label}: opens last week's summary for the project and comes back to the overview: ${href}`);
    const box=await link.boundingBox();
    check(box.height>=(phone?44:24)&&box.width>=24,`${label}: big enough to tap (${Math.round(box.width)}x${Math.round(box.height)})`);
    if(!phone){
      // The link fits beside the five figures: the name column is no taller than they are, so the row keeps its height.
      const [name,cells]=await Promise.all([tetley.locator('.glance-name').boundingBox(),tetley.locator('.glance-cells').boundingBox()]);
      check(name.height<=cells.height+0.5,`${label}: the row is no taller for the link (name ${name.height}, figures ${cells.height})`);
    }
    // The link sits above the row's own link, so a tap lands on it, not on the project.
    const top=await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?.closest('a')?.className??'';},[box.x+box.width/2,box.y+box.height/2]);
    check(top==='glance-week',`${label}: the middle of the link is the link (${top})`);
    check(await overflow(page)<=0,`${label}: no sideways scroll on the overview`);
    if(width!==1280){
      await page.evaluate(axeSource);
      const found=await page.evaluate(async()=>(await window.axe.run('.glance',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));
      check(found.length===0,`${label}: no accessibility problems on the project list: ${found.join('; ')}`);
    }
    if(width===1440&&scheme==='dark'){
      // Keyboard: the project, then its summary, each with a visible focus ring.
      await page.locator('.glance-open').first().focus();
      const ring=await page.evaluate(()=>getComputedStyle(document.activeElement,'::after').outlineStyle);
      check(ring==='solid',`${label}: the focused project shows a ring round its row (${ring})`);
      await page.keyboard.press('Tab');
      check(await page.evaluate(()=>document.activeElement?.className)==='glance-week',`${label}: Tab moves from the project to its summary`);
    }
    if(screenshot)await page.screenshot({path:join(screenshot,`after-overview-${scheme}-${width}.png`),fullPage:!phone});
    // The rest of the row still opens the project.
    const figures=await tetley.locator('.glance-cells').boundingBox(),rowBox=await tetley.boundingBox(),at={position:{x:figures.x-rowBox.x+figures.width/2,y:figures.y-rowBox.y+figures.height/2}};
    if(phone)await tetley.tap(at);else await tetley.click(at);
    await page.waitForURL(/#\/projects\/proj-011lme$/);
    check(true,`${label}: the row still opens the project`);
    await page.goto(`${base}/office`);await page.locator('.glance-week').first().waitFor();
    if(phone)await link.tap();else await link.click();
    await page.waitForURL(/\/weekly-summary\?/);await page.locator('.week-sheet').waitFor();
    const text=await page.locator('.week-sheet').innerText();
    check((await range(page)).endsWith(' · last week'),`${label}: the heading says it is last week: ${await range(page)}`);
    check(text.includes(tetleyLast.reference)&&!text.includes(tetleyNow.reference)&&!text.includes(tetleyOlder.reference),`${label}: last week's report only`);
    if(screenshot&&width!==1280)await page.screenshot({path:join(screenshot,`after-summary-last-week-${scheme}-${width}.png`),fullPage:false});
    if(width===1440&&scheme==='dark'){
      // Another project keeps the week.
      await page.getByLabel('Project').selectOption('proj-014lme');
      await page.waitForFunction(()=>new URL(location.href).searchParams.get('project')==='proj-014lme');
      await page.locator('.week-sheet',{hasText:'Kirkstall Gate'}).waitFor();
      check(new URL(page.url()).searchParams.get('week')===lastMonday&&(await range(page)).endsWith(' · last week'),`${label}: picking another project keeps last week`);
      check((await page.locator('.week-sheet').innerText()).includes(kirkstallLast.reference),`${label}: the other project's report last week`);
      // Printed, the heading still says which week, beside its dates.
      await page.emulateMedia({media:'print'});
      check(await page.locator('.week-range').isVisible()&&(await range(page)).includes(' to ')&&(await range(page)).endsWith(' · last week'),`${label}: the printed heading has the dates and "last week"`);
      await page.emulateMedia({media:'screen'});
      // Two weeks back the heading has dates only; this week says "so far".
      await page.getByRole('button',{name:'← Previous week'}).click();
      await page.waitForFunction(w=>new URL(location.href).searchParams.get('week')===w,twoBack);await page.locator('.week-sheet').waitFor();
      check(!/last week|this week/.test(await range(page)),`${label}: two weeks back is dates only: ${await range(page)}`);
      await page.getByRole('button',{name:'This week'}).click();
      await page.waitForFunction(()=>!new URL(location.href).searchParams.get('week'));await page.locator('.week-range',{hasText:'this week so far'}).waitFor();
      check(true,`${label}: this week still says "this week so far"`);
    }
    await page.getByRole('link',{name:/^← Back to Office/}).click();
    await page.waitForURL(u=>u.pathname==='/office');await page.locator('.glance-row').first().waitFor();
    check(new URL(page.url()).hash==='#/projects',`${label}: Back returns to the overview (${page.url()})`);
    assert.deepEqual(errors,[],`${label}: page errors`);
    await context.close();
  }
  console.log(`Office weekly review check passed (${checks} checks): last week's summary from each project row, the row unchanged, the week kept across projects, "last week" in the heading, Back to the overview; 1440 dark and light, 1280, 390.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
