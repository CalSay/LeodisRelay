// Browser check for first-time use: RELAY as a brand new site engineer and a
// new office user see it, with no reports, issues, variations, inspections,
// notes, talks or photographs anywhere. Each main page must say plainly that
// nothing is there yet (and, where it helps, what fills it), show no error,
// no "NaN" or "undefined", no zero that reads as a fault, and no sideways
// scroll on a phone; each is scanned with axe-core too. Checked at 390px light
// and 1440px dark.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves a screenshot of each page at each width.
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
const root=mkdtempSync(join(tmpdir(),'relay-first-time-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const engineer={id:'entra:first-engineer',oid:'first-engineer',name:'New Engineer',email:'new@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:first-manager',oid:'first-manager',name:'New Manager',email:'newm@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});}
// The only record: a site update the engineer has just started and not added to, on another project.
const draft=createReport('proj-014lme',engineer.name,engineer);
const P='proj-011lme';
// Each page, the words that must be on it, and words that must not.
const pages={
  Engineer:[
    {path:`/engineer?project=${P}`,has:['Start a site update','Nothing new from anyone else','Nothing on this project yet.','Start here'],not:[/new to you/i]},
    {path:`/engineer?project=${P}&view=issues`,has:['No open issues on this project.']},
    {path:`/engineer?project=${P}&view=reports`,has:['No reports yet on this project.']},
    {path:`/issues/snag-list?project=${P}`,has:['Nothing open on this project.']},
    {path:'/search?q=fire',has:['Nothing matches']},
    {path:`/weekly-summary?project=${P}`,has:['No site reports were sent for visits this week.','No issues raised this week.','No variations raised this week.'],not:[/\b0 changes\b/,/\b0 reports\b/]},
    {path:`/photos?project=${P}`,has:['No photographs yet']},
    {path:`/diary?project=${P}`,has:['No site visits yet']},
    {path:'/my-week',has:['One report for this week is not sent yet.'],not:[/Nothing recorded this week yet/]},
    {path:`/safety-actions?project=${P}`,has:['No safety inspection has been sent from this project yet.','Do a safety inspection']},
    {path:`/handover?project=${P}`,has:['Nothing is open in RELAY on this project.']},
    {path:`/issue-trend?project=${P}`,has:['No issues in the last 12 weeks.','Nothing to chart yet.'],not:[/Week by week/,/Open at the end of each week/]},
    {path:`/site-notes?project=${P}`,has:['No notes on this project.']},
    {path:`/toolbox-talks?project=${P}`,has:['No toolbox talks recorded on this project yet.']},
    {path:`/reports/${draft.id}/preview`,has:['Nothing recorded yet. Cards added to the report show here.'],not:[/No actions or decisions arise/]},
    {path:'/help?for=site',has:['New to RELAY? Start with How it works'],not:[/new to you/i],after:async(page,label)=>{
      check(/^How it works/.test(await page.locator('.help-section-title').first().innerText()),`${label}: How it works comes first`);
      check(!(await page.locator('.help-new li.is-new').count()),`${label}: nothing marked New for someone new to RELAY`);
    }},
  ],
  Manager:[
    {path:'/office#/projects',has:['Nothing has come in from site yet.','No reports received yet.','No open issues.','none awaiting instruction','Nothing needs attention.'],not:[/Every report has been read/,/Every open issue has an owner/,/all priced, awaiting the client/],
      after:async(page,label)=>check(!(await page.locator('.tbtn-help .tbtn-new').count()),`${label}: no "new" count on Help for someone who has never opened it`)},
    {path:'/office#/inbox',has:['No reports have come in yet.']},
    {path:'/office#/issues',has:['No issues have been raised yet.']},
    {path:'/office#/variations',has:['No variations have been raised yet.'],not:[/£0\.00/]},
    {path:`/projects/${P}`,has:['Nothing outstanding on this project.','No reports yet on this project.']},
    {path:'/coverage',has:['No site has sent a report through RELAY yet.','no reports sent yet'],not:[/no reports yet/i],
      after:async(page,label)=>check(!(await page.locator('.cov-quiet-list,.cov-quiet').count()),`${label}: no site is marked as gone quiet before any has started`)},
    {path:'/my-week',has:['Nothing recorded this week yet.'],after:async(page,label)=>check(!(await page.getByRole('button',{name:'Copy for my timesheet'}).isEnabled()),`${label}: nothing to copy for a timesheet`)},
    {path:'/companies',has:['No company or person has open issues']},
    {path:`/safety-actions?project=${P}`,has:['No safety inspection has been sent from this project yet.']},
    {path:`/toolbox-talks?project=${P}`,has:['No toolbox talks recorded on this project yet.']},
    {path:`/issue-trend?project=${P}`,has:['No issues in the last 12 weeks.']},
    {path:'/help?for=office',has:['New to RELAY? Start with How it works']},
  ],
};
const port=4352,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-first-time-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [role,list] of Object.entries(pages))for(const [scheme,width] of [['light',390],['dark',1440]]){
    // A fresh browser per role and width: nobody has opened Help on it.
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);
    for(const {path,has,not=[],after} of list){
      const label=`${role} ${path} ${width}px ${scheme}`;
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
      await page.goto(base+path);
      for(const words of has)await page.getByText(words,{exact:false}).first().waitFor({timeout:15000}).catch(()=>{});
      await page.waitForLoadState('networkidle').catch(()=>{});
      const text=await page.locator('body').innerText();
      for(const words of has)check(text.toLowerCase().includes(words.toLowerCase()),`${label}: says "${words}"\n${text}`);
      for(const pattern of not)check(!pattern.test(text),`${label}: does not say ${pattern}`);
      check(!/\bNaN\b|\bundefined\b|\bnull\b|Infinity|could not be loaded|went wrong/i.test(text),`${label}: no broken values or errors on the page`);
      const alerts=(await page.locator('[role=alert]:not(#__next-route-announcer__)').allInnerTexts()).filter(t=>t.trim());
      check(!alerts.length,`${label}: no error message: ${JSON.stringify(alerts)}`);
      if(width===390){const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=390,`${label}: no sideways scroll (${w})`);}
      await page.evaluate(axeSource);
      const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));
      check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);
      if(after)await after(page,label);
      assert.deepEqual(errors,[],`${label}: page errors`);
      if(screenshot)await page.screenshot({path:join(screenshot,`${role.toLowerCase()}-${path.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-').replace(/-proj-011lme|-$/g,'')||'home'}-${scheme}-${width}.png`),fullPage:true});
      await page.close();
    }
    await context.close();
  }
  console.log(`First-time use check passed (${checks} checks): ${pages.Engineer.length} engineer and ${pages.Manager.length} office pages with no data, each with its empty message, no errors, axe clean, 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
