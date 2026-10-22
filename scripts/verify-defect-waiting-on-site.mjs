// Browser check for a defect sent with no signal, seen from the Site page
// (2026-10-22): once the engineer moves on from "Defect not sent yet", the
// Site page's "Flag a defect" button says "Defect not sent yet" and opens it,
// with "Try again"; it says so again after RELAY is closed and reopened while
// the upload still gets no answer; a defect written but never sent leaves the
// button as it was; a defect waiting on another project is one line under the
// buttons and opens that project's defect; once the defect goes by itself the
// button goes back to "Flag a defect", and so it does when the engineer left
// for the Site page while a slow send was still going. 390px light and dark, 1440px dark. Simulated offline in
// a phone-sized browser, not a real phone or real weak signal.
// npm test && npm run build; RELAY_SCREENSHOT_DIR=<dir> saves screenshots
// (RELAY_SHOT_PREFIX names them, default "after").
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
const root=mkdtempSync(join(tmpdir(),'relay-defect-waiting-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord}=require('../apps/web/.test-build/lib/storage.js');
const MIN_TARGET=48;
const engineer={id:'entra:dwos-engineer',oid:'dwos-engineer',name:'Sam Sparks',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const sessionFor=n=>{const id=randomUUID();putRecord('sessions',{id,principal:{...engineer,id:`${engineer.id}-${n}`,oid:`${engineer.oid}-${n}`},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const P='proj-011lme',OTHER='proj-014lme';
const png=await sharp({create:{width:24,height:24,channels:3,background:'#997744'}}).png().toBuffer();
const port=4473,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-defect-waiting',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>ok(a===b,`${message} (got ${JSON.stringify(a)})`);
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR,prefix=process.env.RELAY_SHOT_PREFIX||'after';if(shots)mkdirSync(shots,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['dark',1440]]){
    const label=`${scheme} ${width}`,wide=width>=900,who=`${scheme}-${width}`;
    const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});
    await context.addCookies([{name:'relay_session',value:sessionFor(who),url:base}]);
    // Every defect upload passes here: `cut` gives it no answer, as with no signal; `slow` holds it 3 s, as on weak signal.
    let cut=false,slow=false;
    await context.route('**/api/issues',async route=>{if(route.request().method()!=='POST')return route.continue();if(cut)return route.abort('internetdisconnected');if(slow)await new Promise(r=>setTimeout(r,3000));return route.continue();});
    let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const shot=async name=>{if(shots){await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${prefix}-defect-waiting-${name}-${scheme}-${width}.png`),fullPage:!wide});}};
    const tap=async locator=>{await locator.evaluate(e=>e.scrollIntoView({block:'center'}));if(wide)await locator.click();else await locator.tap();};
    const issuesNamed=async (text,project=P)=>(await context.request.get(`${base}/api/issues?projectId=${project}`).then(r=>r.json())).issues.filter(i=>i.description===text);
    const notSent=()=>page.getByRole('heading',{name:'Defect not sent yet',exact:true});
    const tile=()=>page.locator('.eng-tiles-main .eng-tile').filter({has:page.locator('.tone-defect')});
    const elsewhere=()=>page.locator('.eng-held-defects .eng-row');
    const noSideways=async what=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label}: no sideways scrolling ${what}`);
    /** Fills a defect on `project`; with `send`, taps send with the signal off. */
    async function flag(text,project=P,send=true){
      await page.goto(`${base}/engineer?project=${project}&view=defect`);
      await page.getByLabel('Where on site?',{exact:true}).waitFor();
      await page.getByLabel('Defect photographs',{exact:true}).setInputFiles({name:'defect.png',mimeType:'image/png',buffer:png});
      await page.getByRole('button',{name:'Remove photo 1',exact:true}).waitFor();
      await page.getByLabel('What needs attention?',{exact:true}).fill(text);
      await page.getByLabel('Where on site?',{exact:true}).fill('Flat 4 kitchen');
      if(!send)return;
      await context.setOffline(true);
      await tap(page.getByRole('button',{name:/^Send defect to /}));
      await notSent().waitFor();
    }
    const home=async()=>{await tap(page.getByRole('button',{name:'Site',exact:true}));await page.locator('.eng-tiles-main').waitFor();};

    // 0. Before anything is held: the button is as it was.
    await page.goto(`${base}/engineer?project=${P}`);await tile().waitFor();
    eq((await tile().locator('b').innerText()).trim(),'Flag a defect',`${label}: nothing held, "Flag a defect"`);
    ok((await tile().innerText()).includes('sent straight away'),`${label}: nothing held, "sent straight away"`);
    eq(await elsewhere().count(),0,`${label}: nothing held, no line for another project`);

    // 1. Sent with no signal, then the engineer taps Site: the button says it is not sent yet.
    const first=`Cracked faceplate ${who}`;
    await flag(first);
    await home();
    await page.getByRole('button',{name:/Defect not sent yet/}).waitFor();
    eq((await tile().locator('b').innerText()).trim(),'Defect not sent yet',`${label}: the button says not sent yet`);
    ok((await tile().innerText()).includes('Only on this phone, not at the office yet. Tap to see it.'),`${label}: the button says it is only on this phone`);
    ok(!(await tile().innerText()).includes('sent straight away'),`${label}: no "sent straight away" while it waits`);
    ok((await tile().evaluate(e=>e.classList.contains('eng-tile-held'))),`${label}: the button is marked`);
    eq(await elsewhere().count(),0,`${label}: no line for another project when it is this one's`);
    ok((await tile().boundingBox()).height>=MIN_TARGET-0.5,`${label}: the button at least ${MIN_TARGET}px tall`);
    await noSideways('with the defect waiting');
    await shot('home-waiting');

    // 2. Tapping it opens the same defect, with Try again.
    await tap(tile());
    await notSent().waitFor();
    eq(await page.getByText(first,{exact:true}).count()>0,true,`${label}: the button opens the waiting defect`);
    ok(await page.getByRole('button',{name:'Try again',exact:true}).isVisible(),`${label}: with "Try again"`);

    // 3. RELAY closed and opened again, the upload still getting no answer: it still says so.
    await page.close();
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    // With signal for the page itself, but no answer to the defect's upload.
    cut=true;
    await context.setOffline(false);
    await page.goto(`${base}/engineer?project=${P}`);
    await page.getByRole('button',{name:/Defect not sent yet/}).waitFor();
    ok(true,`${label}: still says not sent yet after RELAY is opened again`);

    // 4. Signal back: it goes by itself and the button goes back.
    cut=false;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.locator('.held-send [role=status]').filter({hasText:'Defect sent to the office by itself'}).waitFor({timeout:20000});
    await page.getByRole('button',{name:/Flag a defect/}).waitFor();
    eq((await issuesNamed(first)).length,1,`${label}: the defect reached the office once`);
    eq((await tile().locator('b').innerText()).trim(),'Flag a defect',`${label}: once sent, "Flag a defect" again`);
    ok(!(await tile().evaluate(e=>e.classList.contains('eng-tile-held'))),`${label}: once sent, not marked`);
    await shot('home-sent');

    // 5. Written but never sent: nothing to say.
    await flag(`Not sent ${who}`,P,false);
    await home();
    eq((await tile().locator('b').innerText()).trim(),'Flag a defect',`${label}: a defect never sent leaves "Flag a defect"`);

    // 6. Waiting on another project: one line under the buttons, opening that project's defect.
    const other=`Loose trunking lid ${who}`;
    await flag(other,OTHER);
    cut=true;
    await context.setOffline(false);
    await page.goto(`${base}/engineer?project=${P}`);
    await elsewhere().first().waitFor();
    eq(await elsewhere().count(),1,`${label}: one line for the other project`);
    const otherName='Kirkstall Gate - Phase 2';
    const line=(await elsewhere().innerText()).replace(/\s+/g,' ');
    ok(line.startsWith('Defect not sent yet · '),`${label}: the line starts "Defect not sent yet ·" (${line})`);
    ok(line.includes(otherName),`${label}: the line names the other project`);
    ok(line.includes('Only on this phone, not at the office yet'),`${label}: the line says it is only on this phone`);
    eq((await tile().locator('b').innerText()).trim(),'Flag a defect',`${label}: this project's button is as it was`);
    eq(await elsewhere().getAttribute('href'),`/engineer?project=${OTHER}&view=defect`,`${label}: the line opens the other project's defect`);
    ok(await elsewhere().evaluate(e=>e.classList.contains('held')),`${label}: the line is marked as waiting, not late`);
    ok((await elsewhere().boundingBox()).height>=MIN_TARGET-0.5,`${label}: the line at least ${MIN_TARGET}px tall`);
    await noSideways('with a line for another project');
    await shot('home-other-project');
    await tap(elsewhere());
    await notSent().waitFor();
    ok(await page.getByText(other,{exact:true}).count()>0,`${label}: the line opens that defect`);
    cut=false;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.getByRole('heading',{name:'Defect sent to the office',exact:true}).waitFor({timeout:20000});
    eq((await issuesNamed(other,OTHER)).length,1,`${label}: the other project's defect went once`);
    await page.goto(`${base}/engineer?project=${P}`);await tile().waitFor();
    eq(await elsewhere().count(),0,`${label}: once sent, no line for the other project`);

    // 7. Weak signal: Send tapped, then Site before the upload ends. Once it ends, the button goes back by itself.
    const slowOne=`Scorched cable ${who}`;
    await flag(slowOne,P,false);
    slow=true;
    await tap(page.getByRole('button',{name:/^Send defect to /}));
    await home();
    await page.getByRole('button',{name:/Defect not sent yet/}).waitFor({timeout:2500});
    ok(true,`${label}: while it is still going, the button says not sent yet`);
    await page.getByRole('button',{name:/Flag a defect/}).waitFor({timeout:10000});
    slow=false;
    eq((await issuesNamed(slowOne)).length,1,`${label}: the slow defect reached the office once`);
    ok(true,`${label}: once the slow send ends, "Flag a defect" again without leaving the page`);

    eq(errors.length,0,`${label}: no page errors (${errors.join(' | ')})`);
    await context.close();
  }
  console.log(`verify-defect-waiting-on-site: ${checks} checks passed`);
} finally { await browser?.close(); server.kill(); }
