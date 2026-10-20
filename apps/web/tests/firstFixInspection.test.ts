import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { correctReport, createReport, reportsFor, saveDraft, submitReport } from '../lib/serverStore';
import { listIssues } from '../lib/issueStore';
import { listVariations } from '../lib/variationStore';
import { FIRST_FIX_CHECKLIST, HANDOVER_CHECKLIST, invalidShape, raisesIssue, REPORT_TYPES, startingCards } from '../lib/reportTypes';
import { reviewReport } from '../lib/review';
import { siteDiary } from '../lib/siteDiary';
import { documentModel } from '../lib/documentModel';
import { offlineTypes } from '../lib/offlineStart';
import type { Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:engineer' as never, oid:'engineer', name:'G. Stephenson', email:'g@example.test', role:'Engineer', trade:'P&H' };
const manager: Principal = { id:'entra:manager' as never, oid:'manager', name:'Tom', email:'t@example.test', role:'Manager' };
const drawn = 'data:image/png;base64,iVBORw0KGgo=';
const firstFix = REPORT_TYPES.find(t => t.id === 'first-fix-inspection')!;

/** Every check satisfactory, except the pressure test: not done yet in one ceiling. */
function walked(cards: Observation[]): Observation[] {
  return cards.map(o => o.check!.item === 'pressure-test'
    ? { ...o, check: { ...o.check!, answer: 'action' }, location: 'L4 corridor ceiling', whatHappened: 'Heating flow and return not pressure tested', actionNeeded: 'Test before the ceiling is boarded', owner: 'Leodis P&H' }
    : { ...o, check: { ...o.check!, answer: 'ok' } });
}
const ok = <T,>(outcome: { ok: true; value: T } | { ok: false; reason: string }): T => { assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.reason); return (outcome as { ok: true; value: T }).value; };

test('the first fix inspection and its rules, without a store', async t => {
  await t.test('a signed checklist of its own, whose actions raise issues', () => {
    assert.equal(firstFix.name, 'First fix inspection');
    assert.equal(firstFix.document, 'First Fix Inspection');
    assert.equal(firstFix.code, 'FFI');
    assert.equal(firstFix.drawnSignature, true);
    assert.equal(firstFix.raisesRecords, true);
    assert.equal(FIRST_FIX_CHECKLIST.length, 12);
    assert.match(firstFix.blurb, /^12 checks .*before ceilings and walls are closed.*snag list/);
    assert.equal(new Set(FIRST_FIX_CHECKLIST.map(c => c.item)).size, FIRST_FIX_CHECKLIST.length, 'check keys are unique');
    assert.ok(FIRST_FIX_CHECKLIST.every(c => c.question.trim() && c.hint.trim()), 'every check has a question and a hint');
    const shared = new Set(HANDOVER_CHECKLIST.map(c => c.question));
    assert.ok(FIRST_FIX_CHECKLIST.filter(c => shared.has(c.question)).length <= 1, 'not the handover inspection again');
    const [first] = startingCards(firstFix);
    assert.equal(first!.id, 'obs-check-first-fix');
    assert.equal(raisesIssue(firstFix, { check: { ...first!.check!, answer: 'action' } }), true);
    assert.equal(raisesIssue(firstFix, { check: { ...first!.check!, answer: 'na' } }), false);
  });

  await t.test('an action must say where; a started inspection keeps its checks', () => {
    const base = { id:'r', projectId:'p', reference:'X-FFI-001', visitDate:'2026-10-20', author:'G', state:'draft', version:1, revision:1, review:'not_required', reportType:'first-fix-inspection', draftSignature: { name: 'G', dataUrl: drawn } } as Report;
    const blocking = (r: Report) => reviewReport(r).filter(f => f.blocking).map(f => f.field);
    const nowhere = walked(startingCards(firstFix)).map(o => o.check!.answer === 'action' ? { ...o, location: '' } : o);
    assert.deepEqual(blocking({ ...base, observations: nowhere }), ['location']);
    assert.deepEqual(blocking({ ...base, observations: walked(startingCards(firstFix)) }), []);
    assert.ok(blocking({ ...base, observations: startingCards(firstFix) }).length > 0, 'an unanswered check stops sending');
    const existing = { reportType: 'first-fix-inspection' as const, observations: startingCards(firstFix) };
    assert.equal(invalidShape(existing, walked(existing.observations)), null);
    assert.notEqual(invalidShape(existing, existing.observations.slice(1)), null, 'a check cannot be removed');
  });

  await t.test('the no-signal page gets it with its checks and its snag-list rule', () => {
    const offline = offlineTypes().find(t => t.id === 'first-fix-inspection')!;
    assert.equal(offline.name, 'First fix inspection');
    assert.equal(offline.raisesIssues, true);
    assert.deepEqual(offline.checklist.map(c => c.item), FIRST_FIX_CHECKLIST.map(c => c.item));
  });
});

test('a first fix inspection end to end through the store', async t => {
  const root = mkdtempSync(join(tmpdir(), 'relay-first-fix-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    let sent!: Report;
    await t.test('numbered on its own, signed with a drawing, and its action raised as an issue', async () => {
      assert.equal(createReport('proj-011lme', engineer.name, engineer, 'handover-inspection').reference, '011LME-PHI-001');
      const draft = createReport('proj-011lme', engineer.name, engineer, 'first-fix-inspection');
      assert.equal(draft.reference, '011LME-FFI-001', 'first fix inspections count separately');
      assert.equal(draft.reportType, 'first-fix-inspection');
      assert.equal(draft.observations.length, FIRST_FIX_CHECKLIST.length);
      const saved = ok(saveDraft(draft.id, { ...draft, observations: walked(draft.observations), draftSignature: { name: engineer.name, dataUrl: drawn } }, draft.version));
      assert.equal((await submitReport(draft.id, { name: engineer.name }, saved.version)).ok, false, 'a typed name does not sign it');
      sent = ok(await submitReport(draft.id, { name: engineer.name, dataUrl: drawn }, saved.version));
      const issues = listIssues('proj-011lme');
      assert.equal(issues.length, 1);
      assert.equal(issues[0]!.location, 'L4 corridor ceiling');
      assert.equal(issues[0]!.description, 'Heating flow and return not pressure tested');
      assert.equal(issues[0]!.actionNeeded, 'Test before the ceiling is boarded');
      assert.equal(issues[0]!.raisedByReport, sent.id);
      assert.equal(listVariations('proj-011lme').length, 0, 'no variation raised');
      assert.equal(createReport('proj-011lme', engineer.name, engineer, 'first-fix-inspection').reference, '011LME-FFI-002');
    });

    await t.test('the office register, the PDF and the diary name it', async () => {
      const row = reportsFor(manager, 'proj-011lme').items.find(r => r.id === sent.id)!;
      assert.equal(row.reportType, 'first-fix-inspection');
      assert.deepEqual(row.checks, { ok: FIRST_FIX_CHECKLIST.length - 1, action: 1, na: 0, open: 0 });
      assert.equal(row.defectCount, 1);
      const doc = await documentModel(sent);
      assert.equal(doc.documentTitle, 'First Fix Inspection');
      assert.equal(doc.inspection, true);
      const entry = siteDiary({ reports: [sent], issues: listIssues('proj-011lme'), variations: [] }, manager, 'proj-011lme').days[0]!.entries[0]!;
      assert.deepEqual(entry.inspection, { name: 'First fix inspection', ok: FIRST_FIX_CHECKLIST.length - 1, action: 1, na: 0 });
      assert.equal(entry.cards[0]!.location, 'L4 corridor ceiling');
    });

    await t.test('a correction links the action to its issue rather than raising it again', async () => {
      const correction = ok(correctReport(sent.id, 'Tested the same afternoon'));
      const action = correction.observations.findIndex(o => o.check?.answer === 'action');
      assert.equal(correction.observations[action]!.linkedIssueId, listIssues('proj-011lme')[0]!.id);
      const saved = ok(saveDraft(correction.id, { ...correction, draftSignature: { name: engineer.name, dataUrl: drawn } }, correction.version));
      ok(await submitReport(correction.id, { name: engineer.name, dataUrl: drawn }, saved.version));
      assert.equal(listIssues('proj-011lme').length, 1, 'no issue raised twice');
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
