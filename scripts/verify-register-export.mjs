// Browser check for the register spreadsheets: the office downloads the issue
// register's current search (every page, the register's order and filters)
// and the variation register's rows as CSV files that open in Excel; engineers
// and signed-out people are refused; phone and desktop, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-export-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const engineer={id:'entra:ex-engineer',oid:'ex-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:ex-manager',oid:'ex-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
// 75 open issues on Tetley Hall (more than one page of 50), 5 on Kirkstall Gate, 3 closed.
for(let n=1;n<=83;n++){
  const project=n<=78?'proj-011lme':'proj-014lme',code=n<=78?'011LME':'014LME';
  putRecord('issues',{id:`ex-${n}`,reference:`DEMO-${code}-ISS-${String(n).padStart(3,'0')}`,projectId:project,source:'report',reportedBy:engineer.name,
    location:n%4===0?'Level 3, Riser 2':'Corridor',description:n===1?'=HYPERLINK("http://example.test","click")':n===2?'Cable tray, "loose", near riser':`Issue number ${n}`,
    actionNeeded:'Make good',confirmation:'confirmed',work:n>80?'closed':'assigned',owner:n%2?'Acme Electrical Ltd':'Pipeworks Ltd',
    targetDate:n===3?addDays(today,-6):'',raisedByReport:'',raisedAt:`${addDays(today,-10)}T09:00:00Z`,affectedTrade:'Electrical',events:[]});
}
const variation=(n,extra)=>putRecord('variations',{id:`exv-${n}`,reference:`DEMO-011LME-VO-${String(n).padStart(3,'0')}`,projectId:'proj-011lme',description:`Variation ${n}`,location:'Plant room',
  trade:'HVAC',reason:'Client instruction',workDone:false,instruction:'pending',source:'office',raisedBy:manager.name,raisedAt:`${addDays(today,-n)}T09:00:00Z`,events:[],...extra});
variation(1,{quotedValue:1200});
variation(2,{workDone:true,quotedValue:800,labourHours:10,labourRate:45});
variation(3,{instruction:'instructed',quotedValue:1500,instructedValue:1400,labourHours:10,labourRate:45,partsCost:200,instructionReference:'CVI-12',instructedBy:'J. Client',instructedOn:addDays(today,-1)});
const port=4344,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-export-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
// A small CSV reader, enough for quoted cells with commas, quotes and line breaks.
const parseCsv=(text)=>{const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\r'&&text[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}else cell+=c;}return rows;};
const save=async(page,click)=>{const [download]=await Promise.all([page.waitForEvent('download'),click()]);const path=await download.path();return {name:download.suggestedFilename(),text:readFileSync(path,'utf8')};};
const showing=async(page,total)=>page.locator('nav.pager > span',{hasText:new RegExp(`of ${total}$`)}).waitFor({timeout:10000});
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,acceptDownloads:true});if(role)await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};

  // Signed out and engineer: the download is refused.
  {
    const res=await fetch(`${base}/api/issues/export`);
    check(res.status===401,`signed out: refused (${res.status})`);
    const {context,page}=await open('Engineer','light',390);
    const r=await page.request.get(`${base}/api/issues/export`);
    check(r.status()===403,`engineer: refused (${r.status()})`);
    await context.close();
  }

  // Office, desktop, dark: the whole open register, then a filtered search.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/issues`);await showing(page,80);
    const button=page.getByRole('link',{name:'Download 80 issues as a spreadsheet (CSV)'});
    check(await button.isVisible(),'office: the register offers the download, naming how many issues it holds');
    const all=await save(page,()=>button.click());
    check(all.name===`relay-issues-${today}.csv`,`office: file name ${all.name}`);
    check(all.text.startsWith('﻿'),'office: led by a byte-order mark for Excel');
    const rows=parseCsv(all.text.slice(1));
    check(rows[0][0]==='Reference'&&rows[0].includes('Owner')&&rows[0].includes('Verification'),`office: header row ${rows[0].join('|')}`);
    check(rows.length===81,`office: every open issue on every page, not just the 50 shown (${rows.length-1})`);
    const screenRefs=await page.locator('table.reg tbody .ref').allTextContents();
    check(JSON.stringify(rows.slice(1,51).map(r=>r[0]))===JSON.stringify(screenRefs),'office: the file keeps the register\'s order');
    const col=(name)=>rows[0].indexOf(name);
    const formula=rows.find(r=>r[0]==='DEMO-011LME-ISS-001');
    check(formula[col('Issue')].startsWith("'="),`office: a cell Excel would run as a formula is made text: ${formula[col('Issue')]}`);
    check(rows.find(r=>r[0]==='DEMO-011LME-ISS-002')[col('Issue')]==='Cable tray, "loose", near riser','office: commas and quotes survive');
    check(rows.find(r=>r[0]==='DEMO-011LME-ISS-003')[col('Days past target')]==='6','office: days past target');
    check(rows.find(r=>r[0]==='DEMO-014LME-ISS-079')[col('Project')]==='Kirkstall Gate - Phase 2','office: project named');
    // A narrower search: one project, one company, a location; the file follows it.
    await page.locator('.issue-search label',{hasText:'Project'}).locator('select').selectOption('proj-011lme');
    await page.locator('.issue-search label',{hasText:'Company'}).locator('input').fill('pipeworks');
    await page.locator('.issue-search label',{hasText:'Location'}).locator('input').fill('riser 2');
    const want=[...Array(78).keys()].map(k=>k+1).filter(n=>n%2===0&&n%4===0).length;
    await showing(page,want);
    const narrowed=await save(page,()=>page.getByRole('link',{name:new RegExp(`^Download ${want} issues`)}).click());
    const nrows=parseCsv(narrowed.text.slice(1));
    check(narrowed.name===`relay-issues-011LME-${today}.csv`,`office: a project's file is named for it (${narrowed.name})`);
    check(nrows.length-1===want&&nrows.slice(1).every(r=>r[col('Owner')]==='Pipeworks Ltd'&&r[col('Location')]==='Level 3, Riser 2'),`office: the file holds this search only (${nrows.length-1} of ${want})`);
    // Closed filter: the closed issues, with their verification words.
    await page.getByRole('button',{name:'Clear filters'}).first().click();
    await page.getByRole('button',{name:/^Closed · /}).click();await showing(page,3);
    const closed=parseCsv((await save(page,()=>page.getByRole('link',{name:'Download 3 issues as a spreadsheet (CSV)'}).click())).text.slice(1));
    check(closed.length===4&&closed.slice(1).every(r=>r[col('Work')]==='Closed'&&r[col('Verification')]==='Verified and closed'),'office: the closed filter downloads the closed issues');
    if(screenshot)await page.screenshot({path:join(screenshot,'issues-dark-1440.png')});
    // Variations: the rows on screen, money as numbers.
    await page.goto(`${base}/office#/variations`);
    await page.getByRole('button',{name:/^All · /}).click();
    const vbutton=page.getByRole('button',{name:'Download 3 variations as a spreadsheet (CSV)'});
    await vbutton.waitFor();
    const v=await save(page,()=>vbutton.click());
    check(v.name===`relay-variations-${today}.csv`,`office: variation file name ${v.name}`);
    const vrows=parseCsv(v.text.slice(1));
    const vcol=(name)=>vrows[0].indexOf(name);
    const screenV=await page.locator('table.reg tbody .ref').allTextContents();
    check(JSON.stringify(vrows.slice(1).map(r=>r[0]))===JSON.stringify(screenV),`office: the variation file holds the rows on screen in order (${vrows.length-1})`);
    const instructed=vrows.find(r=>r[0]==='DEMO-011LME-VO-003');
    check(instructed[vcol('Instructed (£)')]==='1400'&&instructed[vcol('Expected cost (£)')]==='650'&&instructed[vcol('Margin (£)')]==='750'&&instructed[vcol('Client reference')]==='CVI-12','office: instructed value, cost, margin and client reference as numbers');
    check(vrows.find(r=>r[0]==='DEMO-011LME-VO-002')[vcol('Instruction')]==='Done, not instructed','office: work done without an instruction is named');
    await page.getByRole('button',{name:/^Declined · /}).click();
    check(await page.getByRole('button',{name:/^Download .* variations? as a spreadsheet/}).count()===0,'office: no download when nothing is shown');
    if(screenshot){await page.getByRole('button',{name:/^All · /}).click();await page.screenshot({path:join(screenshot,'variations-dark-1440.png')});}
    assert.deepEqual(errors,[],'office: page errors');
    await context.close();
  }

  // Office on a phone, light: the button is there, touch-size, and the heading fits.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/office#/issues`);await showing(page,80);
    const button=page.getByRole('link',{name:'Download 80 issues as a spreadsheet (CSV)'});
    const box=await button.boundingBox();
    check(box&&box.height>=32&&box.x>=0&&box.x+box.width<=390,`phone: the download button fits and is tappable (${JSON.stringify(box)})`);
    const phone=await save(page,()=>button.click());
    check(parseCsv(phone.text.slice(1)).length===81,'phone: the same file');
    // The register's table is wider than a phone and scrolls on its own (as before this change); the header and its buttons must fit.
    const right=await page.locator('.pagehead').evaluate(e=>Math.max(e.getBoundingClientRect().right,...[...e.querySelectorAll('*')].map(x=>x.getBoundingClientRect().right)));
    check(right<=390,`phone: the heading and its buttons fit the screen (${Math.round(right)}px)`);
    if(screenshot)await page.screenshot({path:join(screenshot,'issues-light-390.png')});
    assert.deepEqual(errors,[],'phone: page errors');
    await context.close();
  }
  console.log(`Register spreadsheet check passed (${checks} checks): office-only download, every page in the register's order, filters followed, Excel-safe cells, variations as on screen, phone and desktop, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
