// Browser check for "Yours" on the engineer's Issues tab (2026-10-21).
// Walking an engineer's Friday afternoon at 390px found that "what is still
// mine to do?" meant picking "All projects" (two taps), then scrolling about
// 2,800px of every trade's issues, three sites each with their own filter
// buttons; and after putting one forward as fixed, Back reset the list to
// "This project", so the next site's issue had gone until All projects was
// picked again. Putting two forward on two sites took 11 taps.
// Now the tab opens on "Yours": on every site, the open issues the engineer
// raised, worked on or that are for their trade, a section per site with a
// count, the office's sent-back ones first with what they wrote; put forward
// as fixed leaves the list and is counted; Back keeps the list.
// Checks at 390px light (the whole flow, counting taps), then 390px dark and
// 1440px dark on the state it leaves; an engineer with no trade; an engineer
// with nothing open (says so, one tap to every issue); Open and All issues
// still list every trade, and keep the project choice after Back.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
// RELAY_SCREENSHOT_DIR=<dir> saves screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const sharp=require('sharp');
const root=mkdtempSync(join(tmpdir(),'relay-issues-yours-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,saveDraft,submitReport}=require('../apps/web/.test-build/lib/serverStore.js');
const {listIssues,applyCommand}=require('../apps/web/.test-build/lib/issueStore.js');
const {runOneJob}=require('../apps/web/.test-build/lib/reportWorker.js');
const person=(oid,name,trade)=>({id:`entra:${oid}`,oid,name,email:`${oid}@example.test`,role:'Engineer',...(trade?{trade}:{})});
const sam=person('iy-sam','Sam Sparks','Electrical'),pat=person('iy-pat','Pat Pipe','P&H'),nora=person('iy-nora','Nora No-Trade'),quiet=person('iy-quiet','Quinn Quiet','HVAC');
const olive={id:'entra:iy-olive',oid:'iy-olive',name:'Olive Office',email:'olive@example.test',role:'Manager'};
const sessions={};
for(const p of [sam,pat,nora,quiet]){sessions[p.oid]=randomUUID();putRecord('sessions',{id:sessions[p.oid],principal:p,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});}
const photo=[{id:randomUUID(),dataUrl:'data:image/jpeg;base64,'+(await sharp({create:{width:320,height:240,channels:3,background:'#aa7744'}}).jpeg().toBuffer()).toString('base64'),caption:'',capturedAt:new Date().toISOString()}];
const ob=(type,location,whatHappened,extra={})=>({id:randomUUID(),type,location,whatHappened,actionNeeded:'',owner:'',photos:[],...extra});
const defect=(location,what,trade)=>ob('defect',location,what,{actionNeeded:'Put right',owner:'Leodis',affectedTrade:trade,photos:photo});
const T='proj-011lme',K='proj-014lme',H='proj-009lcp';
const send=async(who,P,obs)=>{const r=createReport(P,who.name,who,'progress');const saved=saveDraft(r.id,{...r,observations:obs},r.version).value;const sent=await submitReport(r.id,undefined,saved.version,who.name);assert.ok(sent.ok,JSON.stringify(sent));while(await runOneJob());await new Promise(r=>setTimeout(r,5));};
// Sam on three sites; Pat raises some for Sam's trade and some for their own.
await send(sam,T,[ob('update','Level 2','First fix'),defect('Flat 2.04','Pull cord switch missing','Electrical')]);
await send(sam,T,[defect('Flat 5.01','Riser door label missing','Electrical'),defect('Level 1 corridor','Ceiling tile cracked by the ladder','Other / non-Leodis')]);
await send(pat,T,[defect('Level 2 riser','Cable clashing with pipework at riser','Electrical'),defect('Level 4','Pipe lagging missing','P&H')]);
await send(sam,K,[defect('Flat 9.04','Light fitting not earthed','Electrical'),defect('Flat 9.05','Spur not labelled','Electrical')]);
await send(pat,K,[defect('Core B','Isolator missing for fan coil','Electrical'),defect('Core B','Valve leaking','P&H')]);
await send(sam,H,[defect('Flat 7.02','Socket faceplate cracked','Electrical')]);
await send(nora,H,[defect('Welfare cabin','Door closer loose','Other / non-Leodis')]);
const byName=d=>listIssues().find(i=>i.description===d);
const QUESTION='Site manager says it is still loose. Can you look again on Friday?';
// The office sent the pull cord back with a question; the earthing is put forward, waiting; the spur was checked and closed.
const cord=byName('Pull cord switch missing');
assert.ok(applyCommand(cord.id,{kind:'submit_closure',actor:sam.name,actorId:sam.id,note:'Done'}).ok);
assert.ok(applyCommand(cord.id,{kind:'reopen',actor:olive.name,actorId:olive.id,note:QUESTION}).ok);
assert.ok(applyCommand(byName('Light fitting not earthed').id,{kind:'submit_closure',actor:sam.name,actorId:sam.id,note:'Done'}).ok);
const spur=byName('Spur not labelled');
assert.ok(applyCommand(spur.id,{kind:'submit_closure',actor:sam.name,actorId:sam.id,note:'Done'}).ok);
assert.ok(applyCommand(spur.id,{kind:'verify',actor:olive.name,actorId:olive.id,note:''}).ok);

const port=4512,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-issues-yours',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shots=process.env.RELAY_SCREENSHOT_DIR;if(shots)mkdirSync(shots,{recursive:true});
  const open=async(who,scheme,width)=>{const wide=width>=900;const context=await browser.newContext({viewport:{width,height:wide?900:844},colorScheme:scheme,...(wide?{}:{hasTouch:true,isMobile:true})});await context.addCookies([{name:'relay_session',value:sessions[who.oid],url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {context,page,errors};};
  const sections=page=>page.locator('main section.eng-panel').evaluateAll(els=>els.map(e=>({site:e.querySelector('h2')?.firstChild?.textContent?.trim(),count:e.querySelector('.eng-yours-count')?.textContent,waiting:e.querySelector('.eng-yours-waiting')?.textContent??'',cards:[...e.querySelectorAll('.eng-issue-card h3')].map(h=>h.textContent)})));
  const settle=async page=>{await page.locator('.eng-issue-list, .eng-yours-empty').first().waitFor();await page.waitForTimeout(300);};
  const layout=async(page,at)=>{
    ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${at}: no sideways scroll`);
    if(!at.includes('1440')){const small=await page.evaluate(()=>[...document.querySelectorAll('.eng-issue-tabs button, .eng-issue-card')].filter(e=>e.getBoundingClientRect().height<48).map(e=>e.textContent.trim()));ok(small.length===0,`${at}: buttons and cards 48px or taller (${small.join(', ')})`);}
  };

  // 390px light: the whole Friday flow, counting taps.
  {
    const at='light 390';const {context,page,errors}=await open(sam,'light',390);let taps=0;
    const tap=async loc=>{await loc.scrollIntoViewIfNeeded();await loc.click();taps++;};
    await page.goto(`${base}/engineer?project=${T}`);await page.getByText('Came back from the office').waitFor();
    await tap(page.getByRole('button',{name:'Issues',exact:true}).first());await settle(page);
    ok(await page.getByRole('button',{name:'Yours'}).getAttribute('aria-pressed')==='true',`${at}: Issues opens on Yours`);
    ok(await page.locator('#eng-issue-scope').count()===0,`${at}: no project dropdown on Yours`);
    let s=await sections(page);
    ok(await page.locator('main section.eng-panel h2').first().evaluate(h=>h.textContent)==='Tetley Hall - Block E 4 to do',`${at}: the site heading reads with a space before its count`);
    ok(JSON.stringify(s.map(x=>x.site))===JSON.stringify(['Tetley Hall - Block E','Kirkstall Gate - Phase 2','Hunslet Depot - Welfare Block']),`${at}: a section per site, the current one first: ${JSON.stringify(s)}`);
    ok(s[0].count==='4 to do'&&s[0].cards[0]==='Pull cord switch missing',`${at}: Tetley Hall has 4 to do, the sent-back one first: ${JSON.stringify(s[0])}`);
    ok(['Riser door label missing','Ceiling tile cracked by the ladder','Cable clashing with pipework at riser'].every(d=>s[0].cards.includes(d)),`${at}: raised by Sam (any trade) and Pat's for Sam's trade are listed`);
    const all=s.flatMap(x=>x.cards);
    const api=await (await page.request.get(`${base}/api/issues?only=yours`)).json();
    ok(api.issues.length===7&&!api.issues.some(i=>['Pipe lagging missing','Valve leaking','Door closer loose','Spur not labelled'].includes(i.description)),`${at}: the phone downloads only Sam's open issues (seven, one waiting): ${api.issues.map(i=>i.description)}`);
    ok(!all.includes('Pipe lagging missing')&&!all.includes('Valve leaking')&&!all.includes('Door closer loose'),`${at}: other trades' issues raised by others are left out`);
    ok(!all.includes('Spur not labelled')&&!all.includes('Light fitting not earthed'),`${at}: closed and put-forward issues are not listed`);
    ok(s[1].count==='1 to do'&&/1 put forward as fixed, waiting for the office to check/.test(s[1].waiting),`${at}: Kirkstall Gate counts the one waiting: ${JSON.stringify(s[1])}`);
    const cordCard=page.locator('.eng-issue-card',{hasText:'Pull cord switch missing'});
    const cordText=await cordCard.innerText();
    ok(/Sent back/i.test(cordText)&&cordText.includes(`Olive Office wrote on`)&&cordText.includes('still loose'),`${at}: the sent-back card says so, with what the office wrote: ${JSON.stringify(cordText)}`);
    ok(await cordCard.locator('img').count()===1&&/Who is fixing it: Leodis/.test(cordText),`${at}: the card keeps its photo and who is fixing it`);
    await layout(page,at);
    if(shots)await page.screenshot({path:join(shots,'after-issues-yours-light-390.png'),fullPage:true});
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);console.log(`${at}: Yours page ${height}px`);
    // Put two forward as fixed on two sites.
    for(const [name,site] of [['Riser door label missing',0],['Socket faceplate cracked',2]]){
      await tap(page.locator('.eng-issue-card',{hasText:name}));await page.locator('.issue-eng-title').waitFor();
      await tap(page.getByRole('button',{name:'Put forward as fixed'}));await page.getByText('waiting for the office to check').waitFor();
      await tap(page.getByRole('link',{name:'← Back to Issues'}));await settle(page);
      ok(await page.getByRole('button',{name:'Yours'}).getAttribute('aria-pressed')==='true',`${at}: Back from ${name} returns to Yours`);
      s=await sections(page);
      ok(!s.flatMap(x=>x.cards).includes(name),`${at}: ${name} has left the list`);
      ok(/put forward as fixed/.test(s[site].waiting),`${at}: its site counts it as waiting: ${JSON.stringify(s[site])}`);
    }
    ok(taps===7,`${at}: two issues on two sites put forward in 7 taps from home (was 11): ${taps}`);
    s=await sections(page);
    ok(s[0].count==='3 to do'&&s[2].count==='0 to do'&&s[2].cards.length===0&&/1 put forward/.test(s[2].waiting),`${at}: counts follow: ${JSON.stringify(s)}`);
    ok(!(await page.locator('main section.eng-panel').nth(2).innerText()).includes('Nothing left'),`${at}: a site with only waiting issues says so once, not twice`);
    // Open and All issues still list every trade on one project, and keep the project choice after Back.
    await page.getByRole('button',{name:'Open',exact:true}).click();await settle(page);
    ok(await page.locator('#eng-issue-scope').inputValue()==='current',`${at}: Open starts on this project`);
    const openText=await page.locator('main').innerText();
    ok(openText.includes('Pipe lagging missing')&&!openText.includes('Valve leaking'),`${at}: Open lists every trade on this project only`);
    await page.locator('#eng-issue-scope').selectOption('all');await page.locator('.eng-issue-card',{hasText:'Valve leaking'}).waitFor();
    ok(true,`${at}: All projects lists the other sites`);
    await page.locator('.eng-issue-card',{hasText:'Valve leaking'}).click();await page.locator('.issue-eng-title').waitFor();
    await page.getByRole('link',{name:'← Back to Issues'}).click();await settle(page);
    ok(await page.getByRole('button',{name:'Open',exact:true}).getAttribute('aria-pressed')==='true'&&await page.locator('#eng-issue-scope').inputValue()==='all',`${at}: Back keeps Open and All projects`);
    await page.getByRole('button',{name:'All issues'}).click();await page.locator('.eng-issue-card',{hasText:'Spur not labelled'}).first().waitFor();
    ok(true,`${at}: All issues includes closed ones`);
    // The home's "Site issues" row counts every trade here, so it opens Open on this project.
    await page.getByRole('button',{name:'Site',exact:true}).first().click();await page.getByText('Came back from the office').waitFor();
    await page.getByRole('button',{name:/^Site issues/}).click();await settle(page);
    ok(await page.getByRole('button',{name:'Open',exact:true}).getAttribute('aria-pressed')==='true'&&await page.locator('#eng-issue-scope').inputValue()==='current',`${at}: the home's Site issues row opens Open on this project`);
    // The tab always opens on Yours again.
    await page.getByRole('button',{name:'Site',exact:true}).first().click();await page.getByText('Came back from the office').waitFor();
    await page.getByRole('button',{name:'Issues',exact:true}).first().click();await settle(page);
    ok(await page.getByRole('button',{name:'Yours'}).getAttribute('aria-pressed')==='true',`${at}: the Issues tab opens on Yours again`);
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }

  // 390px dark and 1440px dark: the state the flow left.
  for(const [scheme,width] of [['dark',390],['dark',1440]]){
    const at=`${scheme} ${width}`;const {context,page,errors}=await open(sam,scheme,width);
    await page.goto(`${base}/engineer?project=${K}&view=issues`);await settle(page);
    const s=await sections(page);
    ok(s[0].site==='Kirkstall Gate - Phase 2'&&s.length===3,`${at}: the site Sam is on comes first: ${JSON.stringify(s.map(x=>x.site))}`);
    ok(s.find(x=>x.site==='Tetley Hall - Block E').cards[0]==='Pull cord switch missing',`${at}: the sent-back issue still leads its site`);
    await layout(page,at);
    if(shots)await page.screenshot({path:join(shots,`after-issues-yours-${scheme}-${width}.png`),fullPage:true});
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }

  // No trade set: what they raised is theirs, never another trade's or nothing.
  {
    const at='no trade';const {context,page,errors}=await open(nora,'light',390);
    await page.goto(`${base}/engineer?project=${H}&view=issues`);await settle(page);
    const s=await sections(page);
    ok(s.length===1&&JSON.stringify(s[0].cards)===JSON.stringify(['Door closer loose']),`${at}: lists what they raised: ${JSON.stringify(s)}`);
    const intro=await page.locator('.eng-heading').innerText();
    ok(/issues you raised or added to, still to do/.test(intro)&&!/trade/.test(intro),`${at}: the heading does not mention a trade they have not got: ${JSON.stringify(intro)}`);
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  // Nothing open: says so, one tap to every issue.
  {
    const at='nothing open';const {context,page,errors}=await open(quiet,'light',390);
    await page.goto(`${base}/engineer?project=${T}&view=issues`);await settle(page);
    const text=await page.locator('.eng-yours-empty').innerText();
    ok(/Nothing open for you on any of your \d+ sites/.test(text),`${at}: says so plainly: ${JSON.stringify(text)}`);
    await page.getByRole('button',{name:'See all issues'}).click();await page.locator('.eng-issue-card',{hasText:'Pipe lagging missing'}).waitFor();
    ok(await page.getByRole('button',{name:'All issues'}).getAttribute('aria-pressed')==='true'&&await page.locator('#eng-issue-scope').inputValue()==='all',`${at}: one tap to all issues on every site`);
    await layout(page,at);
    if(shots)await page.screenshot({path:join(shots,'after-issues-yours-empty-light-390.png'),fullPage:true});
    assert.deepEqual(errors,[],`${at}: page errors`);
    await context.close();
  }
  console.log(`Yours on the Issues tab check passed (${checks} checks): every site, own and own-trade issues, sent back first with the office's words, put forward counted not listed, 7 taps for two on two sites, Back keeps the list, no trade, nothing open, light and dark.`);
} catch (error) { console.error(output.slice(-3000)); throw error; }
finally { await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true}); }
