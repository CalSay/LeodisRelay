// Browser check for FE-1b: "Another card here" on a card starts a new card at
// the same location, placed next to it, with nothing else carried over (no
// words, photographs, linked issue or variation answers). Checked at 390px
// light and 1440px dark, and the new card is saved to the server.
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
const root=mkdtempSync(join(tmpdir(),'relay-same-location-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:place-engineer',oid:'place-engineer',name:'Place Engineer',email:'place@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGNoaGhgQAIMxHEBAG6dBQGx9D2YAAAAAElFTkSuQmCC';
const seed=()=>{
  const draft=createReport('proj-011lme',principal.name,principal);
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  putRecord('reports',{...draft,observations:[
    {id:ids[0],type:'instruction',location:'Level 3 riser',whatHappened:'Client asked for an extra socket by the riser door',actionNeeded:'Price it',owner:'Client',variationReason:'Client instruction',workDone:true,askedBy:'Site manager',roughSize:'half-day',photos:[{id:randomUUID(),dataUrl:png,caption:'Riser door',capturedAt:new Date().toISOString()}]},
    {id:ids[1],type:'update',location:'Plant room',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]},
    {id:ids[2],type:'update',location:'',whatHappened:'General tidy',actionNeeded:'',owner:'',photos:[]},
  ]});
  return {draft,ids};
};
const port=4336,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-place-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`)});};
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    const label=`${scheme} ${width}px`,wide=width>=900;
    const {draft,ids}=seed();
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/reports/${draft.id}`);
    const rows=page.locator('.eng-cardrow');
    await rows.first().waitFor();
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const open=async i=>{if(!wide||(await rows.nth(i).getAttribute('aria-current'))!=='true')await rows.nth(i).click();};
    const action=()=>page.locator('.eng-same-place:visible');
    // A card with no location has nothing to repeat, so no action.
    await open(2);
    eq(await action().count(),0,`${label}: no "Another card here" on a card with no location`);
    // The variation at the riser offers it, naming the place.
    await open(0);
    eq(await action().count(),1,`${label}: the open card offers another card here`);
    ok(/Another card here/.test(await action().innerText())&&/Level 3 riser/.test(await action().innerText()),`${label}: the action names the location`);
    eq(await overflow(),false,`${label}: no sideways scroll with the action showing`);
    await action().scrollIntoViewIfNeeded();await shot(page,`same-location-${scheme}-${width}-action`);
    await action().click();
    eq(await rows.count(),4,`${label}: a fourth card was added`);
    const added=await rows.nth(1).innerText();
    ok(/Level 3 riser/.test(added)&&/New/i.test(added),`${label}: the new card sits straight after its source with the location filled in: ${added}`);
    ok(wide?(await rows.nth(1).getAttribute('aria-current'))==='true':(await rows.nth(1).getAttribute('aria-expanded'))==='true',`${label}: the new card is open`);
    ok(await page.getByText('What kind of update is this?').first().isVisible(),`${label}: the new card asks for its kind`);
    await shot(page,`same-location-${scheme}-${width}-pick`);
    await page.locator('.eng-pick:visible').getByRole('button',{name:/Progress/}).first().click();
    const where=page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card').getByLabel('Where',{exact:true});
    eq(await where.inputValue(),'Level 3 riser',`${label}: Where is filled in`);
    const card=page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card');
    eq(await card.locator('img').count(),0,`${label}: no photograph came across`);
    eq(await card.locator('textarea').first().inputValue(),'',`${label}: the new card has no words`);
    // Open on a phone, the row is only the card's heading; side by side it still summarises.
    if(wide)ok(/0 photographs/.test(await rows.nth(1).innerText())&&/Nothing written yet/.test(await rows.nth(1).innerText()),`${label}: the new card's row has no words and no photos`);
    await shot(page,`same-location-${scheme}-${width}-new`);
    // A second one from the source goes after the first, keeping the order added.
    await open(0);
    await action().click();
    eq(await rows.count(),5,`${label}: a fifth card was added`);
    ok(/Choose a kind|New/i.test(await rows.nth(2).innerText())&&/Progress/i.test(await rows.nth(1).innerText()),`${label}: the second new card goes after the first, not before it`);
    await page.getByText('Saved to RELAY',{exact:true}).waitFor({state:'attached'});
    // The server's copy: location only, everything else blank, the source untouched.
    let saved;for(let n=0;n<20;n++){saved=getRecord('reports',draft.id);if(saved.observations.length===5)break;await new Promise(r=>setTimeout(r,250));}
    const obs=saved.observations;
    eq(obs.length,5,`${label}: five cards on the server`);
    eq(obs[0].id,ids[0],`${label}: source still first`);
    eq(obs[0].photos.length,1,`${label}: the source keeps its photograph`);
    for(const n of [1,2]){
      const o=obs[n];
      eq(o.location,'Level 3 riser',`${label}: card ${n+1} location saved`);
      ok(o.whatHappened===''&&o.actionNeeded===''&&o.owner===''&&o.photos.length===0,`${label}: card ${n+1} has no words or photos`);
      ok(o.linkedIssueId===undefined&&o.variationReason===undefined&&o.workDone===undefined&&o.askedBy===undefined&&o.roughSize===undefined,`${label}: card ${n+1} has no variation answers or link`);
      ok(![ids[0],ids[1],ids[2]].includes(o.id),`${label}: card ${n+1} has its own id`);
    }
    eq(obs[1].type,'update',`${label}: the first new card is the kind picked`);
    eq(obs[3].id,ids[1],`${label}: the plant room card comes after the riser run`);
    eq(await overflow(),false,`${label}: no sideways scroll at the end`);
    assert.deepEqual(errors,[],`${label}: no page errors`);
    await context.close();
  }
  console.log(`Passed ${checks} same location checks (390px light, 1440px dark).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
