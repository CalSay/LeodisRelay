import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { correctReport, createReport, getReport, reportsFor, saveDraft, submitReport } from '../lib/serverStore';
import { getIssue, listIssues } from '../lib/issueStore';
import { CHECKLIST_TYPES, HANDOVER_CHECKLIST, invalidShape, raisesIssue, REPORT_TYPES, startingCards } from '../lib/reportTypes';
import { reviewReport } from '../lib/review';
import { siteDiary } from '../lib/siteDiary';
import { weeklySummary } from '../lib/weeklySummary';
import { documentModel } from '../lib/documentModel';
import type { Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:engineer' as never, oid:'engineer', name:'G. Stephenson', email:'g@example.test', role:'Engineer', trade:'Electrical' };
const manager: Principal = { id:'entra:manager' as never, oid:'manager', name:'Tom', email:'t@example.test', role:'Manager' };
const drawn = 'data:image/png;base64,iVBORw0KGgo=';
const handover = REPORT_TYPES.find(t => t.id === 'handover-inspection')!;
const safety = REPORT_TYPES.find(t => t.id === 'safety-inspection')!;

/** Every check satisfactory, except the first two: snags with where, what and who. */
function walked(cards: Observation[]): Observation[] {
  return cards.map((o, i) => i === 0
    ? { ...o, check: { ...o.check!, answer: 'action' }, location: 'L2 office 2.04', whatHappened: 'Tray lid missing over the desks', actionNeeded: 'Fit the lid', owner: 'Leodis Electrical' }
    : i === 1
      ? { ...o, check: { ...o.check!, answer: 'action' }, location: 'L2 riser', whatHappened: 'Insulation not taped at the bends', actionNeeded: 'Tape the joints', owner: '' }
      : { ...o, check: { ...o.check!, answer: 'ok' } });
}
const ok = <T,>(outcome: { ok: true; value: T } | { ok: false; reason: string }): T => { assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.reason); return (outcome as { ok: true; value: T }).value; };

test('the handover inspection and its rules, without a store', async t => {
  await t.test('it is a checklist type of its own, signed, whose actions raise issues', () => {
    assert.deepEqual(CHECKLIST_TYPES.map(t => t.id), ['safety-inspection', 'handover-inspection', 'first-fix-inspection', 'tower-inspection'], 'one home tile per checklist type');
    assert.equal(handover.code, 'PHI');
    assert.equal(handover.signatureRequired, true);
    assert.equal(new Set(HANDOVER_CHECKLIST.map(c => c.item)).size, HANDOVER_CHECKLIST.length, 'check keys are unique');
    const [first] = startingCards(handover);
    assert.equal(raisesIssue(handover, { check: { ...first!.check!, answer: 'action' } }), true);
    assert.equal(raisesIssue(handover, { check: { ...first!.check!, answer: 'ok' } }), false);
    assert.equal(raisesIssue(safety, { check: { ...first!.check!, answer: 'action' } }), false, 'a safety action stays on the inspection');
  });

  await t.test('an action must say where, as every snag does; a safety action need not', () => {
    const base = { id:'r', projectId:'p', reference:'X-PHI-001', visitDate:'2026-10-20', author:'G', state:'draft', version:1, revision:1, review:'not_required', draftSignature: { name: 'G', dataUrl: drawn } } as Report;
    const blocking = (r: Report) => reviewReport(r).filter(f => f.blocking).map(f => f.field);
    const nowhere = walked(startingCards(handover)).map((o, i) => i === 0 ? { ...o, location: ' ' } : o);
    assert.deepEqual(blocking({ ...base, reportType: 'handover-inspection', observations: nowhere }), ['location']);
    assert.deepEqual(blocking({ ...base, reportType: 'handover-inspection', observations: walked(startingCards(handover)) }), []);
    const safetyAction = startingCards(safety).map((o, i) => ({ ...o, check: { ...o.check!, answer: i === 0 ? 'action' as const : 'ok' as const }, ...(i === 0 ? { whatHappened: 'Cut lead', actionNeeded: 'Replace it' } : {}) }));
    assert.deepEqual(blocking({ ...base, reportType: 'safety-inspection', observations: safetyAction }), []);
  });

  await t.test('a save cannot link a check to an issue: only a correction does, on the server', () => {
    const existing = { reportType: 'handover-inspection' as const, observations: startingCards(handover) };
    const linked = existing.observations.map((o, i) => i === 0 ? { ...o, linkedIssueId: 'iss-someone-elses' } : o);
    assert.match(invalidShape(existing, linked) ?? '', /not linked to an issue/);
    const corrected = { reportType: 'handover-inspection' as const, observations: linked };
    assert.equal(invalidShape(corrected, linked), null, 'the link the server set is kept');
    assert.match(invalidShape(corrected, existing.observations) ?? '', /not linked to an issue/, 'nor dropped');
  });
});

test('a handover inspection end to end through the store, and every reader of sent reports', async t => {
  const root = mkdtempSync(join(tmpdir(), 'relay-handover-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    let sent!: Report;
    await t.test('it is numbered on its own, and sending raises one issue per action', async () => {
      assert.equal(createReport('proj-011lme', engineer.name, engineer, 'safety-inspection').reference, '011LME-SSI-001');
      const draft = createReport('proj-011lme', engineer.name, engineer, 'handover-inspection');
      assert.equal(draft.reference, '011LME-PHI-001', 'handover inspections count separately');
      assert.equal(draft.observations.length, HANDOVER_CHECKLIST.length);
      const saved = ok(saveDraft(draft.id, { ...draft, observations: walked(draft.observations), draftSignature: { name: engineer.name, dataUrl: drawn } }, draft.version));
      const unsigned = await submitReport(draft.id, { name: engineer.name }, saved.version);
      assert.equal(unsigned.ok, false, 'a typed name does not sign it');
      sent = ok(await submitReport(draft.id, { name: engineer.name, dataUrl: drawn }, saved.version));
      const issues = listIssues('proj-011lme');
      assert.equal(issues.length, 2);
      const lid = issues.find(i => i.raisedByObservation === sent.observations[0]!.id)!;
      assert.equal(lid.location, 'L2 office 2.04');
      assert.equal(lid.description, 'Tray lid missing over the desks');
      assert.equal(lid.actionNeeded, 'Fit the lid');
      assert.equal(lid.work, 'assigned', 'named to someone, so assigned');
      assert.equal(lid.confirmation, 'provisional');
      assert.equal(lid.raisedByReport, sent.id);
      assert.equal(issues.find(i => i.location === 'L2 riser')?.work, 'open');
    });

    await t.test('the office register counts its answers', () => {
      const row = reportsFor(manager, 'proj-011lme').items.find(r => r.id === sent.id)!;
      assert.equal(row.reportType, 'handover-inspection');
      assert.deepEqual(row.checks, { ok: HANDOVER_CHECKLIST.length - 2, action: 2, na: 0, open: 0 });
      assert.equal(row.defectCount, 2, 'the review dialog counts the issues approving will confirm');
    });

    await t.test('a correction points each action at the issue it raised, so resending adds a sighting, not a second issue', async () => {
      const correction = ok(correctReport(sent.id, 'Second snag was in the other riser'));
      assert.equal(correction.reference, sent.reference);
      const raised = listIssues('proj-011lme');
      assert.equal(correction.observations[0]!.linkedIssueId, raised.find(i => i.raisedByObservation === sent.observations[0]!.id)!.id);
      assert.equal(correction.observations[2]!.linkedIssueId, undefined, 'a satisfactory check raised nothing');
      const changed = correction.observations.map((o, i) => i === 1 ? { ...o, location: 'L3 riser' } : o);
      const saved = ok(saveDraft(correction.id, { ...correction, observations: changed, draftSignature: { name: engineer.name, dataUrl: drawn } }, correction.version));
      ok(await submitReport(correction.id, { name: engineer.name, dataUrl: drawn }, saved.version));
      assert.equal(listIssues('proj-011lme').length, 2, 'no issue raised twice');
      const riser = getIssue(correction.observations[1]!.linkedIssueId!)!;
      assert.match(riser.events.at(-1)!.note ?? '', /^Corrected in 011LME-PHI-001 rev 2/);
      assert.equal(getReport(sent.id)?.state, 'submitted', 'the sent revision is untouched');
    });

    await t.test('the PDF names it, and an action says where', async () => {
      const doc = await documentModel(sent);
      assert.equal(doc.documentTitle, 'Pre-Handover Inspection');
      assert.equal(doc.inspection, true);
      assert.equal(doc.observations[0]!.location, 'L2 office 2.04');
      assert.equal(doc.observations[0]!.check?.tone, 'action');
    });

    await t.test('the diary shows each action with where it is and the issue it raised', () => {
      const issues = listIssues('proj-011lme');
      const diary = siteDiary({ reports: [sent], issues, variations: [] }, manager, 'proj-011lme');
      const entry = diary.days[0]!.entries[0]!;
      assert.deepEqual(entry.inspection, { name: 'Handover inspection', ok: HANDOVER_CHECKLIST.length - 2, action: 2, na: 0 });
      assert.equal(entry.cards.length, 2);
      assert.equal(entry.cards[0]!.location, 'L2 office 2.04');
      assert.match(entry.cards[0]!.issue?.reference ?? '', /-ISS-/);
      assert.equal(entry.cards[0]!.issue?.sighting, false);
      // A correction that withdraws the action (now satisfactory, with a note) keeps the link but shows no issue.
      const withdrawn = { ...sent, id: 'rep-withdrawn', corrects: sent.id, revision: 2, observations: sent.observations.map((o, i) => i === 0
        ? { ...o, check: { ...o.check!, answer: 'ok' as const }, location: '', actionNeeded: '', owner: '', whatHappened: 'Lid was fitted after all', linkedIssueId: issues.find(x => x.raisedByObservation === o.id)!.id }
        : o) };
      const after = siteDiary({ reports: [sent, withdrawn], issues, variations: [] }, manager, 'proj-011lme').days[0]!.entries[0]!;
      assert.equal(after.cards.find(c => c.id === sent.observations[0]!.id)?.issue, undefined);
    });

    await t.test('the weekly summary names it rather than counting twelve cards', () => {
      const week = weeklySummary({ reports: [{ ...sent, visitDate: '2026-10-20' }], issues: [], variations: [] }, manager, 'proj-011lme', '2026-10-19', '2026-10-20');
      assert.deepEqual(week.reports[0]!.inspection, { name: 'Handover inspection', ok: HANDOVER_CHECKLIST.length - 2, action: 2, na: 0 });
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
