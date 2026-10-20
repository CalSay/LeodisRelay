// Browser check for FE-6b: an issue's history names the report revision behind
// each change. The issue raised by a report links to rev 1; the sighting added
// when that report was corrected links to rev 2 and says which revision it
// corrects; a change made on the issue itself has no report link; an issue
// from before revisions were recorded still links its raising report.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-issue-provenance-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {correctReport,createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {applyCommand,listIssues}=require('../apps/web/.test-build/lib/issueStore.js');
const principal={id:'entra:prov-engineer',oid:'prov-engineer',name:'Prov Engineer',email:'prov@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const photo={id:randomUUID(),dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC',caption:'Riser',capturedAt:new Date().toISOString()};
const defect={id:randomUUID(),type:'defect',location:'Level 3 riser',whatHappened:'Fire stopping missing',actionNeeded:'Make good',owner:'',photos:[photo]};
const send=async(report,observations)=>{const saved=saveDraft(report.id,{...report,observations},report.version);assert.ok(saved.ok,saved.reason);const sent=await submitReport(report.id,{name:principal.name},saved.value.version);assert.ok(sent.ok,sent.reason);return sent.value;};
const original=await send(createReport('proj-011lme',principal.name,principal),[defect]);
const draft=correctReport(original.id,'Wrong level recorded');assert.ok(draft.ok);
const correction=await send(draft.value,[{...draft.value.observations[0],location:'Level 2 riser'}]);
const issue=listIssues('proj-011lme')[0];
assert.ok(applyCommand(issue.id,{kind:'assign',actor:'Office Manager',actorId:'entra:office',note:'Over to Northbank',owner:'Northbank'}).ok);
// Recorded before FE-6b: no source on the event, only raisedByReport on the issue.
const legacy={id:randomUUID(),reference:'011LME-ISS-099',projectId:'proj-011lme',location:'Level 1',description:'Older issue',actionNeeded:'',confirmation:'confirmed',work:'open',owner:'',targetDate:'',source:'report',raisedByReport:original.id,raisedAt:'2026-09-01T09:00:00.000Z',events:[{at:'2026-09-01T09:00:00.000Z',actor:'Prov Engineer',kind:'raised',note:'Older issue',photos:[]}]};
putRecord('issues',legacy);
const port=4342,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-provenance-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const ref=original.reference;
  for(const [scheme,width] of [['light',390],['dark',1440]]){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const tag=`${scheme} ${width}px`;
    await page.goto(`${base}/issues/${issue.id}`);
    const rows=page.locator('.reg .row');
    await rows.first().waitFor();
    eq(await rows.count(),3,`${tag}: raised, corrected sighting and assignment`);
    const link=(i)=>rows.nth(i).locator('.issue-event-source a');
    eq(await link(0).innerText(),`From ${ref} rev 1`,`${tag}: the raising event names rev 1`);
    eq(await link(0).getAttribute('href'),`/reports/${original.id}`,`${tag}: and links the sent report`);
    eq(await link(1).innerText(),`From ${ref} rev 2, which corrects rev 1`,`${tag}: the sighting names the correcting revision`);
    eq(await link(1).getAttribute('href'),`/reports/${correction.id}`,`${tag}: and links the correction, not the original`);
    eq(await rows.nth(2).locator('.issue-event-source').count(),0,`${tag}: a change made on the issue itself has no report link`);
    eq(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tag}: no sideways scroll`);
    const height=(await link(1).boundingBox())?.height??0;ok(height>=32,`${tag}: the link is easy to tap (${height}px)`);
    if(screenshot){await rows.first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:join(screenshot,`provenance-${scheme}-${width}.png`)});}
    if(scheme==='light'){
      await link(1).click();
      await page.waitForURL(`${base}/reports/${correction.id}`);
      ok(true,`${tag}: following the link opens the correction`);
      await page.goto(`${base}/issues/${legacy.id}`);
      await rows.first().waitFor();
      eq(await link(0).innerText(),'From the report that raised it',`${tag}: older history still links its raising report`);
    }
    assert.deepEqual(errors,[],`${tag}: no page errors`);
    await context.close();
  }
  console.log(`Passed ${checks} issue provenance checks (390px light, 1440px dark).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
