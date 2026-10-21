// Browser check for the report editor flow (UI direction item 2, FE-1a): on
// the phone every card folds to a one-line summary, one card opens at a time
// under its own row, and "Check & send" is a separate final step whose action
// bar steps aside while a field has the keyboard. Wide screens keep the cards
// rail beside the open card.
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
const root=mkdtempSync(join(tmpdir(),'relay-report-editor-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:editor-engineer',oid:'editor-engineer',name:'Editor Engineer',email:'editor@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const draft=createReport('proj-011lme',principal.name,principal);
const cards=[
  {id:randomUUID(),type:'update',location:'Level 2 corridor',whatHappened:'Containment run complete from riser to plant room',actionNeeded:'',owner:'',photos:[]},
  {id:randomUUID(),type:'defect',location:'Level 3 riser',whatHappened:'Fire stopping missing around cable tray',actionNeeded:'Make good',owner:'',affectedTrade:'Electrical',photos:[]},
  {id:randomUUID(),type:'instruction',location:'Plant room',whatHappened:'Extra socket asked for by the client',actionNeeded:'',owner:'',photos:[]},
];
putRecord('reports',{...draft,observations:cards});
const port=4334,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-editor-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name,fullPage=false)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`),fullPage});};
  for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/reports/${draft.id}`);
    const rows=page.locator('.eng-cardrow');
    await rows.first().waitFor();
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const visibleEditors=()=>page.locator('.eng-card:visible').count();
    // Folded: three one-line summaries and no open card, so the draft fits on about one screen.
    eq(await rows.count(),3,`${scheme}: three card rows`);
    eq(await visibleEditors(),0,`${scheme}: every card starts folded on the phone`);
    for(const i of [0,1,2])eq(await rows.nth(i).getAttribute('aria-expanded'),'false',`${scheme}: row ${i+1} folded`);
    const row=await rows.nth(2).innerText();
    ok(/Plant room/.test(row)&&/Extra socket asked for/.test(row)&&/0 photographs/.test(row),`${scheme}: summary row shows location, description and photo count`);
    ok(/needs at least one photograph/.test(await rows.nth(1).innerText()),`${scheme}: a card that would stop sending says why`);
    const folded=await page.evaluate(()=>document.documentElement.scrollHeight);
    ok(folded<1300,`${scheme}: folded draft is short (${folded}px)`);
    eq(await overflow(),false,`${scheme}: no sideways scroll when folded`);
    eq(await page.getByText('Sign here').count(),0,`${scheme}: signature is not on the cards step`);
    eq(await page.getByRole('button',{name:'Send to office'}).count(),0,`${scheme}: sending is the final step, not the cards step`);
    await shot(page,`editor-${scheme}-folded`);
    // Open one card: only that one unfolds, under its own row, without the repeated "Selected" line.
    await rows.nth(2).click();
    eq(await rows.nth(2).getAttribute('aria-expanded'),'true',`${scheme}: tapped row opens`);
    eq(await visibleEditors(),1,`${scheme}: one card open at a time`);
    const below=await page.evaluate(()=>{const r=[...document.querySelectorAll('.eng-cardrow')][2].getBoundingClientRect(),c=[...document.querySelectorAll('.eng-card')].find(e=>e.offsetParent).getBoundingClientRect();return c.top>=r.bottom-1&&c.top-r.bottom<4;});
    ok(below,`${scheme}: open card sits directly under its row`);
    eq(await page.getByText(/Selected:/).count(),0,`${scheme}: no repeated "Selected" line`);
    eq(await overflow(),false,`${scheme}: no sideways scroll with a card open`);
    await shot(page,`editor-${scheme}-open`);
    // Typing: the action bar steps aside so it never covers the field.
    const where=page.locator('.eng-slot.open').getByLabel('Where',{exact:true});
    await where.click();
    ok(!(await page.locator('.actionbar').isVisible()),`${scheme}: action bar hidden while a field has the keyboard`);
    if(scheme==='light'){await where.fill('Plant room east');await page.getByText('Saved on server',{exact:true}).waitFor({state:'attached'});}
    await shot(page,`editor-${scheme}-typing`);
    await page.locator('.eng-slot.open .eng-done').click();
    ok(await page.locator('.actionbar').isVisible(),`${scheme}: action bar back once the field is left`);
    eq(await visibleEditors(),0,`${scheme}: "Done with this card" folds it`);
    ok(/Plant room east/.test(await rows.nth(2).innerText()),`${scheme}: folded row shows the edit`);
    // Check & send is its own step, Back returns to the cards.
    await page.locator('.actionbar').getByRole('button',{name:'Check & send →'}).click();
    await page.getByText('Sign here').waitFor();
    ok(page.url().endsWith('#check'),`${scheme}: check step has its own history entry`);
    eq(await rows.count(),0,`${scheme}: cards are not on the check step`);
    ok(await page.getByRole('button',{name:'Send to office'}).isDisabled(),`${scheme}: a stop finding blocks sending`);
    eq(await overflow(),false,`${scheme}: no sideways scroll on the check step`);
    await shot(page,`editor-${scheme}-check`);await shot(page,`editor-${scheme}-check-full`,true);
    await page.goBack();await rows.first().waitFor();
    ok(!page.url().includes('#check'),`${scheme}: Back returns to the cards`);
    // A finding on the check step opens the card it is about.
    await page.locator('.actionbar').getByRole('button',{name:'Check & send →'}).click();
    await page.locator('.find-stop').first().click();
    await rows.first().waitFor();
    eq(await rows.nth(1).getAttribute('aria-expanded'),'true',`${scheme}: tapping a finding opens its card`);
    // Wide screens keep the rail beside the open card.
    await page.setViewportSize({width:1440,height:900});
    await page.locator('.eng-editor-grid').waitFor();
    eq(await page.locator('.eng-rail .eng-cardrow').count(),3,`${scheme}: wide screen keeps the cards rail`);
    eq(await visibleEditors(),1,`${scheme}: wide screen shows the open card beside the rail`);
    eq(await overflow(),false,`${scheme}: no sideways scroll at 1440px`);
    await shot(page,`editor-${scheme}-1440`);
    assert.deepEqual(errors,[],`${scheme}: no page errors`);
    await context.close();
  }
  console.log(`Passed ${checks} report editor checks (390px and 1440px, light and dark).`);
} finally {
  await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});
}
