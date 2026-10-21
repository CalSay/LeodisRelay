// Browser check for the office's view of project progress: the office
// position's "Where each project stands" list (last visit, visits this week by
// trade, open and overdue issues, variations waiting, the office's count), a
// quiet active site, a site in defects liability never visited, the project
// sheet's Last visit and Latest from site (each trade's newest site update,
// never an inspection, a correction in place of what it corrects), the phone
// register standing in for the sheet (its figures, then the project's pages on
// the first screen, then Latest from site), a report that will not load, axe, tap
// sizes and no sideways scroll. Built only from records engineers already send.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the overview, sheet and phone register at 390px light and 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-progress-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {workingDaysBetween}=require('../apps/web/.test-build/lib/siteCoverage.js');
const manager={id:'entra:progress-manager',oid:'progress-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sam={id:'entra:progress-sam',oid:'progress-sam',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const hana={id:'entra:progress-hana',oid:'progress-hana',name:'Hana Duct',email:'hana@example.test',role:'Engineer',trade:'HVAC'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,h=9)=>`${ymd}T${String(h).padStart(2,'0')}:00:00.000Z`;
const card=(type,location,whatHappened)=>({id:randomUUID(),type,location,whatHappened,actionNeeded:type==='update'||type==='access'?'':'Sort it',owner:'',photos:[]});
const sent=(projectId,person,visitDate,observations,over={},type)=>{const r=createReport(projectId,person.name,person,type);const out={...r,authorTrade:person.trade,visitDate,state:'submitted',review:'not_required',serverAcknowledgedAt:at(visitDate,over.hour??10),observations,...over};delete out.hour;putRecord('reports',out);return out;};

// Tetley Hall (011LME): Sam's report this morning, corrected this afternoon; Hana's this morning; Sam's from a month ago; an inspection today.
const P='proj-011lme';
sent(P,sam,addDays(today,-30),[card('update','Old riser','Month old progress not to show')]);
const first=sent(P,sam,today,[card('update','Level 1 corridor','First version, replaced by the correction')],{hour:8});
const ELEC=[card('update','Level 1 corridor','Containment installed along the full run'),card('update','Flat 204 kitchen','First fix complete, boxes set to the drylining line'),card('defect','Flat 311 bathroom','Cracked faceplate'),
  card('access','Level 2 west','Blocked by stacked plasterboard, moved to level 3'),card('update','Riser 2','Cable pulled to the distribution board'),card('update','Plant room','Board dressed and labelled'),card('update','Roof','Lightning protection tapes fixed')];
const elec=sent(P,sam,today,ELEC,{hour:14,corrects:first.id,revision:2,correctionReason:'Wrong location'});
const hvac=sent(P,hana,today,[card('update','Level 3 ceiling void','Ductwork hangers fitted'),card('instruction','Plant room','Extra grille asked for')],{hour:9});
sent(P,sam,today,[{...card('update','','Scaffold tag in date'),check:{question:'Scaffold tagged',answer:'ok'}}],{hour:15},'safety-inspection');
const issue=(id,over)=>putRecord('issues',{id,reference:`DEMO-011LME-ISS-${id}`,projectId:P,source:'report',reportedBy:sam.name,location:'Riser',description:`Issue ${id}`,actionNeeded:'',confirmation:'confirmed',work:'assigned',owner:'Acme Electrical',targetDate:'',raisedByReport:'',raisedAt:at(addDays(today,-10)),events:[],...over});
issue('201',{targetDate:addDays(today,-2)}); // overdue
issue('202',{});                            // open
issue('203',{work:'closed'});               // closed
putRecord('variations',{id:randomUUID(),reference:'DEMO-011LME-VO-201',projectId:P,description:'Extra sockets in the plant room',location:'Plant room',trade:'Electrical',reason:'Client instruction',workDone:true,instruction:'pending',source:'report',raisedBy:sam.name,raisedAt:at(addDays(today,-3)),events:[]});
// Kirkstall Gate (014LME): last visit sixteen days ago, so it has gone quiet and has no site update in the fortnight.
const quietDay=addDays(today,-16);
sent('proj-014lme',hana,quietDay,[card('update','Stair core B','Ductwork to level 2')]);
sent('proj-014lme',sam,quietDay,[card('update','Stair core B','Containment to level 2')]); // two people on that last day
const quietDays=workingDaysBetween(quietDay,today);
// Hunslet Depot (009LCP) is in defects liability and has no reports at all.

const port=4352,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-progress-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const axe=async(page,label)=>{await page.evaluate(()=>scrollTo(0,0));await page.evaluate(axeSource);if(process.env.AXE_DEBUG)await page.evaluate(()=>{window.AXE_DEBUG=1;});const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')+(window.AXE_DEBUG?' '+n.failureSummary:'')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
const cells=async row=>Object.fromEntries(await row.locator('.glance-cells > div').evaluateAll(ds=>ds.map(d=>[d.querySelector('dt').textContent,{text:d.querySelector('dd').innerText.replace(/\s+/g,' ').trim(),late:d.querySelector('dd').classList.contains('late')}])));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects`);
    const rows=page.locator('.glance-row');await rows.first().waitFor();
    // One row a project, active first, each answering the same five questions.
    check(await rows.count()===3,`${label}: one row for each reportable project`);
    const names=await rows.locator('.glance-name b').allInnerTexts();
    check(names.length===3&&(await page.locator('.glance-group .grp').allInnerTexts()).map(t=>t.split('\n')[0].trim().toLowerCase()).join('|')==='active|defects liability period',`${label}: grouped Active, then Defects liability period`);
    const tetley=await cells(rows.filter({hasText:'011LME'}));
    check(Object.keys(tetley).join('|')==='Last visit|This week|Open issues|Variations waiting|Needs action',`${label}: the five questions, in order: ${Object.keys(tetley)}`);
    check(/^Today /.test(tetley['Last visit'].text)&&!tetley['Last visit'].late,`${label}: Tetley Hall last visited today: ${tetley['Last visit'].text}`);
    check(tetley['Last visit'].text==='Today Sam Spark and Hana Duct',`${label}: everyone on site today is named, once each, not only the last to send: ${tetley['Last visit'].text}`);
    // Measured on the words, not the cell (grid cells stretch to the row): the names stay on one line on the desk, two at most on a phone.
    const whoLines=await rows.filter({hasText:'011LME'}).locator('.glance-cells > div').first().locator('dd small').evaluate(e=>Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight)));
    check(whoLines<=(phone?2:1),`${label}: naming everyone keeps the row tidy (${whoLines} lines)`);
    check(tetley['This week'].text==='3 visits Electrical, HVAC',`${label}: the correction counts once, the inspection counts as a visit, trades named: ${tetley['This week'].text}`);
    check(tetley['Open issues'].text==='2 1 overdue'&&tetley['Open issues'].late,`${label}: open issues and the overdue one: ${tetley['Open issues'].text}`);
    check(tetley['Variations waiting'].text==='1 1 done, not instructed'&&tetley['Variations waiting'].late,`${label}: the variation done without an instruction: ${tetley['Variations waiting'].text}`);
    const needs=tetley['Needs action'].text.match(/^(\d+) for the office · \d+ reports not seen yet$/);
    check(needs,`${label}: the office's count, with the reports not seen yet: ${tetley['Needs action'].text}`);
    const kirkstall=await cells(rows.filter({hasText:'014LME'}));
    check(kirkstall['Last visit'].late&&kirkstall['Last visit'].text.endsWith(`No report for ${quietDays} working days`),`${label}: Kirkstall Gate has gone quiet: ${kirkstall['Last visit'].text}`);
    check(kirkstall['This week'].text==='0 visits nobody yet',`${label}: nobody this week: ${kirkstall['This week'].text}`);
    const hunslet=await cells(rows.filter({hasText:'009LCP'}));
    check(hunslet['Last visit'].text==='No visit yet no report sent from site'&&!hunslet['Last visit'].late,`${label}: a site in defects liability is never marked quiet: ${hunslet['Last visit'].text}`);
    // What was cut: the totals block and the latest reports table.
    check(await page.locator('dl.tb').count()===0,`${label}: no totals block on the overview`);
    check(await page.getByRole('heading',{name:'Latest reports'}).count()===0,`${label}: no latest reports table on the overview`);
    check(await overflow(page)<=0,`${label}: no sideways scroll on the overview`);
    const box=await rows.first().boundingBox();check(box.height>=44,`${label}: a project row is big enough to tap`);
    // The overview's own list is the project list, on a phone and a desk alike (simpler office screens).
    check(await page.locator('.col-projects').count()===0,`${label}: no second project list beside or under the overview`);
    if(phone){
      const strip=await page.locator('.act-strip').boundingBox();check(strip.y<box.y,`${label}: the counts stay above the project list`);
      check(box.y<1100,`${label}: the first project is near the top of the phone (${Math.round(box.y)}px)`);
    }
    await axe(page,`${label}, overview`);
    if(shot)await page.screenshot({path:join(shot,`office-progress-overview-${scheme}-${width}.png`),fullPage:true});

    // Open the project from its row.
    await rows.filter({hasText:'011LME'}).click();
    await page.waitForFunction(()=>location.hash==='#/projects/proj-011lme');check(true,`${label}: the row opens the project`);
    const scope=phone?page.locator('.register-standing'):page.locator('.col-main .sheet');
    const visits=scope.locator('.from-site-visit');await visits.first().waitFor();
    const chip=await page.locator('.filters .chip').first().innerText();
    check(chip===`Needs action · ${needs[1]}`,`${label}: the row's count is the register's (${chip})`);
    if(phone){
      const last=scope.locator('dl.tb > div').first();
      check(/^last visit\s*today/i.test(await last.innerText())&&/3 visits this week/.test(await last.innerText()),`${label}: the register starts with the sheet's figures, last visit first`);
      const filters=await page.locator('.filters').boundingBox(),standing=await scope.boundingBox();check(standing.y<filters.y,`${label}: where it stands comes before the register's lists`);
      const links=scope.locator('.sheet-links'),fromSite=await visits.first().boundingBox();
      check(await links.isVisible()&&(await links.boundingBox()).y<fromSite.y,`${label}: the project's other pages come before Latest from site and the register`);
      const photos=links.getByRole('link',{name:'Photographs',exact:true});check((await photos.boundingBox()).y+(await photos.boundingBox()).height<=844,`${label}: Photographs is on the first screen`);
      check(await page.locator('.sheet-links:visible').count()===1,`${label}: the project's pages are listed once`);
    } else {
      const last=page.locator('.col-main dl.tb > div').first();
      check(/^last visit\s*today/i.test(await last.innerText()),`${label}: the sheet's first figure is the last visit`);
      check(/3 visits this week/.test(await last.innerText()),`${label}: with this week's visits`);
      check(/Sam Spark and Hana Duct · 3 visits this week/.test(await last.innerText()),`${label}: the sheet names everyone on site that day too: ${await last.innerText()}`);
      // With a project open, the project column is back to move between projects, and says how each stands.
      const item=page.locator('.col-projects a.item').filter({hasText:'014LME'});
      check(/no report for \d+ working days/i.test(await item.innerText()),`${label}: the project column says a site has gone quiet`);
      check(/last visit today · /i.test(await page.locator('.col-projects a.item').filter({hasText:'011LME'}).innerText()),`${label}: the project column gives the last visit`);
    }
    check(await visits.count()===2,`${label}: one site update for each trade, no inspection`);
    const trades=await visits.locator('.from-site-h b').allInnerTexts();
    check(trades.join('|')==='HVAC|Electrical',`${label}: trades newest first, a busy day by reference as Site coverage orders it: ${trades}`);
    const e=visits.filter({hasText:'Electrical'});const shown=phone?2:4;
    const lines=await e.locator('li').allInnerTexts();
    check(lines.length===shown,`${label}: ${shown} progress lines shown (${lines.length})`);
    check(/Level 1 corridor — Containment installed along the full run/.test(lines[0]),`${label}: the correction's words, not the report it replaced: ${lines[0]}`);
    check(!(await e.innerText()).includes('Cracked faceplate'),`${label}: defects are counted, not repeated`);
    check(new RegExp(`And ${6-shown} more in the report\\. Also raised 1 defect\\.`).test(await e.innerText()),`${label}: what is left out is said`);
    if(!phone)check(/^access/i.test(lines[2])&&await e.locator('li .kind.tone-access').count()===1,`${label}: an access line is marked as access`);
    check(/Also raised 1 variation\./.test(await visits.filter({hasText:'HVAC'}).innerText()),`${label}: HVAC's variation is counted`);
    check(!(await scope.innerText()).includes('Month old progress'),`${label}: a month-old update is not latest`);
    await axe(page,`${label}, project`);
    if(shot)await page.screenshot({path:join(shot,`office-progress-project-${scheme}-${width}.png`),fullPage:true});
    await e.locator('.from-site-h').click();
    await page.waitForFunction(id=>location.hash.endsWith(`/report/${id}`),elec.id);check(true,`${label}: the trade's heading opens that report`);
    check(await overflow(page)<=0,`${label}: no sideways scroll on the report`);

    // A report that will not load says so, and points to the list that still works.
    await page.route('**/api/reports/*',r=>r.request().resourceType()==='fetch'&&r.request().url().endsWith(hvac.id)?r.abort():r.continue());
    await page.goto(`${base}/office#/projects/proj-014lme`);await page.goto(`${base}/office#/projects/proj-011lme`);
    await scope.getByText('The latest reports could not be loaded just now.').waitFor();check(true,`${label}: a report that will not load is said plainly`);
    await page.unroute('**/api/reports/*');
    // A project with no site update in the fortnight says so.
    await page.goto(`${base}/office#/projects/proj-014lme`);
    await (phone?page.locator('.register-standing'):page.locator('.col-main .sheet')).getByText('No site update in the last 14 days.').waitFor();check(true,`${label}: a quiet project says it has no recent site update`);
    const quietLast=await (phone?page.locator('.register-standing'):page.locator('.col-main .sheet')).locator('dl.tb > div').first().innerText();
    check(new RegExp(`No report for ${quietDays} working days · Sam Spark and Hana Duct · 0 visits this week`).test(quietLast.replace(/\s+/g,' '))&&!/today/i.test(quietLast),`${label}: an earlier last visit names that day's people under its date, never "today": ${quietLast}`);
    await context.close();
  }
  check(errors.length===0,`no page errors: ${errors}`);
  console.log(`Passed ${checks} office progress checks (overview, project sheet and phone register; 1440px dark and 390px light).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
