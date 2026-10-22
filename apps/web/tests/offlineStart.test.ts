import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Principal} from '@relay/platform';
import {createReport,getReport,saveDraft,startedReport} from '../lib/serverStore';
import {database} from '../lib/storage';
import {fitStartedChecks,heldCounts,isClientKey,offlineTypes,planHeldSend,sentLine,startedKey,startedReportId,startedTitle,visitDateProblem,type HeldWork} from '../lib/offlineStart';
import {HANDOVER_CHECKLIST,SAFETY_CHECKLIST,invalidShape,reportTypeOf,startingCards} from '../lib/reportTypes';
import {unfinishedReports} from '../lib/unfinishedReports';
import {londonDay} from '../lib/weeklySummary';
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

test('an inspection started offline: its checks, its name, and how it fits the server\'s checks',() => {
  const types = offlineTypes();
  assert.deepEqual(types.map(t => t.id),['safety-inspection','handover-inspection','first-fix-inspection','tower-inspection']);
  assert.equal(types[0]!.checklist.length,SAFETY_CHECKLIST.length);
  assert.deepEqual(types.map(t => t.raisesIssues),[false,true,true,false],'only handover and first fix actions say where');
  assert.equal(types[1]!.checklist[0]!.hint,HANDOVER_CHECKLIST[0]!.hint);
  assert.equal(startedTitle(started),'New site update · Tetley Hall - Block E');
  assert.equal(startedTitle({...started,reportType:'safety-inspection'}),'New safety inspection · Tetley Hall - Block E');

  const server = startingCards(reportTypeOf({reportType:'handover-inspection'}));
  // The phone's copy, as the offline page builds it, with one check answered and a photo.
  const phone = server.map((o,i) => i === 2 ? {...o,location:'L2 east',whatHappened:'Grille missing',actionNeeded:'Fit grille',owner:'Ductwork',
    photos:[{id:'p1',dataUrl:'/api/media/p1',caption:'',capturedAt:''}],check:{...o.check!,answer:'action' as const}} : {...o,check:{...o.check!,answer:'ok' as const}});
  const fitted = fitStartedChecks(phone,server);
  assert.deepEqual(fitted,phone,'the same checklist: the copy goes up as it is');
  assert.equal(invalidShape({reportType:'handover-inspection',observations:server},fitted),null);

  // The wording changed in a deploy while the phone had no signal: the server's words are kept, the answers move across.
  const reworded = server.map(o => ({...o,check:{...o.check!,question:`${o.check!.question} (new wording)`}}));
  const moved = fitStartedChecks(phone,reworded);
  assert.equal(invalidShape({reportType:'handover-inspection',observations:reworded},moved),null);
  assert.deepEqual([moved[2]!.check!.answer,moved[2]!.location,moved[2]!.photos.length,moved[2]!.check!.question],['action','L2 east',1,reworded[2]!.check!.question]);
  assert.equal(moved[0]!.check!.answer,'ok');

  // A check the phone answered is no longer on the server's inspection: never dropped; the copy is kept as it is, and the server refuses it.
  const shorter = server.slice(1);
  assert.deepEqual(fitStartedChecks(phone,shorter),phone);
  assert.notEqual(invalidShape({reportType:'handover-inspection',observations:shorter},phone),null);
  // A removed check the phone left untouched does not hold the rest back.
  const untouched = server.map((o,i) => i === 0 ? o : {...o,check:{...o.check!,answer:'ok' as const}});
  assert.equal(invalidShape({reportType:'handover-inspection',observations:shorter},fitStartedChecks(untouched,shorter)),null);
  // A check added on the server since: it waits unanswered beside the phone's answers.
  const longer = [...server,{...server[0]!,id:'obs-check-new',check:{item:'new',question:'A new check'}}];
  const grown = fitStartedChecks(phone,longer);
  assert.equal(grown.length,longer.length);
  assert.equal(grown.at(-1)!.check!.answer,undefined);
  // A site update's cards are not touched.
  assert.deepEqual(fitStartedChecks([card('a')],[]),[card('a')]);
});

test('an inspection started offline shows on the home screen by its own name',() => {
  const checks = startingCards(reportTypeOf({reportType:'safety-inspection'}));
  const [row] = unfinishedReports([],[{reportId:startedReportId(KEY),heldAt:'2026-10-19T09:00:00Z',observations:checks,started:{...started,reportType:'safety-inspection'}}],[{id:'proj-011lme',projectName:'Tetley Hall - Block E'}]);
  assert.deepEqual([row!.typeName,row!.checklist,row!.cards,row!.started],['Safety inspection',true,SAFETY_CHECKLIST.length,true]);
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

    await t.test('an inspection started offline starts with its checks, and a retry returns it',() => {
      const key = '44444444-4444-4444-8444-444444444444';
      const inspection = createReport('proj-011lme',engineer.name,engineer,'safety-inspection',{clientKey:key,visitDate:'2026-10-18'});
      assert.deepEqual([inspection.reportType,inspection.visitDate,inspection.observations.length],['safety-inspection','2026-10-18',SAFETY_CHECKLIST.length]);
      assert.match(inspection.reference,/-SSI-\d{3}$/);
      assert.equal(createReport('proj-011lme',engineer.name,engineer,'safety-inspection',{clientKey:key,visitDate:'2026-10-18'}).id,inspection.id);
    });

    await t.test('a report started with signal still takes today and keeps no key',() => {
      const today = createReport('proj-011lme',engineer.name,engineer);
      // Today in the office calendar: between 23:00 and midnight UTC in summer it is already tomorrow in London.
      assert.equal(today.visitDate,londonDay(new Date()));
      assert.equal(getReport(today.id)?.id,today.id);
    });
  } finally {
    database().close();
    rmSync(root,{recursive:true,force:true});
  }
});
