import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {createReport,getReport,saveDraft,startedReport} from '../lib/serverStore';
import {database} from '../lib/storage';
import {heldCounts,isClientKey,planHeldSend,sentLine,startedKey,startedReportId,visitDateProblem,type HeldWork} from '../lib/offlineStart';
import {unfinishedReports} from '../lib/unfinishedReports';
import type {Observation} from '../lib/types';

const engineer:Principal = {id:'entra:offline-engineer' as never,oid:'offline-engineer',name:'K. Wright',email:'k@example.test',role:'Engineer',trade:'HVAC'};
const other:Principal = {...engineer,id:'entra:offline-other' as never,oid:'offline-other',name:'P. Nolan'};
const card = (id:string,photos = 0):Observation => ({id,type:'update',location:'Plant room',whatHappened:'AHU set',actionNeeded:'',owner:'',
  photos:Array.from({length:photos},(_,i) => ({id:`p${i}`,dataUrl:'',caption:'',capturedAt:''}))});
const KEY = '33333333-3333-4333-8333-333333333333';
const started = {clientKey:KEY,projectId:'proj-011lme',projectName:'Tetley Hall - Block E',projectNumber:'011LME',visitDate:'2026-10-19',startedAt:'2026-10-19T08:00:00Z'};
const held = (extra:Partial<HeldWork>):HeldWork => ({key:'k',reportId:'rep-1',principalId:engineer.id,seq:1,observations:[card('a')],heldAt:'2026-10-20T09:00:00Z',...extra});

test('a visit date given by a phone is a real day, not ahead, and at most 30 days back',() => {
  const now = new Date('2026-10-20T10:00:00Z');
  assert.equal(visitDateProblem('2026-10-20',now),null);
  assert.equal(visitDateProblem('2026-10-21',now),null,'a phone a time zone ahead may already be on tomorrow');
  assert.equal(visitDateProblem('2026-09-20',now),null);
  assert.match(visitDateProblem('2026-10-22',now)!,/future/);
  assert.match(visitDateProblem('2026-09-19',now)!,/30 days/);
  for (const bad of ['2026-02-30','20-10-2026','',undefined,20261020]) assert.match(visitDateProblem(bad,now)!,/must be a date/,String(bad));
});

test('what goes up by itself: reports started offline, then copies typed on the offline page',() => {
  const all = [
    held({key:startedKey(engineer.id,KEY),reportId:startedReportId(KEY),started}),
    held({key:`${engineer.id}::rep-1`,reportId:'rep-1',heldOffline:true,baseVersion:3}),
    held({key:`${engineer.id}::rep-2`,reportId:'rep-2',baseVersion:2,tab:'tab-a'}),
    held({key:`${engineer.id}::rep-3::aside::tab-b`,reportId:'rep-3',heldOffline:true,baseVersion:2}),
    held({key:`${engineer.id}::rep-4`,reportId:'rep-4',heldOffline:true}),
    held({key:`${other.id}::rep-5`,reportId:'rep-5',principalId:other.id,heldOffline:true,baseVersion:1}),
  ];
  const plan = planHeldSend(all,engineer.id);
  assert.deepEqual(plan.start.map(h => h.reportId),[startedReportId(KEY)]);
  assert.deepEqual(plan.send.map(h => h.reportId),['rep-1'],'not an editor\'s copy, a set-aside copy, one with no base version, or another person\'s');
});

test('the words once held work has gone up',() => {
  assert.equal(sentLine([]),'');
  assert.equal(sentLine([{reference:'R1',started:true}]),'The report you started on this phone is now on the server. It stays a draft until you sign and send.');
  assert.equal(sentLine([{reference:'R1',started:false}]),'Your changes on this phone are now on the server. It stays a draft until you sign and send.');
  assert.equal(sentLine([{reference:'R1',started:true},{reference:'R2',started:false}]),'2 reports from this phone are now on the server. They stay drafts until you sign and send.');
  assert.deepEqual(heldCounts([card('a',2),card('b',1)]),{cards:2,photos:3});
  assert.equal(isClientKey(KEY),true);
  assert.equal(isClientKey('not-a-key'),false);
});

test('a report started offline shows on the home screen until the server has it',() => {
  const rows = unfinishedReports([],[{reportId:startedReportId(KEY),heldAt:'2026-10-19T09:00:00Z',observations:[card('a'),card('b')],started}],[{id:'proj-011lme',projectName:'Tetley Hall - Block E'}]);
  assert.equal(rows.length,1);
  assert.deepEqual([rows[0]!.started,rows[0]!.device,rows[0]!.reference,rows[0]!.visitDate,rows[0]!.cards],[true,'only','','2026-10-19',2]);
  assert.equal(unfinishedReports([],[{reportId:startedReportId(KEY),heldAt:'',observations:[],started:{...started,projectId:'closed'}}],[{id:'proj-011lme',projectName:'T'}]).length,0,'not for a project no longer open to them');
});

// One store per file: the connection is a module singleton that is not reopened after close.
test('starting a report begun offline, against the real store',async t => {
  const root = mkdtempSync(join(tmpdir(),'relay-offline-start-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    const first = createReport('proj-011lme',engineer.name,engineer,'progress',{clientKey:KEY,visitDate:'2026-10-19'});

    await t.test('takes the visit date the phone gave',() => {
      assert.equal(first.visitDate,'2026-10-19');
      assert.equal(first.state,'draft');
      assert.equal(first.authorId,engineer.id);
    });

    await t.test('a retry with the same key returns the same report, not a second one',() => {
      const again = createReport('proj-011lme',engineer.name,engineer,'progress',{clientKey:KEY,visitDate:'2026-10-19'});
      assert.equal(again.id,first.id);
      assert.equal(again.reference,first.reference);
      assert.equal(startedReport(engineer.id,KEY)?.id,first.id);
      const count = database().prepare("SELECT COUNT(*) AS n FROM records WHERE kind='reports'").get() as {n:number};
      assert.equal(Number(count.n),1);
    });

    await t.test('returns the report as it now stands, with cards saved since',() => {
      const saved = saveDraft(first.id,{...first,observations:[card('obs-1')]},first.version);
      assert.equal(saved.ok,true);
      const again = createReport('proj-011lme',engineer.name,engineer,'progress',{clientKey:KEY,visitDate:'2026-10-19'});
      assert.equal(again.version,2);
      assert.equal(again.observations.length,1);
    });

    await t.test('the key belongs to one person: another person\'s same key starts their own report',() => {
      const theirs = createReport('proj-011lme',other.name,other,'progress',{clientKey:KEY,visitDate:'2026-10-20'});
      assert.notEqual(theirs.id,first.id);
      assert.equal(theirs.authorId,other.id);
      assert.equal(startedReport(other.id,KEY)?.id,theirs.id);
    });

    await t.test('a report started with signal still takes today and keeps no key',() => {
      const today = createReport('proj-011lme',engineer.name,engineer);
      assert.equal(today.visitDate,new Date().toISOString().slice(0,10));
      assert.equal(getReport(today.id)?.id,today.id);
    });
  } finally {
    database().close();
    rmSync(root,{recursive:true,force:true});
  }
});
