// Browser check: the office desk's sections read as separate pieces (Cal,
// 2026-10-21: the top bar, the tabs and the Projects column "all blend into
// one"). With a project open, at 1440 and 1180px in light and dark: the top
// bar, the tab row and the column headers each sit on a different surface,
// with an edge between them that can be seen (3:1 against both sides); the
// columns have a visible edge between them; each project in the Projects
// column is its own card with a gap and a visible border; and the open project
// is marked by more than a tint. At 390px the phone register still shows
// without sideways scrolling.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves each page. RELAY_REPORT_ONLY=1 prints the
// measurements without failing (for before screenshots on an older build).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-office-sections-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const admin={id:'entra:sections-admin',oid:'sections-admin',name:'Office Admin',email:'admin@example.test',role:'Admin'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:admin,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
const port=4371,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-office-sections-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
let browser,checks=0;
const failed=[];
const check=(ok,message)=>{if(process.env.RELAY_REPORT_ONLY){if(!ok)failed.push(message);}else assert.ok(ok,message);};

// Runs in the page: WCAG contrast between two computed colours (alpha laid over the second).
const measure=()=>{
  const rgb=s=>{const m=s.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m[3]??1};};
  const over=(c,bg)=>({r:c.r*c.a+bg.r*(1-c.a),g:c.g*c.a+bg.g*(1-c.a),b:c.b*c.a+bg.b*(1-c.a),a:1});
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  // The colour an element shows: its own background over whatever is behind it.
  const bgOf=el=>{const stack=[];for(let e=el;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c.a>0)stack.push(c);if(c.a===1)break;}
    return stack.reduceRight((acc,c)=>over(c,acc),{r:255,g:255,b:255,a:1});};
  const edge=(el,side,behind)=>{const cs=getComputedStyle(el),w=parseFloat(cs[`border${side}Width`]);if(!w)return 0;return ratio(over(rgb(cs[`border${side}Color`]),behind),behind);};
  const q=s=>document.querySelector(s);
  const top=q('.ws .topbar'),nav=q('.ws .hnav'),cols=[...document.querySelectorAll('.ws .cols > .col')];
  const heads=cols.map(c=>c.querySelector(':scope > .col-head'));
  const bTop=bgOf(top),bNav=bgOf(nav),bHead=bgOf(heads[0]);
  const items=[...cols[0].querySelectorAll('.item')],firstGroup=[...items[0].parentElement.querySelectorAll(':scope > .item')];
  const listBg=bgOf(items[0].parentElement);
  const rects=firstGroup.map(i=>i.getBoundingClientRect());
  const on=cols[0].querySelector('.item.on'),onCs=on&&getComputedStyle(on),offCs=getComputedStyle(cols[0].querySelector('.item:not(.on)'));
  return {
    topVsNav:ratio(bTop,bNav),
    topEdge:Math.min(edge(top,'Bottom',bTop),edge(top,'Bottom',bNav)),
    navEdge:Math.min(edge(nav,'Bottom',bNav),edge(nav,'Bottom',bHead)),
    navVsHead:ratio(bNav,bHead),
    colEdges:cols.slice(0,-1).map(c=>Math.min(edge(c,'Right',bgOf(c)),edge(c,'Right',bgOf(c.nextElementSibling)))),
    headEdges:heads.map(h=>Math.min(edge(h,'Bottom',bgOf(h)),edge(h,'Bottom',bgOf(h.nextElementSibling??h.parentElement)))),
    gaps:rects.slice(1).map((r,i)=>Math.round(r.top-rects[i].bottom)),
    cardEdge:Math.min(...items.slice(0,4).map(i=>Math.min(edge(i,'Top',listBg),edge(i,'Bottom',listBg),edge(i,'Right',listBg)))),
    onEdge:on?Math.min(edge(on,'Top',listBg),edge(on,'Right',listBg)):0,
    cardVsList:ratio(bgOf(cols[0].querySelector('.item:not(.on)')),listBg),
    onDiffers:!!on&&onCs.borderTopColor!==offCs.borderTopColor&&(onCs.backgroundColor+onCs.backgroundImage)!==(offCs.backgroundColor+offCs.backgroundImage),
    sideways:document.documentElement.scrollWidth>innerWidth+1,
  };
};

try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [width,height] of [[1440,900],[1180,800],[390,844]])for(const colorScheme of ['light','dark']){
    const label=`${colorScheme} ${width}px`;
    const context=await browser.newContext({viewport:{width,height},colorScheme,...(width===390?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects/proj-011lme`);
    if(width===390){
      await page.locator('.ws .col .col-head h2',{hasText:/^Register/}).first().waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label}: the phone register does not scroll sideways`);checks++;
      if(shot)await page.screenshot({path:join(shot,`office-sections-${colorScheme}-${width}.png`)});
      await context.close();continue;
    }
    await page.locator('.sheet-title h3',{hasText:'Tetley Hall - Block E'}).waitFor();
    await page.locator('.ws .cols > .col').first().locator('.item.on').waitFor();
    if(shot)await page.screenshot({path:join(shot,`office-sections-${colorScheme}-${width}.png`)});
    const m=await page.evaluate(measure);
    const fmt=n=>Number(n.toFixed(2));
    check(m.topVsNav>=1.15,`${label}: the top bar and the tab row sit on different surfaces (${fmt(m.topVsNav)}:1)`);checks++;
    check(m.topEdge>=3,`${label}: the line under the top bar can be seen (${fmt(m.topEdge)}:1)`);checks++;
    check(m.navEdge>=3,`${label}: the line under the tabs can be seen (${fmt(m.navEdge)}:1)`);checks++;
    check(m.navVsHead>=1.15,`${label}: the tab row and the column headers sit on different surfaces (${fmt(m.navVsHead)}:1)`);checks++;
    for(const [i,e] of m.colEdges.entries()){check(e>=3,`${label}: column ${i+1} has a visible edge (${fmt(e)}:1)`);checks++;}
    for(const [i,e] of m.headEdges.entries()){check(e>=3,`${label}: column ${i+1}'s header has a visible edge (${fmt(e)}:1)`);checks++;}
    check(m.gaps.every(g=>g>=6),`${label}: project cards have a gap between them (${m.gaps.join(', ')}px)`);checks++;
    check(m.cardEdge>=1.3,`${label}: each project card has a border (${fmt(m.cardEdge)}:1)`);checks++;
    check(m.cardVsList>=1.15,`${label}: project cards stand out from the column behind them (${fmt(m.cardVsList)}:1)`);checks++;
    check(m.onEdge>=3,`${label}: the open project has a strong outline (${fmt(m.onEdge)}:1)`);checks++;
    check(m.onDiffers,`${label}: the open project differs in outline and fill`);checks++;
    assert.equal(m.sideways,false,`${label}: the desk does not scroll sideways`);checks++;
    await context.close();
  }
  assert.deepEqual(errors,[],'no page errors');checks++;
  if(failed.length)console.log(`verify-office-sections (report only): ${failed.length} of ${checks} checks would fail\n- ${failed.join('\n- ')}`);
  else console.log(`verify-office-sections: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');rmSync(root,{recursive:true,force:true});
}
