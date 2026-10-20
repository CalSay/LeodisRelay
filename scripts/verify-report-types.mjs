// Browser check for EXP-5: a safety inspection, the first report type beside
// the site update. From the engineer home: start one, answer every check (one
// needing action, with a photograph), sign with a drawing, send. Then the
// server copy, the draft PDF's words, the sent view, the site diary and the
// office report sheet. At 390px light and 1440px dark.
// npm test && npm run build; set RELAY_SCREENSHOT_DIR=<dir> to save screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-report-types-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {SAFETY_CHECKLIST}=require('../apps/web/.test-build/lib/reportTypes.js');
const engineer={id:'entra:inspect-engineer',oid:'inspect-engineer',name:'Ivy Inspector',email:'ivy@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:inspect-manager',oid:'inspect-manager',name:'Morgan Office',email:'morgan@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});}
const sharp=require('sharp');
const png=async colour=>({name:`${colour.slice(1)}.png`,mimeType:'image/png',buffer:await sharp({create:{width:24,height:24,channels:3,background:colour}}).png().toBuffer()});
const port=4351,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-report-types-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const N=SAFETY_CHECKLIST.length;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await sleep(500);}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  const shot=async(page,name,full=false)=>{if(screenshot)await page.screenshot({path:join(screenshot,`${name}.png`),fullPage:full});};
  const contextFor=async(who,scheme,width,height)=>{const c=await browser.newContext({viewport:{width,height},colorScheme:scheme});await c.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);return c;};
  let n=0;
  for(const [scheme,width,height] of [['light',390,844],['dark',1440,900]]){
    n++;
    const label=`${scheme} ${width}px`,wide=width>=900;
    const context=await contextFor(engineer,scheme,width,height);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);

    // 1. The home screen offers it beside the site update.
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const tile=page.getByRole('button',{name:/Do a safety inspection/});
    await tile.waitFor();
    ok(/12 checks/.test(await tile.innerText()),`${label}: the tile says what an inspection asks`);
    ok(await page.getByRole('button',{name:/Start a site update/}).isVisible(),`${label}: the site update is still there`);
    eq(await overflow(),false,`${label}: home has no sideways scroll`);
    await shot(page,`home-${scheme}-${width}`);
    await tile.click();
    await page.waitForURL(/\/reports\/rep-/);
    const id=new URL(page.url()).pathname.split('/')[2];
    await page.locator('h1').filter({hasText:'Safety inspection'}).waitFor();checks++;
    ok((await page.locator('.pagehead .ref').innerText()).endsWith(`SSI-00${n}`),`${label}: its own reference series`);
    const rows=page.locator('.eng-checkrow');
    eq(await rows.count(),N,`${label}: one row per check`);
    eq(await page.getByRole('button',{name:/Add a card/}).count(),0,`${label}: no cards can be added to an inspection`);
    ok(/0\/12/.test(await page.locator('.eng-steps').innerText()),`${label}: the step says none answered yet`);

    // 2. The first check needs action, with words and a photograph.
    const card=()=>page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card');
    if(!wide)await rows.nth(0).click();
    await card().getByRole('heading',{name:SAFETY_CHECKLIST[0].question}).waitFor();checks++;
    await card().getByRole('button',{name:'Action needed'}).click();
    await card().getByLabel('What’s wrong',{exact:true}).fill('Extension lead with a cut sheath by the riser');
    await card().getByLabel('What needs doing',{exact:true}).fill('Withdraw the lead and replace it');
    await card().getByLabel('Who is to do it',{exact:true}).fill('Leodis Electrical');
    await card().locator('input[type=file]').setInputFiles([await png('#aa5533')]);
    await card().locator('.shot img').first().waitFor();
    await card().getByLabel('Caption for photograph 1',{exact:true}).fill('Cut sheath');
    eq(await overflow(),false,`${label}: an open check has no sideways scroll`);
    await shot(page,`check-action-${scheme}-${width}`);

    // 3. Each next check is a tap away; the rest are satisfactory but one.
    for(let i=1;i<N;i++){
      await page.locator('.eng-next-check:visible').click();
      await card().getByRole('heading',{name:SAFETY_CHECKLIST[i].question}).waitFor();
      await card().getByRole('button',{name:i===5?'Not applicable':'Satisfactory'}).click();
    }
    checks++;
    ok(/12\/12/.test(await page.locator('.eng-steps').innerText()),`${label}: every check answered`);
    ok(/action/i.test(await rows.nth(0).locator('.kind').innerText()),`${label}: the first row says it needs action`);
    const allDone=page.locator('.eng-review-link:visible').filter({hasText:'All answered'});
    eq(await allDone.count(),1,`${label}: the last check offers check and sign`);

    // 4. The draft PDF reads as an inspection (rendered on the server from what it holds).
    if(n===1){
      let saved;for(let k=0;k<40;k++){saved=getRecord('reports',id);if(saved.observations.every(o=>o.check?.answer))break;await sleep(250);}
      ok(saved.observations.every(o=>o.check?.answer),`${label}: every answer reached the server`);
      const pdf=await page.request.get(`${base}/api/reports/${id}/pdf`);
      eq(pdf.status(),200,`${label}: the draft PDF renders`);
      const file=join(root,'inspection.pdf');writeFileSync(file,await pdf.body());
      const text=spawnSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});if(process.env.RELAY_PDF_TEXT)writeFileSync(process.env.RELAY_PDF_TEXT,text.stdout??'');
      if(text.status===0){
        // Letter-spaced headings come out as "I N S P E C T I O N", so spaces are ignored.
        const said=text.stdout.replace(/\s+/g,''),says=words=>said.includes(words.replace(/\s+/g,''));
        for(const words of ['SITE SAFETY INSPECTION','ACTIONS ARISING','INSPECTION RESULTS','INSPECTED BY','Withdraw the lead and replace it','Leodis Electrical','Not applicable','NOTES AND PHOTOGRAPHS','Cut sheath'])ok(says(words),`${label}: the PDF says "${words}"`);
        ok(!says('SITE PROGRESS REPORT')&&!says('ACTION AND DECISION SUMMARY'),`${label}: the PDF is not laid out as a progress report`);
      } else console.log('pdftotext not found: PDF words not checked');
    }

    // 5. Check and sign: the drawing is required.
    await allDone.click();
    await page.locator('#report-check').waitFor();
    ok(/inspector’s signature/.test(await page.locator('#report-check .eng-finds').innerText()),`${label}: a missing drawing stops sending`);
    const send=page.getByRole('button',{name:'Send to office'});
    eq(await send.isDisabled(),true,`${label}: Send waits for the signature`);
    const sum=await page.locator('.eng-sum').innerText();
    ok(/Satisfactory\s*10/i.test(sum)&&/Action needed\s*1/i.test(sum)&&/Not applicable\s*1/i.test(sum),`${label}: the summary counts the answers: ${sum}`);
    ok(/Nothing is added to the issue register/.test(await page.locator('.eng-does').innerText()),`${label}: it says no issue is raised`);
    const pad=page.locator('canvas.sigpad');await pad.scrollIntoViewIfNeeded();
    const box=await pad.boundingBox();
    await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
    for(let x=20;x<box.width-20;x+=12)await page.mouse.move(box.x+x,box.y+box.height/2+Math.sin(x/15)*20);
    await page.mouse.up();
    await page.waitForFunction(()=>!document.querySelector('.actionbar .btn-primary')?.disabled);checks++;
    eq(await overflow(),false,`${label}: check and sign has no sideways scroll`);
    await shot(page,`check-sign-${scheme}-${width}`,true);
    await send.click();
    await page.locator('.tag-sent').filter({hasText:'Sent'}).waitFor();checks++;

    // 6. What the server holds, and the sent view.
    const sent=getRecord('reports',id);
    eq(sent.state,'submitted',`${label}: sent`);
    eq(sent.reportType,'safety-inspection',`${label}: kept as an inspection`);
    ok(/^data:image\/png;base64,/.test(sent.signature?.dataUrl??''),`${label}: signed with a drawing`);
    eq(sent.observations[0].check.answer,'action',`${label}: the action answer`);
    eq(sent.observations[0].owner,'Leodis Electrical',`${label}: who is to do it`);
    eq(sent.observations[0].photos.length,1,`${label}: its photograph`);
    eq(sent.observations[5].check.answer,'na',`${label}: the not applicable answer`);
    eq(records('issues','proj-011lme').length,0,`${label}: no issue raised`);
    eq(records('variations','proj-011lme').length,0,`${label}: no variation raised`);
    eq(await page.locator('.eng-sent-card').count(),N,`${label}: the sent view lists every check`);
    ok(/Action needed/i.test(await page.locator('.eng-sent-card').first().innerText()),`${label}: with its answer`);
    await shot(page,`sent-${scheme}-${width}`);

    // 7. The site diary shows it with its counts and the one check to act on.
    await page.goto(`${base}/diary?project=proj-011lme`);
    const entry=page.locator('.diary-entry').filter({hasText:sent.reference});
    await entry.waitFor();
    ok(/Safety inspection/i.test(await entry.locator('.diary-inspection').innerText())&&/10 satisfactory/.test(await entry.innerText()),`${label}: the diary names the inspection and its counts`);
    eq(await entry.locator('.diary-card').count(),1,`${label}: only the check needing action is a diary card`);
    eq(await overflow(),false,`${label}: the diary has no sideways scroll`);
    await shot(page,`diary-${scheme}-${width}`);

    // 8. Home again: a new inspection can be started.
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('button',{name:/Do a safety inspection/}).waitFor();checks++;
    assert.deepEqual(errors,[],`${label}: page errors`);
    await context.close();
  }

  // 9. The office reads it as an inspection, with its action listed, not raised.
  const sent=records('reports','proj-011lme').find(r=>r.reportType==='safety-inspection'&&r.state==='submitted');
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const context=await contextFor(manager,scheme,width,height);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects/proj-011lme/report/${sent.id}`);
    await page.getByText('Site Safety Inspection').first().waitFor();checks++;
    ok(await page.getByText('On this inspection').first().isVisible(),`office ${scheme}: the action is on the inspection, not raised`);
    ok(await page.getByText(SAFETY_CHECKLIST[0].question).first().isVisible(),`office ${scheme}: the question is shown`);
    if(screenshot)await page.screenshot({path:join(screenshot,`office-${scheme}-${width}.png`)});
    assert.deepEqual(errors,[],`office ${scheme}: page errors`);
    await context.close();
  }
  console.log(`Report types check passed (${checks} checks): a safety inspection started from home, answered, signed, sent, and read back at 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
