// Browser check for "no red on a card you are still filling in" (2026-10-22).
// A card the engineer has just started (blank, or from "+ Another card here")
// does not turn red, nor put a red count on Check & send, while it is still
// open: typing "Where" first should not read as a mistake before they reach
// "What happened" or the camera. Once they leave the card (Done, another card)
// or go to Check & send, what is missing shows in red as before, and a card
// opened again from a Stop still says what stops it, whichever card was
// open before. Phone 390 and wide 1440.
// npm test && npm run build first.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-calm-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const sessionFor=name=>{const principal={id:`entra:calm-${name}`,oid:`calm-${name}`,name:`Calm ${name}`,email:`calm-${name}@example.test`,role:'Engineer',trade:'Electrical'};const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4391,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-calm-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  for(const [width,height,phone] of [[390,844,true],[1440,900,false]]){
    const who=phone?'phone':'wide';
    const context=await browser.newContext({viewport:{width,height},colorScheme:'light',...(phone?{hasTouch:true,isMobile:true}:{})});
    await context.addCookies([{name:'relay_session',value:sessionFor(who),url:base}]);
    await context.addInitScript(id=>{try{if(!localStorage.getItem(`relay-project:${id}`))localStorage.setItem(`relay-project:${id}`,'proj-011lme');}catch{}},`entra:calm-${who}`);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const at=`${width}px`;
    const editor=phone?page.locator('.eng-slot.open'):page.locator('#card-editor > div:not([hidden])');
    const tapOn=async l=>{await l.evaluate(e=>e.scrollIntoView({block:'center'}));phone?await l.tap():await l.click();};
    const rows=page.locator('.eng-cardrow');
    /** The red number on Check & send: things that stop the update being sent. */
    const tabCount=async()=>{const l=page.locator('.eng-steps small.late');return await l.count()?parseInt(await l.textContent(),10):0;};
    const red=async n=>(await rows.nth(n).getAttribute('class')).split(/\s+/).includes('late');
    const settle=()=>page.waitForTimeout(400);

    await page.goto(`${base}/engineer`);
    await tapOn(page.getByRole('button',{name:/Start today’s site update/}));
    await page.waitForURL(/\/reports\//);
    if(!phone&&!await editor.getByLabel('Where',{exact:true}).count())await tapOn(rows.first());
    await editor.getByLabel('Where',{exact:true}).waitFor();

    // 1. Where typed, nothing else yet: no red anywhere.
    await editor.getByLabel('Where',{exact:true}).fill('Level 2 corridor');await settle();
    eq(await red(0),false,`${at}: the card being filled in is not red after typing Where`);
    eq(await tabCount(),0,`${at}: Check & send has no red count yet`);
    eq(await page.getByText(/no description of what happened/).count(),0,`${at}: no "no description" warning while writing`);
    if(!phone)eq(await page.locator('.eng-finds .find-stop').count(),0,`${at}: the side list has no Stop for it`);
    await editor.locator('textarea').first().fill('Containment run complete to grid C');await settle();

    // 2. A defect: calm while being written, red once left without its photograph.
    await tapOn(page.locator('.eng-add-kinds').getByRole('button',{name:'+ Defect'}));
    await editor.getByLabel('Where',{exact:true}).waitFor();
    eq(await rows.count(),2,`${at}: a second card`);
    await editor.getByLabel('Where',{exact:true}).fill('Riser 3');
    await editor.locator('textarea').first().fill('Fire stopping missing round tray');await settle();
    eq(await red(1),false,`${at}: the new defect with no photo yet is not red while open`);
    eq(await tabCount(),0,`${at}: still no red count while the defect is open`);
    if(phone)await tapOn(editor.getByRole('button',{name:'Done with this card'}));
    else await tapOn(rows.first());
    await settle();
    eq(await red(1),true,`${at}: once left, the defect is red`);
    ok(/needs at least one photograph/.test(await rows.nth(1).innerText()),`${at}: and says it needs a photograph`);
    eq(await tabCount(),1,`${at}: Check & send shows 1`);
    // Opened again, it is no longer new: the warning stays.
    await tapOn(rows.nth(1));await settle();
    eq(await red(1),true,`${at}: opened again, the defect is still red`);
    eq(await tabCount(),1,`${at}: and the count stays`);

    // 3. "+ Another card here" is a new card too.
    await tapOn(editor.locator('.eng-same-place'));
    await settle();
    eq(await rows.count(),3,`${at}: a third card at the same place`);
    eq(await red(2),false,`${at}: the card from "+ Another card here" is not red while it is chosen and filled in`);
    eq(await tabCount(),1,`${at}: only the defect counts`);
    await tapOn(editor.locator('.eng-tile').filter({hasText:'Progress'}));
    await editor.locator('textarea').first().waitFor();await settle();
    eq(await red(2),false,`${at}: still calm after choosing its kind`);

    // 4. Check & send: everything missing is listed, and a Stop opens its card still saying why.
    await tapOn(page.locator('.eng-steps').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check').waitFor();
    eq(await page.locator('#report-check .find-stop').count(),2,`${at}: Check & send stops on the defect photo and the empty third card`);
    ok(await page.getByRole('button',{name:'Send to office'}).isDisabled(),`${at}: it cannot be sent`);
    await tapOn(page.locator('#report-check .find-stop').filter({hasText:/no description/}));
    await settle();
    eq(await red(2),true,`${at}: the card opened from a Stop is red`);
    {const t=await rows.nth(2).innerText();ok(/no description of what happened/i.test(t),`${at}: and says what stops it (${t})`);}
    eq(await tabCount(),2,`${at}: Check & send shows 2`);

    // 5. A card from "+ Another card here" left with no kind chosen, then opened from its Stop, stays red.
    await tapOn(rows.first());
    await editor.locator('.eng-same-place').waitFor();
    await tapOn(editor.locator('.eng-same-place'));await settle();
    const unchosen=rows.filter({has:page.locator('.kind',{hasText:/^New$/})});
    eq(await unchosen.count(),1,`${at}: a fourth card waiting for its kind`);
    eq(await tabCount(),2,`${at}: calm while its kind is being chosen`);
    await tapOn(rows.first());await settle();
    eq(await tabCount(),3,`${at}: left without a kind, it counts`);
    await tapOn(unchosen);await settle();
    eq(await tabCount(),3,`${at}: opened again, it still counts`);
    await tapOn(rows.first());await settle();
    await tapOn(page.locator('.eng-steps').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check').waitFor();
    await tapOn(page.locator('#report-check .find-stop').filter({hasText:/Level 2 corridor: no description/}));
    await settle();
    ok((await unchosen.getAttribute('class')).split(/\s+/).includes('late'),`${at}: opened from its Stop, the card with no kind is red`);
    eq(await tabCount(),3,`${at}: and Check & send still shows 3`);
    eq(errors.length,0,`${at}: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
  console.log(`verify-calm-while-writing: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();
}
