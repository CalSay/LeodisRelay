import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {accessFromRoles,canManage,canReadReport,ownsReport,canIssueCommand,canAccessProject} from '../lib/auth/access';
import {createReport,reportsFor,getReport,reviewSubmission} from '../lib/serverStore';
import {database,putRecord,records} from '../lib/storage';
import {assignLegacyDraft} from '../lib/auth/legacyDrafts';
import {applyCommand} from '../lib/issueStore';

const engineer:Principal = {id:'entra:engineer' as never,oid:'engineer',name:'Same Name',email:'a@example.test',role:'Engineer',trade:'Electrical'};
const other:Principal = {...engineer,id:'entra:other' as never,oid:'other'};
const manager:Principal = {...other,id:'entra:manager' as never,role:'Manager'};
const admin:Principal = {...other,id:'entra:admin' as never,role:'Admin'};
test('explicit Microsoft roles determine access, never matching display names',() => {
  assert.deepEqual(accessFromRoles(['Engineer.PH']),{role:'Engineer',trade:'P&H'});
  for (const claims of [undefined,[],['Default Access'],['Admin','Engineer.Electrical'],['__proto__']]) assert.throws(() => accessFromRoles(claims));
  assert.equal(canManage(engineer),false);
  for (const p of [engineer,manager,admin]) assert.equal(canAccessProject(p,'any-project'),true);
  assert.equal(ownsReport(other,{authorId:engineer.id}),false);
  assert.equal(ownsReport(engineer,{}),false,'legacy display names cannot grant ownership');
  assert.equal(canReadReport(manager,{projectId:'p',state:'draft',authorId:engineer.id}),false);
  assert.equal(canReadReport(other,{projectId:'p',state:'submitted',authorId:engineer.id}),true);
  for (const kind of ['assign','verify','confirm','withdraw','reopen']) {
    assert.equal(canIssueCommand(engineer,kind),false);
    assert.equal(canIssueCommand(manager,kind),true);
  }
  assert.equal(canIssueCommand(engineer,'submit_closure'),true);
  assert.equal(canIssueCommand(admin,'unknown'),false);
});
test('draft filtering, legacy assignment and independent actions preserve privacy and attribution',() => {
  const root = mkdtempSync(join(tmpdir(),'relay-access-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    const draft = createReport('proj-011lme',engineer.name,engineer);
    assert.equal(draft.authorId,engineer.id);
    assert.equal(draft.authorTrade,'Electrical');
    putRecord('reports',{...draft,reviewNote:'PRIVATE',correctionReason:'PRIVATE',signature:{name:'PRIVATE',dataUrl:'PRIVATE',signedAt:'today'}});
    assert.equal(reportsFor(other).items.length,0);
    assert.equal(reportsFor(engineer).items.length,1);
    const summary = reportsFor(manager).items[0]!;
    assert.equal(JSON.stringify(summary).includes('PRIVATE'),false);
    assert.equal('observations' in summary,false);
    const legacy = createReport('proj-011lme','Same Name');
    putRecord('sessions',{id:'test-session',principal:engineer,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()});
    assert.equal(assignLegacyDraft(manager,legacy.id,engineer.id).status,403);
    assert.equal(assignLegacyDraft(admin,legacy.id,engineer.id).ok,true);
    assert.equal(getReport(legacy.id)?.authorId,engineer.id);
    assert.equal(assignLegacyDraft(admin,legacy.id,other.id).ok,false);
    assert.equal(records('audit').length,1);
    putRecord('reports',{...draft,state:'submitted',review:'pending'});
    assert.equal(reviewSubmission(draft.id,'approve','Renamed engineer','',engineer.id).ok,false);
    assert.equal(reviewSubmission(draft.id,'approve',manager.name,'',manager.id).ok,true,'same display name, different identity can review');
    putRecord('issues',{id:'i',projectId:'proj-011lme',confirmation:'confirmed',work:'awaiting_verification',owner:'',targetDate:'',raisedByReport:draft.id,closureSubmittedBy:'Old name',closureSubmittedById:manager.id,events:[]});
    assert.equal(applyCommand('i',{kind:'verify',actor:'New name',actorId:manager.id,note:''}).ok,false);
    assert.equal(applyCommand('i',{kind:'verify',actor:admin.name,actorId:admin.id,note:''}).ok,true);
  } finally { database().close(); rmSync(root,{recursive:true,force:true}); }
});
