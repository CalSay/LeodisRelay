// Browser check for EXP-5's second report type: a pre-handover inspection of
// one area. From the engineer home: start one, answer every check (one needing
// action, which must say where), sign with a drawing, send. Then the server
// copy and the issue the action raised, the draft PDF's words, the sent view,
// the site diary, the snag list and the office report sheet. At 390px light
// and 1440px dark.
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
const root=mkdtempSync(join(tmpdir(),'relay-handover-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,getRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {HANDOVER_CHECKLIST}=require('../apps/web/.test-build/lib/reportTypes.js');
const {correctReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const engineer={id:'entra:handover-engineer',oid:'handover-engineer',name:'Hal Handover',email:'hal@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:handover-manager',oid:'handover-manager',name:'Morgan Office',email:'morgan@example.test',role:'Manager'};
const sessions={};
for(const p of [engineer,manager]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});}
const sharp=require('sharp');
const png=async colour=>({name:`${colour.slice(1)}.png`,mimeType:'image/png',buffer:await sharp({create:{width:24,height:24,channels:3,background:colour}}).png().toBuffer()});
const port=4353,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-handover-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const N=HANDOVER_CHECKLIST.length;
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
    const where=`L${n} office ${n}.04`;
    const context=await contextFor(engineer,scheme,width,height);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);

    // 1. The home screen offers it beside the site update and the safety inspection.
    await page.goto(`${base}/engineer?project=proj-011lme`);
    const tile=page.getByRole('button',{name:/Do a handover inspection/});
    await tile.waitFor();
    ok(/12 checks/.test(await tile.innerText())&&/snag list/.test(await tile.innerText()),`${label}: the tile says what it asks and where actions go`);
    ok(await page.getByRole('button',{name:/Do a safety inspection/}).isVisible(),`${label}: the safety inspection is still there`);
    ok(await page.getByRole('button',{name:/Start a site update/}).isVisible(),`${label}: the site update is still there`);
    eq(await overflow(),false,`${label}: home has no sideways scroll`);
    await shot(page,`home-${scheme}-${width}`);
    await tile.click();
    await page.waitForURL(/\/reports\/rep-/);
    const id=new URL(page.url()).pathname.split('/')[2];
    await page.locator('h1').filter({hasText:'Handover inspection'}).waitFor();checks++;
    ok((await page.locator('.pagehead .ref').innerText()).endsWith(`PHI-00${n}`),`${label}: its own reference series`);
    const rows=page.locator('.eng-checkrow');
    eq(await rows.count(),N,`${label}: one row per check`);
    eq(await page.getByRole('button',{name:/Add a card/}).count(),0,`${label}: no cards can be added`);

    // 2. The first check needs action: where, what, what to do, who, a photograph.
    const card=()=>page.locator(wide?'#card-editor .eng-card:visible':'.eng-slot.open .eng-card');
    if(!wide)await rows.nth(0).click();
    await card().getByRole('heading',{name:HANDOVER_CHECKLIST[0].question}).waitFor();checks++;
    eq(await card().getByLabel('Where',{exact:true}).count(),0,`${label}: no Where before the answer needs one`);
    await card().getByRole('button',{name:'Action needed'}).click();
    await card().getByLabel('What’s wrong',{exact:true}).fill('Tray lid missing over the desks');
    await card().getByLabel('What needs doing',{exact:true}).fill('Fit the tray lid');
    await card().getByLabel('Who is to do it',{exact:true}).fill('Leodis Electrical');
    ok(/snag list/.test(await card().innerText()),`${label}: the card says the action goes on the snag list`);
    await card().locator('input[type=file]').setInputFiles([await png('#3355aa')]);
    await card().locator('.shot img').first().waitFor();
    await card().getByLabel('Caption for photograph 1',{exact:true}).fill('Open tray');
    eq(await overflow(),false,`${label}: an open check has no sideways scroll`);

    // 3. The rest: satisfactory, but one not applicable.
    for(let i=1;i<N;i++){
      await page.locator('.eng-next-check:visible').click();
      await card().getByRole('heading',{name:HANDOVER_CHECKLIST[i].question}).waitFor();
      await card().getByRole('button',{name:i===4?'Not applicable':'Satisfactory'}).click();
    }
    checks++;
    const allDone=page.locator('.eng-review-link:visible').filter({hasText:'All answered'});
    eq(await allDone.count(),1,`${label}: the last check offers check and sign`);

    // 4. Check and sign: the missing Where stops sending, and says why.
    await allDone.click();
    await page.locator('#report-check').waitFor();
    ok(/say where, for the snag list/.test(await page.locator('#report-check .eng-finds').innerText()),`${label}: an action with no Where stops sending`);
    ok(/1 issue raised/.test(await page.locator('.eng-does').innerText()),`${label}: it says sending raises an issue`);
    const sum=await page.locator('.eng-sum').innerText();
    ok(/Action needed\s*1\s*raise issues/i.test(sum),`${label}: the summary says actions raise issues: ${sum}`);
    // Back to the check to say where.
    await page.locator('.eng-steps button').nth(0).click();
    if(!wide)await rows.nth(0).click();else await rows.nth(0).click();
    await card().getByLabel('Where',{exact:true}).fill(where);
    await shot(page,`check-action-${scheme}-${width}`);
    await page.locator('.eng-steps button').nth(1).click();
    await page.locator('#report-check').waitFor();
    let savedWhere;for(let k=0;k<40;k++){savedWhere=getRecord('reports',id).observations[0].location;if(savedWhere===where)break;await sleep(250);}
    eq(savedWhere,where,`${label}: Where reached the server`);

    // 5. The draft PDF reads as a handover inspection, with the action's place.
    if(n===1){
      const pdf=await page.request.get(`${base}/api/reports/${id}/pdf`);
      eq(pdf.status(),200,`${label}: the draft PDF renders`);
      const file=join(root,'handover.pdf');writeFileSync(file,await pdf.body());
      const text=spawnSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
      if(text.status===0){
        const said=text.stdout.replace(/\s+/g,''),says=words=>said.includes(words.replace(/\s+/g,''));
        for(const words of ['PRE-HANDOVER INSPECTION','ACTIONS ARISING','INSPECTION RESULTS','INSPECTED BY','Fit the tray lid',where,'Leodis Electrical','Not applicable','Open tray'])ok(says(words),`${label}: the PDF says "${words}"`);
        ok(!says('SITE SAFETY INSPECTION')&&!says('SITE PROGRESS REPORT'),`${label}: the PDF is not another type`);
      } else console.log('pdftotext not found: PDF words not checked');
    }

    // 6. Sign with a drawing and send.
    const send=page.getByRole('button',{name:'Send to office'});
    eq(await send.isDisabled(),true,`${label}: Send waits for the signature`);
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

    // 7. The server copy, and the one issue the action raised.
    const sent=getRecord('reports',id);
    eq(sent.state,'submitted',`${label}: sent`);
    eq(sent.reportType,'handover-inspection',`${label}: kept as a handover inspection`);
    ok(/^data:image\/png;base64,/.test(sent.signature?.dataUrl??''),`${label}: signed with a drawing`);
    const raised=records('issues','proj-011lme').filter(i=>i.raisedByReport===id);
    eq(raised.length,1,`${label}: one issue raised for the one action`);
    eq(raised[0].location,where,`${label}: the issue says where`);
    eq(raised[0].description,'Tray lid missing over the desks',`${label}: the issue says what is wrong`);
    eq(raised[0].actionNeeded,'Fit the tray lid',`${label}: and what needs doing`);
    eq(raised[0].owner,'Leodis Electrical',`${label}: and who`);
    eq(raised[0].events[0].photos.length,1,`${label}: with its photograph`);
    eq(records('variations','proj-011lme').length,0,`${label}: no variation raised`);
    eq(await page.locator('.eng-sent-card').count(),N,`${label}: the sent view lists every check`);
    ok((await page.locator('.eng-sent-card').first().innerText()).includes(where),`${label}: the sent view says where`);
    await shot(page,`sent-${scheme}-${width}`);

    // 8. The site diary: counts, the one action with where and its issue.
    await page.goto(`${base}/diary?project=proj-011lme`);
    const entry=page.locator('.diary-entry').filter({hasText:sent.reference});
    await entry.waitFor();
    ok(/Handover inspection/i.test(await entry.locator('.diary-inspection').innerText()),`${label}: the diary names the inspection`);
    eq(await entry.locator('.diary-card').count(),1,`${label}: only the action is a diary card`);
    const dcard=await entry.locator('.diary-card').innerText();
    ok(dcard.includes(where)&&dcard.includes(raised[0].reference.split('-').slice(-2).join('-')),`${label}: the diary card says where and names its issue: ${dcard}`);
    eq(await overflow(),false,`${label}: the diary has no sideways scroll`);
    await shot(page,`diary-${scheme}-${width}`);

    // 9. Home again: a new one can be started.
    await page.goto(`${base}/engineer?project=proj-011lme`);
    await page.getByRole('button',{name:/Do a handover inspection/}).waitFor();checks++;
    assert.deepEqual(errors,[],`${label}: page errors`);
    await context.close();
  }

  // 10. The office reads it as a handover inspection, with each action's issue linked.
  const sent=records('reports','proj-011lme').find(r=>r.reportType==='handover-inspection'&&r.state==='submitted');
  const issue=records('issues','proj-011lme').find(i=>i.raisedByReport===sent.id);
  for(const [scheme,width,height] of [['dark',1440,900],['light',390,844]]){
    const context=await contextFor(manager,scheme,width,height);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects/proj-011lme/report/${sent.id}`);
    await page.getByText('Pre-Handover Inspection').first().waitFor();checks++;
    eq(await page.getByText('On this inspection').count(),0,`office ${scheme}: the action is not kept on the inspection`);
    const short=issue.reference.split('-').slice(-2).join('-');
    ok(await page.locator('.rmenu a.ref').filter({hasText:short}).first().isVisible(),`office ${scheme}: the action links its issue ${short}`);
    ok(await page.getByText(`${HANDOVER_CHECKLIST[0].question} · ${sent.observations[0].location}`).first().isVisible(),`office ${scheme}: the question and where`);
    if(screenshot)await page.screenshot({path:join(screenshot,`office-${scheme}-${width}.png`)});
    // The issue page, reached from the report.
    await page.goto(`${base}/office#/projects/proj-011lme/issue/${issue.id}`);
    await page.getByText('Tray lid missing over the desks').first().waitFor();checks++;
    assert.deepEqual(errors,[],`office ${scheme}: page errors`);
    await context.close();
  }
  // 11. A sent correction raises nothing new: the office sheet still links each action's issue.
  const correction=correctReport(sent.id,'Wrong owner').value;
  const resaved=saveDraft(correction.id,{...correction,draftSignature:{name:engineer.name,dataUrl:'data:image/png;base64,iVBORw0KGgo='}},correction.version).value;
  const rev2=await submitReport(correction.id,{name:engineer.name,dataUrl:'data:image/png;base64,iVBORw0KGgo='},resaved.version);
  ok(rev2.ok,`rev 2 sent: ${rev2.reason??''}`);
  eq(records('issues','proj-011lme').filter(i=>i.raisedByReport===correction.id).length,0,'the correction raises no new issue');
  {
    const context=await contextFor(manager,'light',1440,900);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/projects/proj-011lme/report/${correction.id}`);
    await page.getByText('Pre-Handover Inspection').first().waitFor();checks++;
    const short=issue.reference.split('-').slice(-2).join('-');
    ok(await page.locator('.rmenu a.ref').filter({hasText:short}).first().isVisible(),`office rev 2: the action still links its issue ${short}`);
    eq(await page.locator('.rmenu').getByText('no issue').count(),0,'office rev 2: no action reads "no issue"');
    assert.deepEqual(errors,[],'office rev 2: page errors');
    await context.close();
  }
  console.log(`Handover inspection check passed (${checks} checks): started from home, answered, Where required, signed, sent, an issue raised, and read back at 390px light and 1440px dark.`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
