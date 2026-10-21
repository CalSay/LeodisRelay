// Browser check for FE-1d: removing a card or a photograph offers Undo, and
// Undo puts back the same card or photograph (same ids, photos included)
// without a second copy being saved or a photograph being sent again.
// Checked at 390px light and 1440px dark against the server's copy.
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
const root=mkdtempSync(join(tmpdir(),'relay-undo-remove-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:undo-engineer',oid:'undo-engineer',name:'Undo Engineer',email:'undo@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const sharp=require('sharp');
const png=async colour=>({name:`${colour.slice(1)}.png`,mimeType:'image/png',buffer:await sharp({create:{width:24,height:24,channels:3,background:colour}}).png().toBuffer()});
const seed=()=>{
  const draft=createReport('proj-011lme',principal.name,principal);
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  putRecord('reports',{...draft,observations:[
    {id:ids[0],type:'defect',location:'Level 2 riser',whatHappened:'Cracked cable tray',actionNeeded:'Replace the section',owner:'',affectedTrade:'Electrical',photos:[]},
    {id:ids[1],type:'update',location:'Plant room',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]},
    {id:ids[2],type:'update',location:'Roof',whatHappened:'Lights fixed',actionNeeded:'',owner:'',photos:[]},
  ]});
  return {draft,ids};
};
const port=4337,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-undo-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await sleep(500);}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`)});};
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    const label=`${scheme} ${width}px`,wide=width>=900;
    const {draft,ids}=seed();
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Every save of this draft and every photograph upload, to prove Undo saves once and uploads nothing.
    let saves=0,uploads=0;
    page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes(`/api/reports/${draft.id}`))saves++;if(r.method()==='PUT'&&r.url().includes('/api/media/'))uploads++;});
    await page.goto(`${base}/reports/${draft.id}`);
    const rows=page.locator('.eng-cardrow');
    await rows.first().waitFor();
    const card=()=>page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card');
    const open=async i=>{if(wide?(await rows.nth(i).getAttribute('aria-current'))!=='true':(await rows.nth(i).getAttribute('aria-expanded'))!=='true')await rows.nth(i).click();};
    const bar=page.locator('.eng-undo');
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const stored=async(test,what)=>{let saved;for(let n=0;n<40;n++){saved=getRecord('reports',draft.id);if(test(saved))return saved;await sleep(250);}assert.fail(`${label}: server never showed ${what}: ${JSON.stringify(saved.observations.map(o=>[o.id,o.photos.length]))}`);};
    const settle=async()=>{await page.getByText('Saved on server',{exact:true}).first().waitFor({state:'attached'});await sleep(900);};
    eq(await bar.count(),0,`${label}: no undo bar before anything is removed`);
    // Two photographs taken on the defect card the usual way, so they are uploaded once.
    await open(0);
    await card().locator('input[type=file]').setInputFiles([await png('#997744'),await png('#335577')]);
    await card().locator('.shot img').nth(1).waitFor();
    await card().getByLabel('Caption for photograph 1',{exact:true}).fill('Tray joint');
    const withPhotos=await stored(r=>r.observations[0].photos.length===2&&r.observations[0].photos[0].caption==='Tray joint','the photographs');
    const photos=withPhotos.observations[0].photos.map(p=>p.id);
    await settle();
    ok(uploads>=2,`${label}: the photographs were uploaded (${uploads})`);

    // 1. Remove the defect card and let the removal reach the server.
    await open(0);
    await card().getByRole('button',{name:'Remove card 1',exact:true}).click();
    eq(await rows.count(),2,`${label}: the card is gone from the list`);
    await bar.waitFor();
    const text=await bar.innerText();
    ok(/Card 01 removed/.test(text)&&/Defect/.test(text)&&/Level 2 riser/.test(text)&&/2 photographs/.test(text),`${label}: the bar says what was removed: ${text}`);
    const undo=bar.getByRole('button',{name:'Undo',exact:true});
    ok(await undo.isVisible(),`${label}: Undo is visible`);
    const box=await undo.boundingBox();
    ok(box&&box.height>=44&&box.y+box.height<=height,`${label}: Undo is a full-size target on screen`);
    eq(await overflow(),false,`${label}: no sideways scroll with the bar showing`);
    await page.waitForFunction(()=>/Card 01 removed/.test(document.querySelector('.eng-undo-said')?.textContent??''));checks++;
    eq(await page.evaluate(()=>document.activeElement?.textContent),'Undo',`${label}: focus moves to Undo once the Remove button has gone`);
    await shot(page,`undo-card-${scheme}-${width}`);
    await stored(r=>r.observations.length===2,'the removal');
    await settle();
    const savesBefore=saves,uploadsBefore=uploads;
    await undo.click();
    eq(await bar.count(),0,`${label}: the bar goes once used`);
    eq(await rows.count(),3,`${label}: the card is back in the list`);
    // Open on a phone, its row is only its heading; its two photographs are counted in the card below.
    ok(/Level 2 riser/.test(await rows.nth(0).innerText())&&(!wide||/2 photographs/.test(await rows.nth(0).innerText())),`${label}: it is back first${wide?', with its two photos':''}`);
    ok(wide?(await rows.nth(0).getAttribute('aria-current'))==='true':(await rows.nth(0).getAttribute('aria-expanded'))==='true',`${label}: the restored card is open`);
    // Side by side focus is on the card's Remove; on a phone Remove is at the card's foot, so focus is on its row instead.
    await page.waitForFunction(wide=>wide?document.activeElement?.getAttribute('aria-label')==='Remove card 1':document.activeElement===document.querySelector('.eng-cardrow'),wide);checks++;
    eq(await card().getByLabel('What needs doing',{exact:true}).inputValue(),'Replace the section',`${label}: its words are back`);
    eq(await card().locator('.shot img').count(),2,`${label}: its photographs are back`);
    let saved=await stored(r=>r.observations.length===3,'the card put back');
    await settle();
    assert.deepEqual(saved.observations.map(o=>o.id),ids,`${label}: the same three cards, same ids, same order`);checks++;
    assert.deepEqual(saved.observations[0].photos.map(p=>p.id),photos,`${label}: the same photographs, same ids`);checks++;
    eq(saved.observations[0].photos[0].caption,'Tray joint',`${label}: the caption came back`);
    eq(saves-savesBefore,1,`${label}: putting it back was one save`);
    eq(uploads-uploadsBefore,0,`${label}: no photograph was sent again`);

    // 2. Remove and undo straight away: the removal never needs to be saved.
    await settle();
    const quickBefore=saves;
    await open(1);
    await card().getByRole('button',{name:'Remove card 2',exact:true}).click();
    await bar.getByRole('button',{name:'Undo',exact:true}).click();
    await settle();
    eq(saves-quickBefore,1,`${label}: a quick remove and undo is one save, not two`);
    saved=getRecord('reports',draft.id);
    assert.deepEqual(saved.observations.map(o=>o.id),ids,`${label}: still the same three cards after a quick undo`);checks++;

    // 3. Remove a photograph, then undo it.
    await open(0);
    await card().getByRole('button',{name:'Remove photo 1',exact:true}).click();
    eq(await card().locator('.shot img').count(),1,`${label}: the photograph is gone from the card`);
    await bar.waitFor();
    ok(/Photograph 01 removed/.test(await bar.innerText())&&/Tray joint/.test(await bar.innerText()),`${label}: the bar names the photograph`);
    await shot(page,`undo-photo-${scheme}-${width}`);
    await stored(r=>r.observations[0].photos.length===1,'the photograph removed');
    await settle();
    const photoBefore=saves,photoUploads=uploads;
    await bar.getByRole('button',{name:'Undo',exact:true}).click();
    eq(await card().locator('.shot img').count(),2,`${label}: the photograph is back`);
    eq(await card().getByLabel('Caption for photograph 1',{exact:true}).inputValue(),'Tray joint',`${label}: back in first place with its caption`);
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Remove photo 1');checks++;
    saved=await stored(r=>r.observations[0].photos.length===2,'the photograph put back');
    await settle();
    assert.deepEqual(saved.observations[0].photos.map(p=>p.id),photos,`${label}: same photographs in the same order on the server`);checks++;
    eq(saves-photoBefore,1,`${label}: putting the photograph back was one save`);
    eq(uploads-photoUploads,0,`${label}: the photograph was not sent again`);

    // 3b. Photo numbers repeat across cards: undo on the second card's photo 1 focuses that card's button.
    await open(1);
    await card().locator('input[type=file]').setInputFiles([await png('#558833')]);
    await card().locator('.shot img').first().waitFor();
    await stored(r=>r.observations[1].photos.length===1,'the second card photograph');
    await settle();
    await card().getByRole('button',{name:'Remove photo 1',exact:true}).click();
    await bar.getByRole('button',{name:'Undo',exact:true}).click();
    eq(await card().locator('.shot img').count(),1,`${label}: the second card's photograph is back`);
    await page.waitForFunction(()=>{const a=document.activeElement;return a?.getAttribute('aria-label')==='Remove photo 1'&&!!a.offsetParent;});checks++;
    ok(await card().getByRole('button',{name:'Remove photo 1',exact:true}).evaluate(b=>b===document.activeElement),`${label}: focus is on the restored photograph's own card`);
    await settle();

    // 4. A second removal replaces the first; closing the bar keeps the removal.
    await open(2);
    await card().getByRole('button',{name:'Remove card 3',exact:true}).click();
    await open(0);
    await card().getByRole('button',{name:'Remove photo 2',exact:true}).click();
    eq(await bar.count(),1,`${label}: one bar at a time`);
    ok(/Photograph 02 removed/.test(await bar.innerText()),`${label}: the bar offers the latest removal`);
    await bar.getByRole('button',{name:'Dismiss',exact:true}).click();
    eq(await bar.count(),0,`${label}: Dismiss closes the bar`);
    await page.waitForFunction(()=>document.activeElement?.matches('.eng-steps [aria-current="step"]'));checks++;
    saved=await stored(r=>r.observations.length===2&&r.observations[0].photos.length===1,'both removals kept');
    eq(saved.observations.some(o=>o.id===ids[2]),false,`${label}: the dismissed removal stands`);

    // 5. The offer runs out on its own.
    if(!wide){
      await open(1);
      await card().getByRole('button',{name:'Remove card 2',exact:true}).click();
      await bar.waitFor();
      await sleep(13000);
      eq(await bar.count(),1,`${label}: the bar stays while Undo has focus`);
      await page.locator('h1').click();
      await sleep(13000);
      eq(await bar.count(),0,`${label}: the bar goes by itself once left`);
    }
    eq(await overflow(),false,`${label}: no sideways scroll at the end`);
    assert.deepEqual(errors,[],`${label}: no page errors`);
    await context.close();
  }
  console.log(`Passed ${checks} undo checks (390px light, 1440px dark).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
