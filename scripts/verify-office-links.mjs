// Browser check for office counts that lead somewhere: on a project sheet,
// Last visit opens that report and Overdue actions, Fixed, to check and
// Variations open their register on that project and filter; a figure with
// nothing to open is not a link; "And N more in the report" opens the report;
// on a phone the same four figures lead the register and open the same. In the Weekly
// summary a visit's "N photographs" opens Photographs on that day with only
// that report's photographs, and an office person's "fixed and waiting to be
// checked" opens the Issues register on the project ("past target" stays
// words; an engineer gets words, not office links). Printed, the photographs
// link is plain black like the other row links. Axe, tap sizes, no sideways scroll.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the sheet, phone register and weekly summary at 1440px dark and 390px light.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-links-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const manager={id:'entra:links-manager',oid:'links-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sam={id:'entra:links-sam',oid:'links-sam',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const hana={id:'entra:links-hana',oid:'links-hana',name:'Hana Duct',email:'hana@example.test',role:'Engineer',trade:'HVAC'};
const session=(principal)=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});return id;};
const managerSession=session(manager),samSession=session(sam);
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,h=9)=>`${ymd}T${String(h).padStart(2,'0')}:00:00.000Z`;
const photo=()=>({id:randomUUID(),dataUrl:`/api/media/${randomUUID()}`,caption:'',capturedAt:at(today)});
const card=(location,whatHappened,photos=0)=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:Array.from({length:photos},photo)});
const sent=(projectId,person,visitDate,observations,hour)=>{const r=createReport(projectId,person.name,person);const out={...r,authorTrade:person.trade,visitDate,state:'submitted',review:'not_required',serverAcknowledgedAt:at(visitDate,hour),observations};putRecord('reports',out);return out;};

// Tetley Hall (011LME): Sam's update today with seven lines and three photographs; Hana's today with two photographs,
// sent second, so it is the last visit (a busy day goes by reference, as Site coverage orders it).
const P='proj-011lme';
const elec=sent(P,sam,today,[card('Level 1 corridor','Containment installed',2),card('Flat 204 kitchen','First fix complete',1),card('Riser 2','Cable pulled'),card('Plant room','Board dressed'),card('Roof','Tapes fixed'),card('Level 3','Sockets boxed'),card('Stair core','Lighting run')],10);
const hvac=sent(P,hana,today,[card('Level 3 ceiling void','Ductwork hangers fitted',2)],9);
const issue=(id,over)=>putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:P,source:'report',reportedBy:sam.name,location:'Riser',description:`Issue ${id}`,actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Acme Electrical',targetDate:'',raisedByReport:'',raisedAt:at(addDays(today,-10)),events:[],...over});
issue('301',{targetDate:addDays(today,-2)});                                                     // overdue
issue('302',{});                                                                                   // open
issue('303',{work:'awaiting_verification',closureSubmittedBy:sam.name,events:[{at:at(addDays(today,-1)),actor:sam.name,kind:'closure_submitted',note:'Done',photos:[]}]}); // to check
// Another project's overdue issue, which a Tetley Hall link must leave out.
putRecord('issues',{id:'401',reference:'DEMO-014LME-ISS-401',projectId:'proj-014lme',source:'report',reportedBy:hana.name,location:'Stair',description:'Kirkstall overdue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Acme',targetDate:addDays(today,-5),raisedByReport:'',raisedAt:at(addDays(today,-12)),events:[]});
putRecord('variations',{id:randomUUID(),reference:'DEMO-011LME-VO-301',projectId:P,description:'Extra sockets in the plant room',location:'Plant room',trade:'Electrical',reason:'Client instruction',workDone:false,instruction:'pending',source:'report',raisedBy:sam.name,raisedAt:at(addDays(today,-3)),events:[]});
putRecord('variations',{id:randomUUID(),reference:'DEMO-014LME-VO-401',projectId:'proj-014lme',description:'Kirkstall variation',location:'Stair',trade:'HVAC',reason:'Client instruction',workDone:false,instruction:'pending',source:'report',raisedBy:hana.name,raisedAt:at(addDays(today,-3)),events:[]});
// Hunslet Depot (009LCP) has nothing: none of its figures is a link.

const port=4356,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-links-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const axe=async(page,label)=>{await page.evaluate(()=>scrollTo(0,0));await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
// The register's project choice ("All projects", then each project).
const projectChoice=page=>page.locator('select').filter({has:page.locator('option',{hasText:'All projects'})}).first();
const hash=(page,want)=>page.waitForFunction(w=>location.hash===w,want);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:managerSession,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const sheet=async code=>{await page.goto(`${base}/office#/projects/${code}`);await page.locator(phone?'.register-standing':'.col-main .sheet dl.tb').first().waitFor();};

    // The sheet's four figures: beside the register on a desk, at the top of the register on a phone.
    const figuresAt=phone?'.register-standing dl.tb':'.col-main .sheet dl.tb';
    {
      await sheet(P);
      const figures=page.locator(figuresAt).first().locator('> div');
      await page.locator(phone?'.register-standing .from-site-visit':'.col-main .from-site-visit').first().waitFor();
      const links=figures.locator('a.tb-go');
      check(await links.count()===4,`${label}: all four figures open something on a busy project (${await links.count()})`);
      check((await links.evaluateAll(as=>as.map(a=>a.getAttribute('href')))).join(' ')===`#/projects/${P}/report/${hvac.id} #/issues/show/overdue/${P} #/issues/show/verify/${P} #/variations/show/pending/${P}`,`${label}: each figure opens what it counts`);
      for(let n=0;n<4;n++){const b=await links.nth(n).boundingBox();check(b.height>=44,`${label}: figure ${n+1} is big enough to tap (${Math.round(b.height)}px)`);}
      check(await figures.first().locator('dd').evaluate(d=>getComputedStyle(d.querySelector('a')).textDecorationLine)==='none',`${label}: the figures stay calm, not underlined until hovered`);
      await axe(page,`${label}, ${phone?'phone register':'project sheet'}`);
      if(shot)await page.screenshot({path:join(shot,`office-links-sheet-${scheme}-${width}.png`),fullPage:true});
      // Last visit: that report.
      await links.nth(0).click();await hash(page,`#/projects/${P}/report/${hvac.id}`);check(true,`${label}: Last visit opens the last visit's report`);
      // Overdue actions: the Issues register, overdue, this project only.
      await sheet(P);await links.nth(1).click();await hash(page,`#/issues/show/overdue/${P}`);
      const project=projectChoice(page);
      await page.locator('table.reg tbody tr').first().waitFor();
      check(await project.inputValue()===P,`${label}: the register opens on Tetley Hall`);
      check(/^Overdue/.test(await page.locator('.chip[aria-pressed="true"]').first().innerText()),`${label}: on the Overdue filter`);
      const refs=async()=>(await page.locator('table.reg tbody tr').allInnerTexts()).join('\n');
      await page.waitForFunction(()=>!document.body.innerText.includes('Kirkstall overdue'));
      check(/Issue 301/.test(await refs())&&!/Issue 30[23]/.test(await refs()),`${label}: only Tetley Hall's overdue issue`);
      // Fixed, to check.
      await sheet(P);await links.nth(2).click();await hash(page,`#/issues/show/verify/${P}`);
      await page.waitForFunction(()=>document.querySelector('.chip[aria-pressed="true"]')?.textContent?.startsWith('Fixed, to check'));
      await page.waitForFunction(()=>/Issue 303/.test(document.querySelector('table.reg tbody')?.innerText??''));
      check(await project.inputValue()===P&&!/Issue 301/.test(await refs()),`${label}: Fixed, to check opens that list on Tetley Hall`);
      // The overview's own "Show all" opens across every project, not the last one linked.
      await page.goto(`${base}/office#/issues/show/overdue`);await page.waitForFunction(()=>document.body.innerText.includes('Kirkstall overdue'));
      check(await project.inputValue()==='',`${label}: a link with no project is every project again`);
      // So is the tab itself, after a project's link.
      await sheet(P);await links.nth(1).click();await hash(page,`#/issues/show/overdue/${P}`);await page.waitForFunction(p=>[...document.querySelectorAll('select')].some(s=>s.value===p),P);
      await page.locator('a[href="#/issues"]').first().click();await hash(page,'#/issues');
      await page.waitForFunction(()=>document.body.innerText.includes('Kirkstall overdue'));
      check(await project.inputValue()==='',`${label}: the Issues tab starts again on every project`);
      // Variations: awaiting instruction on this project.
      await sheet(P);await links.nth(3).click();await hash(page,`#/variations/show/pending/${P}`);
      await page.getByText('Extra sockets in the plant room').first().waitFor();
      check(await projectChoice(page).inputValue()===P&&!(await page.locator('table.reg').innerText()).includes('Kirkstall variation'),`${label}: Variations opens awaiting instruction on Tetley Hall`);
      // A project with nothing to open has figures, not links.
      await sheet('proj-009lcp');
      check(await page.locator(figuresAt).first().locator('a').count()===0,`${label}: a project with nothing to open has no figure links`);
    }

    // Latest from site: "And N more in the report" opens it (four lines on a desk, two on a phone).
    await sheet(P);
    const scope=phone?page.locator('.register-standing'):page.locator('.col-main .sheet');
    const more=scope.locator('.from-site-visit').filter({hasText:'Electrical'}).locator('a.from-site-more');await more.waitFor();
    check(await more.innerText()===`And ${phone?5:3} more in the report`,`${label}: the left-out lines are a link (${await more.innerText()})`);
    if(phone){
      const b=await more.boundingBox();check(b.height>=44,`${label}: more link big enough to tap (${Math.round(b.height)}px)`);
      if(shot)await page.screenshot({path:join(shot,`office-links-register-${scheme}-${width}.png`),fullPage:true});
      check(await overflow(page)<=0,`${label}: no sideways scroll on the register`);
    }
    await scope.locator('.from-site-visit').filter({hasText:'Electrical'}).locator('a.from-site-more').click();
    await hash(page,`#/projects/${P}/report/${elec.id}`);check(true,`${label}: "more in the report" opens the report`);

    // Weekly summary: a visit's photographs open that day, that report.
    await page.goto(`${base}/weekly-summary?project=${P}`);
    const samRow=page.locator('.week-rows > li').filter({hasText:elec.reference});await samRow.waitFor();
    const pics=samRow.getByRole('link',{name:`3 photographs from ${elec.reference}`});
    check(await pics.count()===1,`${label}: Sam's "3 photographs" is a link`);
    const href=new URL(await pics.getAttribute('href'),base);
    check(href.pathname==='/photos'&&href.searchParams.get('day')===today&&href.searchParams.get('q')===elec.reference&&href.searchParams.get('project')===P,`${label}: to Photographs on the visit day and report (${href.search})`);
    const toCheck=page.locator('.week-total a').filter({hasText:'1 fixed and waiting to be checked'});
    check(await toCheck.getAttribute('href')===`/office#/issues/show/verify/${P}`,`${label}: "fixed and waiting to be checked" opens the office register on the project`);
    // Past target leaves out issues put forward as fixed, which the register's Overdue keeps, so it is not a link to a longer list.
    check(await page.locator('.week-total a').filter({hasText:'past target'}).count()===0&&/1 past target/.test(await page.locator('.week-total').filter({hasText:'Open now'}).innerText()),`${label}: "past target" stays words`);
    await page.emulateMedia({media:'print'});
    check(await pics.evaluate(a=>{const c=getComputedStyle(a);return c.textDecorationLine==='none'&&c.color==='rgb(17, 17, 17)';}),`${label}: printed, the photographs link is plain black`);
    await page.emulateMedia({media:'screen'});
    check(await overflow(page)<=0,`${label}: no sideways scroll on the weekly summary`);
    await axe(page,`${label}, weekly summary`);
    if(shot)await page.screenshot({path:join(shot,`office-links-weekly-${scheme}-${width}.png`),fullPage:true});
    await pics.click();await page.waitForURL(u=>u.pathname==='/photos');
    await page.locator('.photos-tile').first().waitFor();
    check(await page.locator('.photos-tile').count()===3,`${label}: only that report's three photographs, not Hana's (${await page.locator('.photos-tile').count()})`);
    check(await page.getByLabel('Find').inputValue()===elec.reference,`${label}: the find box says why`);
    check(/Back to Weekly summary/.test(await page.locator('a.back').first().innerText()),`${label}: Back returns to the Weekly summary`);
    await page.locator('a.back').first().click();await page.waitForURL(u=>u.pathname==='/weekly-summary');
    await toCheck.click();
    await hash(page,`#/issues/show/verify/${P}`);await page.locator('table.reg tbody tr').first().waitFor();
    check(await projectChoice(page).inputValue()===P,`${label}: "fixed and waiting to be checked" opens that list on Tetley Hall`);
    await context.close();
  }
  // An engineer's weekly summary: the photographs link, no office links.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.addCookies([{name:'relay_session',value:samSession,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/weekly-summary?project=${P}`);
    await page.locator('.week-rows > li').filter({hasText:hvac.reference}).waitFor();
    check(await page.getByRole('link',{name:`2 photographs from ${hvac.reference}`}).count()===1,'engineer: photographs link too');
    check(await page.locator('.week-total a[href^="/office"]').count()===0&&/1 past target/.test(await page.locator('.week-total').filter({hasText:'Open now'}).innerText()),'engineer: counts in words, no office links');
    await context.close();
  }
  check(errors.length===0,`no page errors: ${errors}`);
  console.log(`Passed ${checks} office link checks (project sheet, phone register, Weekly summary; 1440px dark and 390px light).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
