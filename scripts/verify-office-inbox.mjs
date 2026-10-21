// Browser check for the office Inbox with weeks of reports from three
// engineers on three sites: with no report open the list has the page to
// itself (no empty reader beside it), so each row reads on one or two lines
// and project names do not wrap onto three or four; opening a report brings
// the reader in beside the list; the list and "Not seen yet" (Inbox filter and
// the office position's group) are newest first, and a report received today
// says "Today" with its time. Section edges stay visible, axe finds nothing,
// no sideways scroll. 1440px dark and light, 1280 and 1200px laptops, 390px light.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the Inbox and the office position.
// RELAY_REPORT_ONLY=1 prints the measurements without failing (for "before" shots on an older build).
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
const root=mkdtempSync(join(tmpdir(),'relay-office-inbox-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const manager={id:'entra:inbox-manager',oid:'inbox-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sam={id:'entra:inbox-sam',oid:'inbox-sam',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const hana={id:'entra:inbox-hana',oid:'inbox-hana',name:'Hana Duct',email:'hana@example.test',role:'Engineer',trade:'HVAC'};
const pat={id:'entra:inbox-pat',oid:'inbox-pat',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const card=(type,location,whatHappened)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:type==='defect'?'Sort it':'',owner:'',photos:[]});
const seen={by:'Office Manager',byId:manager.id,at:new Date(Date.now()-3600000).toISOString()};
const sent=(projectId,person,visitDate,receivedAt,over={})=>{const r=createReport(projectId,person.name,person);const out={...r,authorTrade:person.trade,visitDate,state:'submitted',review:'not_required',serverAcknowledgedAt:receivedAt,observations:[card('update','Level 1 corridor','Containment installed'),card('defect','Flat 204','Cracked faceplate'),card('update','Riser 2','Cable pulled')],...over};putRecord('reports',out);return out;};
// A busy visit raises every kind of card, so "Found" is at its widest.
const busy=()=>({observations:[card('update','Level 1 corridor','Containment installed'),card('defect','Flat 204','Cracked faceplate'),card('defect','Flat 311','Loose back box'),card('access','Level 2 west','Blocked by plasterboard'),card('instruction','Plant room','Extra grille asked for'),card('variation','Plant room','Extra sockets')]});
// Three weeks of working days: each engineer on their own site, seen by the office.
const crew=[[sam,'proj-011lme'],[hana,'proj-014lme'],[pat,'proj-009lcp']];
for(let n=21;n>=1;n--){const day=addDays(today,-n);const wd=new Date(`${day}T12:00:00Z`).getUTCDay();if(wd===0||wd===6)continue;
  crew.forEach(([person,project],i)=>sent(project,person,day,`${day}T${String(14+i).padStart(2,'0')}:00:00.000Z`,{acknowledged:seen,...(i===0||n%3===0?busy():{})}));}
// Two older reports nobody has opened, and three received today (newest last here), none opened.
const oldUnseen=[sent('proj-014lme',hana,addDays(today,-12),`${addDays(today,-12)}T16:30:00.000Z`),sent('proj-009lcp',pat,addDays(today,-9),`${addDays(today,-9)}T16:30:00.000Z`)];
// Today's three are a few seconds old, so the check works at any time of day bar the first seconds after midnight.
const ago=m=>new Date(Date.now()-m*1000).toISOString();
const todays=[sent('proj-009lcp',pat,today,ago(3),busy()),sent('proj-014lme',hana,today,ago(2),{revision:2,...busy()}),sent('proj-011lme',sam,today,ago(1),busy())];
const newest=todays.at(-1);
const unseenCount=oldUnseen.length+todays.length;

const port=4356,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-inbox-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const reportOnly=!!process.env.RELAY_REPORT_ONLY;
let browser,checks=0;const failed=[];
const check=(value,message)=>{if(reportOnly){if(!value)failed.push(message);return;}assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
// The page and the desk's own scrolling view (.view scrolls inside the page), whichever spills more.
const overflow=page=>page.evaluate(()=>Math.max(...[document.documentElement,...document.querySelectorAll('.view')].map(e=>e.scrollWidth-e.clientWidth)));
const axe=async(page,label)=>{await page.evaluate(()=>scrollTo(0,0));await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
// How many lines each row's project name takes, and each row's height.
const measure=page=>page.locator('table.reg tbody tr.clickable').evaluateAll(rows=>rows.map(tr=>{const t=tr.querySelector('.c-title .rowtitle');const lh=parseFloat(getComputedStyle(t).lineHeight)||parseFloat(getComputedStyle(t).fontSize)*1.4;return {lines:Math.round(t.getBoundingClientRect().height/lh),height:Math.round(tr.getBoundingClientRect().height),text:t.textContent};}));
const rowIds=page=>page.locator('table.reg tbody tr.clickable').evaluateAll(rows=>rows.map(tr=>tr.querySelector('.ref')?.textContent));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['dark',1440,900],['light',1440,900],['dark',1280,800],['light',1200,800],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));

    // The office position's "Not seen yet": today's newest first, saying today.
    await page.goto(`${base}/office#/projects`);
    const group=page.locator('.act[data-group="notAck"]');await group.waitFor();
    const groupRows=await group.locator('.rmenu a.rt').evaluateAll(as=>as.map(a=>a.innerText.replace(/\s+/g,' ')));
    console.log(`${label} office position Not seen yet: ${JSON.stringify(groupRows)}`);
    check(!!groupRows[0]?.startsWith('Tetley Hall - Block E · Sam Spark'),`${label}: "Not seen yet" starts with the newest report (${groupRows[0]})`);
    check(groupRows.slice(0,3).every(t=>/received Today, \d\d:\d\d/.test(t)),`${label}: today's three come first and say "Today" with the time`);
    if(shot&&!phone)await page.screenshot({path:join(shot,`office-position-${scheme}-${width}.png`)});

    // The Inbox with no report open.
    await page.goto(`${base}/office#/inbox`);await page.getByRole('heading',{name:'Inbox'}).waitFor();
    await page.locator('table.reg tbody tr.clickable').first().waitFor();
    const rows=await measure(page);
    const tableW=await page.locator('.view .panel').first().evaluate(e=>Math.round(e.getBoundingClientRect().width));
    const viewW=await page.locator('.view').evaluate(e=>Math.round(e.clientWidth));
    const reader=await page.locator('.inbox-reader, .panel:has(> .panel-head h3:text-is("Reader"))').count();
    const maxLines=Math.max(...rows.map(r=>r.lines)),maxH=Math.max(...rows.map(r=>r.height));
    console.log(`${label} Inbox, nothing open: list ${tableW}px of ${viewW}px, reader panels ${reader}, project name up to ${maxLines} lines, rows up to ${maxH}px, ${rows.length} rows`);
    if(!phone){
      check(reader===0,`${label}: no empty reader beside the list when nothing is open`);
      check(tableW>=viewW-48,`${label}: the list has the width (${tableW} of ${viewW})`);
      check(maxLines<=1,`${label}: each project name on one line (up to ${maxLines})`);
      check(maxH<=72,`${label}: each row on one or two lines (tallest ${maxH}px)`);
    }else{
      check(reader===0,`${label}: no empty reader under the list on a phone`);
    }
    const ids=await rowIds(page);
    check(ids[0]===newest.reference,`${label}: the Inbox is newest first (${ids[0]})`);
    const firstWhen=await page.locator('table.reg tbody tr.clickable').first().locator('td.due').innerText();
    check(/^Today, \d\d:\d\d$/.test(firstWhen.trim()),`${label}: today's report says "Today" with its time (${firstWhen})`);
    const olderWhen=await page.locator('table.reg tbody tr.clickable').nth(3).locator('td.due').innerText();
    check(!/Today/.test(olderWhen),`${label}: an earlier report shows its date (${olderWhen})`);
    check(await overflow(page)<=0,`${label}: no sideways scroll with nothing open`);
    await axe(page,`${label} Inbox`);
    if(shot)await page.screenshot({path:join(shot,`inbox-${scheme}-${width}.png`)});

    // Not seen yet: newest first.
    await page.goto(`${base}/office#/inbox/show/notAck`);await page.getByRole('heading',{name:'Inbox'}).waitFor();
    await page.waitForFunction(n=>document.querySelectorAll('table.reg tbody tr.clickable').length===n,unseenCount);
    const unseenIds=await rowIds(page);
    check(unseenIds.join()===[...todays].reverse().concat([...oldUnseen].reverse()).map(r=>r.reference).join(),`${label}: "Not seen yet" in the Inbox is newest first`);

    // Opening a report brings the reader in beside the list.
    await page.goto(`${base}/office#/inbox`);await page.locator('table.reg tbody tr.clickable').nth(4).click();
    await page.waitForURL(/#\/inbox\/[^/]+$/);
    const openReader=page.locator('.panel:has(> .panel-head h3:text-is("Reader"))');await openReader.waitFor();
    await openReader.locator('.empty, h1, h2, h3, h4').first().waitFor();
    const openRows=await measure(page);
    const listBox=await page.locator('.view .panel').first().boundingBox(),readerBox=await openReader.boundingBox();
    console.log(`${label} Inbox, report open: list ${Math.round(listBox.width)}px, reader ${Math.round(readerBox.width)}px, project name up to ${Math.max(...openRows.map(r=>r.lines))} lines, rows up to ${Math.max(...openRows.map(r=>r.height))}px`);
    if(!phone){
      check(Math.abs(listBox.y-readerBox.y)<4&&readerBox.x>listBox.x+listBox.width-1,`${label}: the reader opens beside the list`);
      const edge=await openReader.evaluate(e=>getComputedStyle(e).borderLeftColor);
      const bg=await page.locator('.view').evaluate(e=>getComputedStyle(e).backgroundColor);
      check(edge!==bg&&!/rgba\(0, 0, 0, 0\)/.test(edge),`${label}: the reader panel keeps its edge (${edge} on ${bg})`);
      check(Math.max(...openRows.map(r=>r.lines))<=2,`${label}: with a report open, project names still on two lines at most`);
      check(!(await page.locator('table.reg thead th.c-found').isVisible()),`${label}: with the reader open, Found is left to the reader`);
    }else{
      check(readerBox.y>listBox.y,`${label}: on a phone the reader is under the list`);
    }
    check(await overflow(page)<=0,`${label}: no sideways scroll with a report open`);
    if(shot)await page.screenshot({path:join(shot,`inbox-open-${scheme}-${width}.png`)});
    await context.close();
  }
  check(errors.length===0,`no page errors: ${errors}`);
  if(reportOnly)console.log(`Report only. Would fail:\n  ${failed.join('\n  ')||'nothing'}`);
  else console.log(`Passed ${checks} office Inbox checks (1440px dark and light, 1280px dark, 1200px light, 390px light).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
