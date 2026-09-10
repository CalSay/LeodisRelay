const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const dir = path.join(__dirname, 'leodis-operations-dashboard/src/webparts/operationsDashboard');
function page() {
  const source = fs.readFileSync(path.join(dir, 'dashboardContent.ts'), 'utf8').replace(/export /g, '') + '\n' +
    fs.readFileSync(path.join(dir, 'renderDashboard.ts'), 'utf8').replace(/^import .*;\s*/,'').replace('export function','function');
  const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Leodis dashboard · component preview</title><style>body{margin:0;background:#202020;color:white;font-family:Georgia}nav{padding:12px 20px;background:#14171c;font:14px Segoe UI,sans-serif}nav button{margin-left:10px;padding:7px 12px}#host{margin:auto;max-width:1440px}h2{color:red!important}a{color:lime!important}</style></head><body><nav>Component preview · unpublished <button data-width="1440px">Desktop</button><button data-width="820px">Tablet</button><button data-width="390px">Mobile</button></nav><div id="host"></div><script>'+js+'\nrenderDashboard(document.getElementById("host").attachShadow({mode:"open"}));document.querySelectorAll("button[data-width]").forEach(b=>b.onclick=()=>document.getElementById("host").style.maxWidth=b.dataset.width);</script></body></html>';
}
http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page());}).listen(4331,'127.0.0.1');
