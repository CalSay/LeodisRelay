// Browser check: signing an inspection without drawing. Someone who cannot
// draw a signature (a keyboard or a screen reader, say) chooses "Type my name
// instead", types their full name and ticks the statement, all from the
// keyboard. In RELAY's editor (a handover inspection, 390px light and 1440px
// dark) the choice survives a reload, drawing again clears it, and it is sent;
// the office report and the PDF say it was typed, with the statement and who
// was signed in. With no signal (a first fix inspection, 390px dark) the
// offline page takes a typed signature and it goes to the office by itself,
// typed, when signal returns. Drawn signing is covered by verify-offline-sign
// and verify-signature-reload, which still pass.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-typed-signature-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {TYPED_STATEMENT}=require('../apps/web/.test-build/lib/signature.js');
const engineer={id:'entra:typed-signer',oid:'typed-signer',name:'Tess Typed',email:'tess@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:typed-office',oid:'typed-office',name:'Office Manager',email:'office@example.test',role:'Manager'};
const newSession=principal=>{const id=randomUUID();putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});return id;};
const P='proj-011lme';
const port=4361,base=`http://127.0.0.1:${port}`;let output='',server;
async function start(){
  server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-typed-signature-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
  server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw Error(`server did not start\n${output}`);
}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}}
let browser,checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const screenshot=process.env.RELAY_SCREENSHOT_DIR;
// Choose a radio or tick a box from the keyboard: focus it and press Space.
const press=async(page,locator)=>{await locator.focus();await page.keyboard.press('Space');};
// Delete the name already there one key at a time, as a person would, then type their own.
const typeName=async(page,name)=>{const box=page.getByRole('textbox',{name:'Your full name'});await box.focus();await page.keyboard.press('End');
  for(let n=(await box.inputValue()).length;n>0;n--)await page.keyboard.press('Backspace');
  await page.waitForTimeout(400);check(await box.inputValue()==='','emptying the name box leaves it empty: the author\'s name is not put back');
  await page.keyboard.type(name);};
// Wait until the server holds what the screen shows: the save bar says nothing while an item needs attention.
const saved=async(ready)=>{for(let n=0;n<60;n++){if(ready())return;await new Promise(r=>setTimeout(r,250));}throw Error('the draft was not saved');};
const statement=page=>page.getByRole('checkbox',{name:/I carried out this inspection/});

/** A handover inspection with every check answered, waiting to be signed in the editor. */
function answeredDraft(){
  const draft=createReport(P,engineer.name,engineer,'handover-inspection');
  putRecord('reports',{...draft,observations:draft.observations.map(o=>({...o,check:{...o.check,answer:'ok'}}))});
  return draft;
}

async function editor(scheme,width){
  const label=`editor ${scheme} ${width}px`;
  const draft=answeredDraft();
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
  await context.addCookies([{name:'relay_session',value:newSession(engineer),url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/reports/${draft.id}#check`);
  await page.locator('.sigway').waitFor();
  check(await page.locator('.sigpad').isVisible()&&await page.getByRole('radio',{name:'Draw my signature'}).isChecked(),`${label}: drawing is still the way it opens`);
  const send=page.getByRole('button',{name:'Send to office'});
  await press(page,page.getByRole('radio',{name:'Type my name instead'}));
  check(await page.locator('.sigpad').isHidden(),`${label}: typing hides the drawing box`);
  await typeName(page,'Tess Typed');
  await press(page,statement(page));
  await page.locator('.sigtyped-name',{hasText:'Tess Typed'}).waitFor();
  await page.getByText('Saved on server',{exact:true}).waitFor({timeout:15000});
  check(getReport(draft.id).draftSignature?.typed===true&&getReport(draft.id).draftSignature.name==='Tess Typed'&&!getReport(draft.id).draftSignature.dataUrl,`${label}: the draft holds a typed signature, no drawing: ${JSON.stringify(getReport(draft.id).draftSignature)}`);
  check(await send.isEnabled()&&!/Sign below/.test(await page.locator('#report-check').innerText()),`${label}: a typed name and tick are enough to send`);
  // A reload keeps it typed and ticked.
  await page.reload();await page.locator('.sigway').waitFor();
  check(await page.getByRole('radio',{name:'Type my name instead'}).isChecked()&&await statement(page).isChecked()&&await page.getByRole('textbox',{name:'Your full name'}).inputValue()==='Tess Typed',`${label}: still typed and ticked after a reload`);
  // Drawing instead takes the tick away; typing again needs a fresh tick.
  await press(page,page.getByRole('radio',{name:'Draw my signature'}));
  await page.waitForFunction(()=>!document.querySelector('.sigconfirm'));
  await saved(()=>!getReport(draft.id).draftSignature?.typed);
  check(await page.locator('#report-check',{hasText:'Sign below'}).count()===1,`${label}: choosing to draw clears the typed signature`);
  await press(page,page.getByRole('radio',{name:'Type my name instead'}));
  check(!(await statement(page).isChecked()),`${label}: typing again needs a fresh tick`);
  await press(page,statement(page));
  await saved(()=>getReport(draft.id).draftSignature?.typed===true);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${label}: no sideways scroll`);
  if(screenshot){await page.locator('.sigway').scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`typed-editor-${scheme}-${width}.png`)});}
  // Sent from the keyboard.
  await send.focus();await page.keyboard.press('Enter');
  await page.locator('.pagehead .tag-sent').waitFor({timeout:20000});
  const sent=getReport(draft.id);
  check(sent.state==='submitted'&&sent.signature?.typed===true&&sent.signature.name==='Tess Typed'&&sent.signature.statement===TYPED_STATEMENT&&sent.signature.signedInAs===engineer.name&&!sent.signature.dataUrl&&!!sent.signature.signedAt,`${label}: sent with a typed signature, the statement and who was signed in: ${JSON.stringify(sent.signature)}`);
  check(errors.length===0,`${label}: no page errors: ${errors.join(' | ')}`);
  await context.close();
  return sent;
}

async function office(sent,scheme,width){
  const label=`office ${scheme} ${width}px`;
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
  await context.addCookies([{name:'relay_session',value:newSession(manager),url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/office#/projects/${P}/report/${sent.id}`);
  const line=page.getByText(/Signed by typing the name Tess Typed/);await line.waitFor({timeout:20000});
  check(/signed in as Tess Typed/.test(await line.innerText()),`${label}: says it was typed and who was signed in: ${await line.innerText()}`);
  check(await page.getByText(`They ticked: “${TYPED_STATEMENT}”`).count()===1,`${label}: shows the statement they ticked`);
  if(screenshot){await line.scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`typed-office-${scheme}-${width}.png`)});}
  check(errors.length===0,`${label}: no page errors: ${errors.join(' | ')}`);
  await context.close();
}

/** The PDF, rendered from the sent report as the worker renders it for delivery. */
async function pdf(sent){
  const {documentModel}=require('../apps/web/.test-build/lib/documentModel.js');
  const {renderReportPdf}=await import(resolve('packages/documents/dist/index.js'));
  const bytes=await renderReportPdf(await documentModel(sent));
  const pdfjs=await import(resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs'));
  const doc=await pdfjs.getDocument({data:bytes.slice(),useSystemFonts:true}).promise;
  let text='';for(let n=1;n<=doc.numPages;n++)text+=(await (await doc.getPage(n)).getTextContent()).items.map(i=>i.str).join(' ')+'\n';
  const flat=text.replace(/\s+/g,' ');
  check(/Typed signature · \d\d\/\d\d\/\d{4}, \d\d:\d\d · signed in as Tess Typed/.test(flat),`PDF: the sign-off says typed, when and who was signed in`);
  check(flat.includes('I carried out this inspection and this record is accurate.'),`PDF: the statement is printed`);
  if(screenshot){
    const file=join(screenshot,'typed-signature.pdf');writeFileSync(file,bytes);
    try{execFileSync('pdftoppm',['-png','-r','90','-f',String(doc.numPages),'-l',String(doc.numPages),file,join(screenshot,'typed-pdf-signoff')]);}catch{}
  }
}

async function offline(scheme,width){
  const label=`no signal ${scheme} ${width}px`;
  const before=new Set(records('reports').filter(r=>r.authorId===engineer.id).map(r=>r.id));
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
  await context.addCookies([{name:'relay_session',value:newSession(engineer),url:base}]);
  let page=await context.newPage();const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());};watch(page);
  await page.goto(`${base}/engineer`);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await stop();
  await page.close();page=await context.newPage();watch(page);
  await page.goto(`${base}/engineer`);
  await page.getByRole('heading',{name:'Keep reporting. It is saved on this phone.'}).waitFor();
  await page.getByRole('radio',{name:/^First fix inspection/}).check();
  await page.getByRole('button',{name:'Start on this phone'}).click();
  await page.locator('#editor-title',{hasText:'New first fix inspection'}).waitFor();
  const cards=page.locator('.card');
  for(let i=0;i<12;i++)await cards.nth(i).getByLabel('Answer').selectOption('ok');
  await page.locator('#status',{hasText:'Saved on this phone'}).waitFor();
  const go=page.getByRole('button',{name:'Sign it. Send when there is signal'});
  await press(page,page.getByRole('radio',{name:/Type my name instead/}));
  check(await page.locator('.sigpad').isHidden()&&await go.isDisabled(),`${label}: typing hides the drawing box, and it cannot be signed before the tick`);
  await typeName(page,'Tess Typed');
  await press(page,statement(page));
  check(await go.isEnabled(),`${label}: a typed name and tick sign it`);
  if(screenshot){await page.locator('section.sign').scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`typed-offline-form-${scheme}-${width}.png`)});}
  await go.focus();await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Signed. Not sent yet.'}).waitFor();
  const sign=page.locator('section.sign');
  check(/Signed by Tess Typed by typing their name/.test(await sign.innerText())&&await sign.locator('.typed-name',{hasText:'Tess Typed'}).count()===1,`${label}: shows the typed signature: ${(await sign.innerText()).split('\n').slice(0,3).join(' / ')}`);
  if(screenshot){await sign.scrollIntoViewIfNeeded();await page.screenshot({path:join(screenshot,`typed-offline-signed-${scheme}-${width}.png`)});}
  await start();
  await page.goto(`${base}/engineer`);
  const note=page.locator('.held-send .note-ok');await note.waitFor({timeout:30000});
  check(/The inspection you signed on this phone has gone to the office\./.test(await note.innerText()),`${label}: says it has gone to the office`);
  const fresh=records('reports').filter(r=>r.authorId===engineer.id&&!before.has(r.id));
  check(fresh.length===1,`${label}: one report on the server`);
  const sent=getReport(fresh[0].id);
  check(sent.reportType==='first-fix-inspection'&&sent.state==='submitted'&&sent.signature?.typed===true&&sent.signature.name==='Tess Typed'&&sent.signature.statement===TYPED_STATEMENT&&sent.signature.signedInAs===engineer.name&&!sent.signature.dataUrl,`${label}: sent to the office signed as typed: ${JSON.stringify(sent.signature)}`);
  check(errors.length===0,`${label}: no page errors: ${errors.join(' | ')}`);
  await context.close();
}

try {
  if(screenshot)mkdirSync(screenshot,{recursive:true});
  await start();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const sent=await editor('light',390);
  await editor('dark',1440);
  await office(sent,'light',1440);
  await office(sent,'dark',390);
  await pdf(getReport(sent.id));
  await offline('dark',390);
  console.log(`Typed signature check passed (${checks} checks): handover inspections signed by typing a name from the keyboard in RELAY (390px light, 1440px dark), kept across a reload, cleared by choosing to draw, and sent; the office (1440px light, 390px dark) and its PDF say it was typed, with the statement and who was signed in; a first fix inspection signed by typing with no signal (390px dark) went to the office by itself, typed, when signal returned.`);
} finally {
  await browser?.close();await stop();rmSync(root,{recursive:true,force:true});
}
