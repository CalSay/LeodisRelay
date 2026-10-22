// Browser check for "Not seen yet" on busy projects: fourteen months of
// reports (scripts/seed-busy-projects.mjs), most of them never opened. The
// office overview, each project's "Needs action" and the Inbox filter count
// only the last two weeks' unopened reports, with any a sent correction
// replaces left out, and the figures match the records worked out here. The
// Inbox says how many older reports were never opened and "List them too"
// shows them after the newer ones. Opening a report takes one off; nothing
// else is marked seen. 1440px light and dark, 390px light; axe finds nothing,
// no sideways scroll.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the overview group and the Inbox.
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
const root=mkdtempSync(join(tmpdir(),'relay-not-seen-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});

// What the figures should be, worked out from the records rather than RELAY's own rule.
const day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(iso));
const from=(()=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-13);return d.toISOString().slice(0,10);})();
const expected=()=>{
  const sent=database().prepare("select data from records where kind='reports'").all().map(r=>JSON.parse(r.data)).filter(r=>r.state==='submitted');
  const replaced=new Set(sent.map(r=>r.corrects).filter(Boolean));
  const unseen=sent.filter(r=>!r.acknowledged);
  const counted=unseen.filter(r=>!replaced.has(r.id));
  const recent=counted.filter(r=>day(r.serverAcknowledgedAt)>=from),older=counted.filter(r=>day(r.serverAcknowledgedAt)<from);
  const byProject=p=>recent.filter(r=>r.projectId===p).length;
  return {all:unseen.length,replaced:unseen.filter(r=>replaced.has(r.id)),recent,older,byProject};
};
const before=expected();
assert.ok(before.all>1000&&before.older.length>before.recent.length*10&&before.recent.length>10&&before.replaced.length>0,`the busy seed has a long pile: ${before.all} unopened, ${before.recent.length} recent, ${before.older.length} older, ${before.replaced.length} replaced`);

const port=4361,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-not-seen-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
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
    const label=`${scheme} ${width}px`,phone=width<700,want=expected();
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects`);
    const group=page.locator('.act[data-group="notAck"]');await group.waitFor({timeout:30000});
    check(await group.locator('.act-n').innerText()===String(want.recent.length),`${label}: the overview counts the last two weeks only: ${await group.locator('.act-n').innerText()}, records say ${want.recent.length} (of ${want.all} never opened)`);
    check((await group.locator('.act-sub').innerText()).includes('last two weeks'),`${label}: the group says what it counts`);
    if(phone)check(await page.locator('.act-strip button[data-group="notAck"] b').innerText()===String(want.recent.length),`${label}: the phone's count at the top matches`);
    const listed=await group.locator('.rmenu a.rt span').allInnerTexts();
    check(listed.length===Math.min(4,want.recent.length),`${label}: the newest few are listed`);
    for(const p of ['proj-011lme','proj-014lme','proj-009lcp']){
      const code=p.slice(5).toUpperCase(),n=want.byProject(p);
      const needs=await page.locator('.glance-row').filter({hasText:code}).locator('.glance-cells > div').filter({hasText:'Needs action'}).locator('dd').innerText();
      check(n?needs.includes(`${n} report${n===1?'':'s'} not seen yet`):!needs.includes('not seen yet'),`${label}: ${code} Needs action counts its last two weeks (${n}): ${needs.replace(/\s+/g,' ')}`);
    }
    if(shot)await group.screenshot({path:join(shot,`overview-group-${scheme}-${width}.png`)});
    check(await overflow(page)<=0,`${label}: no sideways scroll on the overview`);
    await axe(page,`${label} overview`);

    await group.locator('a.act-all').click();
    await page.waitForURL(/#\/inbox\/show\/notAck/);
    const rows=page.locator('.inbox-list tbody tr.clickable');await rows.first().waitFor();
    check(await page.locator('.filters .chip.on').innerText()===`Not seen yet · ${want.recent.length}`,`${label}: the Inbox filter says the same: ${await page.locator('.filters .chip.on').innerText()}`);
    check((await page.locator('.pagehead p').innerText()).includes(`${want.recent.length} not seen yet`),`${label}: and so does the Inbox heading`);
    check(await rows.count()===want.recent.length,`${label}: the list is the last two weeks only, without originals a correction replaced (${await rows.count()} rows)`);
    const older=page.locator('.not-seen-older');
    check((await older.innerText()).startsWith(`${want.older.length} reports received more than two weeks ago were never opened and are not counted.`),`${label}: the older pile is named, not counted: ${await older.innerText()}`);
    if(shot){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(shot,`inbox-not-seen-${scheme}-${width}.png`)});await older.scrollIntoViewIfNeeded();await page.screenshot({path:join(shot,`inbox-older-line-${scheme}-${width}.png`)});}
    check(await overflow(page)<=0,`${label}: no sideways scroll on the Inbox`);
    await axe(page,`${label} Inbox`);
    // The older ones on request, after the newer ones; the figure stays the last two weeks.
    await older.getByRole('button',{name:'List them too'}).click();
    await page.waitForFunction(n=>document.querySelectorAll('.inbox-list tbody tr.clickable').length===n,want.recent.length+want.older.length);
    check(await page.locator('.filters .chip.on').innerText()===`Not seen yet · ${want.recent.length}`,`${label}: listing the older ones does not change the figure`);
    check((await older.innerText()).includes('listed after the newer ones'),`${label}: the line says where they are`);
    const lastRef=(await rows.last().locator('.c-ref .ref').innerText()),oldest=[...want.older].sort((a,b)=>a.serverAcknowledgedAt.localeCompare(b.serverAcknowledgedAt))[0];
    check(lastRef===oldest.reference,`${label}: the oldest is last: ${lastRef}`);
    await older.getByRole('button',{name:'Hide them'}).click();
    await page.waitForFunction(n=>document.querySelectorAll('.inbox-list tbody tr.clickable').length===n,want.recent.length);
    checks++;
    // Opening one takes it off, and only it.
    if(!phone){
      await rows.first().click();
      await page.waitForFunction(n=>document.querySelector('.filters .chip.on')?.textContent===`Not seen yet · ${n}`,want.recent.length-1,{timeout:15000});
      const after=expected();
      check(after.recent.length===want.recent.length-1&&after.older.length===want.older.length,`${label}: opening a report marks that one seen and nothing else (${after.recent.length} recent, ${after.older.length} older)`);
    }
    await context.close();
  }
  check(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-not-seen-pile: ${checks} checks passed (records: ${before.all} never opened, ${before.recent.length} in the last two weeks, ${before.older.length} older, ${before.replaced.length} replaced by a correction)`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
