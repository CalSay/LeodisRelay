import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyCommand,getIssue} from '../lib/issueStore';
import {database,putRecord} from '../lib/storage';
import {SEND_BACK_REASON,fixEvidence} from '../lib/checkFix';
import type {Issue,IssueEvent,Photo} from '../lib/types';

const shot=(id:string):Photo=>({id,dataUrl:`/api/media/${id}`,caption:'',capturedAt:'2026-10-20T10:00:00Z'});
const ev=(kind:IssueEvent['kind'],at:string,note='',photos:Photo[]=[],actor='Sam Spark'):IssueEvent=>({at,actor,kind,note,photos});

test('checking a fix reads the defect as raised and the latest fix sent',()=>{
  const raised=shot('11111111-1111-4111-8111-111111111111'),first=shot('22222222-2222-4222-8222-222222222222'),again=shot('33333333-3333-4333-8333-333333333333');
  const e=fixEvidence({closureSubmittedBy:'Sam Spark',events:[ev('raised','2026-10-01T09:00:00Z','Collar missing',[raised]),ev('closure_submitted','2026-10-05T09:00:00Z','Done',[first]),
    ev('reopened','2026-10-06T09:00:00Z','Wrong collar',[],'Jo Office'),ev('closure_submitted','2026-10-08T09:00:00Z','  Right collar fitted  ',[again])]});
  assert.deepEqual(e.defect,[raised]);
  assert.deepEqual(e.fix,[again],'the fix sent last, not the one sent back');
  assert.equal(e.note,'Right collar fitted');
  assert.equal(e.at,'2026-10-08T09:00:00Z');
  const bare=fixEvidence({closureSubmittedBy:'Pat Pipe',events:[]});
  assert.deepEqual([bare.defect,bare.fix,bare.note,bare.by],[[],[],'','Pat Pipe'],'no photos and no note are said plainly, not guessed');
});

test('a fix is sent back only with a reason; older records without one are left as they are',()=>{
  const root=mkdtempSync(join(tmpdir(),'relay-check-fix-'));
  process.env.RELAY_DATA_ROOT=root;
  try{
    const base:Issue={id:'cf-1',reference:'DEMO-011LME-ISS-1',projectId:'proj-011lme',source:'individual',reportedBy:'Sam Spark',reportedById:'entra:sam',location:'Basement',description:'Collar missing',actionNeeded:'',
      confirmation:'confirmed',work:'awaiting_verification',owner:'Leeds Plumbing',targetDate:'',raisedByReport:'',raisedAt:'2026-10-01T09:00:00Z',closureSubmittedBy:'Sam Spark',closureSubmittedById:'entra:sam',
      events:[ev('raised','2026-10-01T09:00:00Z'),ev('closure_submitted','2026-10-05T09:00:00Z','Done')]} as Issue;
    putRecord('issues',base);
    // An older record, sent back before a reason was needed, still reads.
    putRecord('issues',{...base,id:'cf-old',work:'in_progress',events:[...base.events,ev('reopened','2026-10-06T09:00:00Z','',[],'Jo Office')]});
    const office={actor:'Jo Office',actorId:'entra:jo'};
    for(const note of ['','   ','\n']){
      const refused=applyCommand('cf-1',{kind:'reopen',note,...office});
      assert.deepEqual(refused,{ok:false,status:422,reason:SEND_BACK_REASON},`note ${JSON.stringify(note)} is refused in plain words`);
    }
    assert.equal(getIssue('cf-1')?.work,'awaiting_verification','nothing changed');
    assert.equal(getIssue('cf-1')?.events.length,2);
    const back=applyCommand('cf-1',{kind:'reopen',note:'  Wrong collar fitted  ',...office});
    assert.ok(back.ok);
    assert.equal(back.ok&&back.value.work,'in_progress');
    assert.equal(back.ok&&back.value.events.at(-1)?.note,'  Wrong collar fitted  ');
    // Verifying needs no note, and reopening a closed issue is unchanged.
    assert.ok(applyCommand('cf-1',{kind:'submit_closure',note:'',actor:'Sam Spark',actorId:'entra:sam'}).ok);
    assert.ok(applyCommand('cf-1',{kind:'verify',note:'',...office}).ok);
    assert.ok(applyCommand('cf-1',{kind:'reopen',note:'',...office}).ok,'a closed issue reopens as before');
    assert.equal(getIssue('cf-old')?.events.at(-1)?.note,'','the older record is untouched');
  }finally{database().close();rmSync(root,{recursive:true,force:true});}
});
