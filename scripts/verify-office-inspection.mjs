// Browser check for the office reading an inspection that has just come in.
// A handover inspection (12 checks: 3 need action, 1 not applicable) and a
// first fix inspection with no actions are sent from site. In the Inbox
// reader the inspection leads with its tally ("3 need action · 8
// satisfactory · 1 not applicable"), the checks needing action are listed
// with their issues, and the satisfactory and not applicable checks fold
// under one button until asked for. A passing check the office adds a note
// to stays in view. "Not applicable" does not run into its check. Section
// edges stay visible, axe finds nothing, no sideways scroll. 1440px light and
// dark, 390px light.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves the reader folded and open.
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
const root=mkdtempSync(join(tmpdir(),'relay-office-inspection-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
const {HANDOVER_CHECKLIST,FIRST_FIX_CHECKLIST}=require('../apps/web/.test-build/lib/reportTypes.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const engineer={id:'entra:office-inspection-sam',oid:'office-inspection-sam',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'};
const manager={id:'entra:office-inspection-manager',oid:'office-inspection-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
const session=randomUUID();
putRecord('sessions',{id:session,principal:manager,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
/** Send an inspection from site: `actions` and `na` are the checks (by position) answered that way, the rest satisfactory. */
async function inspect(type,actions,na){
  const r=createReport('proj-011lme',engineer.name,engineer,type,undefined,'Level 3 east flats');
  const observations=r.observations.map((o,i)=>{const answer=actions.includes(i)?'action':na.includes(i)?'na':'ok';
    return {...o,location:answer==='action'?`Flat 30${i}`:'',whatHappened:answer==='action'?`Fault at check ${i+1}`:'',actionNeeded:answer==='action'?`Put check ${i+1} right`:'',owner:answer==='action'?'Sparks Ltd':'',check:{...o.check,answer}};});
  const saved=saveDraft(r.id,{...r,observations,draftSignature:{name:engineer.name,typed:true}},r.version);assert.ok(saved.ok,JSON.stringify(saved));
  const sent=await submitReport(r.id,{name:engineer.name,typed:true},saved.value.version,engineer.name);assert.ok(sent.ok,JSON.stringify(sent));
  return sent.value;
}
const ACTIONS=[1,4,7],NA=[10];
const handover=await inspect('handover-inspection',ACTIONS,NA);
const firstFix=await inspect('first-fix-inspection',[],[2]);
const raised=records('issues','proj-011lme').filter(i=>i.raisedByReport===handover.id);
assert.equal(raised.length,ACTIONS.length,'each action raised an issue');
const short=ref=>ref.split('-').slice(-2).join('-');

const port=4364,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-office-inspection-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
const overflow=page=>page.evaluate(()=>Math.max(document.documentElement.scrollWidth-document.documentElement.clientWidth,...[...document.querySelectorAll('.view')].map(v=>v.scrollWidth-v.clientWidth)));
const axe=async(page,label)=>{await page.evaluate(axeSource);const found=await page.evaluate(async()=>(await window.axe.run(document.querySelector('.sheet'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')}`));check(!found.length,`${label}: axe finds nothing\n  ${found.join('\n  ')}`);};
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const errors=[];
  for(const [scheme,width,height] of [['light',1440,900],['dark',1440,900],['light',390,844]]){
    const label=`${scheme} ${width}px`,phone=width<700;
    const context=await browser.newContext({viewport:{width,height},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
    await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/office#/inbox`);
    const row=page.locator('.inbox-list tbody tr',{hasText:handover.reference});
    await row.waitFor({timeout:30000});
    if(!phone)check(/3 actions/i.test(await row.innerText()),`${label}: the Inbox row says 3 actions`);
    await row.click();
    const sheet=page.locator('.sheet');await sheet.locator('.check-tally').waitFor();
    const tally=await sheet.locator('.check-tally').innerText();
    check(tally==='3 need action · 8 satisfactory · 1 not applicable',`${label}: the tally matches the answers: "${tally}"`);
    const results=sheet.locator('.sec-h',{hasText:'Inspection results'});
    check(/12 checks/i.test(await results.innerText()),`${label}: the heading still counts every check`);
    // Before the fold: the three checks needing action, each with its issue, and nothing that passed.
    const listed=sheet.locator(':scope > .hist');
    check(await listed.count()===ACTIONS.length,`${label}: only the ${ACTIONS.length} checks needing action are listed first (${await listed.count()})`);
    for(const [n,i] of ACTIONS.entries()){
      const text=await listed.nth(n).innerText();
      check(text.includes(HANDOVER_CHECKLIST[i].question)&&/Action needed/i.test(text),`${label}: check ${i+1} is listed with Action needed`);
      const issue=raised.find(x=>x.raisedByObservation===handover.observations[i].id);
      check(text.includes(short(issue.reference)),`${label}: check ${i+1} links its issue ${short(issue.reference)}`);
    }
    const toggle=sheet.getByRole('button',{name:'Show the 8 satisfactory and 1 not applicable checks'});
    check(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false',`${label}: the passing checks fold under one button`);
    check(await sheet.getByText(HANDOVER_CHECKLIST[0].question,{exact:true}).count()===0,`${label}: a satisfactory check is not on screen until asked for`);
    check(await overflow(page)<=0,`${label}: no sideways scroll, folded`);
    if(shot)await page.screenshot({path:join(shot,`reader-folded-${scheme}-${width}.png`),fullPage:phone});
    await toggle.click();
    const hide=sheet.getByRole('button',{name:'Hide the 8 satisfactory and 1 not applicable checks'});
    check(await hide.getAttribute('aria-expanded')==='true',`${label}: the button now hides them`);
    const passed=sheet.locator('.checks-passed .hist');
    check(await passed.count()===9,`${label}: the 9 passing checks open in order (${await passed.count()})`);
    check((await passed.first().innerText()).includes(HANDOVER_CHECKLIST[0].question),`${label}: the first check is first`);
    // "Not applicable" stays inside its column rather than running into the check beside it.
    const na=sheet.locator('.checks-passed .hist',{hasText:HANDOVER_CHECKLIST[10].question});
    const clash=await na.evaluate(h=>{const t=h.querySelector('.d .kind').getBoundingClientRect(),b=h.querySelector('.b').getBoundingClientRect();return t.right-b.left;});
    check(clash<=0,`${label}: "Not applicable" does not overlap its check (${clash}px)`);
    check(await overflow(page)<=0,`${label}: no sideways scroll, open`);
    await axe(page,`${label} reader open`);
    if(shot)await page.screenshot({path:join(shot,`reader-open-${scheme}-${width}.png`),fullPage:phone});
    if(phone){
      // Last, as it changes the record the other widths read.
      // A note on a satisfactory check keeps it in view, with its change log, after the fold.
      const first=sheet.locator('.checks-passed .hist',{hasText:HANDOVER_CHECKLIST[0].question});
      await first.getByRole('button',{name:'Quick actions'}).click();
      await first.locator('textarea').fill('Checked again from the photographs');
      await first.getByRole('button',{name:/save/i}).click();
      await sheet.getByRole('button',{name:/the 7 satisfactory and 1 not applicable checks/}).waitFor({timeout:20000});
      const top=sheet.locator(':scope > .hist',{hasText:HANDOVER_CHECKLIST[0].question});
      check(await top.count()===1&&/Corrected/i.test(await top.innerText()),`${label}: the noted check stays above the fold, marked corrected`);
      await page.reload();await sheet.locator('.check-tally').waitFor();
      check(await sheet.getByRole('button',{name:'Show the 7 satisfactory and 1 not applicable checks'}).isVisible(),`${label}: after a reload, 8 checks fold and the noted one is listed`);
      check(await sheet.locator(':scope > .hist').count()===ACTIONS.length+1,`${label}: the three actions and the noted check are listed first`);
    }
    // An inspection with nothing to act on says so, and every check folds.
    await page.goto(`${base}/office#/inbox/${firstFix.id}`);await sheet.locator('.check-tally').waitFor();
    check(await sheet.locator('.check-tally').innerText()==='No actions · 11 satisfactory · 1 not applicable',`${label}: a clean inspection says No actions`);
    check(await sheet.locator(':scope > .hist').count()===0&&await sheet.getByRole('button',{name:'Show the 11 satisfactory and 1 not applicable checks'}).isVisible(),`${label}: all 12 checks fold`);
    await context.close();
  }
  check(!errors.length,`no page errors: ${errors.join('; ')}`);
  console.log(`verify-office-inspection: ${checks} checks passed`);
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
