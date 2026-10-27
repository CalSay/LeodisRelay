// Renders the Release 1 key screens with real seeded data, once per style draft,
// light and dark, so the drafts can be compared side by side. A style draft is a
// stylesheet in this folder laid over the app at render time: nothing in the app
// changes. npm test && npm run build first.
//   node design/style-drafts/shoot.mjs <out-dir> [current|calm|panels|board ...]
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PEOPLE,seedBusyProjects} from '../../scripts/seed-busy-projects.mjs';
const require=createRequire(import.meta.url);
const here=dirname(fileURLToPath(import.meta.url));
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const out=resolve(process.argv[2]||'style-shots');
const styles=process.argv.slice(3).length?process.argv.slice(3):['current','calm','panels','board'];
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const root=mkdtempSync(join(tmpdir(),'relay-style-drafts-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const storagePath=require.resolve('../../apps/web/.test-build/lib/storage.js');
const {putRecord,database}=require(storagePath);
const {londonDay}=require('../../apps/web/.test-build/lib/weeklySummary.js');
const today=londonDay(new Date());
seedBusyProjects({storagePath,today,days:120,scale:0.6});
const rows=kind=>database().prepare('select data from records where kind=?').all(kind).map(r=>JSON.parse(r.data));
const sam=PEOPLE.engineer,manager=PEOPLE.manager,P='proj-011lme';
// One of Sam's sent-back fixes, so Came back from the office has something in it.
let n=0,issue;const iso=m=>new Date(Date.now()-m*60000).toISOString();
for(const i of rows('issues').filter(i=>i.projectId===P&&i.reportedById===sam.id&&i.work==='awaiting_verification').slice(0,2)){
  i.work='in_progress';i.events.push({at:iso(60*(++n)),actor:manager.name,actorId:manager.id,kind:'reopened',note:'Not finished, can you send a photo of the top of the riser?',photos:[]});putRecord('issues',i);issue??=i;
}
// Today's site update as a draft with three cards, for the editor.
for(const d of rows('reports').filter(r=>r.authorId===sam.id&&r.state==='draft'&&r.projectId===P))database().prepare('DELETE FROM records WHERE id=?').run(d.id);
const last=rows('reports').filter(r=>r.projectId===P&&r.authorId===sam.id&&r.state==='submitted'&&!r.reportType).sort((a,b)=>b.visitDate.localeCompare(a.visitDate))[0];
const draftId=randomUUID();
putRecord('reports',{...last,id:draftId,reference:last.reference.replace(/\d+$/,m=>String(9000+Number(m))),visitDate:today,state:'draft',serverAcknowledgedAt:undefined,lastSavedAt:new Date().toISOString(),review:'not_required',delivery:undefined,signature:undefined,observations:(last.observations||[]).slice(0,3)});

const sent=rows('reports').filter(r=>r.projectId===P&&r.state==='submitted'&&!r.reportType&&(r.observations||[]).length>=3).sort((a,b)=>b.visitDate.localeCompare(a.visitDate))[0];
const session=who=>{const id=randomUUID();putRecord('sessions',{id,principal:who,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString()});return id;};
const sessions={engineer:session(sam),manager:session(manager)};
const SCREENS=[
  {id:'eng-site',who:'engineer',w:390,h:844,path:`/engineer?project=${P}`,ready:'h1'},
  {id:'eng-update',who:'engineer',w:390,h:844,path:`/reports/${draftId}`,ready:'main'},
  {id:'eng-issue',who:'engineer',w:390,h:844,path:`/issues/${issue.id}`,ready:'h1'},
  {id:'office-overview',who:'manager',w:1440,h:900,path:'/office#/projects',ready:'.glance-row'},
  {id:'office-issues',who:'manager',w:1440,h:900,path:'/office#/issues',ready:'.ws-main table, .ws-main [role=row], .ws-main .item'},
  {id:'office-report',who:'manager',w:1440,h:900,path:`/office#/inbox/${sent.id}`,ready:'.ws-main h2, .ws-main h3'},
  {id:'office-weekly',who:'manager',w:1440,h:900,path:`/weekly-summary?project=${P}`,ready:'main h1'},
];
const port=Number(process.env.PORT||4391),base=`http://127.0.0.1:${port}`;let log='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-style-drafts',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
let browser;
try{
  for(let k=0;k<80;k++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(base+'/signin')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({headless:true,...((p=>p?{executablePath:p}:{})(process.env.RELAY_BROWSER_PATH||(existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':'')))});
  for(const style of styles){
    const css=style==='current'?'':readFileSync(join(here,'_base.css'),'utf8')+'\n'+readFileSync(join(here,`${style}.css`),'utf8');
    for(const theme of ['light','dark']){
      for(const s of SCREENS){
        if(only&&!only.includes(s.id))continue;
        const context=await browser.newContext({viewport:{width:s.w,height:s.h},colorScheme:theme,deviceScaleFactor:s.w<500?2:1});
        await context.addCookies([{name:'relay_session',value:sessions[s.who],url:base}]);
        if(css)await context.addInitScript(c=>{const add=()=>{if(document.getElementById('style-draft'))return;const el=document.createElement('style');el.id='style-draft';el.textContent=c;(document.head||document.documentElement).appendChild(el);};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();add();},css);
        const page=await context.newPage();
        await page.goto(base+s.path);
        try{await page.locator(s.ready).first().waitFor({timeout:15000});}catch(e){console.warn(style,s.id,'not ready:',e.message.split('\n')[0]);}
        await page.waitForLoadState('networkidle').catch(()=>{});await page.waitForTimeout(600);
        if(process.env.OUTLINE){const o=await page.evaluate(()=>{const lines=[];const walk=(e,d)=>{if(d>5)return;for(const c of e.children){if(['SCRIPT','STYLE','svg','path'].includes(c.tagName))continue;const t=[...c.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').slice(0,30);lines.push('  '.repeat(d)+c.tagName.toLowerCase()+(c.classList.length?'.'+[...c.classList].join('.'):'')+(t?' "'+t+'"':''));if(c.children.length>12){walk({children:[...c.children].slice(0,2)},d+1);lines.push('  '.repeat(d+1)+'… '+c.children.length);}else walk(c,d+1);}};walk(document.querySelector('.ws-main')||document.querySelector('main')||document.body,0);return lines.join('\n');});console.log('## '+s.id+'\n'+o);await context.close();continue;}
        if(process.env.PROBE){const found=await page.evaluate(()=>{const m={};for(const e of document.querySelectorAll('body *')){const cs=getComputedStyle(e);if(!e.childNodes.length||![...e.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()))continue;const k=[];if(cs.textTransform==='uppercase')k.push('UP');if(/mono|Plex|Consolas/i.test(cs.fontFamily))k.push('MONO');if(parseFloat(cs.borderTopWidth)>0&&parseFloat(cs.borderLeftWidth)>0&&e.offsetHeight<40)k.push('BOXED');if(!k.length)continue;const path=[e,e.parentElement].filter(Boolean).map(x=>x.tagName.toLowerCase()+(x.classList.length?'.'+[...x.classList].join('.'):'')).reverse().join(' > ');const key=k.join('+')+' '+path;m[key]=(m[key]||0)+1;}return m;});console.log('## '+s.id+'\n'+Object.entries(found).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+' '+k).join('\n'));await context.close();continue;}
        const dir=join(out,style);mkdirSync(dir,{recursive:true});
        await page.screenshot({path:join(dir,`${s.id}-${theme}.png`),fullPage:false});
        await page.screenshot({path:join(dir,`${s.id}-${theme}-full.png`),fullPage:true});
        console.log('shot',style,s.id,theme);
        await context.close();
      }
    }
  }
}finally{await browser?.close();server.kill();}
