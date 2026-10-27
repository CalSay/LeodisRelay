// Screenshots the redesign concepts. Each concept is design/concepts/<name>/index.html,
// reading ../data.js, with one hash route per screen.
//   node design/concepts/shoot.mjs <out-dir> <concept> [<concept> ...]
// ONLY=eng-home,office-home limits the screens.
import {createRequire} from 'node:module';import {mkdirSync,existsSync} from 'node:fs';import {join,resolve,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.RELAY_PLAYWRIGHT_MODULE||'playwright');
const here=dirname(fileURLToPath(import.meta.url));
const [out,...concepts]=process.argv.slice(2);
export const SCREENS=[['eng-home',390,844],['eng-update',390,844],['eng-issue',390,844],['office-home',1440,900],['office-issues',1440,900],['office-report',1440,900],['office-weekly',1440,900]];
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const exe=process.env.RELAY_BROWSER_PATH||(existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined);
const browser=await chromium.launch({headless:true,...(exe?{executablePath:exe}:{})});
try{
  for(const c of concepts){
    const url=pathToFileURL(join(here,c,'index.html')).href;
    for(const theme of ['light','dark'])for(const [id,w,h] of SCREENS){
      if(only&&!only.includes(id))continue;
      const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:theme,deviceScaleFactor:w<500?2:1});
      const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.goto(`${url}#${id}`);await page.waitForTimeout(400);
      const dir=resolve(out,c);mkdirSync(dir,{recursive:true});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      await page.screenshot({path:join(dir,`${id}-${theme}.png`)});await page.screenshot({path:join(dir,`${id}-${theme}-full.png`),fullPage:true});
      console.log(c,id,theme,errors.length?'ERRORS '+errors.join(' | '):'ok',overflow?'SIDEWAYS SCROLL':'');
      await ctx.close();
    }
  }
}finally{await browser.close();}
