import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {submissionStages,type Stage} from '../lib/status';
import {createReport,getReport,saveDraft,submitReport} from '../lib/serverStore';
import {database,getRecord} from '../lib/storage';
import {runOneJob} from '../lib/reportWorker';
import type {Report} from '../lib/types';

const at = '2026-10-20T09:00:00.000Z';
const base = {id:'r1',projectId:'proj-011lme',reference:'DEMO-011LME-SR-0001',visitDate:'2026-10-20',author:'Site Engineer',state:'submitted',version:2,revision:1,review:'not_required',serverAcknowledgedAt:at} as Omit<Report,'observations'>;
const stages = (over:Partial<Report>) => submissionStages({...base,...over} as Report);
const of = (list:Stage[],key:Stage['key']) => list.find(s => s.key === key);
const email = (failure?:string) => ({revisionId:'r1',revision:1,method:'email' as const,recipient:{name:'Tom PM',address:'tom@example.test',role:'project_manager'},at,...(failure ? {failure} : {})});

test('a draft has no stages',() => {
  assert.deepEqual(stages({state:'draft'}),[]);
});

test('received, PDF, delivery and read are separate steps, in order, with review only where it is used',() => {
  assert.deepEqual(stages({delivery:'pending'}).map(s => s.key),['received','pdf','delivery','read']);
  assert.deepEqual(stages({delivery:'pending',review:'pending'}).map(s => s.key),['received','review','pdf','delivery','read']);
  const queued = stages({delivery:'pending'});
  assert.equal(of(queued,'received')!.label,'Received');
  assert.equal(of(queued,'received')!.at,at);
  assert.equal(of(queued,'pdf')!.label,'Being prepared');
  assert.equal(of(queued,'delivery')!.label,'Waiting for the PDF');
  assert.equal(of(queued,'read')!.label,'Not yet read');
});

test('a ready PDF is not delivery, and a local outbox file is never an email',() => {
  const rendered = stages({delivery:'rendered'});
  assert.equal(of(rendered,'pdf')!.label,'Ready');
  assert.equal(of(rendered,'delivery')!.label,'Waiting to send');
  const outbox = stages({delivery:'outbox',issued:{records:[email()],unaddressed:[],transport:'outbox',location:'/data/outbox/x.eml'}});
  assert.equal(of(outbox,'delivery')!.label,'Not emailed');
  assert.notEqual(of(outbox,'delivery')!.tone,'sent');
  // Even a job status that says "sent" is not an email unless the mail transport sent it.
  assert.equal(of(stages({delivery:'sent',issued:{records:[email()],unaddressed:[],transport:'outbox'}}),'delivery')!.label,'Not emailed');
  const emailed = of(stages({delivery:'sent',issued:{records:[email()],unaddressed:[],transport:'graph'}}),'delivery')!;
  assert.equal(emailed.label,'Emailed to Tom PM');
  assert.equal(emailed.tone,'sent');
});

test('a failure is shown on the step that failed',() => {
  const pdf = stages({delivery:'failed',deliveryError:'Renderer crashed',deliveryErrorStage:'pdf'});
  assert.equal(of(pdf,'pdf')!.label,'Could not be prepared');
  assert.equal(of(pdf,'pdf')!.detail,'Renderer crashed');
  assert.equal(of(pdf,'delivery')!.label,'Waiting for the PDF');
  const mail = stages({delivery:'failed',deliveryErrorStage:'delivery',issued:{records:[email('Mailbox refused')],unaddressed:[],transport:'graph'}});
  assert.equal(of(mail,'pdf')!.label,'Ready');
  assert.equal(of(mail,'delivery')!.label,'Email failed');
  assert.equal(of(mail,'delivery')!.tone,'alert');
  const noAddress = stages({delivery:'failed',deliveryErrorStage:'delivery',issued:{records:[],unaddressed:['project_manager'],transport:'outbox'}});
  assert.equal(of(noAddress,'delivery')!.label,'No email address');
  // Older records have no stage: the failure stays on the PDF step without claiming the PDF was not made.
  assert.equal(of(stages({delivery:'failed'}),'pdf')!.label,'Processing needs attention');
  // A retry that worked replaces the failed attempt for that recipient.
  assert.equal(of(stages({delivery:'outbox',issued:{records:[email('Disk full'),email()],unaddressed:[],transport:'outbox'}}),'delivery')!.label,'Not emailed');
  assert.equal(of(stages({delivery:'sent',issued:{records:[email('Timed out'),email()],unaddressed:[],transport:'graph'}}),'delivery')!.label,'Emailed to Tom PM');
  assert.equal(of(stages({delivery:'failed',deliveryErrorStage:'delivery',deliveryError:'Live delivery is blocked'}),'delivery')!.label,'Could not be sent');
});

test('SharePoint projects are filed, not emailed',() => {
  const projectSnapshot = {source:{siteId:'s',listId:'l',itemId:'102'}} as Report['projectSnapshot'];
  assert.equal(of(stages({delivery:'rendered',projectSnapshot}),'delivery')!.label,'Waiting to file in SharePoint');
  const filed = of(stages({delivery:'filed',projectSnapshot,sharepoint:{status:'filed'}}),'delivery')!;
  assert.equal(filed.label,'Filed in SharePoint');
  assert.match(filed.detail!,/not emailed/);
  assert.equal(of(stages({delivery:'rendered',projectSnapshot,sharepoint:{status:'failed',error:'412'}}),'delivery')!.tone,'alert');
});

test('read is its own step, apart from review and delivery',() => {
  const read = stages({delivery:'outbox',review:'approved',reviewedBy:'Tom',acknowledged:{by:'Office Manager',at}});
  assert.equal(of(read,'review')!.label,'Approved');
  assert.equal(of(read,'read')!.label,'Read by Office Manager');
  assert.equal(of(read,'delivery')!.label,'Not emailed');
});

test('the worker records which step failed',async () => {
  const root = mkdtempSync(join(tmpdir(),'relay-stages-'));
  process.env.RELAY_DATA_ROOT = root;
  const mail = process.env.RELAY_MAIL_ENABLED;
  try {
    const send = async () => {
      const draft = createReport('proj-011lme','Site Engineer');
      const saved = saveDraft(draft.id,{...draft,observations:[{id:'o1',type:'update',location:'Site',whatHappened:'Work progressing',actionNeeded:'',owner:'',photos:[]}]},draft.version);
      assert.equal(saved.ok,true);
      const sent = await submitReport(draft.id,undefined,(saved as {ok:true;value:Report}).value.version);
      assert.equal(sent.ok,true);
      return draft.id;
    };
    // The PDF step: its snapshot is gone, so the PDF cannot be made.
    const broken = await send();
    database().prepare("DELETE FROM records WHERE kind='snapshots' AND id=?").run(broken);
    assert.equal(getRecord('snapshots',broken),undefined);
    assert.equal(await runOneJob(),true);
    assert.equal(getReport(broken)?.deliveryErrorStage,'pdf');
    assert.equal(of(submissionStages(getReport(broken)!),'pdf')!.label,'Could not be prepared');
    // Keep its retry out of the way of the next report's jobs.
    database().prepare("UPDATE jobs SET status='failed' WHERE id=?").run('pdf:'+broken);

    // The delivery step: the PDF is made, then sending is refused.
    const blocked = await send();
    assert.equal(await runOneJob(),true);
    assert.equal(getReport(blocked)?.delivery,'rendered');
    process.env.RELAY_MAIL_ENABLED = 'yes';
    assert.equal(await runOneJob(),true);
    const after = getReport(blocked)!;
    assert.equal(after.deliveryErrorStage,'delivery');
    assert.equal(of(submissionStages(after),'pdf')!.label,'Ready');
    assert.equal(of(submissionStages(after),'delivery')!.label,'Could not be sent');
  } finally {
    if (mail === undefined) delete process.env.RELAY_MAIL_ENABLED; else process.env.RELAY_MAIL_ENABLED = mail;
    database().close();
    delete process.env.RELAY_DATA_ROOT;
    rmSync(root,{recursive:true,force:true});
  }
});
