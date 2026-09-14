import fs from 'node:fs';
import * as fontkit from 'fontkit';
for(const file of ['Archivo-Regular.ttf','Archivo-Medium.ttf','Archivo-SemiBold.ttf','IBMPlexMono-Regular.ttf','IBMPlexMono-Medium.ttf']) {
 const f=fontkit.openSync('packages/documents/fonts/'+file);
 let bad=[];for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -—·/.,;:&()') {try {f.layout(ch).glyphs.forEach(g=>g.advanceWidth)} catch(e){bad.push(ch)}}console.log(file,bad);
}
