// Browser check for the quiet trades line on Site coverage: under an active
// site, "No P&H report yet this week" names each trade that sent a report from
// there in the two weeks before this week but none from Monday to today. Two
// data sets, each with its own server: a small hand-made one with known
// answers, and the busy seed (scripts/seed-busy-projects.mjs) with one trade's
// reports this week turned back into drafts, where every row is checked
// against a count made here from the stored records. Office, desktop dark and
// phone light. On a Monday the line is never shown, and that is what is checked.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const here=fileURLToPath(import.meta.url);
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const weekday=ymd=>(new Date(`${ymd}T12:00:00Z`).getUTCDay()+6)%7;
const SAFETY=new Set(['safety-inspection','tower-inspection']);
const ORDER=['Electrical','HVAC','P&H'];
const words=ts=>!ts.length?'':`No ${ts.length===1?ts[0]:`${ts.slice(0,-1).join(', ')} or ${ts.at(-1)}`} report yet this week`;

// Child mode: write one data set into RELAY_DATA_ROOT and print what each project's line should say.
if(process.argv[2]==='seed'){
  const {putRecord,records,database}=require('../apps/web/.test-build/lib/storage.js');
  const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
  const today=londonDay(new Date()),monday=addDays(today,-weekday(today)),now=new Date().toISOString();
  const manager={id:'entra:quiet-manager',oid:'quiet-manager',name:'Office Manager',email:'manager@example.test',role:'Manager'};
  const session=randomUUID();
  putRecord('sessions',{id:session,principal:manager,issuedAt:now,expiresAt:new Date(Date.now()+900000).toISOString()});
  const projects={'proj-011lme':'011LME','proj-014lme':'014LME','proj-009lcp':'009LCP'};
  if(process.argv[3]==='busy'){
    const {seedBusyProjects}=await import('./seed-busy-projects.mjs');
    seedBusyProjects({storagePath:require.resolve('../apps/web/.test-build/lib/storage.js'),today});
    // Every trade reports every weekday in the busy seed, so take this week's P&H on 014LME back to drafts: the line has something to say.
    for(const r of records('reports','proj-014lme'))if(r.authorTrade==='P&H'&&r.visitDate>=monday&&r.state==='submitted')putRecord('reports',{...r,state:'draft'});
  } else {
    let n=0;const report=(projectId,by,trade,visitDate,extra={})=>putRecord('reports',{id:randomUUID(),projectId,reference:`${projects[projectId]}-SPR-${String(++n).padStart(3,'0')}`,visitDate,author:by,authorId:`entra:quiet-${by.split(' ')[0].toLowerCase()}`,authorTrade:trade,state:'submitted',version:1,revision:1,review:'not_required',serverAcknowledgedAt:now,observations:[],...extra});
    // 011LME: Sam reported last week and this week; Pat and Hana only before this week; Hana's draft today is not a report.
    report('proj-011lme','Sam Spark','Electrical',addDays(monday,-3));
    report('proj-011lme','Sam Spark','Electrical',today);
    report('proj-011lme','Pat Pipe','P&H',addDays(monday,-5));
    report('proj-011lme','Hana Duct','HVAC',addDays(monday,-14));
    report('proj-011lme','Hana Duct','HVAC',today,{state:'draft'});
    // A P&H report from three weeks back is outside the two weeks, so it says nothing.
    report('proj-014lme','Pat Pipe','P&H',addDays(monday,-15));
    report('proj-014lme','Sam Spark','Electrical',addDays(monday,-1));
    report('proj-014lme','Sam Spark','Electrical',today);
    // 014LME: a safety inspection is a switched-off record, so HVAC's one before this week does not count.
    report('proj-014lme','Hana Duct','HVAC',addDays(monday,-2),{reportType:'safety-inspection'});
    // 009LCP is in defects liability: occasional visits, never a line.
    report('proj-009lcp','Pat Pipe','P&H',addDays(monday,-4));
  }
  // What each line should say, counted here from the stored records rather than by the page's code.
  const all=records('reports');
  const sent=all.filter(r=>r.state==='submitted'&&!SAFETY.has(r.reportType));
  const replaced=new Set(sent.map(r=>r.corrects).filter(Boolean));
  const expected={};
  for(const [id,number] of Object.entries(projects)){
    const mine=sent.filter(r=>r.projectId===id&&!replaced.has(r.id));
    const before=new Set(mine.filter(r=>r.visitDate>=addDays(monday,-14)&&r.visitDate<monday).map(r=>r.authorTrade).filter(Boolean));
    const now=new Set(mine.filter(r=>r.visitDate>=monday&&r.visitDate<=today).map(r=>r.authorTrade).filter(Boolean));
    const quiet=ORDER.filter(t=>before.has(t)&&!now.has(t));
    expected[number]=id==='proj-009lcp'||weekday(today)===0?'':words(quiet);
  }
  database().close();
  console.log(JSON.stringify({session,today,expected}));
  process.exit(0);
}

let checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
const seen={};
try {
  for(const [set,port] of [['small',4533],['busy',4534]]){
    const root=mkdtempSync(join(tmpdir(),`relay-quiet-trades-${set}-`));
    const env={...process.env,RELAY_DATA_ROOT:root,RELAY_MEDIA_ROOT:join(root,'media')};
    const {session,today,expected}=JSON.parse(execFileSync(process.execPath,[here,'seed',set],{env,encoding:'utf8',maxBuffer:1<<26}).trim().split('\n').at(-1));
    const base=`http://127.0.0.1:${port}`;let output='';
    const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-quiet-trades-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
    server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
    try {
      let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
      if(set==='small'&&weekday(today)>0){
        check(expected['011LME']==='No HVAC or P&H report yet this week',`small: the count from records names HVAC and P&H on 011LME: ${expected['011LME']}`);
        check(expected['014LME']==='','small: an old report and a switched-off inspection say nothing on 014LME');
      }
      if(set==='busy'&&weekday(today)>0)check(expected['014LME'].includes('P&H'),`busy: 014LME's P&H is quiet in the records: ${expected['014LME']}`);
      for(const [scheme,width] of [['dark',1440],['light',390]]){
        const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme});
        await context.addCookies([{name:'relay_session',value:session,url:base}]);
        const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        const at=`${set} ${scheme} ${width}`;
        await page.goto(`${base}/coverage`,{timeout:60000});await page.locator('.cov-grid').waitFor({timeout:60000});
        for(const [number,want] of Object.entries(expected)){
          const head=page.locator('.cov-grid tbody th[scope=row]').filter({hasText:number});
          check(await head.count()===1,`${at}: ${number} has a row`);
          const line=head.locator('.cov-trades-quiet');
          const got=await line.count()?await line.innerText():'';
          check(got===want,`${at}: ${number} says "${got}", the records say "${want}"`);
          seen[`${set} ${number}`]=got;
        }
        const foot=await page.locator('.cov-foot').innerText();
        check(/names a trade that sent a report from there in the two weeks before this week but none from Monday to today/.test(foot),`${at}: the key says what the line means`);
        if(width===390){const w=await page.evaluate(()=>document.documentElement.scrollWidth);check(w<=390,`${at}: no sideways page scroll (${w})`);}
        if(screenshot)await page.screenshot({path:join(screenshot,`after-${set}-${scheme}-${width}.png`),fullPage:set==='small'});
        // An older fortnight is not this week: no line there.
        await page.getByRole('button',{name:/Previous fortnight/}).click();
        await page.locator('.cov-range').filter({hasNotText:'up to today'}).waitFor();await page.locator('.cov-grid').waitFor();
        check(await page.locator('.cov-trades-quiet').count()===0,`${at}: no quiet trades line on an older fortnight`);
        assert.deepEqual(errors,[],`${at}: page errors`);
        await context.close();
      }
    } finally {
      server.kill();if(server.exitCode===null)await once(server,'exit');rmSync(root,{recursive:true,force:true});
    }
  }
  console.log(`Site coverage quiet trades check passed (${checks} checks): ${JSON.stringify(seen)}; small and busy data, desktop dark and phone light.`);
} finally {
  await browser.close();
}
