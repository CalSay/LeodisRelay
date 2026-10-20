import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { beforeHandover } from '../lib/beforeHandover';
import type { CheckAnswer, Issue, Observation, Report, Variation } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };
const project = { id:'p1', projectNumber:'011LME', projectName:'Tetley Hall' };
const TODAY = '2026-10-20';

let n = 0;
const issue = (i: Partial<Issue> = {}): Issue => ({
  id:`iss-${++n}`, reference:`011LME-ISS-${String(n).padStart(3, '0')}`, projectId:'p1', location:'', description:'Something', actionNeeded:'',
  confirmation:'provisional', work:'open', owner:'', targetDate:'', raisedByReport:'r0', raisedAt:'2026-10-01T09:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation> = {}): Variation => ({
  id:`var-${++n}`, reference:`011LME-VO-00${n}`, projectId:'p1', description:'Extra sockets', location:'', workDone:false, instruction:'pending',
  source:'report', raisedBy:'Sam Spark', raisedAt:'2026-10-01T09:00:00Z', events:[], ...v } as Variation);
const check = (id: string, item: string, answer: CheckAnswer | undefined, o: Partial<Observation> = {}): Observation => ({
  id, type:'check', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], check:{ item, question:`Question ${item}`, ...(answer ? { answer } : {}) }, ...o });
const report = (r: Partial<Report>): Report => ({
  id:`rep-${++n}`, projectId:'p1', reference:`011LME-PHI-00${n}`, visitDate:'2026-10-10', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', reportType:'handover-inspection', ...r } as Report);

test('open issues are split into our snags by trade, fixes waiting to be checked, and other trades', () => {
  n = 0;
  const issues = [
    issue({ affectedTrade:'Electrical', location:'Level 2', owner:'Sparks Ltd', targetDate:'2026-10-15' }),
    issue({ affectedTrade:'Electrical', location:'level  1 ', description:'  Loose  cover ' }),
    issue({ reporterTrade:'HVAC', location:'Plant room' }),
    issue({ affectedTrade:'P&H', work:'awaiting_verification', closureSubmittedBy:'Pat Pipe', targetDate:'2026-10-01', location:'WC' }),
    issue({ affectedTrade:'Other / non-Leodis', owner:'Drylining Co', location:'Stair 2' }),
    issue({ location:'Lobby' }),
    issue({ affectedTrade:'Electrical', work:'closed' }),
    issue({ affectedTrade:'Electrical', confirmation:'withdrawn' }),
    issue({ affectedTrade:'Electrical', projectId:'p2' }),
    issue({ affectedTrade:'HVAC', confirmation:'disputed', targetDate:'not a date' }),
  ];
  const h = beforeHandover(project, { reports:[], issues, variations:[] }, engineer, TODAY);
  assert.deepEqual(h.ours.map(g => [g.trade, g.issues.map(i => i.reference)]), [
    ['Electrical', ['011LME-ISS-002', '011LME-ISS-001']],
    ['HVAC', ['011LME-ISS-010']],
  ], 'by trade in a fixed order, then by place as written, no place last');
  const [level1, level2] = h.ours[0]!.issues;
  assert.equal(level1!.location, 'level 1');
  assert.equal(level1!.description, 'Loose cover');
  assert.equal(level2!.overdue, true, 'past its target');
  assert.equal(level2!.owner, 'Sparks Ltd');
  const disputed = h.ours[1]!.issues[0]!;
  assert.equal(disputed.disputed, true);
  assert.equal(disputed.targetDate, '', 'a target that is not a date is left out');
  assert.deepEqual(h.toCheck.map(i => [i.reference, i.fixedBy, i.overdue, i.trade]), [['011LME-ISS-004', 'Pat Pipe', false, 'P&H']], 'a fix waiting to be checked is not past target');
  assert.deepEqual(h.others.map(i => [i.reference, i.trade]), [['011LME-ISS-006', undefined], ['011LME-ISS-003', undefined], ['011LME-ISS-005', 'Other / non-Leodis']],
    'no affected trade recorded is not assumed to be ours, even when an engineer of ours reported it');
  assert.deepEqual(h.totals, { ours:3, toCheck:1, others:3, variations:0, workDone:0, safety:0, overdue:1, outstanding:7 });
});

test('variations not yet instructed or declined are listed, work already done first', () => {
  n = 0;
  const variations = [
    variation({ quotedValue:1200 }),
    variation({ workDone:true, location:' Riser ' }),
    variation({ instruction:'instructed', workDone:true }),
    variation({ instruction:'declined' }),
    variation({ projectId:'p2' }),
  ];
  const h = beforeHandover(project, { reports:[], issues:[], variations }, engineer, TODAY);
  assert.deepEqual(h.variations.map(v => [v.reference, v.workDone, v.quoted, v.location]), [['011LME-VO-002', true, false, 'Riser'], ['011LME-VO-001', false, true, '']]);
  assert.equal(h.totals.workDone, 1);
  assert.equal(h.totals.outstanding, 2);
});

test('handover inspections say how many of their actions are still open, a correction counted once', () => {
  n = 0;
  const first = report({ visitDate:'2026-10-05', observations:[check('o1', 'labels', 'action', { location:'Level 2' }), check('o2', 'tested', 'ok')] });
  const second = report({ visitDate:'2026-10-12', observations:[check('o3', 'labels', 'action', { location:'Level 3' }), check('o4', 'tested', 'action', { location:'level 3' }), check('o5', 'covers', 'na'), check('o6', 'clean', undefined)] });
  // Revision 2 of the second inspection: o3 kept, o4 now linked to its issue, raised by revision 1.
  const correction = report({ visitDate:'2026-10-12', reference:second.reference, revision:2, corrects:second.id,
    observations:[check('o3', 'labels', 'action', { location:'Level 3' }), check('o4b', 'tested', 'action', { location:'Level 3', linkedIssueId:'iss-l3t' }), check('o5', 'covers', 'na'), check('o6', 'clean', 'ok')] });
  const draft = report({ state:'draft', visitDate:'2026-10-19' });
  const othersDraft = report({ state:'draft', authorId:other.id, visitDate:'2026-10-19' });
  const progress = report({ reportType:'progress', visitDate:'2026-10-18' });
  const issues = [
    issue({ id:'iss-l2', raisedByReport:first.id, raisedByObservation:'o1', reporterTrade:'Electrical', work:'closed' }),
    issue({ id:'iss-l3', raisedByReport:second.id, raisedByObservation:'o3', reporterTrade:'Electrical' }),
    issue({ id:'iss-l3t', raisedByReport:second.id, raisedByObservation:'o4', reporterTrade:'Electrical', work:'awaiting_verification' }),
  ];
  const h = beforeHandover(project, { reports:[first, second, correction, draft, othersDraft, progress], issues, variations:[] }, engineer, TODAY);
  assert.deepEqual(h.inspections.map(r => [r.reference, r.revision, r.raised, r.stillOpen, r.waiting, r.locations]), [
    [second.reference, 2, 2, 2, 1, ['Level 3']],
    [first.reference, 1, 1, 0, 0, ['Level 2']],
  ], 'latest first; the correction stands in; places without repeats');
  assert.deepEqual(h.inspections[0]!.checks, { ok:1, action:2, na:1, open:0 });
  assert.equal(h.ours[0]!.issues[0]!.inspection?.id, correction.id, 'an issue names the inspection that raised it, at its latest revision');
  assert.equal(h.toCheck[0]!.inspection?.reference, second.reference);
  assert.equal(h.ours[0]!.issues[0]!.trade, 'Electrical', 'an inspection action with no trade is the inspector\'s');
});

test('an inspection action that found an existing issue again counts it but does not claim to have raised it', () => {
  n = 0;
  const defect = issue({ id:'iss-old', raisedByReport:'spr-1', raisedByObservation:'d1', affectedTrade:'P&H' });
  const r = report({ observations:[check('o1', 'labels', 'action', { linkedIssueId:'iss-old' })] });
  const h = beforeHandover(project, { reports:[r], issues:[defect], variations:[] }, engineer, TODAY);
  assert.deepEqual([h.inspections[0]!.raised, h.inspections[0]!.stillOpen], [1, 1]);
  assert.equal(h.ours[0]!.issues[0]!.inspection, undefined);
});

test('open safety actions on the project come from its safety inspections', () => {
  n = 0;
  const safety = (visitDate: string, answer: CheckAnswer) => report({ reportType:'safety-inspection', visitDate, observations:[check(`s-${visitDate}`, 'fire', answer, { actionNeeded:'Move pallets' })] });
  let h = beforeHandover(project, { reports:[], issues:[], variations:[] }, engineer, TODAY);
  assert.equal(h.safetyInspected, false);
  assert.equal(h.totals.outstanding, 0, 'nothing open');
  h = beforeHandover(project, { reports:[safety('2026-10-06', 'ok'), safety('2026-10-13', 'action')], issues:[], variations:[] }, engineer, TODAY);
  assert.equal(h.safetyInspected, true);
  assert.deepEqual(h.safety.map(a => [a.item, a.actionNeeded, a.days]), [['fire', 'Move pallets', 7]]);
  assert.equal(h.totals.outstanding, 1);
  const other = report({ reportType:'safety-inspection', projectId:'p2', observations:[check('x', 'ppe', 'action')] });
  assert.equal(beforeHandover(project, { reports:[other], issues:[], variations:[] }, engineer, TODAY).safetyInspected, false, 'another project\'s inspection is left out');
});
