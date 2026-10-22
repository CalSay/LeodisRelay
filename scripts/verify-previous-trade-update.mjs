// Browser check for the office's step between one trade's site updates on a
// site (lib/tradeVisits.ts): opening a site update in the Inbox reader or in its
// project shows the same trade's previous update (and the next, when there is
// one), with the day, the gap in days, who sent it and its reference. Selecting
// it opens that update in the same place. A correction stands in for the report
// it corrects, another person of the same trade counts, another trade, another
// project, a draft and an inspection do not, and an inspection shows no line.
// Axe, tap sizes and no sideways scroll at 1440px dark and 390px light.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the reader at each size.
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
const root=mkdtempSync(join(tmpdir(),'relay-previous-update-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {dayShort}=require('../apps/web/.test-build/lib/dates.js');
const manager={id:'entra:previous-manager',oid:'previous-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sam={id:'entra:previous-sam',oid:'previous-sam',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const ali={id:'entra:previous-ali',oid:'previous-ali',name:'Ali Amp',email:'ali@example.test',role:'Engineer',trade:'Electrical'};
const hana={id:'entra:previous-hana',oid:'previous-hana',name:'Hana Duct',email:'hana@example.test',role:'Engineer',trade:'HVAC'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,h=9)=>`${ymd}T${String(h).padStart(2,'0')}:00:00.000Z`;
const card=(type,location,whatHappened)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[]});
const sent=(projectId,person,visitDate,over={},type)=>{const r=createReport(projectId,person.name,person,type);const out={...r,authorTrade:person.trade,visitDate,state:'submitted',review:'not_required',acknowledged:true,serverAcknowledgedAt:at(visitDate,over.hour??10),observations:[card('update','Level 1 corridor',`${person.name} on ${visitDate}`)],...over};delete out.hour;putRecord('reports',out);return out;};

// Tetley Hall (011LME), Electrical, oldest first: A (Sam), B corrected by B2 (Sam), E (Ali), C (Sam), D (Sam, today).
const P='proj-011lme';
const A=sent(P,sam,addDays(today,-9));
const B=sent(P,sam,addDays(today,-6));
const B2=sent(P,sam,addDays(today,-6),{hour:16,corrects:B.id,revision:2,correctionReason:'Wrong location'});
const E=sent(P,ali,addDays(today,-4));
const C=sent(P,sam,addDays(today,-2));
const D=sent(P,sam,today);
// Not Electrical site updates on this project: HVAC, a draft, an inspection, and Electrical on another project.
const H1=sent(P,hana,addDays(today,-5)),H2=sent(P,hana,addDays(today,-1));
sent(P,sam,addDays(today,-1),{state:'draft',serverAcknowledgedAt:undefined});
const FFI=sent(P,sam,addDays(today,-3),{observations:[{...card('update','Flat 204','Boxes fixed'),check:{question:'Boxes fixed level',answer:'ok'}}]},'first-fix-inspection');
sent('proj-014lme',sam,addDays(today,-3));
// Kirkstall Gate (014LME): Hana's only update there has nothing either side.
const lone=sent('proj-014lme',hana,addDays(today,-1));
const days=(from,to)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
const gap=(from,to)=>{const n=Math.abs(days(from,to));const dir=days(from,to)>0?'before':'after';return n===0?'the same day':n===1?`the day ${dir}`:`${n} days ${dir}`;};
const short=ref=>ref.split('-').slice(1).join('-');
const words=(r,here)=>`${dayShort(r.visitDate)}, ${gap(r.visitDate,here.visitDate)} · ${r.author} · ${short(r.reference)}`;

const port=4363,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-previous-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const flat=t=>t.replace(/\s+/g,' ').trim();
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const opened=async(report)=>{await page.locator('.sheet .sheet-title .ref').filter({hasText:report.reference}).first().waitFor();};
    const bar=page.locator('.sheet nav.trade-visits');
    const prev=bar.locator('.trade-visit.prev'),next=bar.locator('.trade-visit.next');

    // Today's update in the Inbox reader: the previous Electrical update is C, two days before; nothing later.
    await page.goto(`${base}/office#/inbox/${D.id}`);await opened(D);await bar.waitFor();
    check(flat(await prev.innerText())===`‹ Previous Electrical update here ${words(C,D)}`,`${label}: today's update points at the previous Electrical one: ${flat(await prev.innerText())}`);
    check(await next.count()===0,`${label}: nothing after today's update`);
    check(await bar.getAttribute('aria-label')==='Other Electrical updates on this site',`${label}: the line is named for screen readers`);
    const title=await page.locator('.sheet .sheet-title').first().boundingBox(),barBox=await bar.boundingBox(),stages=await page.locator('.sheet .stages, .sheet [class*="stage"]').first().boundingBox();
    check(barBox.y>=title.y+title.height-1&&(!stages||barBox.y<stages.y),`${label}: the line sits under the title, before the stages`);
    if(phone)check((await prev.boundingBox()).height>=44,`${label}: big enough to tap`);
    check(await overflow(page)<=0,`${label}: no sideways scroll`);
    await axe(page,`${label}, Inbox reader`);
    if(shot)await page.screenshot({path:join(shot,`previous-update-inbox-${scheme}-${width}.png`)});

    // Selecting it opens C in the Inbox reader, which points both ways: back to Ali's update, on to today's.
    await prev.click();await page.waitForFunction(id=>location.hash===`#/inbox/${id}`,C.id);await opened(C);
    check(true,`${label}: the previous update opens in the Inbox reader`);
    check(flat(await prev.innerText())===`‹ Previous Electrical update here ${words(E,C)}`,`${label}: another electrician's update counts as the trade's previous visit: ${flat(await prev.innerText())}`);
    check(flat(await next.innerText())===`Next Electrical update here › ${words(D,C)}`,`${label}: and the next one is today's: ${flat(await next.innerText())}`);
    await next.click();await page.waitForFunction(id=>location.hash===`#/inbox/${id}`,D.id);await opened(D);check(true,`${label}: next steps forward again`);
    // Opened from the list, stepping back and forth and then "‹ Inbox" lands on the list in one tap, not on the last report read.
    await page.goto(`${base}/office#/inbox`);await page.locator('tbody tr').filter({hasText:D.reference}).first().click();await opened(D);
    await prev.click();await opened(C);await next.click();await opened(D);
    if(phone){await page.getByRole('button',{name:'Back to Inbox'}).click();}else{await page.goBack();}
    await page.waitForFunction(()=>location.hash==='#/inbox');check(true,`${label}: ${phone?'"‹ Inbox"':'browser Back'} after stepping goes straight to the list`);

    // In the project: Ali's update steps back to the correction, never to the report it replaced.
    await page.goto(`${base}/office#/projects/${P}/report/${E.id}`);await opened(E);await bar.waitFor();
    check(flat(await prev.innerText())===`‹ Previous Electrical update here ${words(B2,E)}`,`${label}: a correction stands in for what it corrects: ${flat(await prev.innerText())}`);
    check(flat(await next.innerText())===`Next Electrical update here › ${words(C,E)}`,`${label}: HVAC, the draft and the inspection between them are skipped: ${flat(await next.innerText())}`);
    await prev.click();await page.waitForFunction(h=>location.hash===h,`#/projects/${P}/report/${B2.id}`);await opened(B2);
    check(true,`${label}: in the project, it opens in the project`);
    check(flat(await prev.innerText()).endsWith(words(A,B2))&&flat(await next.innerText()).endsWith(words(E,B2)),`${label}: the correction sits where its visit was`);
    // The replaced revision is the same visit as its correction, so neither points at the other.
    await page.goto(`${base}/office#/projects/${P}/report/${B.id}`);await opened(B);await bar.waitFor();
    check(flat(await prev.innerText()).endsWith(words(A,B))&&flat(await next.innerText()).endsWith(words(E,B)),`${label}: an old revision steps past its own correction: ${flat(await bar.innerText())}`);
    // The first update says there is nothing before it.
    await page.goto(`${base}/office#/projects/${P}/report/${A.id}`);await opened(A);await bar.waitFor();
    check(flat(await prev.innerText())==='Previous Electrical update here None before this one'&&await bar.locator('a.trade-visit.prev').count()===0,`${label}: the first update says there is none before it`);
    check(flat(await next.innerText()).endsWith(words(B2,A)),`${label}: and steps on to the next`);
    // HVAC follows its own trade.
    await page.goto(`${base}/office#/projects/${P}/report/${H2.id}`);await opened(H2);await bar.waitFor();
    check(flat(await prev.innerText())===`‹ Previous HVAC update here ${words(H1,H2)}`,`${label}: each trade has its own line: ${flat(await prev.innerText())}`);
    // No line on an inspection, or on an update with nothing either side.
    for(const [r,what,proj] of [[FFI,'an inspection',P],[lone,'a trade\'s only update on a site','proj-014lme']]){
      await page.goto(`${base}/office#/projects/${proj}/report/${r.id}`);await opened(r);
      await page.locator('.sheet .stages, .sheet .rowsub').first().waitFor();
      check(await bar.count()===0,`${label}: no line on ${what}`);
    }
    await context.close();
  }
  check(errors.length===0,`no page errors: ${errors}`);
  console.log(`Passed ${checks} previous trade update checks (Inbox reader and project; 1440px dark and 390px light).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
