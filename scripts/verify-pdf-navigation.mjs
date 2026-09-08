// Isolated Chromium check; uses synthetic data and a supplied Playwright module/browser.
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root = mkdtempSync(join(tmpdir(),'relay-pdf-navigation-'));
process.env.RELAY_DATA_ROOT=root;
const {database,putRecord} = require('../apps/web/.test-build/lib/storage.js');
const {createReport} = require('../apps/web/.test-build/lib/serverStore.js');
const {ensurePdf} = require('../apps/web/.test-build/lib/pdfArtifacts.js');
const React = require('react');
const {Document,Page,Text,renderToBuffer} = await import('@react-pdf/renderer');
const pdf = await renderToBuffer(React.createElement(Document,null,
  ...[1,2].map(n => React.createElement(Page,{key:n,size:'A4'},React.createElement(Text,{style:{margin:40}},`Navigation test page ${n}`)))));
const principal={id:'entra:pdf-check',oid:'pdf-check',name:'PDF Test',email:'test@example.test',role:'Engineer'};
putRecord('sessions',{id:'pdf-navigation-check',principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const report={...createReport('proj-011lme',principal.name,principal),state:'submitted'};
putRecord('reports',report);putRecord('snapshots',report);
await ensurePdf(report,async()=>pdf);
let output='';
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p','4328','-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'test',ENTRA_CLIENT_ID:'test',ENTRA_CLIENT_SECRET:'synthetic-only'}});
child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
let browser;
try {
  let ready=false;
  for(let n=0;n<60;n++) {try {if((await fetch('http://127.0.0.1:4328/signin')).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await context.addCookies([{name:'relay_session',value:'pdf-navigation-check',url:'http://127.0.0.1:4328'}]);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const preview=`http://127.0.0.1:4328/reports/${report.id}/preview`;
  await page.goto(preview);
  await page.getByRole('link',{name:'Open the PDF'}).click();
  await page.getByText('Page 1 of 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Next page'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>0 && !document.body.innerText.includes('Loading PDF'));
  assert.equal(context.pages().length,1,'No separate PDF window');
  const painted=await page.locator('canvas').evaluate(c=>{const b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<b.length;i+=4)if(b[i]<100&&b[i+1]<100&&b[i+2]<100&&b[i+3]>0)return true;return false;});
  assert.ok(painted,'PDF must render visible ink');
  await page.getByRole('button',{name:'Next page'}).click();
  await page.getByText('Page 2 of 2',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.body.innerText.includes('Loading PDF'));
  await page.getByLabel('Zoom').selectOption('1.5');
  await page.waitForFunction(()=>!document.body.innerText.includes('Loading PDF'));
  await page.screenshot({path:resolve('.deployment/pdf-viewer-check.png'),fullPage:true});
  await page.goBack();
  assert.equal(page.url(),preview,'Browser Back returns to RELAY preview');
  await page.getByRole('link',{name:'Open the PDF'}).click();
  await page.getByRole('link',{name:'Back to report'}).click();
  await page.waitForURL(`**/reports/${report.id}`);
  assert.equal(new URL(page.url()).pathname,`/reports/${report.id}`);
  assert.deepEqual(errors,[]);
  console.log('Passed: two-page PDF rendered, paging/zoom, one window, browser Back and explicit return at 390px.');
} finally {
  await browser?.close();child.kill();if(child.exitCode===null) await once(child,'exit');
  database().close();
  if(!resolve(root).startsWith(resolve(tmpdir(),'relay-pdf-navigation-'))) throw new Error('Unexpected test directory');
  rmSync(root,{recursive:true,force:true});
}
