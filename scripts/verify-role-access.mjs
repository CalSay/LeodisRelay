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
const submittedPhoto = randomUUID();
await putMedia(submittedPhoto,{reportId:submitted.id,ownerId:'entra:other',mime:'image/png'},await sharp({create:{width:4,height:4,channels:3,background:'#eee'}}).png().toBuffer());
putRecord('issues',{id:'issue-unscoped',projectId:'',confirmation:'provisional',work:'open',owner:'',targetDate:'',raisedByReport:'',events:[]});
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

  // Admin is an administrative role, not a reading one. Nothing in the office
  // grants sight of a draft its author has not sent.
  await status(`/api/reports/${other.id}`,'Admin',403);
  await status(`/api/reports/${other.id}/pdf`,'Admin',403);
  await status(`/api/media/${photo}?variant=thumb`,'Admin',403);
  await status(`/api/reports/${other.id}/pdf?download=1`,'Manager',403);

  // The office sees that a draft exists. It does not see what it says, and the
  // redaction is asserted on the field names, not on the count alone.
  const office = await (await status('/api/reports?view=office','Manager',200)).json();
  const redacted = office.drafts.find(r => r.id === other.id);
  assert.ok(redacted,'A manager should see that the draft exists');
  assert.equal(redacted.observationCount,0); checks++;
  assert.equal(redacted.photoCount,0); checks++;
  for (const leak of ['reviewNote','issued','signature']) {
    assert.ok(!(leak in redacted),`Draft summary leaked ${leak}`); checks++;
  }

  // Overseeing a report is not writing it: no role edits or sends another
  // person's draft.
  const edit = {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({observations:[],expectedVersion:1})};
  await status(`/api/reports/${other.id}`,'Manager',403,edit);
  await status(`/api/reports/${other.id}`,'Admin',403,edit);
  await status(`/api/reports/${other.id}`,'Manager',403,post({}));
  await status(`/api/reports/${other.id}`,'Manager',422,post({action:'submit'}));

  // A photograph cannot be pushed onto a report the uploader does not own.
  const upload = {method:'PUT',headers:{'content-type':'image/png'},body:'not-an-image'};
  await status(`/api/media/${randomUUID()}?reportId=${other.id}`,'Manager',403,upload);

  // Verification is a manager command; reopening is too.
  await status('/api/issues/issue-http','Engineer',403,post({kind:'verify',note:'Done'}));
  await status('/api/issues/issue-http','Engineer',403,post({kind:'reopen',note:'Again'}));
  await status('/api/admin/legacy-drafts','Manager',403,post({reportId:other.id,authorId:'entra:Engineer'}));

  // Media on a report that has been issued is readable by the project team.
  await status(`/api/media/${submittedPhoto}`,'Engineer',200);

  // Issue media is scoped to the issue's project rather than to the mere fact
  // that the issue exists. The pilot grants every project to every role, so this
  // asserts the check runs at all — an issue on no project is refused.
  const realPng = await sharp({create:{width:4,height:4,channels:3,background:'#111'}}).png().toBuffer();
  await status(`/api/media/${randomUUID()}?issueId=issue-unscoped`,'Engineer',403,{method:'PUT',headers:{'content-type':'image/png'},body:realPng});


  // The container health probe must answer with no cookie at all, and must say
  // nothing beyond whether this process can serve.
  const health = await fetch(base+'/api/health');
  assert.equal(health.status,200,'Health probe should answer unauthenticated'); checks++;
  assert.deepEqual(await health.json(),{status:'ok'},'Health probe should disclose nothing else'); checks++;

  console.log(`Passed ${checks} production HTTP permission checks and role landing-page assertions.`);
} finally {
  child.kill();
  if(child.exitCode === null) await once(child,'exit');
  database().close();
  rmSync(root,{recursive:true,force:true});
}
