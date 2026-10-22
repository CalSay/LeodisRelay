// Browser check for one mark per person per day on Site coverage: an engineer
// who sends a site update and a first fix inspection on the same day shows as
// one mark that opens the site update and names both, while two electricians
// on the same day are two marks. Office, desktop dark and phone light.
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
const root=mkdtempSync(join(tmpdir(),'relay-coverage-mark-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const sam={id:'entra:mark-sam',name:'Sam Spark',trade:'Electrical'};
const jo={id:'entra:mark-jo',name:'Jo Wire',trade:'Electrical'};
const pat={id:'entra:mark-pat',name:'Pat Pipe',trade:'P&H'};
const manager={id:'entra:mark-manager',oid:'mark-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const today=londonDay(new Date()),now=new Date().toISOString();
const report=(by,reference,extra={})=>{const r={id:randomUUID(),projectId:'proj-011lme',reference,visitDate:today,author:by.name,authorId:by.id,authorTrade:by.trade,state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra};putRecord('reports',r);return r;};
// The inspection is written first, so the mark opening the update is the rule, not the order of the records.
const samFfi=report(sam,'011LME-FFI-001',{reportType:'first-fix-inspection'});
const samUpdate=report(sam,'011LME-SPR-201');
const joUpdate=report(jo,'011LME-SPR-202');
const patUpdate=report(pat,'011LME-SPR-203');
const port=4531,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-coverage-mark-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width] of [['dark',1440],['light',390]]){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const at=`${scheme} ${width}`;
    await page.goto(`${base}/coverage`);await page.locator('.cov-grid').waitFor();
    const row=page.locator('.cov-grid tbody tr').filter({has:page.locator('th[scope=row]',{hasText:'011LME'})});
    const marks=row.locator('td.cov-today .cov-chip');
    const texts=await marks.allInnerTexts();
    check(JSON.stringify(texts)===JSON.stringify(['Elec','Elec','P&H']),`${at}: three people, three marks, two of them electricians: ${JSON.stringify(texts)}`);
    const labels=await marks.evaluateAll(a=>a.map(x=>x.getAttribute('aria-label')));
    check(labels[0].startsWith('Jo Wire, Electrical')&&labels[0].includes(joUpdate.reference),`${at}: Jo's mark names Jo: ${labels[0]}`);
    check(labels[1].startsWith('Sam Spark, Electrical')&&labels[1].includes(`${samUpdate.reference}, ${samFfi.reference}`),`${at}: Sam's one mark names his update then his inspection: ${labels[1]}`);
    check(labels[2].includes(patUpdate.reference),`${at}: Pat's mark: ${labels[2]}`);
    check((await marks.nth(1).getAttribute('title'))===labels[1].replace('Electrical, ','Electrical · '),`${at}: the mark's title says the same`);
    const list=await row.locator('td.cov-today .cov-visits').getAttribute('aria-label');
    check(/: 3 people on site$/.test(list),`${at}: the day is read out as people on site: ${list}`);
    check(/Each mark is one person who sent a report from site that day/.test(await page.locator('.cov-foot').innerText()),`${at}: the key says what a mark is`);
    if(width===390){const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=390,`${at}: no sideways page scroll (${w})`);}
    if(screenshot)await page.screenshot({path:join(screenshot,`after-small-${scheme}-${width}.png`),fullPage:true});
    await marks.nth(1).click();await page.waitForURL(`**/reports/${samUpdate.id}**`);
    check(true,`${at}: Sam's mark opens his site update`);
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  console.log(`Site coverage one-mark check passed (${checks} checks): one mark per person per day, two electricians are two marks, the mark opens the site update, phone and desktop, light and dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
