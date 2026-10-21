// Browser check for FE-1c: "Who needs to respond" on a defect or access card
// offers the companies already named on this project's sent reports and
// issues, a tap fills the box, and any other wording is still accepted and
// saved. Names typed only in someone's draft are not offered. Recent places
// still show under Where. Checked at 390px light and 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-suggestions-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:suggest-engineer',oid:'suggest-engineer',name:'Suggest Engineer',email:'suggest@example.test',role:'Engineer',trade:'Electrical'};
const other={...principal,id:'entra:other-engineer',oid:'other-engineer',name:'Other Engineer',email:'other@example.test'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const card=(o)=>({id:randomUUID(),type:'defect',location:'',whatHappened:'',actionNeeded:'',owner:'',photos:[],...o});
// What was sent before on this project, and one private draft that must not leak.
const sent=createReport('proj-011lme',principal.name,principal);
putRecord('reports',{...sent,state:'submitted',serverAcknowledgedAt:'2026-10-13T09:00:00.000Z',observations:[
  card({location:'Level 2 riser',whatHappened:'Fire stopping missing',owner:'Main contractor'}),
  card({type:'access',location:'Plant room',whatHappened:'Locked',owner:'Site manager'}),
]});
const later=createReport('proj-011lme',principal.name,principal);
putRecord('reports',{...later,state:'submitted',serverAcknowledgedAt:'2026-10-15T09:00:00.000Z',observations:[card({location:'Core B',whatHappened:'Board cracked',owner:'Dryline Ltd'})]});
const hidden=createReport('proj-011lme',other.name,other);
putRecord('reports',{...hidden,observations:[card({location:'Secret room',owner:'Private Draft Co'})]});
const seed=()=>{
  const draft=createReport('proj-011lme',principal.name,principal);
  const id=randomUUID();
  putRecord('reports',{...draft,observations:[card({id,location:'Level 2 riser',whatHappened:'Tray not fixed'})]});
  return {draft,id};
};
const port=4337,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-suggest-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const savedOwner=async(id,reportId,want)=>{let o;for(let n=0;n<30;n++){o=getRecord('reports',reportId).observations.find(x=>x.id===id);if(o?.owner===want)break;await new Promise(r=>setTimeout(r,250));}return o?.owner;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    const label=`${scheme} ${width}px`,wide=width>=900;
    const {draft,id}=seed();
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/reports/${draft.id}`);
    const rows=page.locator('.eng-cardrow');await rows.first().waitFor();
    if(!wide||(await rows.first().getAttribute('aria-current'))!=='true')await rows.first().click();
    const editor=page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card');
    const owner=editor.getByLabel('Who needs to respond',{exact:true});
    // Who should respond is folded under "More for the office" until it is wanted.
    await editor.locator('.eng-more-detail').waitFor();
    if(!await owner.isVisible())await editor.getByText('More for the office').click();
    await owner.waitFor();
    const box=editor.locator('.eng-suggestions').filter({hasText:'Recent companies'});
    await box.waitFor();
    const chips=async()=>(await box.locator('.eng-chip').allInnerTexts()).map(s=>s.trim());
    const shown=await chips();
    assert.deepEqual(shown,['Dryline Ltd','Main contractor','Site manager'],`${label}: companies from sent reports, newest first`);checks++;
    ok(!shown.includes('Private Draft Co'),`${label}: a name only in someone's draft is not offered`);
    const places=(await editor.locator('.eng-suggestions').filter({hasText:'Recent places'}).locator('.eng-chip').allInnerTexts()).map(s=>s.trim());
    ok(places.includes('Core B')&&!places.includes('Secret room'),`${label}: recent places still show, without draft-only places: ${places}`);
    ok(/Choose one or type any name/.test(await editor.innerText()),`${label}: the hint says free text is fine`);
    await box.getByRole('button',{name:'Main contractor'}).click();
    eq(await owner.inputValue(),'Main contractor',`${label}: tapping a company fills the box`);
    eq(await box.getByRole('button',{name:'Main contractor'}).getAttribute('aria-pressed'),'true',`${label}: the chosen chip shows as chosen`);
    eq(await savedOwner(id,draft.id,'Main contractor'),'Main contractor',`${label}: the chosen company is saved`);
    if(screenshot){await box.scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`suggestions-${scheme}-${width}.png`)});}
    await owner.fill('Brand new firm (not on any list)');
    eq(await box.locator('.eng-chip[aria-pressed=true]').count(),0,`${label}: no chip shows as chosen for new wording`);
    eq(await savedOwner(id,draft.id,'Brand new firm (not on any list)'),'Brand new firm (not on any list)',`${label}: any other wording is accepted and saved`);
    eq(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${label}: no sideways scroll`);
    assert.deepEqual(errors,[],`${label}: no page errors`);
    await context.close();
  }
  console.log(`Passed ${checks} suggestion checks (390px light, 1440px dark).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
