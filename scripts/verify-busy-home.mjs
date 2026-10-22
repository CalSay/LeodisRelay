// Browser check for the engineer home late in a busy week (2026-10-22). A walk
// at 390px with Sam (scripts/seed-busy-projects.mjs: three sites, a site update
// left as a draft on each from Tuesday) found the office's questions starting
// below the first screen: three full rows of drafts saved to RELAY came first.
// Now "Came back from the office" sits straight under the main buttons, and
// drafts saved to RELAY follow it, folded into one line when there are several.
// Anything that could be lost (here: one tapped Send with no signal) is listed
// in full above the office's questions, with the section.
// Checks, light 390px and dark 1440px, then light 390px with one waiting to send:
// - the first office question, down to what the office wrote, is on the first
//   screen above the bottom bar (phone);
// - Unfinished reports comes after Came back, as one line "3 drafts saved to
//   RELAY · Visit … · 3 sites", which opens to the three drafts, each opening its report;
// - with one waiting to send, that one is listed in full above Came back, and the
//   other two fold into "2 more drafts, saved to RELAY";
// - nothing is left out, no sideways scroll, 48px rows, axe finds nothing, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots (RELAY_SHOT_PREFIX names them, default "after").
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-busy-home-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today});
const rows=kind=>database().prepare('select data from records where kind=?').all(kind).map(r=>JSON.parse(r.data));
const sam=PEOPLE.engineer,manager=PEOPLE.manager,P='proj-011lme';
// The busy seed leaves Sam a draft on some sites when today is up to two days after a Tuesday. Whatever the
// day, put one site update on each of the three sites, saved to RELAY, all from three days ago.
const {dayShort}=require('../apps/web/.test-build/lib/dates.js');
const visit=(()=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-3);return d.toISOString().slice(0,10);})();
for(const d of rows('reports').filter(r=>r.authorId===sam.id&&r.state==='draft'))database().prepare('DELETE FROM records WHERE id=?').run(d.id);
for(const pid of ['proj-011lme','proj-014lme','proj-009lcp']){
  const last=rows('reports').filter(r=>r.projectId===pid&&r.authorId===sam.id&&r.state==='submitted'&&!r.reportType).sort((a,b)=>b.visitDate.localeCompare(a.visitDate))[0];
  putRecord('reports',{...last,id:randomUUID(),reference:last.reference.replace(/\d+$/,m=>String(9000+Number(m))),visitDate:visit,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:`${visit}T16:00:00.000Z`,review:'not_required',delivery:undefined,signature:undefined});
}
const drafts=rows('reports').filter(r=>r.authorId===sam.id&&r.state==='draft');
assert.equal(drafts.length,3,'Sam has a draft on each of three sites');
assert.ok(drafts.every(d=>d.visitDate<today),'all from an earlier day, so none is on the big button');
// The office's questions: fixes Sam put forward, sent back with a word, on each site.
let n=0;const iso=m=>new Date(Date.now()-m*60000).toISOString();
for(const [pid,k] of [['proj-011lme',3],['proj-014lme',2],['proj-009lcp',1]]){
  for(const i of rows('issues').filter(i=>i.projectId===pid&&i.reportedById===sam.id&&i.work==='awaiting_verification').slice(0,k)){
    i.work='in_progress';i.events.push({at:iso(60*(++n)),actor:manager.name,actorId:manager.id,kind:'reopened',note:`Not finished, can you send a photo of the ${['top','end','left side'][n%3]}?`,photos:[]});putRecord('issues',i);
  }
}
assert.ok(n>=4,`fixes sent back: ${n}`);
const session=randomUUID();putRecord('sessions',{id:session,principal:sam,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});

const port=4513,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-busy-home',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(x=>x.target.join(' ')).slice(0,4).join(', ')}`));ok(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
try {
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const waitingOne=drafts.find(d=>d.projectId==='proj-014lme');
  for(const [scheme,width,risk] of [['light',390,false],['dark',1440,false],['light',390,true]]){
    const label=`${scheme} ${width}${risk?' one waiting to send':''}`,wide=width>=900;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    if(risk)await context.addInitScript(([id,who])=>{try{localStorage.setItem('relay-send-on-signal',JSON.stringify([{reportId:id,principalId:who,at:new Date().toISOString()}]));}catch{}},[waitingOne.id,sam.id]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/engineer?project=${P}`);
    const section=page.locator('section[aria-labelledby="eng-unfinished-title"]');
    await section.waitFor({timeout:30000});
    await page.locator('.eng-came-back .eng-word').first().waitFor({timeout:30000});
    if(risk)await section.locator('a.eng-row',{hasText:'Not sent yet'}).waitFor({timeout:10000});
    await page.waitForTimeout(300);
    const m=await page.evaluate(()=>{
      const back=document.querySelector('.eng-came-back'),un=document.querySelector('section[aria-labelledby="eng-unfinished-title"]');
      const word=back.querySelector('.eng-row .eng-word').getBoundingClientRect();
      const nav=document.querySelector('.eng-navigation').getBoundingClientRect();
      return {word:Math.round(word.bottom+scrollY),foot:Math.round(nav.top>innerHeight/2?nav.top:innerHeight),
        unfinishedFirst:!!(un.compareDocumentPosition(back)&Node.DOCUMENT_POSITION_FOLLOWING),
        sideways:document.documentElement.scrollWidth>innerWidth+1};
    });
    if(!wide&&!risk)ok(m.word<=m.foot,`${label}: the office's first question, down to what it wrote, is on the first screen (${m.word}px, screen ends ${m.foot}px)`);
    const fold=section.locator('details.eng-saved-drafts');
    const summary=fold.locator('summary');
    const visitWords=dayShort(visit);
    if(!risk){
      ok(!m.unfinishedFirst,`${label}: Unfinished reports comes after Came back from the office`);
      ok(await section.locator(':scope > .eng-list').count()===0,`${label}: no draft listed in full outside the fold`);
      const said=(await summary.innerText()).replace(/\s+/g,' ').trim();
      ok(said===`3 drafts saved to RELAY Visit ${visitWords} · 3 sites · open to carry on`,`${label}: one line for the three drafts: "${said}"`);
      ok(await section.locator('.eng-section-title .r').innerText()==='',`${label}: no count beside the heading repeating the line`);
    } else {
      ok(m.unfinishedFirst,`${label}: with one that could be lost, Unfinished reports comes before Came back`);
      const listed=section.locator(':scope > .eng-list a.eng-row');
      ok(await listed.count()===1&&(await listed.getAttribute('href')).startsWith(`/reports/${waitingOne.id}?`),`${label}: the one waiting to send is listed in full`);
      ok(/Not sent yet/.test(await listed.textContent()),`${label}: and says it is not sent yet`);
      const said=(await summary.innerText()).replace(/\s+/g,' ').trim();
      ok(said===`2 more drafts, saved to RELAY Visit ${visitWords} · 2 sites · open to carry on`,`${label}: the other two fold into one line: "${said}"`);
      ok(await section.locator('.eng-section-title .r').innerText()==='3',`${label}: the heading counts all three`);
    }
    ok(!(await fold.evaluate(d=>d.open)),`${label}: the fold starts closed`);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-busy-home-${scheme}-${width}${risk?'-waiting':''}.png`),fullPage:true});
    await summary.click();
    const inside=fold.locator('a.eng-row');
    const want=risk?drafts.filter(d=>d.id!==waitingOne.id):drafts;
    await inside.first().waitFor();
    const hrefs=await inside.evaluateAll(as=>as.map(a=>a.getAttribute('href')));
    ok(hrefs.length===want.length&&want.every(d=>hrefs.some(h=>h.startsWith(`/reports/${d.id}?`))),`${label}: opened, it lists every draft saved to RELAY (${hrefs.length})`);
    const heights=await page.locator('.eng-workspace a.eng-row:visible, .eng-saved-drafts>summary').evaluateAll(rs=>rs.map(r=>r.getBoundingClientRect().height));
    ok(heights.every(h=>h>=48),`${label}: rows at least 48px tall (${heights.map(Math.round).join(', ')})`);
    ok(!m.sideways,`${label}: no sideways scrolling`);
    await axe(page,label);
    if(shots)await page.screenshot({path:join(shots,`${prefix}-busy-home-${scheme}-${width}${risk?'-waiting':''}-open.png`),fullPage:true});
    const target=inside.first();const href=await target.getAttribute('href');
    if(wide)await target.click();else await target.tap();
    await page.waitForURL(u=>u.pathname===href.split('?')[0],{timeout:20000});
    ok(true,`${label}: a draft in the fold opens its report`);
    ok(!errors.length,`${label}: no page errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log(`busy home verified: ${checks} checks`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
