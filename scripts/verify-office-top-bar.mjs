// Browser check: no office page scrolls sideways from 768 to 1440px wide, and
// every top bar item stays on screen, labelled in plain words and pressable.
// The desk was held at 1180px, so on a small laptop or a tablet on its side
// the whole page scrolled sideways (checking fixes walk, 21 Oct 2026). Busy
// example data (scripts/seed-busy-projects.mjs, 60 days) and an Admin with a
// long name, so the top bar has its most to show and the registers their
// longest rows. At 768, 1024, 1280 and 1440px:
// - the page, the desk's columns, views and panels have nothing off to the
//   right, on every office tab, with a report or an issue open, and on the
//   office pages linked from the desk;
// - Attention, the name, the theme, Help, Engineer view, Switch company and
//   the search box are each inside the window, not covered, not on top of each
//   other, with words a person can read;
// - Help and Attention open, and Attention's list sits inside the window;
// - with a project open, "‹ Projects" is there whenever the Projects column is
//   not, and the register heading shows the project's whole name;
// - a register row's Verify button is inside its panel.
// Light and dark at every width for the overview, a project and the Issues
// tab; the theme does not change the layout, so the rest run in light.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the light and dark pages.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-office-top-bar-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
seedBusyProjects({storagePath,today:londonDay(new Date()),days:60});
const admin={id:'entra:top-bar-admin',oid:'top-bar-admin',name:'Joanna Fitzgerald-Okonkwo',email:'joanna@example.test',role:'Admin'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:admin,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const port=4372,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-office-top-bar-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const P='proj-011lme';
// RELAY_WIDTHS=800,1180 checks other widths.
const WIDTHS=(process.env.RELAY_WIDTHS||'768,1024,1280,1440').split(',').map(Number);

// Desk pages: [name, path, click to open something first, shown in dark too].
const DESK=[
  ['overview','/office',null,true],
  ['project',`/office#/projects/${P}`,null,true],
  ['project-issue',`/office#/projects/${P}`,'.ws .col a.arow[href*="/issue/"]',false],
  ['inbox','/office#/inbox',null,false],
  ['inbox-reader','/office#/inbox','.ws table.inbox-list tbody tr.clickable',false],
  ['issues','/office#/issues',null,true],
  ['fixes-to-check','/office#/issues/show/verify',null,false],
  ['variations','/office#/variations',null,false],
  ['team','/office#/team',null,false],
  ['admin','/office#/admin',null,false],
];
// Office pages reached from the desk.
const LINKED=['/coverage','/companies','/issue-trend',`/weekly-summary?project=${P}`,`/diary?project=${P}`,`/photos?project=${P}`,'/search?q=riser','/help'];

// Runs in the page: anything off to the right of the window or of the box it scrolls in.
const sideways=()=>{
  const out=[];const W=innerWidth;
  if(document.documentElement.scrollWidth>W+1)out.push(`page ${document.documentElement.scrollWidth}px in a ${W}px window`);
  for(const el of document.querySelectorAll('.ws .cols,.ws .col,.ws .view,.ws .panel,.ws .topbar,.ws .hnav'))
    if(el.scrollWidth>el.clientWidth+1&&getComputedStyle(el).display!=='none')out.push(`${el.className.split(' ').slice(0,2).join('.')} ${el.scrollWidth}px in ${el.clientWidth}px`);
  return out;
};
// Runs in the page: each top bar item, where it is, what it says, and whether it is the thing under its centre.
const topBar=()=>{
  const bar=document.querySelector('.ws .topbar');
  const pick=[['search','.search input'],['Attention','.bell'],['name','.whoami'],['theme','.themebtn'],['Help','.tbtn-help'],['Engineer view','a.tbtn[href="/engineer"]'],['Switch company','a.tbtn[href="/"]'],['logo','.logo']];
  return pick.map(([name,sel])=>{
    const el=bar.querySelector(sel);if(!el)return {name,missing:true};
    const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    const words=(el.tagName==='INPUT'?el.placeholder:el.innerText).replace(/\s+/g,' ').trim();
    return {name,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,visible:cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0,
      onTop:!!hit&&(hit===el||el.contains(hit)),words,label:el.getAttribute('aria-label')??'',cut:el.scrollWidth>el.clientWidth+1};
  });
};

let browser,checks=0;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const width of WIDTHS)for(const colorScheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(`${width} ${colorScheme}: ${e.message}`));
    const ready=async()=>{await page.locator('.ws .hnav').waitFor();await page.waitForFunction(()=>!document.querySelector('.ws .loading'));await page.waitForLoadState('networkidle');};
    for(const [name,path,click,dark] of DESK){
      if(colorScheme==='dark'&&!dark)continue;
      const label=`${name} at ${width}px ${colorScheme}`;
      await page.goto(base+path);await ready();
      if(click){await page.locator(click).first().click();await page.waitForLoadState('networkidle');await page.waitForTimeout(300);}
      if(name==='issues')await page.locator('.ws table.reg tbody tr').first().waitFor();
      if(shot)await page.screenshot({path:join(shot,`office-top-bar-${name}-${colorScheme}-${width}.png`)});
      assert.deepEqual(await page.evaluate(sideways),[],`${label}: nothing scrolls sideways`);checks++;
      const items=await page.evaluate(topBar);
      for(const i of items){
        assert.ok(!i.missing,`${label}: the top bar has ${i.name}`);
        assert.ok(i.visible&&i.left>=0&&i.right<=width,`${label}: ${i.name} is inside the window (${Math.round(i.left)}-${Math.round(i.right)}px)`);
        assert.ok(i.onTop,`${label}: ${i.name} is not covered`);
        if(i.name!=='logo'&&i.name!=='search')assert.ok(i.height>=24&&i.width>=24,`${label}: ${i.name} is at least 24px to press (WCAG 2.2) (${Math.round(i.height)}px)`);
        checks+=3;
      }
      const words=Object.fromEntries(items.map(i=>[i.name,i.words]));
      assert.match(words.Attention,/^Attention \d+$/,`${label}: Attention says what it is`);
      assert.match(words.name,/^Joanna Fitzgerald/,`${label}: the name starts with who is signed in`);
      assert.match(words.theme,/^(Auto|Light|Dark)$/,`${label}: the theme button says its setting`);
      assert.match(words.Help,/^Help/,`${label}: Help says Help`);
      assert.equal(words['Engineer view'],'Engineer view',`${label}: Engineer view is in words`);
      assert.equal(words['Switch company'],'Switch company',`${label}: Switch company is in words`);
      assert.match(words.search,/^Search projects/,`${label}: the search box says what it searches`);
      checks+=7;
      for(const i of items.filter(i=>['Attention','theme','Help','Engineer view','Switch company'].includes(i.name)))assert.ok(!i.cut,`${label}: ${i.name} is not cut short`);checks++;
      const pressable=items.filter(i=>i.name!=='logo');
      for(const [n,a] of pressable.entries())for(const b of pressable.slice(n+1))
        assert.ok(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,`${label}: ${a.name} and ${b.name} do not overlap`);
      checks++;
      if(name==='project'||name==='project-issue'){
        const m=await page.evaluate(()=>{const cols=[...document.querySelectorAll('.ws .cols > .col')];const shown=c=>getComputedStyle(c).display!=='none';
          const back=cols[1].querySelector('.col-back'),h=cols[1].querySelector('.col-head h2');
          return {projectsShown:shown(cols[0]),backShown:!!back&&shown(back)&&back.getBoundingClientRect().width>0,backHref:back?.getAttribute('href'),head:h.textContent,headCut:h.scrollWidth>h.clientWidth+1};});
        assert.ok(m.projectsShown||m.backShown,`${label}: the Projects column or "‹ Projects" is there`);
        assert.ok(!(m.projectsShown&&m.backShown),`${label}: "‹ Projects" is not shown beside the Projects column`);
        if(m.backShown)assert.equal(m.backHref,'#/projects',`${label}: "‹ Projects" goes to the project list`);
        assert.match(m.head,/Tetley Hall - Block E/,`${label}: the register heading names the project`);
        assert.ok(!m.headCut,`${label}: the register heading shows the whole name`);
        checks+=4;
      }
      if(name==='fixes-to-check'){
        const verify=page.locator('.ws table.reg tbody tr').first().getByRole('button',{name:/^Verify/});
        await verify.waitFor();
        const ok=await verify.evaluate(b=>{const r=b.getBoundingClientRect(),p=b.closest('.panel').getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.right<=innerWidth;});
        assert.ok(ok,`${label}: the first row's Verify button is inside its panel`);checks++;
      }
      if(name==='overview'&&colorScheme==='light'){
        await page.locator('.ws .tbtn-help').click();
        await page.locator('dialog[open], [role="dialog"]').first().waitFor();
        await page.keyboard.press('Escape');checks++;
        await page.locator('.ws .bell').click();
        const pop=await page.locator('.ws .attn-pop').evaluate(p=>{const r=p.getBoundingClientRect(),bar=document.querySelector('.ws .topbar').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,barBottom:bar.bottom};});
        assert.ok(pop.left>=0&&pop.right<=width,`${label}: the Attention list is inside the window`);
        assert.ok(pop.top>=pop.barBottom-2,`${label}: the Attention list opens under the top bar, not over it`);
        if(shot)await page.screenshot({path:join(shot,`office-top-bar-attention-light-${width}.png`)});
        await page.locator('.ws .bell').click();checks+=2;
      }
    }
    if(colorScheme==='light')for(const path of LINKED){
      await page.goto(base+path);await page.waitForLoadState('networkidle');await page.waitForTimeout(200);
      const off=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1?document.documentElement.scrollWidth:0);
      assert.equal(off,0,`${path} at ${width}px does not scroll sideways`);checks++;
    }
    await context.close();
  }
  assert.deepEqual(errors,[],'no page errors');checks++;
  console.log(`verify-office-top-bar: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');rmSync(root,{recursive:true,force:true});
}
