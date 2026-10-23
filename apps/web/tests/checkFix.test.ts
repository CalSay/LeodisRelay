import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyCommand,getIssue} from '../lib/issueStore';
import {database,putRecord} from '../lib/storage';
import {SEND_BACK_REASON,againWords,byPutForward,daysWaiting,fixEvidence,putForwardAt,sentBackBefore,waitingWords} from '../lib/checkFix';
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

test('a fix waits from when it was last put forward, not from a note added since or when the defect was raised',()=>{
  const a={reference:'R-2',raisedAt:'2026-09-01T09:00:00Z',events:[ev('raised','2026-09-01T09:00:00Z'),ev('closure_submitted','2026-10-10T09:00:00Z'),ev('progress','2026-10-15T09:00:00Z','Photo added')]};
  const b={reference:'R-1',raisedAt:'2026-10-05T09:00:00Z',events:[ev('raised','2026-10-05T09:00:00Z'),ev('closure_submitted','2026-10-06T09:00:00Z'),ev('reopened','2026-10-07T09:00:00Z','Not yet',[],'Jo Office'),ev('closure_submitted','2026-10-12T09:00:00Z')]};
  const c={reference:'R-3',raisedAt:'2026-10-01T09:00:00Z',events:[]};
  assert.equal(putForwardAt(a),'2026-10-10T09:00:00Z','a later note does not restart the wait');
  assert.equal(putForwardAt(b),'2026-10-12T09:00:00Z','the latest time it was put forward');
  assert.equal(putForwardAt(c),'2026-10-01T09:00:00Z','no history: when it was raised');
  assert.deepEqual([b,a,c].sort(byPutForward).map(i=>i.reference),['R-3','R-2','R-1'],'longest waiting first, though R-2 was raised first');
});

test('a fix waits in calendar days, as the date it was put forward reads',()=>{
  const put=(at:string)=>({raisedAt:'2026-09-01T09:00:00Z',events:[ev('raised','2026-09-01T09:00:00Z'),ev('closure_submitted',at)]});
  // Put forward at 17:00 yesterday and read at 09:00: one day, not the 0 whole 24 hours would say.
  assert.equal(daysWaiting(put('2026-10-21T16:00:00Z'),'2026-10-22'),1);
  assert.equal(waitingWords(put('2026-10-21T16:00:00Z'),'2026-10-22'),'waiting 1 day');
  assert.equal(waitingWords(put('2026-10-22T07:00:00Z'),'2026-10-22'),'waiting since today');
  assert.equal(waitingWords(put('2026-10-19T08:00:00Z'),'2026-10-22'),'waiting 3 days');
  // London's day: 23:30 UTC in summer time is already the next day in London.
  assert.equal(daysWaiting(put('2026-10-20T23:30:00Z'),'2026-10-22'),1);
  // A year back, counted the same way as "put forward 9 Sep 2025".
  assert.equal(daysWaiting(put('2025-09-09T14:00:00Z'),'2026-10-22'),408);
  // A note after it was put forward does not restart the wait.
  const noted=put('2026-10-19T08:00:00Z');noted.events.push(ev('note','2026-10-22T08:00:00Z','Photo added'));
  assert.equal(daysWaiting(noted,'2026-10-22'),3);
});

test('a fix sent back before says who sent it back, when, why and how many times',()=>{
  const first=[ev('raised','2026-10-01T09:00:00Z','Collar missing'),ev('closure_submitted','2026-10-05T09:00:00Z','Done')];
  assert.equal(sentBackBefore({events:first}),undefined,'a first attempt is not "again"');
  assert.equal(againWords({events:first}),'');
  const twice={events:[...first,ev('reopened','2026-10-06T09:00:00Z','  Wrong collar  ',[],'Jo Office'),ev('closure_submitted','2026-10-08T09:00:00Z','Right collar')]};
  assert.deepEqual(sentBackBefore(twice),{by:'Jo Office',at:'2026-10-06T09:00:00Z',note:'Wrong collar',times:1});
  assert.equal(againWords(twice),'put forward again');
  // A note added in between changes nothing; the reason given last is the one shown.
  const thrice={events:[...twice.events,ev('note','2026-10-08T10:00:00Z','Photo'),ev('reopened','2026-10-09T09:00:00Z','Still no fire mastic',[],'Ann Office'),ev('closure_submitted','2026-10-10T09:00:00Z','Mastic done')]};
  assert.deepEqual(sentBackBefore(thrice),{by:'Ann Office',at:'2026-10-09T09:00:00Z',note:'Still no fire mastic',times:2});
  assert.equal(againWords(thrice),'put forward 3 times');
  // An issue verified, then reopened as a new defect, starts again: the earlier send-back belongs to the closed round.
  const reopenedAfterClose={events:[...twice.events,ev('verified','2026-10-09T09:00:00Z','',[],'Jo Office'),ev('reopened','2026-10-12T09:00:00Z','Cracked again',[],'Jo Office'),ev('closure_submitted','2026-10-14T09:00:00Z','Replaced')]};
  assert.equal(sentBackBefore(reopenedAfterClose),undefined);
  // An older record sent back with no reason still counts, with the reason left empty.
  const silent={events:[...first,ev('reopened','2026-10-06T09:00:00Z','',[],'Jo Office'),ev('closure_submitted','2026-10-08T09:00:00Z','')]};
  assert.equal(sentBackBefore(silent)?.note,'');
});
