// Browser check for accessibility across the engineer and office pages: an
// axe-core scan (WCAG 2.2 A and AA plus best practice: contrast, names,
// landmarks, headings) in light and dark at 390px and 1440px, one h1 per page,
// controls at least 44px tall on a phone, and a visible focus ring on every
// stop when tabbing through the page.
// The report editor and the offline page are not scanned here (another thread
// is changing them); their findings are listed in docs/progress.md.
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
    `/issues/snag-list?project=${P}`,'/issues/a11y-1','/search?q=fire',`/weekly-summary?project=${P}`,`/photos?project=${P}`,`/diary?project=${P}`,'/my-week',`/safety-actions?project=${P}`,'/help?for=site','/projects'],
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
];
const port=4344,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-a11y-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser,checks=0;const check=(...a)=>{assert.ok(...a);checks++;};
const shotName=url=>url.replace(/^\//,'').replace(/[?#=&/]+/g,'-').replace(/proj-011lme|-+$/g,'').replace(/-+/g,'-').replace(/-$/,'')||'home';
try {
  let ready=false;for(let k=0;k<60;k++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const shot=process.env.RELAY_SCREENSHOT_DIR;if(shot)mkdirSync(shot,{recursive:true});
  for(const [scheme,width] of [['light',390],['dark',390],['light',1440],['dark',1440]]){
    const phone=width<700;
    for(const [role,list] of Object.entries(pages)){
      const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,...(phone?{isMobile:true,hasTouch:true}:{})});
      if(sessions[role])await context.addCookies([{name:'relay_session',value:sessions[role],url:base}]);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      for(const url of list){
        const label=`${role} ${url} ${scheme} ${width}px`;
        await page.goto(base+url,{waitUntil:'networkidle'});await page.waitForTimeout(300);
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
        if(width===1440&&scheme==='light'){
          // Tab through the page: every stop shows a ring.
          await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});const bare=[];
          for(let k=0;k<30;k++){await page.keyboard.press('Tab');const f=await page.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const cs=getComputedStyle(e);return {ring:(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none',name:`${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)}"`};});if(!f)break;if(!f.ring)bare.push(f.name);}
          check(!bare.length,`${label}: a visible focus ring at every stop (${bare.join(', ')})`);
        }
        if(shot)await page.screenshot({path:join(shot,`a11y-${role.toLowerCase()}-${shotName(url)}-${scheme}-${width}.png`)});
      }
      assert.deepEqual(errors,[],`${role} ${scheme} ${width}px: page errors`);
      await context.close();
    }
  }
  console.log(`accessibility verification passed (${checks} checks)`);
} finally {
  if(browser)await browser.close();
  if(server.exitCode===null){server.kill();await once(server,'exit');}
  database().close();rmSync(root,{recursive:true,force:true});
}
