// Browser check for the report editor on tablets and desktops (2026-10-21).
// Walks a site update and a weekly safety inspection (plus the first check of
// the other three inspections) at 390 (phone), 768 and 1024 (tablet, touch),
// 1366 and 1920 (desktop, mouse), light and dark.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-editor-wide-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const sessionFor=name=>{const principal={id:`entra:wide-${name}`,oid:`wide-${name}`,name:`Wide ${name}`,email:`wide-${name}@example.test`,role:'Engineer',trade:'Electrical'};const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const port=4377,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-editor-wide-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const photo=async colour=>({name:`p-${colour.slice(1)}.jpg`,mimeType:'image/jpeg',buffer:await sharp({create:{width:1200,height:900,channels:3,background:colour}}).jpeg().toBuffer()});
const VIEWS=[[390,844,true],[768,1024,true],[1024,768,true],[1366,768,false],[1920,1080,false]];
const only=process.env.RELAY_WIDTHS?process.env.RELAY_WIDTHS.split(',').map(Number):null;
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const [width,height,touch] of VIEWS) for(const scheme of ['light','dark']){
    if(only&&!only.includes(width))continue;
    const label=`${scheme} ${width}`;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,hasTouch:touch,isMobile:touch});
    await context.addCookies([{name:'relay_session',value:sessionFor(`${scheme}-${width}`),url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async(name,full=false)=>{if(screenshot){await page.waitForTimeout(350);await page.screenshot({path:join(screenshot,`${name}-${scheme}-${width}.png`),fullPage:full});}};
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const covered=[];const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));try{if(touch)await locator.tap({timeout:4000});else await locator.click({timeout:4000});}catch(e){if(!/intercepts pointer events/.test(e.message))throw e;covered.push(await locator.innerText());await locator.dispatchEvent('click');}};
    const openBody=()=>page.locator(width<900?'.eng-slot.open':'#card-editor > div:not([hidden])');
    // Scrolled to the very bottom, the last thing on the page sits above the bar.
    const clearOfBar=async(selector,what)=>{await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(150);
      const r=await page.evaluate(sel=>{const el=[...document.querySelectorAll(sel)].filter(e=>e.offsetParent).at(-1),bar=document.querySelector('.actionbar');return el&&bar?{bottom:el.getBoundingClientRect().bottom,bar:bar.getBoundingClientRect().top,shown:getComputedStyle(bar).display!=='none'}:null;},selector);
      ok(r&&(!r.shown||r.bottom<=r.bar+1),`${label}: ${what} is above the bottom bar (${JSON.stringify(r)})`);};
    const wide=width>=900;

    try {
    // A site update: progress with two photographs, then a defect.
    await page.goto(`${base}/engineer`);await tap(page.getByText('Start a site update'));
    await page.waitForURL(/\/reports\//);await page.locator('.eng-tile').first().waitFor();
    await shot('update-new');
    await tap(page.locator('.eng-tile').first());
    let card=openBody();
    await card.getByLabel('Where',{exact:true}).fill('Level 2 corridor');
    await card.locator('textarea').first().fill('Containment run complete to the riser; second fix lighting started in 2.04.');
    await card.locator('input[type=file]').setInputFiles([await photo('#886644'),await photo('#446688')]);
    await card.locator('.shot img').nth(1).waitFor();
    eq(await overflow(),false,`${label}: no sideways scroll with a card open`);
    await shot('update-card');
    await page.evaluate(()=>document.activeElement?.blur());
    await clearOfBar('.eng-add','"+ Add a card"');
    if(width>600){
      const line=await page.evaluate(()=>{const head=document.querySelector('.pagehead').getBoundingClientRect(),bar=document.querySelector('.actionbar-inner'),b=bar.getBoundingClientRect(),button=bar.querySelector('.btn-primary').getBoundingClientRect(),save=bar.querySelector('.savestate').getBoundingClientRect();return {left:Math.abs(save.left-head.left),right:Math.abs(button.right-head.right),inner:b.width};});
      ok(line.left<=2&&line.right<=2,`${label}: the bottom bar lines up with the page (${JSON.stringify(line)})`);
    }
    await tap(page.locator('.eng-add').first());
    await tap(page.locator('.eng-tile.defect').first());
    card=openBody();
    await card.getByLabel('Where',{exact:true}).fill('Riser 2, level 3');
    await card.locator('textarea').first().fill('Fire stopping missing around the cable tray.');
    await card.locator('input[type=file]').setInputFiles([await photo('#994433')]);
    await card.locator('.shot img').first().waitFor();
    const fireStopping=card.locator('.eng-linkrow',{hasText:'Fire stopping missing'});
    const linking=await fireStopping.count()>0;
    if(linking){
      // An issue raised on an earlier run, by P&H: linking to it takes its trade.
      eq(await card.getByRole('group',{name:/Trade affected/}).getByRole('button',{name:'Electrical'}).getAttribute('aria-pressed'),'true',`${label}: a new defect starts with the engineer's own trade`);
      await tap(fireStopping.first());
      eq(await card.getByRole('group',{name:/Trade affected/}).getByRole('button',{name:'P&H'}).getAttribute('aria-pressed'),'true',`${label}: linking to the P&H issue sets the trade to P&H`);
    } else await tap(card.getByRole('group',{name:/Trade affected/}).getByRole('button',{name:'P&H'}));
    await shot('update-defect');
    await page.evaluate(()=>document.activeElement?.blur());await tap(page.locator('.actionbar').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check').waitFor();
    await page.getByText('Saved on server',{exact:true}).waitFor({timeout:15000});
    eq(await overflow(),false,`${label}: no sideways scroll on the check step`);
    const raised=(await page.locator('.eng-does .eng-row b').first().innerText()).trim();
    eq(raised,linking?'1 added to an issue already raised · not yet reviewed':'1 issue raised · not yet reviewed',`${label}: what sending does counts a linked defect apart`);
    await shot('update-check');await shot('update-check-full',true);
    await clearOfBar('.eng-check-sign .hint, .eng-check-sign .btn-row','the signature hint');
    await tap(page.getByRole('button',{name:'Send to office'}));
    await page.locator('.pagehead .tag-sent').waitFor();
    await shot('update-sent');await shot('update-sent-full',true);
    ok(await page.locator('.sec>h2.lbl').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<=11),`${label}: the sent screen's count is a small label, not a heading`);

    // A weekly safety inspection: answer everything, one action, sign, send.
    await page.goto(`${base}/engineer`);await tap(page.getByText(/Do a safety inspection/));
    await page.waitForURL(/\/reports\//);await page.locator('.eng-cardrow').first().waitFor();
    await shot('inspection-new');
    const rows=await page.locator('.eng-cardrow').count();
    for(let i=0;i<rows;i++){
      // The first check from the list, then each next one by "Next check", as an engineer goes.
      if(i===0){const row=page.locator('.eng-cardrow').first();if(!(await row.getAttribute('class')).includes(' on '))await tap(row);}
      else await tap(page.locator('.eng-next-check:visible'));
      await page.locator('.eng-cardrow.on').nth(0).waitFor();
      eq(await page.locator('.eng-cardrow.on .no').first().innerText(),String(i+1).padStart(2,'0'),`${label}: "Next check" opens check ${i+1}`);
      const body=openBody();
      const answer=i===2?/Action needed/:i===rows-1?/Not applicable/:/Satisfactory/;
      await tap(body.getByRole('button',{name:answer}));
      if(i===2){
        await body.getByLabel('What’s wrong').fill('Edge protection missing on the landing.');
        await body.getByLabel('What needs doing').fill('Fit edge protection before anyone works above.');
        await body.getByLabel('Who is to do it').fill('Scaffold contractor');
        await body.locator('input[type=file]').setInputFiles([await photo('#aa3322')]);
        await body.locator('.shot img').first().waitFor();
        await shot('inspection-action');
      }
    }
    if(wide){
      // Stuck under the header (top 70px), the list's own column ends above the bar.
      const rail=await page.evaluate(()=>{const r=document.querySelector('.eng-rail').getBoundingClientRect(),bar=document.querySelector('.actionbar').getBoundingClientRect();return {height:r.height,room:bar.top-70};});
      ok(rail.height<=rail.room,`${label}: the list of checks fits between the header and the bar (${JSON.stringify(rail)})`);
      const seen=await page.evaluate(()=>{const rail=document.querySelector('.eng-rail'),row=rail.querySelector('[aria-current="true"]').getBoundingClientRect(),b=rail.getBoundingClientRect();return {ok:row.top>=b.top-1&&row.bottom<=b.bottom+1,row:[row.top,row.bottom],rail:[b.top,b.bottom],scroll:[rail.scrollTop,rail.scrollHeight,rail.clientHeight]};});
      ok(seen.ok,`${label}: the open check is in sight in the list (${JSON.stringify(seen)})`);
    }
    await page.evaluate(()=>document.activeElement?.blur());await tap(page.locator('.actionbar').getByRole('button',{name:/Check & send/}));
    await page.locator('#report-check').waitFor();
    await page.getByText(/All 12 checks/).waitFor({timeout:15000});
    await shot('inspection-check');await shot('inspection-check-full',true);
    const pad=page.locator('canvas.sigpad');await pad.evaluate(e=>e.scrollIntoView({block:'center'}));await page.waitForTimeout(200);
    const box=await pad.boundingBox();
    ok(box.height>=(width>600?178:148),`${label}: the signature box is tall enough to sign in (${box.height}px)`);
    if(width>=1000){
      const side=await page.evaluate(()=>{const m=document.querySelector('.eng-check-main').getBoundingClientRect(),g=document.querySelector('.eng-check-sign').getBoundingClientRect();return {main:m.right,sign:g.left,top:Math.abs(m.top-g.top)};});
      ok(side.sign>side.main&&side.top<40,`${label}: signing sits beside what is being sent (${JSON.stringify(side)})`);
      ok(box.width<=460,`${label}: the signature box is a signature's width, not the page's (${box.width}px)`);
    } else ok(await page.evaluate(()=>document.querySelector('.eng-check-sign').getBoundingClientRect().top>document.querySelector('.eng-check-main').getBoundingClientRect().bottom-1),`${label}: signing comes after what is being sent`);
    eq(await page.locator('#sign-pad-label').evaluate(e=>getComputedStyle(e).textTransform),'uppercase',`${label}: "Signature" is labelled like the other fields`);
    await shot('inspection-sign');
    if(touch){
      // A finger, through the browser's own touch input.
      const cdp=await context.newCDPSession(page);
      const at=i=>({x:box.x+30+i*(box.width-60)/14,y:box.y+box.height*(.6-.3*Math.sin(i/2))});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[at(0)]});
      for(let i=1;i<=14;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[at(i)]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    } else {
      await page.mouse.move(box.x+30,box.y+box.height*.6);await page.mouse.down();
      for(let i=1;i<=14;i++)await page.mouse.move(box.x+30+i*(box.width-60)/14,box.y+box.height*(.6-.3*Math.sin(i/2)));
      await page.mouse.up();
    }
    await page.getByLabel('Your name').fill(`Wide ${scheme}`).catch(()=>{});
    await page.waitForFunction(()=>!document.querySelector('.actionbar .btn-primary')?.disabled,null,{timeout:10000});
    await page.evaluate(()=>document.activeElement?.blur());
    await shot('inspection-signed');
    // In Chromium's touch emulation the first tap after a drawn stroke gives no
    // click (seen with any target, not with a mouse); a tap on the page clears it.
    if(touch){await page.touchscreen.tap(5,300);await page.waitForTimeout(300);}
    await tap(page.getByRole('button',{name:'Send to office'}));
    await page.locator('.pagehead .tag-sent').waitFor();
    await shot('inspection-sent');await shot('inspection-sent-full',true);

    // The other inspections: the first check of each.
    for(const [name,start,inspects] of [['handover',/Do a handover inspection/],['first-fix',/Do a first fix inspection/],['tower',/Do a tower inspection/,'Tower A']]){
      await page.goto(`${base}/engineer`);await tap(page.getByText(start));
      if(inspects){const form=page.locator('.eng-tile-form');await form.locator('input').fill(inspects);await tap(form.getByRole('button',{name:/^Start the/}));}
      await page.waitForURL(/\/reports\//);await page.locator('.eng-cardrow').first().waitFor();
      if(width<900)await tap(page.locator('.eng-cardrow').first());
      await tap(openBody().getByRole('button',{name:/Action needed/}));
      await shot(`${name}-action`);
    }
    } catch(e){if(screenshot)await page.screenshot({path:join(screenshot,`FAILED-${scheme}-${width}.png`),fullPage:true});throw e;}
    eq(covered.length,0,`${label}: nothing tapped was under the bottom bar (${covered.join(' | ')})`);
    eq(errors.length,0,`${label}: no page errors (${errors.join('; ')})`);
    await context.close();
  }
  console.log(`verify-editor-wide: ${checks} checks passed`);
} finally {await browser?.close();server.kill();}
