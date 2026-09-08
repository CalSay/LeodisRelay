// Isolated production HTTP checks. No real accounts, sessions or application data.
// Run after npm test and npm run build: node scripts/verify-role-access.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const require = createRequire(import.meta.url);
const root = mkdtempSync(join(tmpdir(),'relay-role-http-'));
process.env.RELAY_DATA_ROOT = root;
process.env.RELAY_MEDIA_ROOT = join(root,'media');
const {putRecord,database} = require('../apps/web/.test-build/lib/storage.js');
const {createReport} = require('../apps/web/.test-build/lib/serverStore.js');
const {putMedia} = require('../apps/web/.test-build/lib/mediaStore.js');
const sharp = require('sharp');
const roles = ['Admin','Manager','Engineer'];
const sessions = {};
for (const role of roles) {
  const id = randomUUID(); sessions[role] = id;
  putRecord('sessions',{id,principal:{id:`entra:${role}`,oid:role,name:'Same display name',email:`${role}@example.test`,role},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
}
const own = createReport('proj-011lme','Same display name',{id:'entra:Engineer',oid:'Engineer',name:'Same display name',email:'Engineer@example.test',role:'Engineer'});
const other = createReport('proj-011lme','Same display name',{id:'entra:other',oid:'other',name:'Same display name',email:'other@example.test',role:'Engineer'});
const submitted = {...other,id:'submitted',state:'submitted'};
putRecord('reports',submitted);
const photo = randomUUID();
await putMedia(photo,{reportId:other.id,ownerId:'entra:other',mime:'image/png'},await sharp({create:{width:4,height:4,channels:3,background:'#fff'}}).png().toBuffer());
putRecord('issues',{id:'issue-http',projectId:own.projectId,confirmation:'provisional',work:'open',owner:'',targetDate:'',raisedByReport:submitted.id,events:[]});
let output = '';
const child = spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p','4327','-H','127.0.0.1'],{
  cwd:resolve('apps/web'),windowsHide:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,NODE_ENV:'production',ENTRA_TENANT_ID:'00000000-0000-0000-0000-000000000001',ENTRA_CLIENT_ID:'00000000-0000-0000-0000-000000000002',ENTRA_CLIENT_SECRET:'synthetic-http-check',ENTRA_REDIRECT_URI:'http://localhost:4327/api/auth/callback'},
});
child.stdout.on('data',d => {output += d;}); child.stderr.on('data',d => {output += d;});
const base = 'http://127.0.0.1:4327';
const call = (path,role,options={}) => fetch(base+path,{redirect:'manual',...options,headers:{cookie:`relay_session=${sessions[role] ?? 'forged'}`,...options.headers}});
const post = body => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
let checks=0;
async function status(path,role,expected,options) { const r = await call(path,role,options); assert.equal(r.status,expected,`${role} ${path}`); checks++; return r; }
try {
  let ready=false;
  for(let n=0;n<60;n++) {
    if(child.exitCode !== null) throw new Error('Test server exited: '+output);
    try {if((await fetch(base+'/signin')).ok) {ready=true;break;}} catch {}
    await new Promise(r => setTimeout(r,500));
  }
  assert.ok(ready,'Test server did not start: '+output);
  for (const path of ['/api/reports','/api/issues',`/api/reports/${own.id}`,`/api/media/${photo}`,`/api/reports/${other.id}/pdf`]) await status(path,'forged',401);
  await status('/api/reports?view=office','Engineer',403);
  await status('/api/reports?view=office','Manager',200);
  await status('/admin','Engineer',307);
  await status('/admin','Manager',307);
  const admin = await status('/admin','Admin',200); assert.match(await admin.text(),/Team assignment checklist/);
  await status('/office','Engineer',307);
  await status('/office','Manager',200);
  const home = await status('/','Engineer',200); assert.match(await home.text(),/Continue my report/);
  const managerHome = await status('/','Manager',307); assert.equal(managerHome.headers.get('location'),'/office');
  const adminHome = await status('/','Admin',307); assert.equal(adminHome.headers.get('location'),'/admin');
  const page = await (await status('/api/reports','Engineer',200)).json();
  assert.ok(page.reports.some(r => r.id === own.id));
  assert.ok(!page.reports.some(r => r.id === other.id));
  await status(`/api/reports/${other.id}`,'Engineer',403);
  await status(`/api/reports/${other.id}`,'Manager',403);
  await status(`/api/reports/${own.id}`,'Engineer',200);
  await status(`/api/reports/${submitted.id}`,'Engineer',200);
  await status(`/api/reports/${other.id}/pdf`,'Manager',403);
  await status(`/api/media/${photo}`,'Manager',403);
  await status(`/api/reports/${other.id}`,'Engineer',403,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({observations:[],expectedVersion:1})});
  await status(`/api/reports/${own.id}`,'Engineer',403,post({action:'review',decision:'approve'}));
  await status('/api/issues/issue-http','Engineer',403,post({kind:'confirm',note:'Confirmed'}));
  await status('/api/issues/issue-http','Engineer',200,post({kind:'progress',note:'Progress noted'}));
  await status('/api/issues/issue-http','Manager',200,post({kind:'confirm',note:'Checked'}));
  await status('/api/admin/legacy-drafts','Engineer',403,post({reportId:other.id,authorId:'entra:Engineer'}));
  console.log(`Passed ${checks} production HTTP permission checks and role landing-page assertions.`);
} finally {
  child.kill();
  if(child.exitCode === null) await once(child,'exit');
  database().close();
  rmSync(root,{recursive:true,force:true});
}
