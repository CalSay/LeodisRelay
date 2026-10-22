// Browser check for RELAY opened from the home screen icon (lib/homeScreen.ts):
// the page says so when the icon opened a browser tab instead of the app, says
// nothing when it opened full screen or was typed in, stays through sign-in,
// and the sign-in screen carries on by itself once a session exists. Also the
// tags a phone reads before opening the icon full screen.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the note at 390px light and dark, and 1440px light.
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
const root=mkdtempSync(join(tmpdir(),'relay-home-screen-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const principal={id:'entra:icon-engineer',oid:'icon-engineer',name:'Icon Engineer',email:'icon@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
// localhost, not 127.0.0.1: the sign-in redirect names localhost, and the launch mark must go with it.
const port=4342,base=`http://localhost:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-home-screen-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const NOTE='Your RELAY icon opened the browser, not the app.';
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
async function open({width=390,scheme='light',ua=ANDROID,signedIn=true,standalone=false}={}) {
  const context=await browser.newContext({viewport:{width,height:844},colorScheme:scheme,userAgent:ua,...(width<=600?{isMobile:true,hasTouch:true}:{})});
  if(signedIn) await context.addCookies([{name:'relay_session',value:session,url:base},{name:'relay-company',value:'developments',url:base}]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Chromium 141 cannot be told it is an installed app, so the page's media query answers as one would.
  if(standalone)await page.addInitScript(()=>{const real=window.matchMedia.bind(window);window.matchMedia=q=>q.includes('display-mode: standalone')?{...real(q),matches:true,media:q,addEventListener(){},removeEventListener(){}}:real(q);});
  return {context,page,errors};
}
// An engineer's company page sends them on to their own home.
const landed=url=>['/developments','/engineer'].includes(url.pathname);
const note=page=>page.getByRole('complementary',{name:NOTE});
const launchCookie=async context=>(await context.cookies(base)).find(c=>c.name==='relay-icon-launch');
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});

  // What a phone reads before it opens the icon full screen.
  const html=await (await fetch(base+'/signin')).text();
  check(/<meta name="apple-mobile-web-app-capable" content="yes"\/?>/.test(html),'older iPhones get apple-mobile-web-app-capable');
  check(/<link rel="manifest" href="\/manifest.webmanifest"/.test(html),'the page names its manifest');
  const manifest=await (await fetch(base+'/manifest.webmanifest')).json();
  check(manifest.display==='standalone'&&manifest.scope==='/'&&manifest.start_url==='/?open=app','the manifest opens full screen over the whole of RELAY');

  // Android: the icon was saved as a shortcut, so it opens a Chrome tab.
  {const {context,page,errors}=await open();
    await page.goto(base+'/?open=app');await page.waitForURL(landed);
    await note(page).waitFor();
    check(await note(page).getByText('choose Install, not Create shortcut').isVisible(),'Android: says to install, not make a shortcut');
    check(!(await launchCookie(context)),'the launch mark is read once and cleared');
    const close=note(page).getByRole('button',{name:'Got it'});const box=await close.boundingBox();
    check(box.height>=44,`Got it is a 44px target (${Math.round(box.height)})`);
    if(shots)await page.screenshot({path:join(shots,'icon-opens-browser-light-390.png')});
    await close.click();await note(page).waitFor({state:'detached'});
    await page.reload();await page.locator('body').waitFor();await page.waitForTimeout(500);
    check(await note(page).count()===0,'gone after Got it, and a reload is not a launch');
    check(errors.length===0,`no page errors (${errors})`);await context.close();}

  // iPhone, dark: the iPhone words.
  {const {context,page}=await open({scheme:'dark',ua:IPHONE});
    await page.goto(base+'/?open=app');await note(page).waitFor();
    check(await note(page).getByText('If you see Open as Web App, leave it on.').isVisible(),'iPhone: says to leave Open as Web App on');
    check(await note(page).getByText('Install app').count()===0,'iPhone: no Android words');
    if(shots)await page.screenshot({path:join(shots,'icon-opens-browser-dark-390.png')});await context.close();}

  // Desktop width, light: the note sits clear of the edges.
  {const {context,page}=await open({width:1440,ua:IPHONE.replace('iPhone; CPU iPhone OS 18_6 like Mac OS X','Macintosh; Intel Mac OS X 10_15_7')});
    await page.goto(base+'/?open=app');await note(page).waitFor();
    const b=await note(page).boundingBox();check(b.x>0&&b.x+b.width<1440&&b.width<=560,'1440px: the note is a card within the window');
    if(shots)await page.screenshot({path:join(shots,'icon-opens-browser-light-1440.png')});await context.close();}

  // Opened full screen as an app: nothing to say.
  {const {context,page,errors}=await open({standalone:true});
    await page.goto(base+'/?open=app');await page.waitForURL(landed);
    check(await page.evaluate(()=>matchMedia('(display-mode: standalone)').matches),'the browser is acting as an installed app');await page.waitForTimeout(800);
    check(await note(page).count()===0,'full screen from the icon: no note');
    check(!(await launchCookie(context)),'full screen: the launch mark is still cleared');
    check(errors.length===0,`no page errors (${errors})`);await context.close();}

  // Typed into the browser: not a launch from the icon.
  {const {context,page}=await open();
    await page.goto(base+'/developments');await page.waitForTimeout(800);
    check(await note(page).count()===0,'typed in: no note');await context.close();}

  // Signed out: the note shows on sign-in, stays through it, and sign-in carries on by itself.
  {const {context,page,errors}=await open({signedIn:false});
    await page.goto(base+'/?open=app');await page.waitForURL(/\/signin\?returnTo=%2F%3Fopen%3Dapp/);
    await note(page).waitFor();check(true,'signed out: the note shows on the sign-in screen');
    // As if Microsoft's sign-in finished in another sheet or tab and the person came back here.
    await context.addCookies([{name:'relay_session',value:session,url:base},{name:'relay-company',value:'developments',url:base}]);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForURL(landed);check(true,'back on the sign-in screen once signed in: it carries on to RELAY');
    await note(page).waitFor();check(true,'the note is still there after signing in');
    check(errors.length===0,`no page errors (${errors})`);await context.close();}

  // Signed out on the sign-in screen and still signed out: it stays put.
  {const {context,page}=await open({signedIn:false});
    await page.goto(base+'/signin');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(800);
    check(new URL(page.url()).pathname==='/signin','still signed out: stays on the sign-in screen');await context.close();}

  console.log(`Home screen check passed (${checks} checks): note when the icon opens a browser tab, none full screen or typed in, sign-in carries on.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
