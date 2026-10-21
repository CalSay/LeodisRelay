// Browser check for checking fixes one after another (2026-10-21).
// A walk of an office manager checking 25 fixes from three engineers found the
// Verify and "Not finished" dialogs showed only the description: no photo of the
// defect, no photo or note sent with the fix. Each fix took three clicks and a
// scroll through the issue's history, and "Not finished" went through with no
// reason, so the engineer saw it back with no word why.
// Now the dialog shows the defect and the fix side by side with the engineer's
// note, then opens the next fix from the list it was started on ("2 of 25"), with
// Skip and Stop; a reason is needed to send a fix back, on screen and on the server.
// Checks: from the overview, the dialog follows the panel's order; Enter on the
// opened dialog changes nothing; Verify moves on; an empty "Not finished" is refused
// in plain words and nothing changes, then goes with a reason; Skip changes nothing;
// Esc stops, says what was done and every figure behind it agrees (overview, Issues
// tab, register chips, project list); the server refuses an empty send-back;
// "Verify the oldest" goes oldest first; a register row follows the register's
// filter and order and ends by itself at the end of the list; "No photo" is said
// plainly; photos open full size; at 1440, 1024 and 390 in light and dark: side by
// side or stacked, no sideways scroll, axe, no page errors.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the dialog at each width and scheme.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-check-fixes-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {putMedia}=require('../apps/web/.test-build/lib/mediaStore.js');
const {getIssue}=require('../apps/web/.test-build/lib/issueStore.js');
const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
const {SEND_BACK_REASON}=require('../apps/web/.test-build/lib/checkFix.js');
const person=(oid,name,role,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role,...(trade?{trade}:{})});
const manager=person('cf-manager','Jo Office','Manager');
const engineers=[person('cf-sam','Sam Spark','Engineer','Electrical'),person('cf-hana','Hana Holt','Engineer','HVAC'),person('cf-pat','Pat Pipe','Engineer','P&H')];
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
const today=londonDay(new Date());
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const at=(ymd,h)=>`${ymd}T${String(h).padStart(2,'0')}:00:00.000Z`;
const photo=async(colour,owner,when)=>{const id=randomUUID();await putMedia(id,{...owner,mime:'image/png'},await sharp({create:{width:640,height:480,channels:3,background:colour}}).png().toBuffer());return {id,dataUrl:`/api/media/${id}`,caption:'',capturedAt:when};};

// 25 fixes: Tetley Hall 17, Kirkstall Gate 8; three owners; some past target; two with no fix photo, one with no defect photo, one with no note.
const T='proj-011lme',K='proj-014lme';
const OWNERS=['Acme Electrical','Cool Air Ltd','Leeds Plumbing'];
const fixes=[];
for(let n=0;n<25;n++){
  const id=String(501+n),project=n<17?T:K,e=engineers[n%3],raisedAt=at(addDays(today,-30+n),9),fixedAt=at(addDays(today,-12+Math.floor(n/3)),14);
  const owner=n===20||n===22||n===24?'Northern Lighting':OWNERS[n%3];
  const before=n===5?[]:[await photo('#7a3b2a',{issueId:id,ownerId:e.id},raisedAt)];
  const after=n===3||n===9?[]:[await photo('#2f6b45',{issueId:id,ownerId:e.id},fixedAt)];
  const issue={id,reference:`DEMO-${project==='proj-011lme'?'011LME':'014LME'}-ISS-${id}`,projectId:project,source:'individual',reportedBy:e.name,reportedById:e.id,reporterTrade:e.trade,affectedTrade:e.trade,
    location:`Area ${n+1}`,description:`Fix number ${n+1}`,actionNeeded:'',confirmation:'confirmed',work:'awaiting_verification',owner,targetDate:addDays(today,n%4===0?-5:6),raisedAt,
    closureSubmittedBy:e.name,closureSubmittedById:e.id,
    events:[{at:raisedAt,actor:e.name,actorId:e.id,kind:'raised',note:`Fix number ${n+1}`,photos:before},{at:fixedAt,actor:e.name,actorId:e.id,kind:'closure_submitted',note:n===7?'':`Done ${n+1}`,photos:after}]};
  putRecord('issues',issue);fixes.push(issue);
}
const TOTAL=25;

const port=4497,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-check-fixes',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const flat=s=>s.replace(/\s+/g,' ').trim();
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('dialog[open]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')+' '+n.failureSummary).slice(0,3).join(', ')}`));check(!found.length,`${label}: axe found ${found.join('; ')}`);};
const work=id=>getIssue(id)?.work;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  const open=async(scheme,width)=>{const phone=width<700;const context=await browser.newContext({viewport:{width,height:phone?844:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};};
  const dialog=page=>page.locator('dialog.cf-dialog[open]');
  const heading=async page=>flat(await dialog(page).locator('h2').innerText());
  const current=async page=>flat(await dialog(page).locator('.cf-what b').innerText());
  const waitHeading=(page,re)=>page.waitForFunction(re=>new RegExp(re).test(document.querySelector('dialog.cf-dialog[open] h2')?.textContent??''),re.source,{timeout:8000});

  // 1. From the overview, light 1440.
  {
    const label='light 1440px, overview';
    const {context,page}=await open('light',1440);
    await page.goto(`${base}/office`);
    const panel=page.locator('.act').filter({hasText:'Fixed, to check'}).first();await panel.waitFor();
    check(flat(await panel.innerText()).includes(String(TOTAL)),`${label}: the panel counts ${TOTAL}`);
    const order=(await panel.locator('.rt b').allInnerTexts()).map(flat);
    check(order.length===4,`${label}: four rows shown (${order.length})`);
    await panel.getByRole('button',{name:'Verify'}).first().click();
    await waitHeading(page,new RegExp(`1 of ${TOTAL}`));
    check(await current(page)===order[0],`${label}: the first fix is the panel's first row (${await current(page)} / ${order[0]})`);
    check(await page.evaluate(()=>document.activeElement?.tagName==='H2'),`${label}: focus starts on the fix's heading`);
    const first=fixes.find(f=>f.description===order[0]);
    // The defect and the fix, side by side.
    const sides=dialog(page).locator('.cf-side');
    check(await sides.count()===2,`${label}: two sides`);
    check(/The defect/i.test(await sides.nth(0).innerText())&&/The fix/i.test(await sides.nth(1).innerText()),`${label}: the defect first, then the fix`);
    const boxes=await Promise.all([0,1].map(n=>sides.nth(n).boundingBox()));
    check(Math.abs(boxes[0].y-boxes[1].y)<2&&boxes[1].x>boxes[0].x+boxes[0].width-1,`${label}: side by side at 1440`);
    await dialog(page).locator('.cf-pair').waitFor();
    const pics=await dialog(page).locator('.cf-shots a').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),label:a.getAttribute('aria-label'),loaded:a.querySelector('img').complete&&a.querySelector('img').naturalWidth>0})));
    check(pics.length===(first.events[0].photos.length+first.events[1].photos.length),`${label}: every photo shown (${pics.length})`);
    await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] .cf-shots img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:8000});
    check(pics.every(p=>/\?variant=pdf$/.test(p.href)&&/full size/.test(p.label)),`${label}: each photo opens full size (${pics.map(p=>p.href).join(', ')})`);
    const big=await page.evaluate(async h=>{const r=await fetch(h);return [r.status,r.headers.get('content-type')];},pics[0].href);
    check(big[0]===200&&/^image\//.test(big[1]),`${label}: the full-size photo loads (${big})`);
    check(/Put forward by .+ on /.test(flat(await dialog(page).locator('.cf-what').innerText())),`${label}: says who put it forward and when`);
    await axe(page,label);
    // Enter on the opened dialog never verifies.
    await page.keyboard.press('Enter');await page.waitForTimeout(400);
    check(work(first.id)==='awaiting_verification'&&/1 of 25/.test(await heading(page)),`${label}: Enter changes nothing`);
    // Verify moves on to the panel's second row.
    await dialog(page).getByRole('button',{name:'Verify and close'}).click();
    await waitHeading(page,new RegExp(`2 of ${TOTAL}`));
    check(work(first.id)==='closed',`${label}: the first is verified and closed`);
    check(await current(page)===order[1],`${label}: then the panel's second row`);
    check(await page.evaluate(()=>document.activeElement?.tagName==='H2'),`${label}: focus moves to the new fix's heading`);
    // Not finished needs a reason.
    const second=fixes.find(f=>f.description===order[1]);
    await dialog(page).getByRole('button',{name:'Not finished'}).click();
    const alert=dialog(page).locator('[role=alert]');await alert.waitFor();
    check(flat(await alert.innerText())===SEND_BACK_REASON,`${label}: an empty send-back is refused in plain words (${flat(await alert.innerText())})`);
    check(await page.evaluate(()=>document.activeElement?.id==='cf-note'),`${label}: focus goes to the note`);
    check(work(second.id)==='awaiting_verification'&&/2 of 25/.test(await heading(page)),`${label}: nothing changed`);
    await page.locator('#cf-note').fill('The collar on the left is still missing');
    await page.keyboard.press('Enter');await page.waitForTimeout(300);
    check(work(second.id)==='awaiting_verification',`${label}: Enter in the note writes a new line, it does not send`);
    await dialog(page).getByRole('button',{name:'Not finished'}).click();
    await waitHeading(page,new RegExp(`3 of ${TOTAL}`));
    check(work(second.id)==='in_progress',`${label}: sent back with the reason`);
    check(getIssue(second.id).events.at(-1).note.startsWith('The collar on the left is still missing'),`${label}: the reason is on the issue`);
    check(await page.locator('#cf-note').inputValue()==='',`${label}: the note starts empty for the next fix`);
    // Skip changes nothing.
    const third=fixes.find(f=>f.description===order[2]);
    check(await current(page)===order[2],`${label}: the third is the panel's third row`);
    await dialog(page).getByRole('button',{name:'Skip'}).click();
    await waitHeading(page,new RegExp(`4 of ${TOTAL}`));
    check(work(third.id)==='awaiting_verification'&&getIssue(third.id).events.length===2,`${label}: Skip changes nothing`);
    check(await current(page)===order[3],`${label}: then the fourth`);
    if(shot)await page.screenshot({path:join(shot,'check-fix-light-1440.png')});
    // Esc stops, says what was done, and every figure behind agrees.
    await page.keyboard.press('Escape');
    await dialog(page).waitFor({state:'detached',timeout:5000}).catch(()=>{});
    check(await dialog(page).count()===0,`${label}: Esc stops`);
    const toast=page.locator('.toast').filter({hasText:'1 verified, 1 sent back'});await toast.waitFor({timeout:5000});
    check(await toast.count()===1,`${label}: says "1 verified, 1 sent back."`);
    const left=TOTAL-2,openNow=TOTAL-1;
    await page.waitForFunction(n=>([...document.querySelectorAll('.act')].find(a=>/Fixed, to check/.test(a.textContent))?.textContent??'').includes(String(n)),left,{timeout:8000}).catch(()=>{});
    const panelNow=flat(await page.locator('.act').filter({hasText:'Fixed, to check'}).first().innerText());
    check(panelNow.includes(String(left))&&!panelNow.includes(String(TOTAL)),`${label}: the panel now counts ${left} (${panelNow.slice(0,80)})`);
    const tab=flat(await page.locator('a[href="#/issues"]').first().innerText());
    check(new RegExp(`^Issues ${openNow}\\b`).test(tab),`${label}: the Issues tab counts ${openNow} open (${tab})`);
    await page.goto(`${base}/office#/issues/show/verify`);
    await page.waitForFunction(n=>document.querySelectorAll('table.reg tbody tr').length===n,left,{timeout:8000}).catch(()=>{});
    const chips=flat((await page.locator('.chip').allInnerTexts()).join(' | '));
    check(new RegExp(`Open · ${openNow} \\|.*Fixed, to check · ${left} \\|`).test(chips),`${label}: the register's chips agree (${chips})`);
    await page.goto(`${base}/office#/projects/${T}`);
    const card=page.locator('a.item').filter({hasText:'Tetley Hall'}).first();await card.waitFor();
    const tetley=fixes.filter(f=>f.projectId===T),changed=[first,second].filter(f=>f.projectId===T);
    const cardText=flat(await card.locator('.meta').first().innerText());
    check(cardText.includes(`${tetley.length-changed.filter(f=>f===first).length} open`)&&cardText.includes(`${tetley.length-changed.length} to check`),`${label}: the project list agrees (${cardText})`);
    // The server refuses an empty send-back, as an older app would send it.
    const waiting=fixes.find(f=>work(f.id)==='awaiting_verification');
    const refused=await page.evaluate(async id=>{const r=await fetch(`/api/issues/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'reopen',note:'  '})});return [r.status,(await r.json()).reason];},waiting.id);
    check(refused[0]===422&&refused[1]===SEND_BACK_REASON,`${label}: the server refuses an empty send-back (${refused})`);
    check(work(waiting.id)==='awaiting_verification',`${label}: and nothing changed`);
    await context.close();
  }

  // 2. The register, dark 1440: "Verify the oldest" goes oldest first; a row follows the filter and ends by itself.
  {
    const label='dark 1440px, register';
    const {context,page}=await open('dark',1440);
    await page.goto(`${base}/office#/issues/show/verify`);
    await page.locator('table.reg tbody tr').first().waitFor();
    const waiting=fixes.filter(f=>work(f.id)==='awaiting_verification').sort((a,b)=>a.raisedAt.localeCompare(b.raisedAt)||a.reference.localeCompare(b.reference));
    await page.getByRole('button',{name:'Verify the oldest'}).click();
    await waitHeading(page,new RegExp(`1 of ${waiting.length}`));
    check(await current(page)===waiting[0].description,`${label}: Verify the oldest starts at the oldest (${await current(page)})`);
    await dialog(page).getByRole('button',{name:'Skip'}).click();await waitHeading(page,/2 of /);
    check(await current(page)===waiting[1].description,`${label}: then the next oldest`);
    if(shot)await page.screenshot({path:join(shot,'check-fix-dark-1440.png')});
    await axe(page,label);
    await dialog(page).getByRole('button',{name:'Stop'}).click();
    await dialog(page).waitFor({state:'detached',timeout:5000});
    check(waiting.every(f=>work(f.id)==='awaiting_verification'),`${label}: Stop and Skip changed nothing`);
    check(await page.locator('.toast').count()===0||!/verified|sent back/.test(flat((await page.locator('.toast').allInnerTexts()).join(' '))),`${label}: nothing to report after only skipping`);
    // A fix with no fix photo, and one with no defect photo, are said plainly.
    const noFix=fixes[9],noDefect=fixes[5];
    for(const [f,what] of [[noFix,'No photo was sent with the fix.'],[noDefect,'No photo was taken of the defect.']]){
      await page.locator('table.reg tbody tr').filter({hasText:f.reference}).getByRole('button',{name:'Verify'}).click();
      await dialog(page).locator('.cf-pair').waitFor();
      check((await dialog(page).locator('.cf-none').allInnerTexts()).includes(what),`${label}: ${f.reference} says "${what}"`);
      check(await dialog(page).getByRole('button',{name:'Verify and close'}).isEnabled(),`${label}: and can still be verified`);
      await page.keyboard.press('Escape');await dialog(page).waitFor({state:'detached'});
    }
    const noNote=fixes[7];
    await page.locator('table.reg tbody tr').filter({hasText:noNote.reference}).getByRole('button',{name:'Verify'}).click();
    await dialog(page).locator('.cf-note').waitFor();
    check(/No note was sent with the fix\./.test(flat(await dialog(page).locator('.cf-what').innerText())),`${label}: no note is said plainly`);
    await page.keyboard.press('Escape');await dialog(page).waitFor({state:'detached'});
    // Northern Lighting's fixes, in the register's order: verify each, and it ends by itself.
    await page.locator('.issue-search input[list="issue-owners"]').fill('Northern Lighting');
    await page.waitForFunction(()=>document.querySelectorAll('table.reg tbody tr').length===3,null,{timeout:8000});
    const rows=(await page.locator('table.reg tbody tr .c-title .rowtitle').allInnerTexts()).map(flat);
    await page.locator('table.reg tbody tr').first().getByRole('button',{name:'Verify'}).click();
    for(let n=0;n<3;n++){
      await waitHeading(page,new RegExp(`${n+1} of 3`));
      check(await current(page)===rows[n],`${label}: fix ${n+1} of 3 is the register's row ${n+1} (${await current(page)})`);
      await dialog(page).getByRole('button',{name:'Verify and close'}).click();
    }
    await dialog(page).waitFor({state:'detached',timeout:5000});
    check(await dialog(page).count()===0,`${label}: closes by itself at the end of the list`);
    await page.locator('.toast').filter({hasText:'3 verified'}).waitFor({timeout:5000});
    check(true,`${label}: says "3 verified."`);
    await page.waitForFunction(()=>document.querySelectorAll('table.reg tbody tr td.empty').length===1,null,{timeout:8000});
    check(/Fixed, to check · 0/.test(flat((await page.locator('.chip').allInnerTexts()).join(' | '))),`${label}: the register for that company is empty`);
    // Opened with "Not finished" on a row: straight to the reason.
    await page.getByRole('button',{name:'Clear filters'}).first().click();
    await page.waitForFunction(()=>document.querySelectorAll('table.reg tbody tr').length>3,null,{timeout:8000});
    await page.locator('table.reg tbody tr').first().getByRole('button',{name:'Not finished'}).click();
    await dialog(page).waitFor();
    check(await page.evaluate(()=>document.activeElement?.id==='cf-note'),`${label}: "Not finished" opens on the note`);
    await page.keyboard.press('Escape');
    await context.close();
  }

  // 3. Narrower office and phone, light and dark.
  for(const [scheme,width] of [['light',1024],['dark',1024],['light',390],['dark',390]]){
    const label=`${scheme} ${width}px`;
    const {context,page}=await open(scheme,width);
    await page.goto(`${base}/office#/issues/show/verify`);
    await page.locator('table.reg tbody tr').first().waitFor();
    const before=await overflow(page);
    await page.locator('table.reg tbody tr').first().getByRole('button',{name:'Verify'}).click();
    await waitHeading(page,/1 of /);
    const sides=dialog(page).locator('.cf-side');
    const boxes=await Promise.all([0,1].map(n=>sides.nth(n).boundingBox()));
    if(width<700)check(boxes[1].y>=boxes[0].y+boxes[0].height-1,`${label}: the fix sits under the defect`);
    else check(Math.abs(boxes[0].y-boxes[1].y)<2,`${label}: side by side`);
    // The register itself may scroll sideways at this width (it did before this change); the dialog adds none.
    const during=await overflow(page);
    check(during<=Math.max(0,before),`${label}: no sideways scroll added (${before} before, ${during} with the dialog)`);
    const dialogOverflow=await dialog(page).evaluate(d=>d.scrollWidth-d.clientWidth);
    check(dialogOverflow<=0,`${label}: nothing in the dialog runs off the side (${dialogOverflow})`);
    if(width<700){const h=await dialog(page).getByRole('button',{name:'Verify and close'}).evaluate(b=>b.getBoundingClientRect().height);check(h>=44,`${label}: buttons are at least 44px tall (${h})`);}
    await axe(page,label);
    if(shot)await page.screenshot({path:join(shot,`check-fix-${scheme}-${width}.png`),fullPage:false});
    await context.close();
  }

  check(!errors.length,`no page errors (${errors.join('; ')})`);
  console.log(`verify-check-fixes: ${checks} checks passed`);
} finally {
  await browser?.close();
  server.kill();if(server.exitCode===null)await once(server,'exit').catch(()=>{});
  database().close();rmSync(root,{recursive:true,force:true});
}
