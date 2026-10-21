// Browser check that the register spreadsheets read as one set. On a busy
// project (months of reports, issues and variations, 60 permits and 60
// toolbox talks with accents, typed formulas and withdrawn records) it
// downloads each register through its page, as the office at 1440px dark and
// on a 390px phone light, and an engineer on a phone: issues, variations,
// permits to work and toolbox talks. Each file must be named relay-<register>
// [-<project>]-<day>.csv, open as UTF-8 with CRLF rows, lead with the house
// columns (reference, project number, project), carry every heading the
// register shows, hold the rows on screen in the order on screen, write days
// and UK times as Excel reads them, keep accents, and start no typed cell
// with a formula sign. Variations are ordered by a column first, on a desk by
// its heading and on a phone by the Order list, so the file must keep it.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {seedBusyProjects,PEOPLE} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-register-downloads-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,records,database}=require(storagePath);
// Safety, permits and deliveries are off unless the office turns them on (lib/featureSwitch.ts); this check needs them on. verify-simpler-home.mjs covers both states.
putRecord('settings',{id:'features',safetyRecords:true});
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {ISSUE_COLUMNS,VARIATION_COLUMNS}=require('../apps/web/.test-build/lib/registerExport.js');
const {PERMIT_COLUMNS}=require('../apps/web/.test-build/lib/permits.js');
const {TALK_COLUMNS}=require('../apps/web/.test-build/lib/toolboxTalks.js');
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const seeded=seedBusyProjects({storagePath,today,days:Number(process.env.RELAY_REGISTER_DAYS??180),scale:1});
const P='proj-011lme';
const NAMES=['Zoë Brontë','Seán O\'Neill','Chloé Dupré','José Núñez','Pat Pipe','Sam Spark','=SUM(A1:A2)','Dana Lee, Northbank Electrical'];
for(let n=0;n<60;n++){
  const day=addDays(today,-n*2);
  putRecord('toolbox-talks',{id:`rd-talk-${n}`,projectId:P,day,topic:n===0?'Safe isolation: "lock off, test, prove"':n===1?'=HYPERLINK("http://example.test","x")':'Working at height on the podium',
    givenBy:NAMES[n%4],attendees:NAMES.slice(0,3+(n%5)),...(n%3?{}:{notes:'Café on site closed, briefing held in cabin 2'}),by:'Sam Spark',byId:PEOPLE.engineer.id,
    at:`${day}T07:${String(10+n%40).padStart(2,'0')}:00.000Z`,...(n===4?{withdrawn:{by:'Office Manager',byId:PEOPLE.manager.id,at:`${day}T23:30:00.000Z`,reason:'Entered twice'}}:{})});
}
const KINDS=['hot-works','electrical-isolation','pipework-isolation','work-at-height','confined-space'];
for(let n=0;n<60;n++){
  const day=addDays(today,-n);
  putRecord('permits',{id:`rd-permit-${n}`,projectId:P,kind:KINDS[n%KINDS.length],reference:`PTW-${1000+n}`,work:n===1?'-Cut riser sleeve, level 3':'Brazing on level 4 plant, Zoë Brontë present',
    issuedBy:'Site manager',heldBy:NAMES[n%6],day,ends:`${day}T17:00`,by:'Sam Spark',byId:PEOPLE.engineer.id,at:`${day}T07:30:00.000Z`,
    ...(n>1?{closed:{by:'Seán O\'Neill',byId:PEOPLE.engineer.id,at:`${day}T16:40:00.000Z`,note:'Area checked'}}:{}),
    ...(n===7?{withdrawn:{by:'Office Manager',byId:PEOPLE.manager.id,at:`${day}T12:00:00.000Z`,reason:'Wrong project'}}:{})});
}
const sessions={};
for(const p of [PEOPLE.engineer,PEOPLE.manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString()});}
const port=4362,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-register-downloads-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
// A small CSV reader, enough for quoted cells with commas, quotes and line breaks.
const parseCsv=(text)=>{const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\r'&&text[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}else cell+=c;}return rows;};
const save=async(page,click)=>{const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),click()]);return {name:download.suggestedFilename(),text:readFileSync(await download.path(),'utf8')};};
const DAY=/^\d{4}-\d{2}-\d{2}$/,TIME=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,NUMBER=/^-?\d+(\.\d+)?$/;
const dayColumn=c=>/ on$| date$|^Last change$/.test(c),timeColumn=c=>/ at$|^Runs until$/.test(c);

/** What every register file must be, whatever the register. Returns the rows. */
function sameShape(file,{label,kind,project,columns,screenHeadings,lead}){
  check(new RegExp(`^relay-${kind}${project?`-${project}`:''}-${today}\\.csv$`).test(file.name),`${label}: file named for the register, project and day (${file.name})`);
  check(file.text.startsWith('﻿'),`${label}: starts with a byte-order mark so Excel reads it as UTF-8`);
  check(file.text.endsWith('\r\n')&&!/[^\r]\n(?=[^"]*$)/.test(file.text.slice(-200)),`${label}: rows end with CRLF`);
  const rows=parseCsv(file.text.slice(1));
  assert.deepEqual(rows[0],[...columns],`${label}: headings`);checks++;
  check(JSON.stringify(rows[0].slice(0,lead.length))===JSON.stringify(lead),`${label}: leads with ${lead.join(', ')}`);
  for(const h of screenHeadings){
    const want=h.toLowerCase();
    check(rows[0].some(c=>c.toLowerCase()===want||c.toLowerCase().startsWith(`${want} (`)||c.toLowerCase().startsWith(`${want} `)||(want==='ref'&&c==='Reference')),`${label}: the page's "${h}" heading is in the file (${rows[0].join('|')})`);
  }
  check(rows.slice(1).every(r=>r.length===columns.length),`${label}: every row has every column`);
  const bad=[];
  rows[0].forEach((c,i)=>{for(const r of rows.slice(1)){const v=r[i];if(!v)continue;if(dayColumn(c)&&!DAY.test(v))bad.push(`${c}=${v}`);if(timeColumn(c)&&!TIME.test(v))bad.push(`${c}=${v}`);}});
  check(!bad.length,`${label}: days as YYYY-MM-DD and times as YYYY-MM-DD HH:MM (${bad.slice(0,4).join(', ')})`);
  const formula=rows.slice(1).flat().filter(v=>/^[=+@\t\r]/.test(v)||(/^-/.test(v)&&!NUMBER.test(v)));
  check(!formula.length,`${label}: no typed cell starts with a formula sign (${formula.slice(0,3).join(' | ')})`);
  return rows;
}
const headings=page=>page.locator('table.reg thead th').evaluateAll(ths=>ths.map(t=>t.textContent.replace(/[↑↓↕]/g,'').trim()).filter(Boolean));

try {
  let ready=false;for(let k=0;k<90;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const open=async(role,scheme,width)=>{const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,acceptDownloads:true});await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const issueCount=records('issues').length,variationCount=records('variations').length;

  // The office at a desk, dark.
  {
    const {context,page,errors}=await open('Manager','dark',1440);
    await page.goto(`${base}/office#/issues`);
    await page.getByRole('button',{name:/^All · /}).click();
    await page.locator('nav.pager > span',{hasText:new RegExp(`of ${issueCount}$`)}).waitFor({timeout:20000});
    const issueHeads=(await headings(page)).filter(h=>h!=='Actions');
    const filterLabels=await page.locator('.issue-search label').evaluateAll(ls=>ls.map(l=>l.childNodes[0].textContent.trim()));
    check(filterLabels[0]==='Project'&&filterLabels[1]==='Trade',`issues: Project and Trade come first, as on Variations (${filterLabels.join(', ')})`);
    const screenIssues=await page.locator('table.reg tbody .ref').allTextContents();
    const issues=sameShape(await save(page,()=>page.getByRole('link',{name:`Download ${issueCount} issues as a spreadsheet (CSV)`}).click()),
      {label:'office issues',kind:'issues',columns:ISSUE_COLUMNS,screenHeadings:issueHeads,lead:['Reference','Project number','Project']});
    check(issues.length-1===issueCount,`issues: every issue on every page is in the file (${issues.length-1} of ${issueCount})`);
    check(JSON.stringify(issues.slice(1,1+screenIssues.length).map(r=>r[0]))===JSON.stringify(screenIssues),'issues: the first rows are the rows on screen, in order');
    check(issues.slice(1).every(r=>r[1]&&r[2]&&!r[2].startsWith('proj-')),'issues: every row names its project number and project');
    if(screenshot)await page.screenshot({path:join(screenshot,'after-office-issues-dark-1440.png')});

    await page.goto(`${base}/office#/variations`);
    await page.getByRole('button',{name:/^All · /}).click();
    const quoted=page.locator('table.reg thead th',{hasText:/^Quoted/}).getByRole('button');
    await quoted.click();await quoted.click();
    check(await page.locator('table.reg thead th',{hasText:/^Quoted/}).getAttribute('aria-sort')==='descending','variations: the Quoted heading orders the rows, highest first on a second press');
    check(/^Sorted by quoted value, descending\./.test(await page.locator('.panel-foot').innerText()),'variations: the foot says how the rows are ordered');
    const money=await page.locator('table.reg tbody td[data-label="Quoted"]').allTextContents();
    const values=money.map(t=>t.includes('£')?Number(t.replace(/[£,]/g,'')):undefined);
    const firstBlank=values.indexOf(undefined);
    check(values.slice(0,firstBlank<0?undefined:firstBlank).every((v,i,a)=>i===0||a[i-1]>=v)&&(firstBlank<0||values.slice(firstBlank).every(v=>v===undefined)),'variations: highest quote first, unquoted last');
    const varHeads=(await headings(page)).filter(h=>h!=='Action');
    const screenVars=await page.locator('table.reg tbody .ref').allTextContents();
    const vars=sameShape(await save(page,()=>page.getByRole('button',{name:`Download ${variationCount} variations as a spreadsheet (CSV)`}).click()),
      {label:'office variations',kind:'variations',columns:VARIATION_COLUMNS,screenHeadings:varHeads,lead:['Reference','Project number','Project']});
    check(JSON.stringify(vars.slice(1).map(r=>r[0]))===JSON.stringify(screenVars),`variations: the file holds the rows on screen in the order on screen (${vars.length-1})`);
    const q=vars[0].indexOf('Quoted (£)');
    check(vars.slice(1).every(r=>r[q]===''||NUMBER.test(r[q])),'variations: money as plain numbers');
    if(screenshot)await page.screenshot({path:join(screenshot,'after-office-variations-dark-1440.png')});

    // A project's permits and talks, from the office.
    await page.goto(`${base}/permits?project=${P}`);
    const permits=sameShape(await save(page,()=>page.getByRole('link',{name:'Download spreadsheet'}).click()),
      {label:'office permits',kind:'permits',project:'011LME',columns:PERMIT_COLUMNS,screenHeadings:['Status'],lead:['Permit number','Project number','Project']});
    check(permits.length-1===60,`permits: every permit, withdrawn included (${permits.length-1})`);
    const pc=n=>permits[0].indexOf(n);
    const gone=permits.find(r=>r[pc('Status')]==='Withdrawn');
    check(gone&&DAY.test(gone[pc('Withdrawn on')])&&gone[pc('Withdrawn by')]==='Office Manager'&&gone[pc('Withdrawn because')]==='Wrong project','permits: a withdrawn permit keeps its row with when, who and why');
    check(permits.some(r=>r[pc('Closed by')]==='Seán O\'Neill')&&permits.some(r=>r[pc('Work and where')].includes('Zoë Brontë')),'permits: accents kept');
    check(permits.some(r=>r[pc('Work and where')]==="'-Cut riser sleeve, level 3"),'permits: a work description starting with a minus is kept as text');
    check(permits.every((r,i)=>i===0||(r[pc('Project number')]==='011LME'&&r[pc('Project')]==='Tetley Hall - Block E')),'permits: project number and name on every row');

    await page.goto(`${base}/toolbox-talks?project=${P}`);
    const talks=sameShape(await save(page,()=>page.getByRole('link',{name:'Download spreadsheet'}).click()),
      {label:'office toolbox talks',kind:'toolbox-talks',project:'011LME',columns:TALK_COLUMNS,screenHeadings:['Given by'],lead:['Project number','Project']});
    check(talks.length-1===60,`talks: every talk, withdrawn included (${talks.length-1})`);
    const tc=n=>talks[0].indexOf(n);
    const pulled=talks.find(r=>r[tc('Status')]==='Withdrawn');
    check(pulled&&pulled[tc('Withdrawn by')]==='Office Manager'&&pulled[tc('Withdrawn because')]==='Entered twice','talks: a withdrawn talk keeps its row with who and why');
    check(pulled[tc('Withdrawn on')]===addDays(pulled[tc('Given on')],1),'talks: withdrawn at 23:30 UTC in summer is the next UK day');
    check(talks.some(r=>r[tc('Topic')]==='Safe isolation: "lock off, test, prove"')&&talks.some(r=>r[tc('Topic')].startsWith("'=HYPERLINK")),'talks: quotes kept, a typed formula is text');
    check(talks.some(r=>r[tc('Attendees')].includes('Zoë Brontë; Seán O\'Neill; Chloé Dupré')),'talks: accents kept in the attendees');
    check(talks.every((r,i)=>i===0||r[tc('Status')]==='Given'||r[tc('Status')]==='Withdrawn'),'talks: every talk has a status');
    assert.deepEqual(errors,[],'office desk: page errors');
    await context.close();
  }

  // The office on a phone, light: Variations ordered from the Order list.
  {
    const {context,page,errors}=await open('Manager','light',390);
    await page.goto(`${base}/office#/variations`);
    await page.getByRole('button',{name:/^All · /}).click();
    check(!(await page.locator('.filters .sort-chip').isVisible()),'phone: the priority chip gives way to the Order list, as on Issues');
    await page.locator('.filters .phone-sort select').selectOption('raised:ascending');
    const screen=await page.locator('table.reg tbody .ref').allTextContents();
    const file=sameShape(await save(page,()=>page.getByRole('button',{name:`Download ${variationCount} variations as a spreadsheet (CSV)`}).click()),
      {label:'phone variations',kind:'variations',columns:VARIATION_COLUMNS,screenHeadings:[],lead:['Reference','Project number','Project']});
    check(JSON.stringify(file.slice(1).map(r=>r[0]))===JSON.stringify(screen),'phone: the file keeps the order chosen on the phone');
    const raised=file.slice(1).map(r=>r[file[0].indexOf('Raised on')]);
    check(raised.every((d,i)=>i===0||raised[i-1]<=d),'phone: oldest first');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone: no sideways scroll');
    if(screenshot)await page.screenshot({path:join(screenshot,'after-office-variations-light-390.png')});
    await page.goto(`${base}/office#/issues`);
    await page.locator('table.reg tbody .ref').first().waitFor();
    const filterLabels=await page.locator('.issue-search label').evaluateAll(ls=>ls.map(l=>l.childNodes[0].textContent.trim()));
    check(filterLabels[0]==='Project'&&filterLabels[1]==='Trade','phone: issue filters start with Project and Trade');
    if(screenshot)await page.screenshot({path:join(screenshot,'after-office-issues-light-390.png')});
    assert.deepEqual(errors,[],'office phone: page errors');
    await context.close();
  }

  // An engineer on a phone, light: the project registers they can download; the office ones are refused.
  {
    const {context,page,errors}=await open('Engineer','light',390);
    check((await page.request.get(`${base}/api/issues/export`)).status()===403,'engineer: the office issue register download is refused');
    await page.goto(`${base}/permits?project=${P}`);
    sameShape(await save(page,()=>page.getByRole('link',{name:'Download spreadsheet'}).click()),{label:'engineer permits',kind:'permits',project:'011LME',columns:PERMIT_COLUMNS,screenHeadings:[],lead:['Permit number','Project number','Project']});
    if(screenshot)await page.screenshot({path:join(screenshot,'after-permits-light-390.png')});
    await page.goto(`${base}/toolbox-talks?project=${P}`);
    sameShape(await save(page,()=>page.getByRole('link',{name:'Download spreadsheet'}).click()),{label:'engineer talks',kind:'toolbox-talks',project:'011LME',columns:TALK_COLUMNS,screenHeadings:[],lead:['Project number','Project']});
    if(screenshot)await page.screenshot({path:join(screenshot,'after-toolbox-talks-light-390.png')});
    assert.deepEqual(errors,[],'engineer: page errors');
    await context.close();
  }
  console.log(`Register downloads check passed (${checks} checks): issues (${issueCount}), variations (${variationCount}), permits and toolbox talks from a busy project, office at 1440px dark and 390px light, engineer at 390px light; names, headings, order, dates, accents and formula protection. Seeded: ${JSON.stringify(seeded)}.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
