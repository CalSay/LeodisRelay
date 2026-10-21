// Browser check for FE-6a: a sent report shows received, PDF, delivery and
// seen as separate steps, each with its own state, in the office reader and
// on the engineer's report page; a local outbox file is never shown as email.
// The engineer's page folds the PDF and delivery steps unless one went wrong.
// The engineer's pages go first: the office opening a report marks it seen,
// and the engineer then sees "Seen by the office" on it.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the office reader at 1440px and the engineer page at 390px, light and dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-stages-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const manager={id:'entra:stages-manager',oid:'stages-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const engineer={id:'entra:stages-engineer',oid:'stages-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=principal=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});return id;};
const sessions={office:sessionFor(manager),engineer:sessionFor(engineer)};
const now=new Date().toISOString();
const obs=()=>[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}];
const record=(failure)=>({revisionId:'x',revision:1,method:'email',recipient:{name:'Tom PM',address:'tom@example.test',role:'project_manager'},at:now,...(failure?{failure}:{})});
const sent=(over)=>{const r=createReport('proj-011lme',engineer.name,engineer);const row={...r,state:'submitted',review:'not_required',serverAcknowledgedAt:now,observations:obs(),...over};putRecord('reports',row);putRecord('snapshots',row);return r.id;};
// What each seeded report should show, step by step.
const cases={
  queued:{id:sent({delivery:'pending'}),steps:{Received:'Received',PDF:'Being prepared',Delivery:'Waiting for the PDF',Seen:'Not seen yet'}},
  outbox:{id:sent({delivery:'outbox',issued:{records:[record()],unaddressed:[],transport:'outbox',location:'/outbox/x.eml'},acknowledged:{by:'Office Manager',byId:manager.id,at:now}}),steps:{Received:'Received',PDF:'Ready',Delivery:'Not emailed',Seen:'Seen by the office'}},
  emailed:{id:sent({delivery:'sent',issued:{records:[record()],unaddressed:[],transport:'graph'}}),steps:{Received:'Received',PDF:'Ready',Delivery:'Emailed to Tom PM',Seen:'Not seen yet'}},
  pdfFailed:{id:sent({delivery:'failed',deliveryError:'Renderer crashed',deliveryErrorStage:'pdf'}),steps:{Received:'Received',PDF:'Could not be prepared',Delivery:'Waiting for the PDF',Seen:'Not seen yet'}},
  mailFailed:{id:sent({delivery:'failed',deliveryErrorStage:'delivery',deliveryError:'Mailbox refused',issued:{records:[record('Mailbox refused')],unaddressed:[],transport:'graph'}}),steps:{Received:'Received',PDF:'Ready',Delivery:'Email failed',Seen:'Not seen yet'}},
  reviewed:{id:sent({delivery:'rendered',review:'pending'}),steps:{Received:'Received',Review:'Awaiting review',PDF:'Ready',Delivery:'Waiting to send',Seen:'Not seen yet'}},
};
const port=4337,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-stages-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const steps=page=>page.locator('ol.stages > li').evaluateAll(els=>Object.fromEntries(els.map(li=>[li.querySelector('.stage-t').textContent,li.querySelector('.tag').textContent])));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  const views=[
    {who:'engineer',width:390,url:id=>`${base}/reports/${id}`},
    {who:'office',width:1440,url:id=>`${base}/office#/projects/proj-011lme/report/${id}`},
  ];
  for(const view of views)for(const colorScheme of ['light','dark']){
    const ctx=await browser.newContext({viewport:{width:view.width,height:900},colorScheme});await ctx.addCookies([{name:'relay_session',value:sessions[view.who],url:base}]);
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    for(const [name,c] of Object.entries(cases)){
      await page.goto(view.url(c.id));await page.locator('ol.stages').first().waitFor();
      const label=`${view.who} ${view.width}px ${colorScheme}, ${name}`;
      // The office opening it is what marks it seen.
      const expected=view.who==='office'?{...c.steps,Seen:'Seen by the office'}:c.steps;
      if(view.who==='office')await page.locator('ol.stages li[data-stage="read"]').getByText('Seen by the office').waitFor();
      assert.deepEqual(await steps(page),expected,`${label}: each step and its state`);checks++;
      // The engineer sees received, review and seen; the PDF and delivery fold
      // away under "PDF and delivery" unless one went wrong. The office sees every step.
      const open=await page.locator('ol.stages > li').evaluateAll(els=>els.filter(li=>!li.closest('details')).map(li=>li.dataset.stage));
      const alerts=['pdf','delivery'].filter(k=>(name==='pdfFailed'&&k==='pdf')||(name==='mailFailed'&&k==='delivery'));
      const keys=Object.keys(expected).map(t=>({Received:'received',Review:'review',PDF:'pdf',Delivery:'delivery',Seen:'read'})[t]);
      assert.deepEqual(open,view.who==='office'?keys:keys.filter(k=>!['pdf','delivery'].includes(k)||alerts.includes(k)),`${label}: steps shown without opening More`);checks++;
      if(view.who==='engineer'){
        const more=page.locator('details.stages-more');
        assert.equal(await more.count(),alerts.length===2?0:1,`${label}: PDF and delivery folded`);checks++;
        assert.equal(await more.evaluate(d=>d.open),false,`${label}: folded until opened`);checks++;
        if(name==='outbox'){assert.equal((await more.locator('summary').textContent()).trim(),'PDF and delivery PDF ready · Delivery not emailed',`${label}: the fold says how each stands`);checks++;}
        await more.locator('summary').click();
        assert.ok(await more.locator('li[data-stage]').first().isVisible(),`${label}: opening it shows the folded steps`);checks++;
      }
      if(view.who==='office'){assert.match(await page.locator('ol.stages li[data-stage="read"] small').textContent(),/Opened by Office Manager/,`${label}: says who opened it`);checks++;}
      if(name==='outbox'){
        assert.equal(await page.locator('ol.stages').getByText(/emailed to/i).count(),0,`${label}: a local outbox file is not shown as an email`);checks++;
        assert.match(await page.locator('ol.stages li[data-stage="delivery"]').textContent(),/does not email anyone yet/,`${label}: says nothing was sent`);checks++;
      }
      if(name==='pdfFailed'){assert.match(await page.locator('ol.stages li[data-stage="pdf"]').textContent(),/Renderer crashed/,`${label}: the PDF step says why`);checks++;}
      if(name==='mailFailed'){assert.equal(await page.locator('ol.stages li[data-stage="delivery"]').getAttribute('data-tone'),'alert',`${label}: a failed email is an alert on the delivery step`);checks++;}
      assert.ok(await overflow(page)<=0,`${label}: no horizontal scroll`);checks++;
      if(shot&&(name==='outbox'||name==='reviewed'))await page.screenshot({path:join(shot,`${view.who}-${name}-${view.width}-${colorScheme}.png`),fullPage:view.who==='engineer'});
    }
    await ctx.close();
  }
  // Back on the engineer's phone, every report the office opened now says so.
  const back=await browser.newContext({viewport:{width:390,height:900}});await back.addCookies([{name:'relay_session',value:sessions.engineer,url:base}]);
  const engineerPage=await back.newPage();engineerPage.on('pageerror',e=>errors.push(e.message));
  for(const [name,c] of Object.entries(cases)){
    await engineerPage.goto(`${base}/reports/${c.id}`);await engineerPage.locator('ol.stages').first().waitFor();
    assert.equal((await steps(engineerPage)).Seen,'Seen by the office',`engineer after the office opened ${name}: seen by the office`);checks++;
  }
  await back.close();
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} submission stage checks (engineer 390px and office 1440px, light and dark; opening in the office marks seen).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
