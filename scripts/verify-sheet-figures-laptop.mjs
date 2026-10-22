// Browser check: a project's four figures read cleanly on a small laptop.
// At 1024 and 1280px the office project sheet is about 550px wide, so its four
// figures sat in four 135px cells: labels such as "Overdue actions" broke onto
// two lines, the arrow crowded the number and each line under a figure wrapped
// to four or five lines (office laptop walk, 22 Oct 2026). Busy example data
// (scripts/seed-busy-projects.mjs, 60 days) and the office manager on Tetley
// Hall - Block E:
// - when the inside of the sheet is narrower than 680px (screens up to about
//   1400px, or 1440px with scrollbars showing as on Windows) the figures and
//   the project's details are two by two; on a wider sheet they stay four in a row;
// - every figure's label is on one line, its number is on one line, the line
//   under it takes no more than three lines, and the arrow stays clear of the text;
// - every cell has a visible edge: a line between cells across and down, and
//   none doubled at the outside;
// - something fixed inside the sheet still sits on the screen;
// - on a phone the figures above the register are still two by two;
// - nothing scrolls sideways.
// Light and dark at 1024 and 1280; the theme does not change the layout, so
// the other widths run in light. 1280, 1366, 1440 and 1920 also run with
// scrollbars showing.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the sheet. RELAY_REPORT_ONLY=1 prints the
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
const root=mkdtempSync(join(tmpdir(),'relay-sheet-figures-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
seedBusyProjects({storagePath,today:londonDay(new Date()),days:60});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4376,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-sheet-figures-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const reportOnly=!!process.env.RELAY_REPORT_ONLY;const failed=[];let checks=0;
const check=(ok,message)=>{checks++;if(reportOnly){if(!ok)failed.push(message);}else assert.ok(ok,message);};
const RUNS=[[390,['light']],[800,['light']],[1024,['light','dark']],[1100,['light']],[1180,['light']],[1279,['light']],[1280,['light','dark']],[1365,['light']],[1366,['light']],[1400,['light']],[1440,['light']],[1920,['light']]];
// Headless Chromium hides scrollbars; Windows browsers show them, which takes about 30px from the sheet.
const SCROLLBARS=[1280,1366,1440,1920];

// Runs in the page: how each figure block's cells sit and how many lines their words take.
const measure=phone=>{
  const r=e=>e.getBoundingClientRect();
  const sheet=document.querySelector(phone?'.ws .register-standing':'.ws .col-main .sheet');
  const lines=e=>{const cs=getComputedStyle(e);const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;return Math.round(r(e).height/lh);};
  const blocks=[...sheet.querySelectorAll('dl.tb')].map(dl=>{
    const cells=[...dl.children];
    const cols=new Set(cells.map(c=>Math.round(r(c).left))).size;
    const words=cells.map(c=>{const dt=c.querySelector('dt'),dd=c.querySelector('dd'),small=dd.querySelector('small'),arrow=dd.querySelector('.arrow');
      // The figure itself: the text before the small line, as one range.
      const range=document.createRange();const first=(dd.querySelector('.tb-go')??dd).firstChild;if(first)range.selectNodeContents(first);
      const big=dd.classList.contains('big')&&first?.nodeType===3?range.getClientRects().length:1;
      const textRight=Math.max(...[...(small?[small]:[])].map(s=>{const g=document.createRange();g.selectNodeContents(s);return Math.max(...[...g.getClientRects()].map(x=>x.right));}),first?.nodeType===3?r(range).right:0);
      const cs=getComputedStyle(c);
      return {label:dt.textContent,labelLines:lines(dt),bigLines:big,smallLines:small?lines(small):0,arrowClear:!arrow||r(arrow).left>=textRight-0.5,
        right:parseFloat(cs.borderRightWidth),bottom:parseFloat(cs.borderBottomWidth),left:r(c).left,top:r(c).top,cellRight:r(c).right,cellBottom:r(c).bottom};});
    const box=r(dl);
    // A cell needs a line on its right unless it ends the row, and below unless it is on the last row.
    const edges=words.every(w=>(w.cellRight>=box.right-2?w.right===0:w.right>0)&&(w.cellBottom>=box.bottom-2?w.bottom===0:w.bottom>0));
    return {cols,width:Math.round(box.width),words,edges};
  });
  const cs=getComputedStyle(sheet);
  return {sheetWidth:Math.round(r(sheet).width),inside:Math.round(sheet.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)),blocks,sideways:document.documentElement.scrollWidth>innerWidth+1||[...document.querySelectorAll('.ws .col,.ws .sheet')].some(e=>getComputedStyle(e).overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)};
};

let browser;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  const withBars=await chromium.launch({headless:true,ignoreDefaultArgs:['--hide-scrollbars'],...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const runs=[...RUNS.flatMap(([width,schemes])=>schemes.map(colorScheme=>[width,colorScheme,false])),...SCROLLBARS.map(width=>[width,'light',true])];
  for(const [width,colorScheme,bars] of runs){
    const phone=width<=700,label=`project at ${width}px ${colorScheme}${bars?' with scrollbars':''}`;
    const context=await (bars?withBars:browser).newContext({viewport:{width,height:phone?844:800},colorScheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(`${width} ${colorScheme}: ${e.message}`));
    await page.goto(`${base}/office#/projects/proj-011lme`);
    await page.locator(phone?'.ws .register-standing dl.tb':'.ws .col-main .sheet dl.tb').first().waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(300);
    if(shot){if(phone)await page.locator('.ws .register-standing').first().scrollIntoViewIfNeeded();await page.screenshot({path:join(shot,`sheet-figures-${colorScheme}-${width}${bars?'-scrollbars':''}.png`)});}
    const m=await page.evaluate(measure,phone);
    console.log(label,JSON.stringify({sheet:m.sheetWidth,inside:m.inside,blocks:m.blocks.map(b=>({cols:b.cols,width:b.width,labels:b.words.map(w=>w.labelLines).join(''),big:b.words.map(w=>w.bigLines).join(''),small:b.words.map(w=>w.smallLines).join(''),edges:b.edges}))}));
    check(!m.sideways,`${label}: nothing scrolls sideways`);
    // The sheet measures its own width for the figures; something fixed inside it (a menu, a toast) still sits on the screen, not on the sheet.
    if(!phone)check(await page.evaluate(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;left:0;top:0;width:10px;height:10px';document.querySelector('.ws .col-main .sheet').append(d);const b=d.getBoundingClientRect();d.remove();return b.left===0&&b.top===0;}),`${label}: something fixed inside the sheet sits on the screen`);
    // A phone shows the figures alone above the register; the details are on the sheet.
    const [figures,details]=m.blocks;
    check(!!figures&&figures.words.length===4,`${label}: the four figures are there`);
    const narrow=phone||m.inside<680;
    for(const [name,b] of [['figures',figures],['details',details]]){
      if(!b)continue;
      check(b.cols===(narrow?2:4),`${label}: the ${name} are ${narrow?'two by two':'four in a row'} (${b.cols} across, inside of the sheet ${m.inside}px)`);
      check(b.edges,`${label}: every ${name} cell has a line between it and the next, none at the outside`);
      for(const w of b.words){
        check(w.labelLines===1,`${label}: "${w.label}" is on one line (${w.labelLines})`);
        check(w.smallLines<=3,`${label}: the line under "${w.label}" takes three lines or fewer (${w.smallLines})`);
        if(name==='figures'){check(w.bigLines===1,`${label}: the ${w.label} figure is on one line (${w.bigLines})`);check(w.arrowClear,`${label}: the ${w.label} arrow is clear of the words`);}
      }
    }
    await context.close();
  }
  await withBars.close();
  check(errors.length===0,`no page errors (${errors.join('; ')})`);
  if(reportOnly)console.log(failed.length?`would fail:\n- ${failed.join('\n- ')}`:'nothing would fail');
  else console.log(`verify-sheet-figures-laptop: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');rmSync(root,{recursive:true,force:true});
}
