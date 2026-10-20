// Browser check for the engineer navigation (UI direction item 3): every entry
// has an icon and a readable label, the phone bottom bar fits at 320px with
// 48px targets, the current view is marked, and the bar never hides content.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves a screenshot per width and theme.
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
const root=mkdtempSync(join(tmpdir(),'relay-nav-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const principal={id:'entra:nav-engineer',oid:'nav-engineer',name:'Nav Engineer',email:'nav@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-nav-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const labels=['Site','Issues','Reports','Projects','Search'];
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const scheme of ['light','dark']) for(const width of [320,390,1440]){
    const at=`${scheme} ${width}px`,phone=width<=600;
    const context=await browser.newContext({viewport:{width,height:700},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const nav=page.getByRole('navigation',{name:'Site companion navigation'});
    await page.locator('.eng-heading').waitFor();
    if(screenshot)await page.screenshot({path:join(screenshot,`nav-${scheme}-${width}.png`)});
    const items=await nav.locator(':scope > a, :scope > button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),label=el.querySelector('.eng-nav-label'),svg=el.querySelector('svg');return {text:el.textContent.trim(),width:r.width,height:r.height,top:r.top,icon:!!svg&&svg.getBoundingClientRect().width>=16&&svg.getAttribute('aria-hidden')==='true',clipped:label?label.scrollWidth>label.clientWidth+1:true,current:el.getAttribute('aria-current'),color:getComputedStyle(el).color};}));
    check(JSON.stringify(items.map(i=>i.text))===JSON.stringify(labels),`${at}: entries in order with plain labels (${items.map(i=>i.text)})`);
    check(items.every(i=>i.icon),`${at}: every entry has a decorative icon`);
    check(items.every(i=>!i.clipped),`${at}: no label is cut off`);
    check(items.every(i=>i.height>=48&&i.width>=48),`${at}: every target is at least 48px (${items.map(i=>`${Math.round(i.width)}x${Math.round(i.height)}`)})`);
    check(items[0].current==='page'&&items.filter(i=>i.current).length===1,`${at}: Site is marked as the current view`);
    check(items[0].color!==items[1].color,`${at}: the current entry looks different from the others`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${at}: no sideways scrolling`);
    if(phone){
      const bar=await nav.boundingBox();
      check(Math.abs(bar.y+bar.height-700)<=1&&bar.width===width,`${at}: bar fixed across the bottom (${JSON.stringify(bar)})`);
      check(items.every(i=>Math.abs(i.top-items[0].top)<1),`${at}: entries sit on one row`);
      await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      const last=await page.evaluate(()=>{const kids=[...document.querySelectorAll('.eng-workspace > :not(nav)')].filter(el=>el.getBoundingClientRect().height>0);return kids.at(-1).getBoundingClientRect().bottom;});
      check(last<=bar.y,`${at}: last content (${Math.round(last)}) ends above the bar (${Math.round(bar.y)})`);
    }
    await nav.getByRole('button',{name:'Issues'}).click();
    await page.locator('.eng-project-context').waitFor();
    check(await nav.getByRole('button',{name:'Issues'}).getAttribute('aria-current')==='page'&&await nav.getByRole('button',{name:'Site'}).getAttribute('aria-current')===null,`${at}: tapping Issues moves the mark`);
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  console.log(`Engineer navigation check passed (${checks} checks): icons, labels, 48px targets, current view, bottom bar at 320 and 390px, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
