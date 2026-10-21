// Browser check for accessibility across the engineer and office pages: an
// axe-core scan (WCAG 2.2 A and AA plus best practice: contrast, names,
// landmarks, headings) in light and dark at 390px and 1440px, one h1 per page,
// controls at least 44px tall on a phone, and a visible focus ring on every
// stop when tabbing through the page.
// Then the report editor and the no-signal page are walked through as an
// engineer would use them (a site update and a safety inspection: cards, an
// open card with a photo, Check & send with the signature, sent; on the
// no-signal page: start, a card with a photo, and signing an inspection), and
// each state gets the same checks. Signing an inspection by typing a name, in
// place of drawing, is done with the keyboard alone on both, as someone who
// cannot draw a signature would do it.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves a screenshot of each page at each width.
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
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const root=mkdtempSync(join(tmpdir(),'relay-a11y-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const sharp=require('sharp');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport}=require('../apps/web/.test-build/lib/serverStore.js');
const engineer={id:'entra:a11y-engineer',oid:'a11y-engineer',name:'Site Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:a11y-manager',oid:'a11y-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const admin={id:'entra:a11y-admin',oid:'a11y-admin',name:'Office Admin',email:'admin@example.test',role:'Admin'};
const sessions={};
for(const p of [engineer,manager,admin]){sessions[p.role]=randomUUID();putRecord('sessions',{id:sessions[p.role],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});}
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
// Issues in each state, two variations and a sent report, so tags, counts and register rows are on screen.
for(let n=1;n<=4;n++)putRecord('issues',{id:`a11y-${n}`,reference:`DEMO-011LME-ISS-00${n}`,projectId:'proj-011lme',source:'report',reportedBy:engineer.name,location:'Riser',description:`Missing fire stopping ${n}`,actionNeeded:'Fire stop the penetration',owner:n>1?'Acme Electrical':'',targetDate:n===2?daysAgo(3).slice(0,10):'',raisedByReport:'',raisedAt:daysAgo(10-n),
  work:n===3?'awaiting_verification':n===4?'closed':'open',confirmation:'confirmed',events:n===3?[{at:daysAgo(2),actor:engineer.name,actorId:engineer.id,kind:'closure_submitted',note:'',photos:[]}]:[],...(n===3?{closureSubmittedBy:engineer.name,closureSubmittedById:engineer.id}:{})});
for(let n=1;n<=2;n++)putRecord('variations',{id:`a11y-v${n}`,reference:`DEMO-011LME-VO-00${n}`,projectId:'proj-011lme',description:'Extra containment to the plant room ceiling void',location:'Plant room',trade:'HVAC',reason:'Client instruction',workDone:n===2,instruction:'pending',source:'office',raisedBy:admin.name,raisedAt:daysAgo(n),quotedValue:n===1?undefined:12000,events:[]});
const report=createReport('proj-011lme',engineer.name,engineer);
putRecord('reports',{...report,state:'submitted',review:'not_required',serverAcknowledgedAt:daysAgo(1),observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]},{id:randomUUID(),type:'defect',location:'Riser',whatHappened:'Missing fire stopping',actionNeeded:'Fire stop',owner:'Acme Electrical',photos:[]}]});
createReport('proj-011lme',engineer.name,engineer); // an unfinished report on the engineer home
const P='proj-011lme';
const pages={
  Engineer:[`/engineer?project=${P}`,`/engineer?project=${P}&view=issues`,`/engineer?project=${P}&view=reports`,`/engineer?project=${P}&view=projects`,`/engineer?project=${P}&view=defect`,
    `/issues/snag-list?project=${P}`,'/issues/a11y-1','/search?q=fire',`/weekly-summary?project=${P}`,`/photos?project=${P}`,`/diary?project=${P}`,'/my-week',`/safety-actions?project=${P}`,`/handover?project=${P}`,`/issue-trend?project=${P}`,'/help?for=site','/projects'],
  Manager:['/office#/projects','/office#/inbox','/office#/issues','/office#/variations',`/projects/${P}`,'/coverage','/companies','/variations/a11y-v1','/issues/a11y-3','/help?for=office'],
  Admin:['/office#/admin','/admin'],
  signedOut:['/signin'],
};
// Controls that may be smaller than 44px on a phone, and why.
const smallAllowed=[
  'a.ref',                      // a reference inside a row of text; the row has other ways in
  '.cov-scroll a',              // the coverage grid: dense by design, still 24px apart (axe target-size)
  '.camera input,.eng-photo-picker input', // hidden file inputs; the visible button around them is the target
  'label input[type="checkbox"]', // the whole label is the target
  'label.choice input[type="radio"]', // the no-signal page's report types: the whole label is the target
  '.sigway-options input[type="radio"]', // draw or type a signature: the whole label is the target
  'label.btn input[type="file"]', // the no-signal page's hidden file inputs; the label around them is the button
];
const port=4344,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-a11y-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,shot,jpeg,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
// The checks every page and editor state gets.
async function audit(page,label,{phone,ring,desk}){
  await page.evaluate(axeSource);
  const found=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));
  check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);
  check(await page.locator('h1').count()===1,`${label}: one h1 (${await page.locator('h1').count()})`);
  if(phone){
    const small=await page.evaluate(allowed=>[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button]')].filter(e=>{
      const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
      if(!r.width||!r.height||cs.visibility==='hidden'||allowed.some(s=>e.matches(s)))return false;
      if(e.tagName==='A'&&cs.display==='inline'&&e.closest('p,li,dd'))return false; // a link in a sentence
      return Math.round(r.height)<44||Math.round(r.width)<24;
    }).map(e=>`${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} ${e.tagName.toLowerCase()}.${String(e.className).trim().replace(/\s+/g,'.')} "${(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)}"`),smallAllowed);
    check(!small.length,`${label}: controls at least 44px tall\n  ${small.join('\n  ')}`);
  }
  if(desk){
    // The desk fills the window and its views scroll inside it, so the top bar and tabs stay put.
    const fit=await page.evaluate(()=>{const ws=document.querySelector('.ws');return ws.scrollHeight-ws.clientHeight;});
    check(fit<=1,`${label}: the office desk fits the window (${fit}px over)`);
  }
  if(ring){
    // Tab through the page: every stop shows a ring.
    await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});const bare=[];
    for(let k=0;k<30;k++){await page.keyboard.press('Tab');const f=await page.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;if(!e.matches(':focus'))return {ring:true}; // in a part the browser draws, such as a date's calendar button
const shows=el=>{const cs=getComputedStyle(el);return (cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none';};const around=e.closest('label');return {ring:shows(e)||(!!around&&shows(around)),name:`${e.tagName.toLowerCase()}${e.type?`[${e.type}]`:''} "${(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)}"`};});if(!f)break;if(!f.ring)bare.push(f.name);}
    check(!bare.length,`${label}: a visible focus ring at every stop (${bare.join(', ')})`);
    await page.evaluate(()=>document.activeElement?.blur());
  }
}
// The report editor and the no-signal page, in the states an engineer meets them.
let runs=0;
async function editorStates(scheme,width,phone){
  const principal={...engineer,id:`entra:a11y-editor-${++runs}`,oid:`a11y-editor-${runs}`};const id=randomUUID();
  putRecord('sessions',{id,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
  await context.addCookies([{name:'relay_session',value:id,url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const state=async name=>{await page.waitForTimeout(300);await audit(page,`editor ${name} ${scheme} ${width}px`,{phone,ring:width===1440&&scheme==='light'});if(shot)await page.screenshot({path:join(shot,`a11y-editor-${name}-${scheme}-${width}.png`)});};
  const open=phone?()=>page.locator('.eng-slot.open'):()=>page.locator('#card-editor > div:not([hidden])');
  const checkStep=async()=>{await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();await page.locator('#report-check').waitFor();};
  // A site update: the cards, an open card with a photo, the check step, sent.
  await page.goto(`${base}/engineer?project=${P}`);await page.getByText('Start a site update').click();
  await page.waitForURL(/\/reports\//);await page.locator('.eng-tile').first().waitFor();
  await state('update-new');
  await page.locator('.eng-tile').first().click();await open().getByLabel('Where',{exact:true}).waitFor();
  await open().getByLabel('Where',{exact:true}).fill('Level 2 corridor');
  await open().locator('textarea').first().fill('Containment run complete');
  await open().locator('input[type=file]').setInputFiles({name:'a.jpg',mimeType:'image/jpeg',buffer:jpeg});
  await open().locator('.shot img').first().waitFor();
  await state('update-card');
  if(phone)await open().locator('.eng-done').click();
  await checkStep();await page.getByText('Saved on server',{exact:true}).waitFor({timeout:15000});
  await state('update-check');
  await page.getByRole('button',{name:'Send to office'}).click();await page.locator('.pagehead .tag-sent').waitFor();
  await state('update-sent');
  // A tower inspection: the tile asks which tower (refused when empty), then Rename under the title.
  await page.goto(`${base}/engineer?project=${P}`);await page.getByRole('button',{name:/Do a tower inspection/}).click();
  await page.getByRole('button',{name:'Start the tower inspection'}).click();await page.getByRole('alert').filter({hasText:'Say which tower'}).waitFor();
  await state('tower-name');
  await page.getByLabel('Which tower or podium?').fill('T3, level 2 east corridor');await page.getByRole('button',{name:'Start the tower inspection'}).click();
  await page.waitForURL(/\/reports\//);await page.locator('.eng-inspected').waitFor();
  await page.locator('.eng-inspected').getByRole('button',{name:'Rename'}).click();await page.locator('#inspected-name').waitFor();
  await state('tower-rename');
  await page.getByRole('button',{name:'Cancel'}).click();
  // A safety inspection: its checks, one answered "Action needed", the check step with what stops it.
  await page.goto(`${base}/engineer?project=${P}`);await page.getByText(/Do a safety inspection/).click();
  await page.waitForURL(/\/reports\//);await page.locator('.eng-cardrow').first().waitFor();
  await state('inspection-new');
  if(phone)await page.locator('.eng-cardrow').first().click();
  await open().locator('.eng-answers').waitFor();
  await open().getByRole('button',{name:/Action needed/}).click();
  await state('inspection-action');
  await checkStep();
  check(await page.evaluate(()=>document.activeElement?.id==='report-check-title'),`editor ${scheme} ${width}px: Check & send takes focus to the check step`);
  await page.locator('#report-check .find-stop').first().click();await open().locator('.eng-answers').waitFor();
  check(await page.evaluate(w=>{const a=document.activeElement;return w?a?.matches('[data-card-body]:not([hidden])'):a?.matches('.eng-slot.open > button');},!phone),`editor ${scheme} ${width}px: a Stop takes focus to the card it opens`);
  await page.locator('.actionbar').getByRole('button',{name:/Check & send/}).click();await page.locator('#report-check').waitFor();
  await state('inspection-check');
  // Signed without drawing: chosen, typed and ticked with the keyboard alone.
  const keyboard=async locator=>{await locator.focus();await page.keyboard.press('Space');};
  await keyboard(page.getByRole('radio',{name:'Type my name instead'}));
  await page.getByRole('textbox',{name:'Your full name'}).fill('Site Engineer');
  await keyboard(page.getByRole('checkbox',{name:/I carried out this inspection/}));
  await page.locator('.sigtyped-name',{hasText:'Site Engineer'}).waitFor();
  check(await page.locator('.sigpad').isHidden(),`editor ${scheme} ${width}px: typing a name hides the drawing box`);
  await page.waitForFunction(()=>!document.querySelector('#report-check')?.textContent?.includes('Sign below'));
  check(await page.getByRole('status').filter({hasText:'Signed by typing the name Site Engineer'}).count()===1,`editor ${scheme} ${width}px: a screen reader hears that it is signed`);
  await state('inspection-typed');
  // The no-signal page, as the phone shows it when the server cannot be reached.
  await page.goto(`${base}/engineer?project=${P}`);await page.locator('.eng-list').first().waitFor();
  await context.route('**/api/health',r=>r.abort());
  await page.goto(`${base}/offline.html`);await page.locator('#start').waitFor();
  await state('offline-start');
  await page.getByRole('button',{name:'Start on this phone'}).click();await page.locator('#editor-title').waitFor();
  await page.locator('.adds button').first().click();await page.locator('.card').first().waitFor();
  await page.locator('.card').first().locator('input[type=file]').setInputFiles({name:'a.jpg',mimeType:'image/jpeg',buffer:jpeg});
  await page.locator('.shot img').first().waitFor();
  await state('offline-update');
  await page.getByRole('radio',{name:/^Safety inspection/}).check();
  await page.getByRole('button',{name:'Start on this phone'}).click();await page.locator('#editor-title',{hasText:'New safety inspection'}).waitFor();
  await state('offline-inspection');
  const cards=page.locator('.card');
  await cards.nth(0).getByLabel('Answer').selectOption('action');
  for(let i=1;i<12;i++)await cards.nth(i).getByLabel('Answer').selectOption('ok');
  await cards.nth(0).getByLabel('Notes or what is wrong').fill('Riser door left unlocked');
  await cards.nth(0).getByLabel('What needs doing').fill('Lock it');
  await page.locator('.sigpad').waitFor();
  await state('offline-sign');
  // Signed with no signal, by typing a name, with the keyboard alone.
  await keyboard(page.getByRole('radio',{name:/Type my name instead/}));
  await page.getByRole('textbox',{name:'Your full name'}).fill('Site Engineer');
  await keyboard(page.getByRole('checkbox',{name:/I carried out this inspection/}));
  const signIt=page.getByRole('button',{name:'Sign it. Send when there is signal'});
  check(await signIt.isEnabled(),`editor ${scheme} ${width}px: the no-signal page signs a typed name`);
  await state('offline-typed');
  await signIt.focus();await page.keyboard.press('Enter');
  await page.locator('#sign-title',{hasText:'Signed. Not sent yet.'}).waitFor();
  check(await page.locator('.typed-name',{hasText:'Site Engineer'}).count()===1,`editor ${scheme} ${width}px: the phone shows the typed signature`);
  await state('offline-typed-signed');
  assert.deepEqual(errors,[],`editor ${scheme} ${width}px: page errors`);
  await context.close();
}
const shotName=url=>url.replace(/^\//,'').replace(/[?#=&/]+/g,'-').replace(/proj-011lme|-+$/g,'').replace(/-+/g,'-').replace(/-$/,'')||'home';
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#886644'}}).jpeg().toBuffer();
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['light',1440],['dark',1440]]){
    const phone=width<700;
    for(const [role,list] of Object.entries(pages)){
      const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
      if(sessions[role])await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      for(const url of list){
        const label=`${role} ${url} ${scheme} ${width}px`;
        await page.goto(base+url,{waitUntil:'networkidle'});await page.waitForTimeout(300);
        await audit(page,label,{phone,ring:width===1440&&scheme==='light',desk:!phone&&url.startsWith('/office')});
        if(shot)await page.screenshot({path:join(shot,`a11y-${role.toLowerCase()}-${shotName(url)}-${scheme}-${width}.png`)});
      }
      assert.deepEqual(errors,[],`${role} ${scheme} ${width}px: page errors`);
      await context.close();
    }
  }
  // After every page, so the reports these make do not change what the pages above show.
  for(const [scheme,width] of [['light',390],['dark',390],['light',1440],['dark',1440]])await editorStates(scheme,width,width<700);
  console.log(`accessibility verification passed (${checks} checks)`);
} finally {
  if(browser)await browser.close();
  if(server.exitCode===null){server.kill();await once(server,'exit');}
  database().close();rmSync(root,{recursive:true,force:true});
}
