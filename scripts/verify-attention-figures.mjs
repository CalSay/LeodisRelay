// Browser check for the office's Attention list on busy projects (fourteen
// months of records, scripts/seed-busy-projects.mjs). The top bar says
// "Attention" with no summed figure; its list has one group a kind, each with
// a figure worked out here from the records and the first of them under it,
// and each group's link opens the Issues or Variations filter
// with the same figure. 1440px light and dark, 390px light; axe finds
// nothing, no sideways scroll.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the open list.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-attention-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});

// The figures, worked out from the records rather than RELAY's own rules.
const rows=kind=>database().prepare('select data from records where kind=?').all(kind).map(r=>JSON.parse(r.data));
const issues=rows('issues'),variations=rows('variations');
const open=issues.filter(i=>i.work!=='closed'&&i.confirmation!=='withdrawn');
const pending=variations.filter(v=>v.instruction==='pending');
const want=[
  {title:'Overdue issues',href:'#/issues/show/overdue',chip:'Overdue',n:open.filter(i=>i.work!=='awaiting_verification'&&/^\d{4}-\d{2}-\d{2}$/.test(i.targetDate)&&i.targetDate<today).length},
  {title:'Variations done, not instructed',href:'#/variations/show/exposed',chip:'Done, not instructed',n:pending.filter(v=>v.workDone).length},
  {title:'Disputed issues',href:'#/issues/show/disputed',chip:'Disputed',n:open.filter(i=>i.confirmation==='disputed').length},
  {title:'Fixed, to check',href:'#/issues/show/verify',chip:'Fixed, to check',n:open.filter(i=>i.work==='awaiting_verification').length},
  {title:'Unassigned issues',href:'#/issues/show/unassigned',chip:'Unassigned',n:open.filter(i=>!i.owner.trim()).length},
  {title:'Variations needing a quote',href:'#/variations/show/unpriced',chip:'Needs a quote',n:pending.filter(v=>v.quotedValue===undefined||v.quotedValue===null).length},
].filter(g=>g.n>0);
const total=want.reduce((n,g)=>n+g.n,0);
assert.ok(want.length>=4&&total>1000,`the busy seed has a long list: ${JSON.stringify(want.map(g=>[g.title,g.n]))}`);

const port=4363,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-attention-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['light',1440,900],['dark',1440,900],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects`);
    await page.locator('.act').first().waitFor({timeout:30000});
    const bell=page.locator('.ws .bell');
    const seen=await bell.evaluate(b=>[...b.childNodes].filter(n=>!(n.classList?.contains('sr'))).map(n=>n.textContent).join('').trim());
    check(seen==='Attention',`${label}: the top bar says Attention with no summed figure: "${seen}"`);
    check(await bell.getAttribute('class').then(c=>!c.includes('quiet'))&&await page.getByRole('button',{name:/^Attention\s*,\s*something is waiting$/}).count()===1,`${label}: it says something is waiting, in words for a screen reader`);
    await bell.click();
    const pop=page.locator('.attn-pop');await pop.locator('.attn-group').first().waitFor();
    const groups=await pop.locator('.attn-group').evaluateAll(gs=>gs.map(g=>({title:g.querySelector('.attn-gh span')?.textContent,n:Number(g.querySelector('.attn-gh b')?.textContent),href:g.querySelector('.attn-gh a')?.getAttribute('href'),rows:g.querySelectorAll('.mini').length})));
    check(JSON.stringify(groups.map(g=>g.title))===JSON.stringify(want.map(g=>g.title)),`${label}: one group a kind, in order: ${JSON.stringify(groups.map(g=>g.title))}`);
    for(const g of want){
      const got=groups.find(x=>x.title===g.title);
      check(got&&got.n===g.n,`${label}: ${g.title} says ${got?.n}, the records give ${g.n}`);
      check(got.href===g.href&&await pop.getByRole('link',{name:new RegExp(`^${g.title}\\s*${g.n}`)}).count()===1,`${label}: ${g.title} opens ${g.href}`);
      check(got.rows===1,`${label}: ${g.title} lists its first one (${got.rows})`);
    }
    check(await pop.locator('.mini').count()===want.length,`${label}: the list is short, not ${total} rows`);
    if(shot)await page.screenshot({path:join(shot,`attention-${scheme}-${width}.png`)});
    check(await overflow(page)<=0,`${label}: no sideways scroll with the list open`);
    await axe(page,`${label} Attention open`);
    // Each group opens the filter that counts the same records.
    const links=phone?want.slice(0,2):want;
    for(const g of links){
      if(!(await pop.isVisible()))await bell.click();
      await pop.locator('.attn-group',{has:page.locator(`.attn-gh a[href="${g.href}"]`)}).locator('.attn-gh a').click();
      await page.waitForURL(u=>u.hash===g.href.slice(1)||u.href.endsWith(g.href));
      const want=`${g.chip} · ${g.n}`;
      const ok=await page.waitForFunction(t=>[...document.querySelectorAll('button.chip[aria-pressed="true"]:not(.sort-chip)')].some(b=>b.textContent===t),want,{timeout:20000}).then(()=>true,()=>false);
      check(ok,`${label}: ${g.title} opens "${want}": ${await page.locator('button.chip[aria-pressed="true"]:not(.sort-chip)').allInnerTexts()}`);
    }
    if(!phone){
      // Opened again from the list it opened, after picking another filter there: the list starts again on its own filter.
      const g=want[0];await page.goto(`${base}/office${g.href}`);
      const chip=page.locator('button.chip[aria-pressed="true"]:not(.sort-chip)').first();
      await page.waitForFunction(t=>[...document.querySelectorAll('button.chip[aria-pressed="true"]')].some(b=>b.textContent===t),`${g.chip} · ${g.n}`,{timeout:20000});
      await page.locator('button.chip',{hasText:/^Open · /}).click();await page.waitForFunction(()=>/^Open · /.test(document.querySelector('button.chip[aria-pressed="true"]')?.textContent??''));
      await bell.click();await pop.locator(`.attn-gh a[href="${g.href}"]`).click();
      const back=await page.waitForFunction(t=>[...document.querySelectorAll('button.chip[aria-pressed="true"]')].some(b=>b.textContent===t),`${g.chip} · ${g.n}`,{timeout:20000}).then(()=>true,()=>false);
      check(back&&!(await pop.isVisible()),`${label}: ${g.title} opened again from its own list goes back to "${g.chip} · ${g.n}" and closes the list: ${await chip.innerText()}`);
    }
    await context.close();
  }
  check(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-attention-figures: ${checks} checks passed (records: ${want.map(g=>`${g.n} ${g.title.toLowerCase()}`).join(', ')})`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
