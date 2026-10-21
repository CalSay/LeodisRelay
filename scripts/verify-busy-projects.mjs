// Browser check for speed on busy projects: seeds a large, realistic data set
// (scripts/seed-busy-projects.mjs: three projects, fourteen months of daily
// updates, about 3,100 reports, 4,100 issues and 950 variations), then times
// the engineer pages on a throttled phone (4x slower processor, 4G network)
// and the office pages on a desktop, and the API calls behind them. Each has a
// time budget and each page a budget for what it downloads; anything over
// budget fails the check, so a slow query or a page that downloads the whole
// register does not slip back in unnoticed.
//
// npm test && npm run build, then from the repo root:
//   node scripts/verify-busy-projects.mjs
// RELAY_BUSY_REPORT=<file.json> writes every timing; RELAY_BUSY_MEASURE=1
// prints timings without failing on budgets. Set RELAY_PLAYWRIGHT_MODULE and
// RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-busy-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord}=require(storagePath);
// Safety, permits and deliveries are off unless the office turns them on (lib/featureSwitch.ts); this check needs them on. verify-simpler-home.mjs covers both states.
putRecord('settings',{id:'features',safetyRecords:true});
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date());
const seeded=seedBusyProjects({storagePath,today});
const sessions={};
for(const key of ['engineer','manager']){sessions[key]=randomUUID();putRecord('sessions',{id:sessions[key],principal:PEOPLE[key],issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});}
const measureOnly=process.env.RELAY_BUSY_MEASURE==='1';
const only=process.env.RELAY_BUSY_ONLY; // api, phone or desk, to time one group
const P='proj-011lme';

// Budgets. Pages: milliseconds from navigation to the page showing its
// records with nothing still loading, and kilobytes the page's API calls sent
// over the network. APIs: the fastest of three warm calls. Time budgets are
// about twice what the fixed code takes here, so a slower machine passes while
// the old behaviour (seconds, or half a minute for the spreadsheet) fails.
// Sizes do not depend on the machine, so they are kept tight.
// A shared cloud machine stalls now and then for a second or so, whatever the
// code, so anything over its time budget is timed again (pages up to twice
// more, APIs three calls more) and the fastest counts. A real slowdown is slow
// every time and still fails; a size is never given a second go.
const PHONE_PAGES=[
  ['Engineer home',`/engineer?project=${P}`,'.eng-row',2500,60],
  ['Engineer issues',`/engineer?project=${P}&view=issues`,'.eng-issue-list',4500,400],
  ['Engineer reports',`/engineer?project=${P}&view=reports`,'.eng-workspace',2500,60],
  ['Snag list',`/issues/snag-list?project=${P}&trade=Electrical`,'main',3500,400],
  ['My week','/my-week','.mw-days',2500,30],
  ['Weekly summary',`/weekly-summary?project=${P}`,'main',2500,30],
  ['Site diary',`/diary?project=${P}`,'main',3000,60],
  ['Photographs',`/photos?project=${P}`,'main',3500,500],
  ['Before handover',`/handover?project=${P}`,'main',2500,60],
  ['Safety actions',`/safety-actions?project=${P}`,'main',2500,30],
  ['Issues over time',`/issue-trend?project=${P}`,'main',2500,30],
  ['Notes for the next visit',`/site-notes?project=${P}`,'main',2500,30],
  ['Search',`/search?q=riser&project=${P}`,'main',3000,30],
];
const DESK_PAGES=[
  ['Office desk','/office#/projects','.ws-main',2500,1200],
  ['Office inbox','/office#/inbox','.ws-main',4000,1200],
  ['Office issues','/office#/issues','.ws-main',3000,1200],
  ['Office variations','/office#/variations','.ws-main',2500,1200],
  ['Issues by company','/companies','main',2000,30],
  ['Site coverage','/coverage','main',2000,30],
  ['Search (office)','/search?q=riser','main',2500,30],
];
const APIS=[
  ['engineer',`/api/reports?projectId=${P}`,100],
  ['engineer',`/api/came-back?projectId=${P}`,150],
  ['engineer',`/api/issues?projectId=${P}`,200],
  ['engineer',`/api/since-last-visit?projectId=${P}`,150],
  ['engineer','/api/my-week',300],
  ['engineer',`/api/weekly-summary?projectId=${P}`,150],
  ['engineer',`/api/site-diary?projectId=${P}`,200],
  ['engineer',`/api/photos?projectId=${P}`,400],
  ['engineer',`/api/before-handover?projectId=${P}`,200],
  ['engineer','/api/safety-actions',250],
  ['engineer',`/api/issue-trend?projectId=${P}`,60], // about 25 ms; a slowdown in #128 took it to 85-100 ms
  ['engineer','/api/search?q=riser',600],
  ['manager','/api/reports?view=office',100],
  ['manager','/api/issues?view=desk',300],
  ['manager','/api/issues?register=1',200],
  ['manager','/api/company-issues',150],
  ['manager','/api/site-coverage',250],
  ['manager','/api/issues/export',400],
];

const port=4339,base=`http://127.0.0.1:${port}`;let output='';
// A check server left running by an earlier run would answer in this one's place, with other data.
assert.ok(await fetch(base+'/signin').then(()=>false,()=>true),`Port ${port} is already in use: stop the server an earlier run left behind.`);
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-busy-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const results=[],over=[];
const record=(kind,name,ms,budget,extra={})=>{
  results.push({kind,name,ms:Math.round(ms),budget,...extra});
  console.log(`${kind.padEnd(6)} ${name.padEnd(48)} ${String(Math.round(ms)).padStart(6)} ms (budget ${budget})${extra.kb!==undefined?`  ${String(extra.kb).padStart(5)} KB${extra.kbBudget?` (budget ${extra.kbBudget})`:''}`:''}${extra.timedAgain?'  (timed again: first try over budget)':''}`);
  if(ms>budget)over.push(`${name}: ${Math.round(ms)} ms, budget ${budget} ms`);
  checks++;
};
// Ready: the page's own content is there, nothing says it is loading, and the network has settled.
async function ready(page,selector){
  await page.locator(selector).first().waitFor({timeout:60000});
  await page.waitForFunction(()=>![...document.querySelectorAll('[role=status],.loading,.empty,.cm-loading')].some(e=>/^\s*Loading/.test(e.textContent??'')),null,{timeout:60000,polling:50});
  await page.waitForLoadState('networkidle',{timeout:60000});
}
try {
  let up=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){up=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(up,output);
  console.log(`Seeded ${JSON.stringify(seeded)}`);

  // The API calls, warm: the server work behind each page, without the browser.
  for(const [who,path,budget] of only&&only!=='api'?[]:APIS){
    const times=[];let size=0,status=0;
    const call=async()=>{const t=performance.now();const res=await fetch(base+path,{headers:{cookie:`relay_session=${sessions[who]}`,'accept-encoding':'gzip'}});const body=await res.arrayBuffer();times.push(performance.now()-t);size=body.byteLength;status=res.status;if(times.length>4)assert.equal(status,200,`${path}: ${status} when timed again`);};
    for(let k=0;k<4;k++)await call();
    if(measureOnly&&status!==200){console.log(`api    ${who} ${path}: ${status}, not timed`);continue;}
    assert.equal(status,200,`${path}: ${status}`);
    const again=Math.min(...times.slice(1))>budget;
    if(again)for(let k=0;k<3;k++)await call();
    record('api',`${who} ${path}`,Math.min(...times.slice(1)),budget,{kb:Math.round(size/1024),...(again?{timedAgain:true}:{})});
  }

  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const open=async(role,width,phone)=>{
    const context=await browser.newContext({viewport:{width,height:phone?844:900},...(phone?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{})});
    await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Bytes on the wire, compressed, for the page's API calls.
    const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
    const api=new Set();let bytes=0;
    cdp.on('Network.requestWillBeSent',e=>{if(new URL(e.request.url).pathname.startsWith('/api/'))api.add(e.requestId);});
    cdp.on('Network.loadingFinished',e=>{if(api.has(e.requestId))bytes+=e.encodedDataLength;});
    if(phone){
      // A mid-range phone on 4G (Chrome's "Fast 4G"): four times slower processor, 9 Mbps down, 60 ms round trip.
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:9e6/8,uploadThroughput:1.5e6/8});
    }
    return {context,page,errors,bytes:()=>bytes,reset:()=>{bytes=0;api.clear();},again:()=>open(role,width,phone)};
  };
  const time=async(session,kind,[name,path,selector,budget,kbBudget])=>{
    let best,tries=0;
    while(tries<3&&!(best?.ms<=budget)){
      tries++;
      // A second go starts in a new browser, so it is no warmer than the first: the page's own scripts are not cached yet.
      const s=tries===1?session:await session.again();
      // A first visit warms the server and the browser cache for the scripts, as an engineer opening RELAY again would have.
      await s.page.goto(base+'/help');await s.page.waitForLoadState('networkidle');
      s.reset();
      const t=performance.now();
      await s.page.goto(base+path);
      await ready(s.page,selector);
      const ms=performance.now()-t,kb=Math.round(s.bytes()/1024);
      if(s!==session){session.errors.push(...s.errors);await s.context.close();}
      // The size is the first visit's: it does not depend on the machine.
      if(!best||ms<best.ms)best={ms,kb:best?.kb??kb};
    }
    record(kind,name,best.ms,budget,{kb:best.kb,kbBudget,...(tries>1?{timedAgain:true}:{})});
    if(best.kb>kbBudget)over.push(`${name}: ${best.kb} KB over the network, budget ${kbBudget} KB`);
  };
  {
    const phone=await open('engineer',390,true);
    for(const entry of only&&only!=='phone'?[]:PHONE_PAGES)await time(phone,'phone',entry);
    assert.deepEqual(phone.errors,[],'phone: page errors');
    await phone.context.close();
  }
  {
    const desk=await open('manager',1440,false);
    for(const entry of only&&only!=='desk'?[]:DESK_PAGES)await time(desk,'desk',entry);
    assert.deepEqual(desk.errors,[],'desk: page errors');
    await desk.context.close();
  }
  if(process.env.RELAY_BUSY_REPORT)writeFileSync(process.env.RELAY_BUSY_REPORT,JSON.stringify({seeded,results},null,2));
  if(!measureOnly)assert.deepEqual(over,[],'over budget');
  console.log(`${checks} timings ${measureOnly?'measured':'within budget'}`);
} catch(error) {
  console.error(output.slice(-4000));throw error;
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
