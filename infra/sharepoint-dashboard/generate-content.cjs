// Preserve the approved concept as the source for copy, colours and links.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../designs/leodis-sharepoint-home-draft.html'), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const data = vm.runInNewContext(script.slice(0, script.indexOf('function link(')) + ';({site,paths,groups})');
let css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
css = css.replace(/:root/g, ':host').replace(/body\{/g, '.leodisDashboard{').replace(/@media/g, '@container');
css += '\n:host{display:block;container-type:inline-size;font:15px/1.5 "Segoe UI",Arial,sans-serif;color:#14171c;color-scheme:light}.leodisDashboard{min-width:0}.draft{display:none}';
let html = source.match(/<body>([\s\S]*?)<script>/)[1];
html = html.replace(/<div class="suite">[\s\S]*?<\/div>/, '')
  .replace('Design draft · verified resource links · no live metrics or background data connection','Leodis Developments · Operations & delivery');
const dir = path.join(__dirname, 'leodis-operations-dashboard/src/webparts/operationsDashboard');
fs.writeFileSync(path.join(dir, 'dashboardContent.ts'), '// Generated from the approved HTML concept.\n' +
  'export const dashboardCss = ' + JSON.stringify(css) + ';\n' +
  'export const dashboardHtml = ' + JSON.stringify('<div class="leodisDashboard">'+html+'</div>') + ';\n' +
  'export const site = '+JSON.stringify(data.site)+';\n'+
  'export const paths: Record<string,string> = '+JSON.stringify(data.paths)+';\n'+
  'export const groups = '+JSON.stringify(data.groups)+';\n');

