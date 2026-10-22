// Browser check for the Month choice on the Weekly summary: last calendar month
// of one project, seeded across week boundaries. Checks every figure against
// the lists it opens and the week rows against the weekly pages, this month
// without weeks still to come, the Site reports line by kind, progress by
// place, behind or stuck, open by company, photographs, no health and safety,
// print, light and dark at 1440 and no sideways scroll at 390.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves month-*.png and month-print.pdf.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-month-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {londonDay,weekStart,shiftWeek,weekEnd}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {monthOf,monthFirst,monthLast,shiftMonth}=require('../apps/web/.test-build/lib/monthSummary.js');
const engineer={id:'entra:month-engineer',oid:'month-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:month-other',oid:'month-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:month-manager',oid:'month-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
// Safety records switched on, to show the month leaves them off anyway.
putRecord('settings',{id:'features',safetyRecords:true});

// Last calendar month, whatever day this runs.
const today=londonDay(new Date()),thisMonth=monthOf(undefined,today),M=shiftMonth(thisMonth,-1);
const first=monthFirst(M),last=monthLast(M);
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,hour=10)=>`${ymd}T${String(hour).padStart(2,'0')}:00:00.000Z`;
const now=new Date().toISOString();
const day15=`${M}-15`,day8=`${M}-08`,day22=`${M}-22`;
let colour=0;const COLOURS=['#8a6f2c','#3b6e8f','#6e3b3b','#3b6e4a','#5b4a7a','#7a5b3b','#2f6b6b','#6b2f5a','#4a6b2f','#6b6b2f'];
const photo=async(reportId,day)=>{const id=randomUUID();await putMedia(id,{reportId,ownerId:engineer.id,mime:'image/png'},await sharp({create:{width:640,height:480,channels:3,background:COLOURS[colour++%COLOURS.length]}}).png().toBuffer());return {id,dataUrl:`/api/media/${id}`,caption:'',capturedAt:at(day)};};
const card=(type,location,whatHappened,photos=[])=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos});
let n=0;
const report=(extra)=>{const r={id:randomUUID(),projectId:'proj-011lme',reference:`011LME-SPR-${String(++n).padStart(3,'0')}`,visitDate:first,author:engineer.name,authorId:engineer.id,authorTrade:'Electrical',state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};

// Fourteen places, so "Show all" is needed; ten have photographs, so eight are shown.
const PLACES=['Plant room','Level 2 corridor','Level 3 riser','Roof','Bin store','Flat 101','Flat 102','Flat 103','Flat 104','Flat 105','Car park','Stair core A','Stair core B','Switch room'];
const r1id=randomUUID(),r2id=randomUUID(),r3id=randomUUID(),r4id=randomUUID();
const r1=report({id:r1id,visitDate:first,observations:[card('update','Plant room','Containment started',[await photo(r1id,first)]),card('access','Level 3 riser','Locked, no key on site'),card('update','','Labels printed')]});
const r2=report({id:r2id,visitDate:first,author:other.name,authorId:other.id,authorTrade:'P&H',observations:PLACES.slice(1,10).map(p=>card('update',p,`First fix ${p}`))});
for(const o of r2.observations.slice(0,6))o.photos=[await photo(r2id,first)];putRecord('reports',r2);
const r3=report({id:r3id,visitDate:day8,observations:[card('update','plant  room','Pumps set on their bases',[await photo(r3id,day8)]),card('access','level 3 riser','Still locked'),card('defect','Roof','Flashing loose')]});
const r4=report({id:r4id,visitDate:day15,author:other.name,authorId:other.id,authorTrade:'P&H',observations:[...PLACES.slice(10).map(p=>card('update',p,`Second fix ${p}`)),card('update','Plant room','Pipework pressure tested, passed')]});
for(const o of r4.observations.slice(0,3))o.photos=[await photo(r4id,day15)];putRecord('reports',r4);
const r5=report({visitDate:last,observations:[card('update','Roof','Roof platform handed over')]});
const before=report({visitDate:addDays(first,-1),observations:[card('update','Garage','Before the month')]});
const after=report({visitDate:addDays(last,1),observations:[card('update','Garage','After the month')]});
const tower=report({visitDate:day8,reportType:'tower-inspection',observations:[]});
const draft=report({visitDate:day8,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:now});
const monthReports=[r1,r2,r3,r4,r5];

const issue=(extra)=>{const i={id:randomUUID(),reference:`011LME-ISS-${String(++n).padStart(3,'0')}`,projectId:'proj-011lme',location:'Plant room',description:'Issue',actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Acme Electrical',targetDate:'',affectedTrade:'Electrical',raisedByReport:'',source:'individual',raisedAt:at(first),events:[],...extra};putRecord('issues',i);return i;};
const ev=(kind,day)=>({at:at(day),actor:manager.name,kind,note:'',photos:[]});
const late=issue({description:'Cable tray lid missing',raisedAt:at(first),targetDate:addDays(first,5)});
const lateAfter=issue({description:'Fire stopping at riser',raisedAt:at(day8),targetDate:day15,work:'closed',events:[ev('verified',addDays(last,2))]});
const toCheck=issue({description:'Socket faceplate cracked',raisedAt:at(day8),targetDate:addDays(day8,2),work:'closed',events:[ev('closure_submitted',day15),ev('verified',addDays(last,3))]});
const closedIn=issue({description:'Light fitting loose',raisedAt:at(day8),work:'closed',events:[ev('verified',day22)]});
const older=issue({description:'Old drain snag',owner:'Bolt Plumbing',raisedAt:at(addDays(first,-10)),targetDate:addDays(last,30)});
const nobody=issue({description:'Ceiling tile stained',owner:'',raisedAt:at(day22)});
const withdrawn=issue({description:'Entered twice',confirmation:'withdrawn',raisedAt:at(day22)});
const nextMonth=issue({description:'Raised after',raisedAt:at(addDays(last,1))});
const raisedIn=[late,lateAfter,toCheck,closedIn,nobody,withdrawn];
const variation=(extra)=>{const v={id:randomUUID(),reference:`011LME-VO-${String(++n).padStart(3,'0')}`,projectId:'proj-011lme',description:'Extra sockets',location:'Plant room',workDone:false,instruction:'pending',source:'report',raisedBy:engineer.name,raisedAt:at(day8),events:[],...extra};putRecord('variations',v);return v;};
variation({workDone:true});variation({instruction:'instructed',raisedAt:at(first),events:[ev('instructed',day22)]});variation({raisedAt:at(addDays(first,-3))});
putRecord('toolbox-talks',{id:randomUUID(),projectId:'proj-011lme',day:day8,topic:'Working at height',givenBy:engineer.name,attendees:[{name:'A'}],withdrawn:false});

const expected={days:4,reports:5,raised:raisedIn.length,closed:1,vraised:2,vinstructed:1};
const port=4393,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-month-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const section=(page,name)=>page.locator('.week-section').filter({has:page.getByRole('heading',{name,level:2})});
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('.week-page'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe found ${found.join('; ')}`);};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out: the month's API refuses.
  {
    const res=await fetch(`${base}/api/monthly-summary?projectId=proj-011lme&month=${M}`);
    check(res.status===401,`signed out: the API refuses (${res.status})`);
  }

  // Office, 1440 light: Week to Month, then last month.
  {
    const {context,page,errors}=await open('Manager','light',1440);
    await page.goto(`${base}/weekly-summary?project=proj-011lme`);await page.locator('.week-sheet').waitFor();
    await page.getByRole('button',{name:'Month',exact:true}).click();
    await page.waitForURL(/period=month/);await page.locator('.month-sheet').waitFor();
    check(/this month so far/.test(await page.locator('.week-range').innerText()),'office: Month opens on this month, so far');
    check(await page.getByRole('button',{name:'Month',exact:true}).getAttribute('aria-pressed')==='true','office: Month is shown as chosen');
    check(!(await page.getByRole('button',{name:/Next month/}).isEnabled()),'office: no month after this one');
    // This month: no row for a week still to come, and this week's row ends today.
    {
      const now=await (await page.request.get(`${base}/api/monthly-summary?projectId=proj-011lme&month=${thisMonth}`)).json();
      const hrefs=await page.locator('.month-weeks tbody tr th a').evaluateAll(as=>as.map(a=>new URL(a.href).searchParams.get('week')));
      check(hrefs.length===now.weeks.length&&hrefs.every(m=>m<=today),`office: this month has no row for a week still to come (${hrefs.join(', ')}, today ${today})`);
      const thisWeek=now.weeks.at(-1),runsOn=(weekEnd(thisWeek.monday)>monthLast(thisMonth)?monthLast(thisMonth):weekEnd(thisWeek.monday))>today;
      check(thisWeek.monday===weekStart(today,today)&&(runsOn?thisWeek.to===today&&thisWeek.soFar:!thisWeek.soFar),`office: this week's row ends today (${JSON.stringify(thisWeek)})`);
      check((await page.locator('.month-weeks tbody tr').last().locator('th').innerText()).includes('so far')===runsOn,'office: this week says "so far" while it runs on past today');
      check(/Weeks still to come are not shown/.test(await section(page,'Figures for the month').innerText()),'office: the note under the weeks says so');
    }
    await page.getByRole('button',{name:/Previous month/}).click();await page.waitForURL(new RegExp(`month=${M}`));
    await page.locator('.month-sheet').filter({hasText:'last month'}).waitFor();
    // The tab title is set just after the sheet draws, so give it a moment.
    await page.waitForFunction(()=>document.title.startsWith('Monthly summary'),null,{timeout:5000}).catch(()=>{});
    check((await page.title()).startsWith('Monthly summary'),`office: the tab says Monthly summary (${await page.title()})`);
    const text=await page.locator('.month-sheet').innerText();
    const reportsLine=await page.locator('.month-stats > div').filter({hasText:'Site reports'}).locator('small').innerText();
    check(reportsLine==='all site updates',`office: Site reports says what the reports were, not a count of cards (${reportsLine})`);
    check(!/Weeks still to come/.test(text),'office: a month that is over says nothing about weeks to come');
    check(!/toolbox|permit|deliver/i.test(text),'office: no toolbox talks, permits or deliveries, even switched on');
    check(!text.includes(tower.reference)&&!text.includes(draft.reference)&&!text.includes(before.reference)&&!text.includes(after.reference),'office: a tower inspection, a draft and reports either side of the month are left out');

    // Every figure opens a list with exactly that many.
    const figures={days:'Days on site',reports:'Site reports',raised:'Issues raised',closed:'Issues closed',vraised:'Variations raised',vinstructed:'Variations instructed'};
    for(const [key,name] of Object.entries(figures)){
      const link=page.getByRole('link',{name:new RegExp(`^${name}: \\d+, show the list$`)});
      const shown=Number(await link.innerText());
      check(shown===expected[key],`office: ${name} reads ${shown}, expected ${expected[key]}`);
      await link.click();
      const list=page.locator(`#month-${key}`);
      await page.waitForFunction(id=>document.getElementById(id)?.open,`month-${key}`);
      const rows=await list.locator('.week-rows > li').count();
      check(rows===shown,`office: ${name} opens ${rows} rows for ${shown}`);
      check(await page.waitForFunction(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=-2&&r.top<innerHeight;},`month-${key}`,{timeout:3000}).then(()=>true,()=>false),`office: ${name} scrolls its list into view`);
    }
    check((await page.locator('#month-raised').innerText()).includes(withdrawn.reference)&&!(await page.locator('#month-raised').innerText()).includes(nextMonth.reference),'office: raised lists as the weekly page does, not next month');

    // Week rows add up to the month and match the weekly pages, day for day.
    const rows=await page.locator('.month-weeks tbody tr').evaluateAll(trs=>trs.map(tr=>({href:tr.querySelector('a').getAttribute('href'),label:tr.querySelector('th').innerText,cells:[...tr.querySelectorAll('td')].map(td=>Number(td.innerText))})));
    const mondays=[];for(let m=weekStart(first,first);m<=last;m=shiftWeek(m,1))mondays.push(m);
    check(rows.length===mondays.length,`office: a row a week (${rows.length} for ${mondays.length})`);
    const foot=await page.locator('.month-weeks tfoot td').evaluateAll(tds=>tds.map(td=>Number(td.innerText)));
    const order=['days','reports','raised','closed','vraised','vinstructed'];
    order.forEach((k,c)=>check(rows.reduce((s,r)=>s+r.cells[c],0)===foot[c]&&foot[c]===expected[k],`office: ${k} rows add up to ${foot[c]}`));
    if(first!==weekStart(first,first))check(/week from/.test(rows[0].label),`office: the first row says which week it is cut from (${rows[0].label})`);
    for(const [k,monday] of mondays.entries()){
      check(new URL(rows[k].href,base).searchParams.get('week')===monday,`office: row ${k+1} links to the week of ${monday}`);
      const from=monday<first?first:monday,to=weekEnd(monday)>last?last:weekEnd(monday),inRow=d=>d>=from&&d<=to,inRowAt=a=>inRow(londonDay(a));
      const w=await (await page.request.get(`${base}/api/weekly-summary?projectId=proj-011lme&week=${monday}`)).json();
      // The weekly page shows safety inspections while they are switched on; the month never does.
      w.reports=w.reports.filter(r=>r.id!==tower.id);
      const fromWeek=[new Set(w.reports.map(r=>r.visitDate).filter(inRow)).size,w.reports.filter(r=>inRow(r.visitDate)).length,w.issuesRaised.filter(i=>inRowAt(i.at)).length,w.issuesClosed.filter(i=>inRowAt(i.at)).length,w.variationsRaised.filter(v=>inRowAt(v.at)).length,w.variationsInstructed.filter(v=>inRowAt(v.at)).length];
      check(JSON.stringify(fromWeek)===JSON.stringify(rows[k].cells),`office: row ${k+1} matches the weekly page's days in the month: ${JSON.stringify(rows[k].cells)} vs ${JSON.stringify(fromWeek)}`);
    }
    // A full week's row is the weekly page's own figures; open one.
    const fullWeek=mondays.findIndex(m=>m>=first&&weekEnd(m)<=last&&m<=day15&&weekEnd(m)>=day15);
    if(fullWeek>=0){
      await page.locator('.month-weeks tbody tr').nth(fullWeek).getByRole('link').click();
      await page.waitForURL(new RegExp(`week=${mondays[fullWeek]}`));await page.locator('.week-stats').waitFor();
      const stats=await page.locator('.week-stats').innerText();
      check(new RegExp(`Site reports\\s*${rows[fullWeek].cells[1]}`,'i').test(stats)&&new RegExp(`Issues raised\\s*${rows[fullWeek].cells[2]}`,'i').test(stats),`office: the full week's page shows the same figures: ${stats.replace(/\s+/g,' ')}`);
      await page.goBack();await page.locator('.month-sheet').waitFor();
      check(new URL(page.url()).searchParams.get('month')===M,'office: back from a week returns to the month');
    }

    // Where work moved on: one line a place, newest first.
    const places=section(page,'Where work moved on').locator('.month-places > li');
    check(await places.count()===PLACES.length+0,`office: ${PLACES.length} places (${await places.count()})`);
    const visible=async()=>places.evaluateAll(ls=>ls.filter(l=>l.offsetHeight>0).length);
    check(await visible()===12,'office: twelve places shown at first');
    const plant=places.filter({hasText:'Plant room'});
    const plantText=await plant.innerText();
    check(await plant.count()===1&&plantText.includes('Pipework pressure tested, passed')&&/3 updates this month/.test(plantText),`office: the plant room once, its newest line and 3 updates: ${plantText}`);
    check((await places.first().innerText()).includes('Roof platform handed over'),'office: newest place first');
    check(/1 progress update gave no place/.test(await section(page,'Where work moved on').innerText()),'office: an update with no place is counted');
    await page.getByRole('button',{name:`Show all ${PLACES.length} places`}).click();
    check(await visible()===PLACES.length,'office: Show all shows every place');

    // Behind or stuck.
    const behind=await section(page,'Behind or stuck').innerText();
    check(behind.includes(late.reference)&&behind.includes(lateAfter.reference)&&!behind.includes(toCheck.reference)&&!behind.includes(older.reference),'office: past target at the month end, a fixed issue waiting to be checked is not');
    check(/Level 3 riser/.test(behind)&&/2 times/.test(behind)&&!/Flashing loose/.test(behind),'office: the riser had access problems on two days; a defect is not an access problem');

    // Still open, with whom, at the month's end.
    const companies=section(page,'Still open, with whom').locator('.month-companies > li');
    const acme=companies.filter({hasText:'Acme Electrical'});
    check(/3 open · 2 past target/.test(await acme.locator('summary').innerText()),`office: Acme had 3 open, 2 past target: ${await acme.locator('summary').innerText()}`);
    await acme.locator('summary').click();
    check(await acme.locator('.week-rows > li').count()===3,'office: Acme opens its 3 issues');
    check(await acme.locator('.tag-alert').count()===2,'office: 2 of them marked past target');
    check(/Bolt Plumbing/.test(await companies.allInnerTexts().then(t=>t.join('\n')))&&/Not yet assigned/.test(await companies.last().innerText()),'office: every company, nobody assigned last');
    check(/5 open on/.test(await section(page,'Still open, with whom').locator('h2').innerText()),`office: 5 open at the month's end (${await section(page,'Still open, with whom').locator('h2').innerText()})`);

    // Photographs: the newest from up to 8 places, loaded.
    const photos=section(page,'A few photographs').locator('.month-photos img');
    check(await photos.count()===8,`office: eight photographs (${await photos.count()})`);
    await page.waitForFunction(()=>[...document.querySelectorAll('.month-photos img')].every(i=>i.complete&&i.naturalWidth>0));
    check(true,'office: every photograph loaded');
    const firstPhoto=await section(page,'A few photographs').locator('li').first().innerText();
    check(PLACES.slice(10,13).some(p=>firstPhoto.includes(p)),`office: the newest photograph first (${firstPhoto})`);
    check(!(await section(page,'A few photographs').innerText()).includes('Flat 102'),'office: places past the eighth have none');
    await axe(page,'office light');
    // Fold the lists again for the screenshot.
    await page.evaluate(()=>document.querySelectorAll('.month-lists details,.month-companies details').forEach(d=>d.open=false));
    await page.getByRole('button',{name:'Show less'}).click();
    if(shots)await page.screenshot({path:join(shots,'month-light-1440.png'),fullPage:true});

    // Print: no controls or lists behind the figures, every place, on white.
    await page.emulateMedia({media:'print'});
    check(!(await page.locator('.week-controls').isVisible())&&!(await page.locator('.month-lists').isVisible()),'print: controls and the lists behind the figures are left off');
    check(await visible()===PLACES.length,'print: every place printed');
    check(!(await page.getByRole('button',{name:/Show all/}).first().isVisible()),'print: Show all is left off paper');
    if(shots){await page.screenshot({path:join(shots,'month-print-preview.png'),fullPage:true});writeFileSync(join(shots,'month-print.pdf'),await page.pdf({format:'A4'}));}
    const pdf=await page.pdf({format:'A4'});check(pdf.length>1000,`print: produces an A4 PDF (${pdf.length} bytes)`);
    await page.emulateMedia({media:'screen'});
    assert.deepEqual(errors,[],'office light: page errors');
    await context.close();
  }

  // Office, 1440 dark: the same month from its address; prints on white.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/weekly-summary?project=proj-011lme&period=month&month=${M}`);await page.locator('.month-sheet').waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.month-photos img')].every(i=>i.complete&&i.naturalWidth>0));
    await axe(page,'office dark');
    if(shots)await page.screenshot({path:join(shots,'month-dark-1440.png'),fullPage:true});
    await page.emulateMedia({media:'print'});
    const bg=await page.evaluate(()=>getComputedStyle(document.querySelector('.week-sheet')).backgroundColor);
    check(bg==='rgb(255, 255, 255)',`print: white sheet in dark mode (${bg})`);
    await page.emulateMedia({media:'screen'});
    // Week brings back the weekly page.
    await page.getByRole('button',{name:'Week',exact:true}).click();await page.locator('.week-sheet:not(.month-sheet)').waitFor();
    await page.waitForURL(u=>!u.searchParams.has('period')&&!u.searchParams.has('month'));check(true,'office: Week returns to the weekly page');
    assert.deepEqual(errors,[],'office dark: page errors');
    await context.close();
  }

  // Engineer, 390 light: the same month, no sideways scroll.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    await page.goto(`${base}/weekly-summary?project=proj-011lme&period=month&month=${M}`);await page.locator('.month-sheet').waitFor();
    const reports=await page.getByRole('link',{name:/^Site reports: \d+/}).innerText();
    check(Number(reports)===expected.reports,`engineer: the same ${expected.reports} reports (${reports})`);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(width<=390,`engineer: no sideways scroll at 390px (${width})`);
    if(shots)await page.screenshot({path:join(shots,'month-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }
  console.log(`Month summary check passed (${checks} checks): figures open their lists, week rows match the weekly pages, places, behind or stuck, open by company, photographs, print, light and dark, 390.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
