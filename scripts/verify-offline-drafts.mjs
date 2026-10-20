// Browser check for the offline page (public/offline.html): a copy set aside
// while choosing between two versions of a draft is named apart from the
// ordinary copy, and the ordinary copy opens first.
// Run from the repo root: node scripts/verify-offline-drafts.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const pub=resolve('apps/web/public');
// The offline page is static and reads only IndexedDB, so a plain file server stands in for the app.
const server=createServer((request,response)=>{
  const file=request.url.startsWith('/offline.js')?'offline.js':'offline.html';
  response.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');
  response.end(readFileSync(resolve(pub,file)));
}).listen(4341,'127.0.0.1');
let browser,checks=0;
try {
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4341/');
  await page.evaluate(async()=>{
    sessionStorage.setItem('relay-offline-principal','user-1');
    await new Promise((done,fail)=>{
      const open=indexedDB.open('relay-drafts',2);
      open.onupgradeneeded=()=>open.result.createObjectStore('unsent',{keyPath:'key'});
      open.onsuccess=()=>{
        const tx=open.result.transaction('unsent','readwrite');const store=tx.objectStore('unsent');
        const held={reportId:'report-1',principalId:'user-1',seq:1,heldAt:'2026-10-20T10:00:00Z',baseVersion:2,report:{reference:'011LME-R-007'},observations:[{location:'Level 3',whatHappened:'Tray fixed',actionNeeded:'',owner:'',photos:[]}]};
        store.put({...held,key:'user-1::report-1::aside::tab-a',tab:'tab-a',observations:[{...held.observations[0],whatHappened:'Set aside'}]});
        store.put({...held,key:'user-1::report-1'});
        tx.oncomplete=()=>{open.result.close();done();};tx.onerror=()=>fail(tx.error);
      };
    });
  });
  await page.goto('http://127.0.0.1:4341/reports/report-1');
  await page.waitForSelector('#editor h2');
  assert.deepEqual(await page.$$eval('#drafts button .t',b=>b.map(x=>x.textContent)),['011LME-R-007','011LME-R-007 (copy kept while choosing between two versions)'],'both copies listed, the set-aside one named apart');checks++;
  assert.equal(await page.textContent('#editor h2'),'011LME-R-007','the ordinary copy opens first');checks++;
  assert.equal(await page.inputValue('#editor textarea'),'Tray fixed','the ordinary copy’s words');checks++;
  await page.click('#drafts button:nth-child(2)');
  await page.waitForFunction(()=>document.querySelector('#editor h2')?.textContent.includes('copy kept'));
  assert.equal(await page.inputValue('#editor textarea'),'Set aside','the set-aside copy opens with its own words');checks++;
  assert.deepEqual(errors,[],'no page errors');checks++;
  console.log(`Offline drafts check passed (${checks} checks): set-aside copy named apart, ordinary copy first.`);
} finally {
  await browser?.close();server.close();
}
