// Browser check: on a phone, a report picked in the office Inbox opens at the
// top of the screen on its own, not under the whole list; "‹ Inbox" and the
// phone's own Back both return to the same place in the list with the same
// filter; opening it still marks it seen. Inspection names on Inbox rows wrap
// rather than being cut off. At a desk (1440px and 1280px) the list and the
// reader stay side by side. Data: two weeks of reports from three engineers on
// three projects (seed-busy-projects).
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the list and the open report at 390px, light and dark, and the desk.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from './seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-inbox-phone-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../apps/web/.test-build/lib/storage.js');
const {putRecord,records,database}=require(storagePath);
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
seedBusyProjects({storagePath,today:londonDay(new Date()),days:14});
const session=randomUUID();
putRecord('sessions',{id:session,principal:PEOPLE.manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString()});
const port=4341,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-inbox-phone-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const rows=page=>page.locator('table.inbox-list tbody tr.clickable');
const reader=page=>page.locator('.panel-head h3',{hasText:/^Reader$/});
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const scrollY=page=>page.evaluate(()=>Math.round(window.scrollY));
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const colorScheme of ['light','dark']){
    const label=`${colorScheme} 390px`;
    const phone=await browser.newContext({viewport:{width:390,height:844},colorScheme,isMobile:true,hasTouch:true});await phone.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await phone.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/inbox`);await rows(page).first().waitFor();
    assert.ok(await rows(page).count()>=30,`${label}: weeks of reports in the list`);checks++;
    // Inspection names ("Tower inspection · Podium P3, plant room") wrap inside the row.
    const cut=await page.locator('table.inbox-list .kind').evaluateAll(els=>els.filter(e=>e.scrollWidth>e.clientWidth+1||e.getBoundingClientRect().right>e.closest('tr').getBoundingClientRect().right+1).map(e=>e.textContent));
    assert.deepEqual(cut,[],`${label}: no "Found" tag is cut off`);checks++;
    assert.ok(await page.locator('table.inbox-list .kind',{hasText:/inspection ·/i}).count()>0,`${label}: the data has named inspections`);checks++;
    assert.ok(await overflow(page)<=0,`${label}: no sideways scroll on the list`);checks++;
    if(shot)await page.screenshot({path:join(shot,`inbox-list-${colorScheme}-390.png`)});
    // Scroll down the list and pick a report that nobody has opened yet.
    const pick=rows(page).filter({hasNot:page.locator('.tag',{hasText:/^Seen$/i})}).nth(8);
    await pick.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-200));
    const ref=(await pick.locator('.ref').first().textContent()).trim();
    const before=await scrollY(page);
    assert.ok(before>1000,`${label}: picking from well down the list (${before}px)`);checks++;
    await pick.tap();
    await reader(page).waitFor();
    await page.waitForFunction(()=>window.scrollY===0);
    const top=await reader(page).evaluate(e=>Math.round(e.getBoundingClientRect().top));
    assert.ok(top>=0&&top<300,`${label}: the report is at the top of the screen (reader at ${top}px)`);checks++;
    assert.equal(await page.locator('.inbox-list-panel').isVisible(),false,`${label}: the list steps aside`);checks++;
    assert.equal(await page.locator('.view.inbox-reading > .filters').isVisible(),false,`${label}: so do the filters`);checks++;
    assert.match(await page.locator('.sheet-title .rowsub .ref').first().textContent(),new RegExp(ref),`${label}: the report picked is the one shown`);checks++;
    await page.locator('.stages [data-stage="read"]').getByText('Seen by the office').waitFor();checks++;
    const back=page.getByRole('button',{name:'‹ Inbox'});
    assert.ok(await back.isVisible(),`${label}: "‹ Inbox" on the report`);checks++;
    assert.ok((await back.boundingBox()).height>=44,`${label}: "‹ Inbox" is big enough to tap`);checks++;
    assert.ok(await overflow(page)<=0,`${label}: no sideways scroll on the report`);checks++;
    if(shot)await page.screenshot({path:join(shot,`inbox-report-${colorScheme}-390.png`)});
    await back.tap();
    await rows(page).first().waitFor();
    await page.waitForFunction(()=>!location.hash.slice(2).includes('/'));
    assert.equal(new URL(page.url()).hash,'#/inbox',`${label}: "‹ Inbox" goes back to the list`);checks++;
    assert.ok(Math.abs(await scrollY(page)-before)<=40,`${label}: back at the same place in the list (${await scrollY(page)}px, was ${before}px)`);checks++;
    assert.ok(await rows(page).filter({hasText:ref}).locator('.tag',{hasText:/^Seen$/i}).count()>0,`${label}: the row now says Seen`);checks++;
    // With "Not seen yet" chosen, the phone's own Back keeps the filter and the place.
    await page.getByRole('button',{name:/^Not seen yet · /}).tap();
    const notSeen=Number((await page.getByRole('button',{name:/^Not seen yet · /}).textContent()).match(/(\d+)$/)[1]);
    const pick2=rows(page).nth(6);await pick2.scrollIntoViewIfNeeded();
    const before2=await scrollY(page);
    await pick2.tap();await reader(page).waitFor();
    await page.locator('.stages [data-stage="read"]').getByText('Seen by the office').waitFor();
    await page.goBack();
    await rows(page).first().waitFor();
    assert.equal(await page.getByRole('button',{name:/^Not seen yet · /}).getAttribute('aria-pressed'),'true',`${label}: Back keeps "Not seen yet"`);checks++;
    await page.waitForFunction(n=>document.querySelector('button[aria-pressed="true"]')?.textContent.endsWith(` ${n}`),notSeen-1);checks++;
    assert.ok(Math.abs(await scrollY(page)-before2)<=40,`${label}: Back returns to the same place (${await scrollY(page)}px, was ${before2}px)`);checks++;
    // The Inbox tab itself still starts from All.
    await page.goto(`${base}/office#/projects`);await page.goto(`${base}/office#/inbox`);await rows(page).first().waitFor();
    assert.equal(await page.getByRole('button',{name:/^All · /}).getAttribute('aria-pressed'),'true',`${label}: the Inbox tab opens on All`);checks++;
    await phone.close();
  }
  for(const [width,colorScheme] of [[1440,'dark'],[1280,'light']]){
    const label=`${colorScheme} ${width}px`;
    const desk=await browser.newContext({viewport:{width,height:900},colorScheme});await desk.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await desk.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/inbox`);await rows(page).first().waitFor();
    await rows(page).nth(3).click();await reader(page).waitFor();
    const list=await page.locator('.inbox-list-panel').boundingBox(),read=await reader(page).locator('xpath=ancestor::div[contains(@class,"panel")][1]').boundingBox();
    assert.ok(list&&read&&read.x>=list.x+list.width-1&&Math.abs(read.y-list.y)<2,`${label}: list and reader side by side`);checks++;
    assert.equal(await page.getByRole('button',{name:'‹ Inbox'}).isVisible(),false,`${label}: no "‹ Inbox" on the desk`);checks++;
    assert.ok(await page.locator('.view > .filters').isVisible(),`${label}: filters stay on the desk`);checks++;
    assert.ok(await overflow(page)<=0,`${label}: no sideways scroll`);checks++;
    if(shot)await page.screenshot({path:join(shot,`inbox-desk-${colorScheme}-${width}.png`)});
    await desk.close();
  }
  // Straight to a report by its address on a phone: "‹ Inbox" opens the list.
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await phone.addCookies([{name:'relay_session',value:session,url:base}]);
  const page=await phone.newPage();page.on('pageerror',e=>errors.push(e.message));
  const direct=records('reports').find(r=>r.state==='submitted'&&!r.reportType)?.id;
  assert.ok(direct,'a report to open by address');
  await page.goto(`${base}/office#/inbox/${direct}`);await reader(page).waitFor();
  await page.getByRole('button',{name:'‹ Inbox'}).tap();await rows(page).first().waitFor();
  assert.equal(new URL(page.url()).hash,'#/inbox','opened by address: "‹ Inbox" opens the list');checks++;
  await phone.close();
  assert.deepEqual(errors,[]);checks++;
  console.log(`Passed ${checks} Inbox phone checks (390px light and dark, 1440px and 1280px desk; report on its own screen, back to the same place, Seen kept).`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit');
  database().close();rmSync(root,{recursive:true,force:true});
}
