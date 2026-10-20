// Browser check for search: an engineer opens Search from the site companion,
// finds a report, an issue and a variation by words they remember, opens one
// and comes back to the same results. Another engineer's draft is never found.
// The matching rules are covered by apps/web/tests/search.test.ts.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
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
const root=mkdtempSync(join(tmpdir(),'relay-search-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const engineer={id:'entra:search-engineer',oid:'search-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const other={id:'entra:search-other',oid:'search-other',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'};
const manager={id:'entra:search-manager',oid:'search-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});}
const at=new Date().toISOString();
const card=(location,whatHappened)=>({id:randomUUID(),type:'update',location,whatHappened,actionNeeded:'',owner:'',photos:[]});
const sent=createReport('proj-011lme',engineer.name,engineer);
putRecord('reports',{...sent,state:'submitted',serverAcknowledgedAt:at,observations:[card('Level 3 riser','Cable tray brackets fixed to the slab')]});
const theirs=createReport('proj-011lme',other.name,other);
putRecord('reports',{...theirs,observations:[card('Level 3 riser','Private draft about the riser')]});
putRecord('issues',{id:'issue-search',reference:'011LME-ISS-001',projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Level-3 Riser',description:'Fire stopping missing around containment',actionNeeded:'Seal the penetrations',confirmation:'provisional',work:'open',owner:'Acme Fire',targetDate:'',raisedByReport:sent.id,raisedAt:at,events:[]});
putRecord('variations',{id:'variation-search',reference:'011LME-VO-004',projectId:'proj-011lme',description:'Move the riser door',location:'Level 3',workDone:false,instruction:'pending',source:'report',raisedBy:engineer.name,raisedById:engineer.id,raisedAt:at,events:[]});
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-search-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const sections=page=>page.locator('section[aria-label]').evaluateAll(s=>Object.fromEntries(s.map(x=>[x.getAttribute('aria-label'),x.querySelectorAll('.search-hit').length])));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  async function open(who,viewport,scheme='light'){
    const context=await browser.newContext({viewport,colorScheme:scheme});await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page;
  }
  for(const [width,height] of [[390,844],[1440,900]]) for(const scheme of ['light','dark']){
    const page=await open(engineer,{width,height},scheme);
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('link',{name:'Search'}).waitFor();
    if(shot)await page.screenshot({path:join(shot,`engineer-home-${width}-${scheme}.png`)});
    await page.getByRole('link',{name:'Search'}).click();
    await page.getByRole('heading',{name:'Search',level:1}).waitFor();
    assert.match(page.url(),/\/search\?.*project=proj-011lme/,'Search opens on the current project');checks++;
    assert.ok(await page.getByLabel('Search for').evaluate(e=>e===document.activeElement),'the search box has focus');checks++;
    await page.getByLabel('Search for').fill('level 3 riser');
    await page.getByText(/^\d+ match/).waitFor();
    assert.deepEqual(await sections(page),{Issues:1,Reports:1,Variations:1},'one issue, one report, one variation; the other engineer’s draft is not found');checks++;
    assert.equal(await page.getByText('Private draft').count(),0);checks++;
    assert.ok((await page.locator('mark').allInnerTexts()).some(t=>t.toLowerCase()==='riser'),'matched words are marked');checks++;
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=0,`no sideways scroll at ${width}px (${overflow})`);checks++;
    if(shot)await page.screenshot({path:join(shot,`search-${width}-${scheme}.png`),fullPage:true});
    if(width===390&&scheme==='light'){
      await page.getByRole('link',{name:/Fire stopping missing/}).click();
      await page.waitForURL(/\/issues\/issue-search/);await page.getByText('Fire stopping missing around containment').first().waitFor();
      await page.locator('a.back').click();
      await page.getByText(/^\d+ match/).waitFor();
      assert.equal(await page.getByLabel('Search for').inputValue(),'level 3 riser','Back from a result keeps the search');checks++;
      await page.getByLabel('Search for').fill('kitchen extract');
      await page.getByText(/Nothing matches “kitchen extract”/).waitFor();checks++;
      await page.getByLabel('Project').selectOption('');
      await page.getByLabel('Search for').fill('VO-004');
      await page.getByText(/^1 match$/).waitFor();checks++;
      await page.locator('a.back').click();
      await page.waitForURL(/\/engineer\?project=proj-011lme/);checks++;
    }
    await page.context().close();
  }
  // The office can use the same page; it sees no engineer's draft either.
  const office=await open(manager,{width:1440,height:900});
  await office.goto(`${base}/search?q=riser`);
  await office.getByText(/^\d+ match/).waitFor();
  assert.deepEqual(await sections(office),{Issues:1,Reports:1,Variations:1});checks++;
  assert.equal(await office.evaluate(async()=>(await fetch('/api/search?q=private')).json()).then(r=>r.reports.total),0,'no draft text through the API');checks++;
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} search checks (engineer at 390px and 1440px, light and dark; office).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
