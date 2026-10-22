// Browser check for the Weekly summary on a phone (walk of 22 Oct 2026): an office
// manager at 390px asking "how did this project do last week, and last month?". On
// the busy example data (scripts/seed-busy-projects.mjs, ten weeks), the choices
// filled the first screen, so no figure showed until a scroll, and the Month
// choice's "Week by week" showed only days and reports: the issues and variations
// columns were off the side of the screen in a sideways scroll.
// Checks, as the manager at 390px light and dark and at 360, 375, 412 and 430px light: the week's figures match the
// records (sent reports by visit day, safety records left off; issues and
// variations by the day raised); the choices take three rows, print sits beside
// Week and Month and is not the gold button; the week's four figures and the
// month's first two are on the first screen; each week in Week by week shows all
// six figures, named, inside the screen, matching the month's own figures and
// adding up to the month; no sideways scroll; axe finds nothing. At 1440 and in
// print it is still a table with its header row. RELAY_SCREENSHOT_DIR=<dir> saves
// the screens. npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and
// RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-weekly-phone-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,records,database}=require(storagePath);
const {londonDay,weekStart,shiftWeek,weekEnd}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {monthOf,shiftMonth}=require('../apps/web/.test-build/lib/monthSummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today,days:75});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});

// Last week and last month, whatever day this runs.
const week=shiftWeek(weekStart(undefined,today),-1),weekLast=weekEnd(week);
const month=shiftMonth(monthOf(undefined,today),-1);
const P='proj-011lme';
const inWeek=(d)=>d>=week&&d<=weekLast;
const SAFETY=new Set(['safety-inspection','tower-inspection']);
const sent=records('reports',P).filter(r=>r.state==='submitted');
const replaced=new Set(sent.map(r=>r.corrects).filter(Boolean));
const weekReports=sent.filter(r=>!replaced.has(r.id)&&!SAFETY.has(r.reportType)&&inWeek(r.visitDate));
const expected={reports:weekReports.length,days:new Set(weekReports.map(r=>r.visitDate)).size,engineers:new Set(weekReports.map(r=>r.author)).size,
  raised:records('issues',P).filter(i=>inWeek(londonDay(i.raisedAt))).length,vraised:records('variations',P).filter(v=>inWeek(londonDay(v.raisedAt))).length};
assert.ok(expected.reports>5&&expected.raised>0,`the seed gives last week reports and issues (${JSON.stringify(expected)})`);

const port=4386,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-weekly-phone',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('.week-page'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe found ${found.join('; ')}`);};
const COLUMNS=['Days on site','Reports','Issues raised','Issues closed','Variations raised','Variations instructed'];
try {
  let ready=false;for(let k=0;k<90;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  const open=async(scheme,width,height=844)=>{const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  // Rows of choices: controls whose tops are within 8px of each other share a row.
  const rows=(page)=>page.evaluate(()=>{const tops=[...document.querySelectorAll('.week-controls select, .week-controls button')].map(el=>el.getBoundingClientRect().top).sort((a,b)=>a-b);return tops.filter((t,i)=>i===0||t-tops[i-1]>8).length;});
  const figureNumbers=(page)=>page.evaluate(()=>[...document.querySelectorAll('.week-stats > div')].map(d=>({label:d.querySelector('dt').textContent,value:Number(d.querySelector('dd').firstChild.textContent),bottom:d.getBoundingClientRect().bottom})));

  // 360 to 430 covers small Android phones, iPhones and the common 412px Android width.
  for(const [scheme,width] of [['light',390],['dark',390],['light',360],['light',375],['light',412],['light',430]]){
    const {context,page,errors}=await open(scheme,width);
    const label=`${width} ${scheme}`;
    // Last week.
    await page.goto(`${base}/weekly-summary?project=${P}&week=${week}`);await page.locator('.week-sheet').filter({hasText:'last week'}).waitFor();
    const figures=await figureNumbers(page);
    const byLabel=Object.fromEntries(figures.map(f=>[f.label,f.value]));
    check(byLabel['Site reports']===expected.reports,`${label}: site reports ${byLabel['Site reports']} match the records (${expected.reports})`);
    check(byLabel.Engineers===expected.engineers,`${label}: engineers ${byLabel.Engineers} match the records (${expected.engineers})`);
    check(byLabel['Issues raised']===expected.raised,`${label}: issues raised ${byLabel['Issues raised']} match the records (${expected.raised})`);
    check(byLabel['Variations raised']===expected.vraised,`${label}: variations raised ${byLabel['Variations raised']} match the records (${expected.vraised})`);
    check((await page.locator('.week-stats small').first().innerText()).startsWith(`${expected.days} day`),`${label}: days on site match the records (${expected.days})`);
    check(await rows(page)===3,`${label}: the week's choices take three rows (${await rows(page)})`);
    // All four from 390px; narrower, the engineers' names wrap, so the first two.
    const onScreen=width>=390?4:2;
    check(figures.length===4&&figures.slice(0,onScreen).every(f=>f.bottom<=844),`${label}: the week's first ${onScreen} figures are on the first screen (${figures.map(f=>Math.round(f.bottom)).join(', ')})`);
    const print=page.getByRole('button',{name:'Print or save as PDF'});
    const [printBox,weekBox]=[await print.boundingBox(),await page.getByRole('button',{name:'Week',exact:true}).boundingBox()];
    check(Math.abs(printBox.y-weekBox.y)<2&&Math.abs(printBox.height-weekBox.height)<2,`${label}: print sits beside Week and Month, the same height`);
    const [printBg,panelBg]=await print.evaluate(b=>[getComputedStyle(b).backgroundColor,getComputedStyle(document.querySelector('.week-controls')).backgroundColor]);
    check(printBg===panelBg,`${label}: print is an outlined button, not the gold one (${printBg})`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth)<=width,`${label}: no sideways scroll on the week`);
    if(shots&&width===390)await page.screenshot({path:join(shots,`week-${scheme}-390.png`)});
    if(width===390)await axe(page,`${label} week`);

    // Last month.
    await page.goto(`${base}/weekly-summary?project=${P}&period=month&month=${month}`);await page.locator('.month-sheet').filter({hasText:'last month'}).waitFor();
    const api=await page.evaluate(async(a)=>(await fetch(a,{cache:'no-store'})).json(),`/api/monthly-summary?projectId=${P}&month=${month}`);
    check(await rows(page)===3,`${label}: the month's choices take three rows (${await rows(page)})`);
    const monthFigures=await figureNumbers(page);
    check(monthFigures.slice(0,2).every(f=>f.bottom<=844),`${label}: the month's first two figures are on the first screen (${monthFigures.slice(0,2).map(f=>Math.round(f.bottom)).join(', ')})`);
    const total=Object.fromEntries(monthFigures.map(f=>[f.label,f.value]));
    const blocks=await page.evaluate(()=>[...document.querySelectorAll('.month-weeks tbody tr, .month-weeks tfoot tr')].map(tr=>({
      week:tr.querySelector('th').innerText.split('\n')[0],
      cells:[...tr.querySelectorAll('td')].map(td=>{const r=td.getBoundingClientRect();return {label:(getComputedStyle(td,'::before').content.match(/^"([^"]*)"/)||[])[1],value:Number(td.innerText),left:r.left,right:r.right,width:r.width};}),
    })));
    const weekBlocks=blocks.slice(0,-1),foot=blocks.at(-1);
    check(weekBlocks.length===api.weeks.length&&weekBlocks.length>=4,`${label}: a block for each week of the month (${weekBlocks.length})`);
    for(const b of blocks){
      check(b.cells.length===6&&b.cells.every((c,i)=>c.label===COLUMNS[i]),`${label}: ${b.week} names its six figures (${b.cells.map(c=>c.label).join(', ')})`);
      check(b.cells.every(c=>c.width>0&&c.left>=0&&c.right<=width),`${label}: ${b.week} shows all six inside the screen`);
    }
    const keys=['daysOnSite','reports','issuesRaised','issuesClosed','variationsRaised','variationsInstructed'];
    weekBlocks.forEach((b,n)=>check(b.cells.every((c,i)=>c.value===api.weeks[n][keys[i]]),`${label}: ${b.week} figures match the month's records`));
    COLUMNS.forEach((c,i)=>check(weekBlocks.reduce((s,b)=>s+b.cells[i].value,0)===foot.cells[i].value,`${label}: ${c} adds up to the month`));
    check(foot.cells[0].value===total['Days on site']&&foot.cells[1].value===total['Site reports']&&foot.cells[2].value===total['Issues raised']&&foot.cells[3].value===total['Issues closed']&&foot.cells[4].value===total['Variations raised']&&foot.cells[5].value===total['Variations instructed'],`${label}: the month line matches the figures above`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth)<=width,`${label}: no sideways scroll on the month`);
    // Screen readers hear each figure once: the header row names it, the visible label is left out.
    const firstRow=await page.locator('.month-weeks tbody tr').first().ariaSnapshot();
    check(new RegExp(`cell "${weekBlocks[0].cells[0].value}"`).test(firstRow)&&!/cell "[^"]*days on site/i.test(firstRow),`${label}: a figure's cell is read as its number only (${firstRow.split('\n').slice(1,3).join(' ')})`);
    check(await page.getByRole('columnheader',{name:'Variations instructed'}).count()===1,`${label}: the header row is still there for screen readers`);
    check(await page.evaluate(()=>{const w=document.querySelector('.month-weeks-wrap');return w.scrollWidth<=w.clientWidth;}),`${label}: Week by week does not scroll sideways`);
    if(width===390)await axe(page,`${label} month`);
    if(width===390&&scheme==='light'){
      // A week's line still opens that week.
      if(shots){await page.screenshot({path:join(shots,`month-${scheme}-390.png`)});await page.locator('.month-weeks').scrollIntoViewIfNeeded();await page.screenshot({path:join(shots,`month-weeks-${scheme}-390.png`)});}
      await page.locator('.month-weeks tbody th a').nth(1).click();await page.locator('.week-sheet:not(.month-sheet)').waitFor();
      check(new URL(page.url()).searchParams.get('week')===api.weeks[1].monday,`${label}: a week's line opens that week (${page.url()})`);
    } else if(shots&&width===390){await page.locator('.month-weeks').scrollIntoViewIfNeeded();await page.screenshot({path:join(shots,`month-weeks-${scheme}-390.png`)});}
    check(!errors.length,`${label}: no page errors (${errors.join('; ')})`);
    await context.close();
  }

  // Desk and paper: still a table with its header row.
  {
    const {context,page,errors}=await open('light',1440,900);
    await page.goto(`${base}/weekly-summary?project=${P}&period=month&month=${month}`);await page.locator('.month-sheet').filter({hasText:'last month'}).waitFor();
    const desk=await page.evaluate(()=>({td:getComputedStyle(document.querySelector('.month-weeks td')).display,head:document.querySelector('.month-weeks thead').getBoundingClientRect().height}));
    check(desk.td==='table-cell'&&desk.head>20,`1440: Week by week is a table with its header row (${JSON.stringify(desk)})`);
    check(await page.getByRole('button',{name:'Print or save as PDF'}).evaluate(b=>getComputedStyle(b).backgroundColor!==getComputedStyle(document.querySelector('.week-controls')).backgroundColor),'1440: print keeps the gold button');
    check(await page.evaluate(()=>document.querySelector('.week-period').nextElementSibling?.classList.contains('week-print')),'1440: print comes straight after Week and Month in the page order');
    if(shots)await page.screenshot({path:join(shots,'month-light-1440.png')});
    await context.close();
    // A mouse in a narrow window: hovering the outlined print button keeps its text readable.
    {
      const narrow=await open('light',600,900);
      await narrow.page.goto(`${base}/weekly-summary?project=${P}&week=${week}`);await narrow.page.locator('.week-sheet').waitFor();
      const print=narrow.page.getByRole('button',{name:'Print or save as PDF'});
      // No fade, so the colours read are the hover's own, not the start of the transition.
      await narrow.page.addStyleTag({content:'*{transition:none !important;}'});await print.hover();
      const [bgRaw,fg,panel]=await print.evaluate(b=>[getComputedStyle(b).backgroundColor,getComputedStyle(b).color,getComputedStyle(document.querySelector('.week-controls')).backgroundColor]);
      // A see-through hover colour is blended over the panel behind it.
      const parts=(c)=>c.match(/\d+(\.\d+)?/g).map(Number);
      const [br,bg_,bb,ba=1]=parts(bgRaw),[pr,pg,pb]=parts(panel);
      const bg=`rgb(${[br*ba+pr*(1-ba),bg_*ba+pg*(1-ba),bb*ba+pb*(1-ba)].map(Math.round).join(', ')})`;
      const lum=(c)=>{const [r,g,b]=parts(c).slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*b;};
      const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
      check(bgRaw!==panel&&ratio(bg,fg)>=4.5,`600 with a mouse: hovering print shows and keeps its text readable (${bgRaw} over ${panel} / ${fg}, ${ratio(bg,fg).toFixed(1)}:1)`);
      await narrow.context.close();
    }
    const phone=await open('light',390);
    await phone.page.goto(`${base}/weekly-summary?project=${P}&period=month&month=${month}`);await phone.page.locator('.month-sheet').filter({hasText:'last month'}).waitFor();
    await phone.page.emulateMedia({media:'print'});
    const paper=await phone.page.evaluate(()=>({td:getComputedStyle(document.querySelector('.month-weeks td')).display,head:document.querySelector('.month-weeks thead').getBoundingClientRect().height}));
    check(paper.td==='table-cell'&&paper.head>20,`print from a phone: Week by week is still a table (${JSON.stringify(paper)})`);
    check(!errors.length&&!phone.errors.length,'desk and print: no page errors');
    await phone.context.close();
  }
  console.log(`Weekly summary on a phone check passed (${checks} checks): figures match the records, three rows of choices, figures on the first screen, every week's six figures named and on screen, desk and print unchanged.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit').catch(()=>{});database().close?.();rmSync(root,{recursive:true,force:true});
}
