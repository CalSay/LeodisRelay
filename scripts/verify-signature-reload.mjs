// Browser check for FE-3a: sign a draft, reload, and the signature is still
// shown and saved on the server. Sending is covered by tests/signatures.test.ts.
// npm test && npm run build; set RELAY_PLAYWRIGHT_MODULE and RELAY_BROWSER_PATH if needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'relay-signature-'));
process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
const {putRecord,database}=require('../apps/web/.test-build/lib/storage.js');
const {createReport,getReport}=require('../apps/web/.test-build/lib/serverStore.js');
const principal={id:'entra:signature-engineer',oid:'signature-engineer',name:'Signature Engineer',email:'sign@example.test',role:'Engineer',trade:'Electrical'};
const session=randomUUID();
putRecord('sessions',{id:session,principal,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
const draft=createReport('proj-011lme',principal.name,principal);
putRecord('reports',{...draft,observations:[{id:randomUUID(),type:'update',location:'Corridor',whatHappened:'Containment complete',actionNeeded:'',owner:'',photos:[]}]});
const port=4331,base=`http://127.0.0.1:${port}`;let output='';
const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-signature-check',ENTRA_REDIRECT_URI:`${base}/api/auth/callback`}});
server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
/** Count inked pixels, so "shown" means something was actually drawn on the pad. */
const ink=page=>page.locator('canvas.sigpad').evaluate(canvas=>{const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);let n=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)n++;return n;});
let browser;
try {
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(base+'/signin')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.RELAY_BROWSER_PATH?{executablePath:process.env.RELAY_BROWSER_PATH}:{})});
  const screenshot=process.env.RELAY_SCREENSHOT_DIR;if(screenshot)mkdirSync(screenshot,{recursive:true});
  for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:scheme});await context.addCookies([{name:'relay_session',value:session,url:base}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/reports/${draft.id}#check`); // the signature is on the Check & send step
    const pad=page.locator('canvas.sigpad');
    if(scheme==='light'){
      // An optional signature folds behind one button until it is wanted.
      await page.getByRole('button',{name:'Add your signature'}).click();await pad.scrollIntoViewIfNeeded();
      await page.getByLabel('Your name',{exact:true}).fill('G. Stephenson');
      const box=await pad.boundingBox();
      await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
      for(let x=20;x<box.width-20;x+=12)await page.mouse.move(box.x+x,box.y+box.height/2+Math.sin(x/15)*20);
      await page.mouse.up();
      await page.getByText('Saved to RELAY',{exact:true}).waitFor();
      const saved=getReport(draft.id).draftSignature;
      assert.equal(saved?.name,'G. Stephenson','name saved to the server');
      assert.match(saved?.dataUrl??'',/^data:image\/png;base64,/,'drawing saved to the server');
      assert.ok(await ink(page)>50,'signed');
    }
    // A reload, or the dark-mode context opening the same draft fresh.
    await page.reload();await pad.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const c=document.querySelector('canvas.sigpad');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;return false;},null,{timeout:5000});
    assert.ok(await ink(page)>50,`${scheme}: signature still shown after reload`);
    assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),'G. Stephenson',`${scheme}: name restored`);
    assert.equal(await page.getByText('Sign here').count(),0,`${scheme}: no empty-pad hint over a saved signature`);
    if(screenshot)await pad.screenshot({path:join(screenshot,`signature-${scheme}.png`)});
    assert.deepEqual(errors,[],`${scheme}: page errors`);
    await context.close();
  }
  console.log('Signature reload check passed: saved on the server, shown after reload in light and dark.');
} finally {
  await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');database().close();rmSync(root,{recursive:true,force:true});
}
