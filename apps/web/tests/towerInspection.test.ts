import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { correctReport, createReport, renameInspected, reportsFor, saveDraft, submitReport } from '../lib/serverStore';
import { listIssues } from '../lib/issueStore';
import { listVariations } from '../lib/variationStore';
import { INSPECTED_MAX, inspectedKey, inspectedName, REPORT_TYPES, reportName, SAFETY_CHECKLIST, startingCards, TOWER_CHECKLIST } from '../lib/reportTypes';
import { reviewReport } from '../lib/review';
import { siteDiary } from '../lib/siteDiary';
import { documentModel } from '../lib/documentModel';
import { offlineTypes } from '../lib/offlineStart';
import { safetyActions, TOWER_DUE_DAYS, TOWER_SHOWN_DAYS } from '../lib/safetyActions';
import type { CheckAnswer, Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:engineer' as never, oid:'engineer', name:'G. Stephenson', email:'g@example.test', role:'Engineer', trade:'Electrical' };
const manager: Principal = { id:'entra:manager' as never, oid:'manager', name:'Tom', email:'t@example.test', role:'Manager' };
const drawn = 'data:image/png;base64,iVBORw0KGgo=';
const tower = REPORT_TYPES.find(t => t.id === 'tower-inspection')!;
const safety = REPORT_TYPES.find(t => t.id === 'safety-inspection')!;
const ok = <T,>(outcome: { ok: true; value: T } | { ok: false; reason: string }): T => { assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.reason); return (outcome as { ok: true; value: T }).value; };

/** Every check satisfactory, except a missing guardrail. */
function walked(cards: Observation[]): Observation[] {
  return cards.map(o => o.check!.item === 'guardrails'
    ? { ...o, check: { ...o.check!, answer: 'action' }, whatHappened: 'Middle guardrail missing on the east side', actionNeeded: 'Fit the guardrail before anyone goes up', owner: 'Leodis Electrical' }
    : { ...o, check: { ...o.check!, answer: 'ok' } });
}

test('the tower inspection and its rules, without a store', async t => {
  await t.test('a signed checklist about one tower, whose actions raise nothing', () => {
    assert.equal(tower.name, 'Tower inspection');
    assert.equal(tower.document, 'Tower and Podium Inspection');
    assert.equal(tower.code, 'TPI');
    assert.equal(tower.tag, 'Tower');
    assert.equal(tower.signatureRequired, true);
    assert.equal(tower.raisesRecords, false, 'a tower that is not safe is tagged out of use, not snagged');
    assert.equal(tower.inspects?.label, 'Tower or podium');
    assert.equal(TOWER_CHECKLIST.length, 12);
    assert.match(tower.blurb, /^12 checks on one mobile tower or podium; actions go on Safety actions$/);
    assert.equal(new Set(TOWER_CHECKLIST.map(c => c.item)).size, TOWER_CHECKLIST.length, 'check keys are unique');
    assert.ok(TOWER_CHECKLIST.every(c => c.question.trim() && c.hint.trim()), 'every check has a question and a hint');
    const weekly = new Set(SAFETY_CHECKLIST.map(c => c.question));
    assert.ok(TOWER_CHECKLIST.every(c => !weekly.has(c.question)), 'not the weekly safety inspection again');
    assert.equal(REPORT_TYPES.filter(t => t.inspects).map(t => t.id).join(), 'tower-inspection', 'no other type names one thing');
  });

  await t.test('what is inspected is required, tidied and kept short; other types take none', () => {
    assert.deepEqual(inspectedName(tower, '  T3,   level 2  east '), { ok: true, value: 'T3, level 2 east' });
    assert.equal(inspectedName(tower, undefined).ok, false);
    assert.equal(inspectedName(tower, '   ').ok, false);
    assert.equal(inspectedName(tower, 7).ok, false);
    assert.deepEqual(inspectedName(tower, ''), { ok: false, reason: 'Say which tower or podium you are inspecting.' });
    assert.equal(inspectedName(tower, 'x'.repeat(INSPECTED_MAX)).ok, true);
    assert.equal(inspectedName(tower, 'x'.repeat(INSPECTED_MAX + 1)).ok, false);
    assert.deepEqual(inspectedName(safety, undefined), { ok: true, value: undefined });
    assert.equal(inspectedName(safety, 'T3').ok, false, 'a safety inspection is of the whole site');
    assert.equal(inspectedKey(' T3,  Level 2 '), inspectedKey('t3, level 2'));
    assert.equal(reportName({ reportType: 'tower-inspection', inspected: 'T3' }), 'Tower inspection · T3');
    assert.equal(reportName({ reportType: 'safety-inspection' }), 'Safety inspection');
  });

  await t.test('an action says what is wrong but not where; the no-signal page gets the name it asks for', () => {
    const base = { id:'r', projectId:'p', reference:'X-TPI-001', visitDate:'2026-10-20', author:'G', state:'draft', version:1, revision:1, review:'not_required', reportType:'tower-inspection', inspected:'T3', draftSignature: { name: 'G', dataUrl: drawn } } as Report;
    const blocking = (r: Report) => reviewReport(r).filter(f => f.blocking).map(f => f.field);
    assert.deepEqual(blocking({ ...base, observations: walked(startingCards(tower)) }), [], 'the tower is where');
    assert.ok(blocking({ ...base, observations: startingCards(tower) }).length > 0, 'an unanswered check stops sending');
    assert.deepEqual(blocking({ ...base, inspected: '', observations: walked(startingCards(tower)) }), ['inspected'], 'an unnamed tower (started on an old offline page) cannot be sent');
    const offline = offlineTypes().find(t => t.id === 'tower-inspection')!;
    assert.equal(offline.raisesIssues, false);
    assert.deepEqual(offline.inspects, tower.inspects);
    assert.deepEqual(offline.checklist.map(c => c.item), TOWER_CHECKLIST.map(c => c.item));
    assert.equal(offlineTypes().find(t => t.id === 'safety-inspection')!.inspects, undefined);
  });
});

test('a tower inspection end to end through the store', async t => {
  const root = mkdtempSync(join(tmpdir(), 'relay-tower-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    let sent!: Report;
    await t.test('started with its tower, renamed while a draft, sent with a signature and raising nothing', async () => {
      const draft = createReport('proj-011lme', engineer.name, engineer, 'tower-inspection', undefined, 'T4, level 2 east corridor');
      assert.equal(draft.reference, '011LME-TPI-001');
      assert.equal(draft.inspected, 'T4, level 2 east corridor');
      assert.equal(draft.observations.length, TOWER_CHECKLIST.length);
      const renamed = ok(renameInspected(draft.id, 'T3, level 2 east corridor'));
      assert.equal(renamed.inspected, 'T3, level 2 east corridor');
      assert.equal(renamed.version, draft.version, 'renaming is not a save of the checks');
      const saved = ok(saveDraft(draft.id, { ...renamed, observations: walked(draft.observations), draftSignature: { name: engineer.name, dataUrl: drawn } }, draft.version));
      assert.equal(saved.inspected, 'T3, level 2 east corridor', 'a save keeps the name');
      assert.equal((await submitReport(draft.id, undefined, saved.version)).ok, false, 'it must be signed');
      sent = ok(await submitReport(draft.id, { name: engineer.name, dataUrl: drawn }, saved.version));
      assert.equal(sent.inspected, 'T3, level 2 east corridor');
      assert.equal(listIssues('proj-011lme').length, 0, 'no issue raised');
      assert.equal(listVariations('proj-011lme').length, 0, 'no variation raised');
      const refused = renameInspected(sent.id, 'T9');
      assert.equal(refused.ok, false, 'a sent inspection cannot be renamed');
      const site = createReport('proj-011lme', engineer.name, engineer, 'safety-inspection');
      assert.equal(site.inspected, undefined);
      assert.equal(renameInspected(site.id, 'T3').ok, false, 'only a type about one thing can be renamed');
    });

    await t.test('the office register, the PDF and the diary name the tower', async () => {
      const row = reportsFor(manager, 'proj-011lme').items.find(r => r.id === sent.id)!;
      assert.equal(row.inspected, 'T3, level 2 east corridor');
      assert.deepEqual(row.checks, { ok: TOWER_CHECKLIST.length - 1, action: 1, na: 0, open: 0 });
      assert.equal(row.defectCount, 0);
      const doc = await documentModel(sent);
      assert.equal(doc.documentTitle, 'Tower and Podium Inspection');
      assert.deepEqual(doc.inspected, { label: 'Tower or podium', value: 'T3, level 2 east corridor' });
      assert.equal((await documentModel({ ...sent, reportType: 'safety-inspection' })).inspected, undefined);
      const entry = siteDiary({ reports: [sent], issues: [], variations: [] }, manager, 'proj-011lme').days[0]!.entries[0]!;
      assert.equal(entry.inspection?.name, 'Tower inspection · T3, level 2 east corridor');
    });

    await t.test('a correction keeps the tower and can rename it before it is sent', () => {
      const correction = ok(correctReport(sent.id, 'Wrong tower'));
      assert.equal(correction.inspected, 'T3, level 2 east corridor');
      assert.equal(ok(renameInspected(correction.id, 'T5')).inspected, 'T5');
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Safety actions follow each tower on its own, and say when one is due', () => {
  const projects = [{ id:'p1', projectNumber:'011LME', projectName:'Tetley Hall' }];
  const check = (item: string, answer: CheckAnswer, o: Partial<Observation> = {}): Observation => ({
    id:`obs-check-${item}`, type:'check', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], check:{ item, question:`Question ${item}`, answer }, ...o });
  let n = 0;
  const towerCheck = (visitDate: string, inspected: string, checks: Observation[], r: Partial<Report> = {}): Report => ({
    id:`tpi-${++n}`, projectId:'p1', reference:`011LME-TPI-00${n}`, visitDate, author:'Sam', authorId:engineer.id, state:'submitted', version:1, revision:1,
    observations:checks, review:'not_required', reportType:'tower-inspection', inspected, ...r } as Report);
  const weekly = { id:'ssi-1', projectId:'p1', reference:'011LME-SSI-001', visitDate:'2026-10-14', author:'Sam', authorId:engineer.id, state:'submitted', version:1, revision:1,
    observations:[check('guardrails', 'action', { whatHappened:'Site guardrail' })], review:'not_required', reportType:'safety-inspection' } as Report;
  const reports = [
    towerCheck('2026-10-05', 'T3, level 2', [check('guardrails', 'action', { whatHappened:'Middle rail missing' }), check('base', 'action')]),
    towerCheck('2026-10-12', 'T4', [check('guardrails', 'ok')]),
    towerCheck('2026-10-15', ' t3,  Level 2', [check('base', 'ok'), check('guardrails', 'action', { whatHappened:'Still missing' })]),
    towerCheck('2026-09-01', 'Old podium', [check('tag', 'action')]),
    towerCheck('2026-10-19', 'T6', [check('tag', 'ok')], { state:'draft' }),
    weekly,
  ];
  const s = safetyActions(projects, reports, engineer, '2026-10-20');
  const p1 = s.projects[0]!;
  assert.equal(p1.inspections, 1, 'only weekly safety inspections count as the project inspection');
  assert.equal(p1.last?.id, 'ssi-1');
  const open = p1.open.map(a => [a.tower ?? 'site', a.item, a.times, a.found]);
  assert.deepEqual(open, [
    ['Old podium', 'tag', 1, ''],
    ['t3, Level 2', 'guardrails', 2, 'Still missing'],
    ['site', 'guardrails', 1, 'Site guardrail'],
  ], 'T4 being fine clears nothing on T3; the weekly inspection keeps its own guardrail action; a tower long gone keeps its open action');
  assert.deepEqual(p1.cleared.map(a => [a.tower, a.item, a.cleared?.id]), [['t3, Level 2', 'base', 'tpi-3']], 'named as the tower was last inspected');
  assert.ok(p1.open.every(a => a.key.startsWith('p1:')));
  assert.notEqual(p1.open[1]!.key, p1.open[2]!.key);
  assert.deepEqual(p1.towers.map(t => [t.name, t.sinceLast, t.due, t.open]), [
    ['T4', 8, true, 0],
    ['t3, Level 2', 5, false, 1],
  ], `due after ${TOWER_DUE_DAYS} days; not listed after ${TOWER_SHOWN_DAYS}; drafts left out`);
  assert.equal(s.totals.towersDue, 1);
  const seventh = safetyActions(projects, [towerCheck('2026-10-13', 'T8', [check('tag', 'ok')])], engineer, '2026-10-20').projects[0]!.towers[0]!;
  assert.deepEqual([seventh.sinceLast, seventh.due], [7, true], 'due on the seventh day, not the eighth');
  const sixth = safetyActions(projects, [towerCheck('2026-10-14', 'T8', [check('tag', 'ok')])], engineer, '2026-10-20').projects[0]!.towers[0]!;
  assert.equal(sixth.due, false);
  assert.equal(s.totals.open, 3);
  const unnamed = safetyActions(projects, [towerCheck('2026-10-18', '', [check('tag', 'action')])], engineer, '2026-10-20');
  assert.equal(unnamed.projects[0]!.open.length, 0, 'a tower inspection with no tower is not followed');
});
