// Browser check: the office Issues register reads well on a small laptop.
// At 1024px the heading, filters and tall rows left room for about one and a
// half issues before scrolling: each description wrapped to five or six lines
// and the status tags broke into a column of words (office laptop walk, 22 Oct
// 2026). Busy example data (scripts/seed-busy-projects.mjs, 60 days) and the
// office manager, on Open, on Fixed, to check and with a location typed (so
// "Clear filters" is on the filter row):
// - at 1024-1279px the heading's buttons sit beside the title on one row, the
//   five filters are on one row, the Project column gives way to the
//   project's name under the reference, and "45d late" sits under the target;
// - at 1280px and wider the Project column is back and nothing is under the
//   reference; below 1024 the register is still cards with a Project line;
// - every Work and Confirmation tag is on one line from 1024px up;
// - the first issue starts no lower than 520px at 1024 (it was about 580) and an Open row averages no
//   more than 130px (it was about 180);
// - nothing scrolls sideways, the Verify button is inside its panel, and no
//   cell of the table runs into the next;
// - a spreadsheet download that fails says so inside the heading, nothing sideways.
// Light and dark at 1024 and 1280; the theme does not change the layout, so
// 1000, 1100, 1180, 1365 and 1440 run in light.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves each page. RELAY_REPORT_ONLY=1 prints the
// measurements and what would fail without failing (for before shots on main).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {seedBusyProjects,PEOPLE} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-issues-laptop-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
seedBusyProjects({storagePath,today:londonDay(new Date()),days:60});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4374,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-issues-laptop-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const reportOnly=!!process.env.RELAY_REPORT_ONLY;const failed=[];let checks=0;
const check=(ok,message)=>{checks++;if(reportOnly){if(!ok)failed.push(message);}else assert.ok(ok,message);};
const RUNS=[[1000,['light']],[1024,['light','dark']],[1100,['light']],[1180,['light']],[1279,['light']],[1280,['light','dark']],[1365,['light']],[1440,['light']]];
const PAGES=[['open','/office#/issues'],['fixes','/office#/issues/show/verify'],['filtered','/office#/issues']];

// Runs in the page: where the heading, filters and rows are, and how the cells sit.
const measure=()=>{
  const view=document.querySelector('.ws .issue-search').closest('.view');const r=e=>e.getBoundingClientRect();
  const head=view.querySelector(':scope>.pagehead'),title=head.querySelector('h2'),btns=[...head.querySelectorAll('.actions>*')];
  const search=view.querySelector('.issue-search'),labels=[...search.querySelectorAll('label')];
  const table=view.querySelector('table.reg'),rows=[...table.querySelectorAll('tbody tr')];
  const shown=e=>!!e&&getComputedStyle(e).display!=='none'&&r(e).width>0;
  const lines=e=>{const cs=getComputedStyle(e);const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3;return Math.round((r(e).height-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-parseFloat(cs.borderTopWidth)-parseFloat(cs.borderBottomWidth))/lh);};
  const tags=[...table.querySelectorAll('tbody td[data-label="Work"] .tag,tbody td[data-label="Confirmation"] .tag')];
  const cells=[];for(const tr of rows.slice(0,20)){const tds=[...tr.children].filter(shown);for(const [n,td] of tds.entries()){if(n&&getComputedStyle(table).display!=='block'&&r(td).left<r(tds[n-1]).right-1)cells.push(tr.querySelector('.ref')?.textContent);
    for(const kid of td.querySelectorAll('*'))if(shown(kid)&&(r(kid).right>r(td).right+1))cells.push(`${tr.querySelector('.ref')?.textContent} ${td.dataset.label??td.className}`);}}
  const verify=table.querySelector('tbody tr .c-actions .btn');const panel=table.closest('.panel');
  return {
    cards:getComputedStyle(table).display==='block',
    headOneRow:btns.every(b=>Math.abs(r(b).top-r(btns[0]).top)<2)&&btns.every(b=>r(b).left>r(title).right),
    filtersOneRow:labels.every(l=>Math.abs(r(l).top-r(labels[0]).top)<2),
    filterCut:labels.filter(l=>{const c=l.querySelector("input,select");return r(c).width<90;}).map(l=>`${l.textContent.trim().split(" ")[0]} ${Math.round(r(l.querySelector("input,select")).width)}px`),
    projectColumn:shown(table.querySelector('thead th.c-project'))&&shown(rows[0].querySelector('td.c-project')),
    projectUnderRef:shown(rows[0].querySelector('.ref-project')),
    projectUnderRefText:rows[0].querySelector('.ref-project')?.textContent??'',
    projectCellText:rows[0].querySelector('td.c-project')?.textContent??'',
    projectCardLine:shown(rows[0].querySelector('td.c-project')),
    tagsOnTwoLines:tags.filter(t=>lines(t)>1).length,tags:tags.length,
    firstRowTop:Math.round(r(rows[0]).top+scrollY),
    rowAverage:Math.round(rows.reduce((s,tr)=>s+r(tr).height,0)/rows.length),
    lateUnder:[...table.querySelectorAll('.late-days')].every(s=>getComputedStyle(s).display==='block'),
    lateBeside:[...table.querySelectorAll('.late-days')].every(s=>getComputedStyle(s).display==='inline'),
    late:table.querySelectorAll('.late-days').length,
    sideways:document.documentElement.scrollWidth>innerWidth+1||[...document.querySelectorAll('.ws .view,.ws .panel')].some(e=>e.scrollWidth>e.clientWidth+1),
    verifyInside:!verify||(r(verify).right<=r(panel).right&&r(verify).right<=innerWidth),
    overrun:cells,
  };
};

let browser;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [width,schemes] of RUNS)for(const colorScheme of schemes){
    const context=await browser.newContext({viewport:{width,height:800},colorScheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(`${width} ${colorScheme}: ${e.message}`));
    for(const [name,path] of PAGES){
      const label=`${name} at ${width}px ${colorScheme}`;
      await page.goto(base+path);await page.locator('.ws .view:has(.issue-search) table.reg tbody tr').first().waitFor();await page.waitForLoadState('networkidle');
      // Narrowed, so "Clear filters" joins the filter row.
      if(name==='filtered'){await page.getByRole('searchbox',{name:/Location/}).fill('riser');await page.getByRole('button',{name:'Clear filters'}).first().waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(400);}
      if(shot)await page.screenshot({path:join(shot,`issues-laptop-${name}-${colorScheme}-${width}.png`)});
      const m=await page.evaluate(measure);
      console.log(label,JSON.stringify({first:m.firstRowTop,row:m.rowAverage,tagsOnTwoLines:`${m.tagsOnTwoLines}/${m.tags}`,head:m.headOneRow,filters:m.filtersOneRow,project:m.projectColumn?'column':m.projectUnderRef?'under ref':'cards'}));
      check(!m.sideways,`${label}: nothing scrolls sideways`);
      check(m.verifyInside,`${label}: the first row's button is inside its panel`);
      check(m.overrun.length===0,`${label}: no cell runs into the next (${m.overrun.slice(0,3).join(', ')})`);
      if(width<1024){
        check(m.cards,`${label}: the register is cards`);
        check(!m.projectUnderRef&&m.projectCardLine,`${label}: cards have their Project line, not a name under the reference`);
        continue;
      }
      check(!m.cards,`${label}: the register is a table`);
      check(m.tagsOnTwoLines===0,`${label}: every Work and Confirmation tag is on one line (${m.tagsOnTwoLines} of ${m.tags} on two or more)`);
      if(width<1280){
        check(m.headOneRow,`${label}: the heading's buttons are on one row beside the title`);
        check(m.filtersOneRow,`${label}: the five filters are on one row`);
        check(m.filterCut.length===0,`${label}: every filter box is wide enough to read (${m.filterCut.join(', ')})`);
        check(!m.projectColumn&&m.projectUnderRef,`${label}: the project's name is under the reference, not in a column`);
        check(/\S/.test(m.projectUnderRefText),`${label}: the name under the reference is the project's name`);
        if(name==='open')check(m.late>0&&m.lateUnder,`${label}: "Nd late" is under the target date`);
      }else{
        check(m.projectColumn&&!m.projectUnderRef,`${label}: the Project column is there and nothing is under the reference`);
        if(name==='open')check(m.late>0&&m.lateBeside,`${label}: "Nd late" is beside the target date`);
      }
      if(width===1024&&name==='open'){
        check(m.firstRowTop<=520,`${label}: the first issue starts by 520px (${m.firstRowTop}px)`);
        check(m.rowAverage<=130,`${label}: an Open row averages 130px or less (${m.rowAverage}px)`);
      }
    }
    // A download that fails says so under the buttons without pushing the page sideways.
    if(width>=1024){
      await page.goto(base+'/office#/issues');await page.locator('.ws .view:has(.issue-search) table.reg tbody tr').first().waitFor();
      await page.route('**/api/issues/export**',r=>r.abort());
      await page.getByRole('link',{name:/Download .* spreadsheet/}).click();
      await page.locator('.ws .pagehead .download-problem').waitFor();
      const d=await page.evaluate(()=>{const p=document.querySelector('.ws .pagehead .download-problem').getBoundingClientRect(),h=document.querySelector('.ws .issues-view>.pagehead, .ws .view:has(.issue-search)>.pagehead').getBoundingClientRect();
        return {sideways:document.documentElement.scrollWidth>innerWidth+1||[...document.querySelectorAll('.ws .view,.ws .panel,.ws .pagehead')].some(e=>e.scrollWidth>e.clientWidth+1),inside:p.left>=h.left&&p.right<=h.right+1};});
      check(!d.sideways&&d.inside,`download failure at ${width}px ${colorScheme}: the message is inside the heading and nothing scrolls sideways`);
      await page.unroute('**/api/issues/export**');
    }
    await context.close();
  }
  check(errors.length===0,`no page errors (${errors.join('; ')})`);
  if(reportOnly)console.log(failed.length?`would fail:\n- ${failed.join('\n- ')}`:'nothing would fail');
  else console.log(`verify-issues-laptop: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');rmSync(root,{recursive:true,force:true});
}
