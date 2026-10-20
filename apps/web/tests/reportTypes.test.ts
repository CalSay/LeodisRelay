import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { correctReport, createReport, getReport, reportsFor, saveDraft, submitReport } from '../lib/serverStore';
import { listIssues } from '../lib/issueStore';
import { invalidShape, SAFETY_CHECKLIST, startingCards, reportTypeOf, REPORT_TYPES, checkCounts } from '../lib/reportTypes';
import { reviewReport } from '../lib/review';
import { siteDiary } from '../lib/siteDiary';
import { weeklySummary } from '../lib/weeklySummary';
import { documentModel } from '../lib/documentModel';
import { compareDrafts, choicesFor } from '../lib/draftConflict';
import type { CheckAnswer, Observation, Report } from '../lib/types';

const engineer: Principal = { id:'entra:engineer' as never, oid:'engineer', name:'G. Stephenson', email:'g@example.test', role:'Engineer', trade:'Electrical' };
const manager: Principal = { id:'entra:manager' as never, oid:'manager', name:'Tom', email:'t@example.test', role:'Manager' };
const drawn = 'data:image/png;base64,iVBORw0KGgo=';
const inspection = REPORT_TYPES.find(t => t.id === 'safety-inspection')!;

/** Every check answered `answer`, the first one as action needed with its details when `action` is set. */
function answered(cards: Observation[], answer: CheckAnswer = 'ok', action = false): Observation[] {
  return cards.map((o, i) => i === 0 && action
    ? { ...o, check: { ...o.check!, answer: 'action' }, whatHappened: 'Lead with cut sheath', actionNeeded: 'Withdraw and replace the lead', owner: 'Leodis Electrical' }
    : { ...o, check: { ...o.check!, answer } });
}
const ok = <T,>(outcome: { ok: true; value: T } | { ok: false; reason: string }): T => { assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.reason); return (outcome as { ok: true; value: T }).value; };

test('the checklist and its rules, without a store', async t => {
  await t.test('a new inspection starts with one unanswered card per check, each keeping its question', () => {
    const cards = startingCards(inspection);
    assert.equal(cards.length, SAFETY_CHECKLIST.length);
    assert.ok(cards.every(o => o.type === 'check' && o.check && !o.check.answer && o.check.question));
    assert.equal(new Set(cards.map(o => o.id)).size, cards.length, 'card IDs are unique');
    assert.deepEqual(startingCards(reportTypeOf({})), [], 'a site update starts empty');
  });

  await t.test('a save keeps the checklist as it was asked: answers change, checks do not', () => {
    const existing = { reportType: 'safety-inspection' as const, observations: startingCards(inspection) };
    assert.equal(invalidShape(existing, answered(existing.observations)), null);
    assert.match(invalidShape(existing, existing.observations.slice(1)) ?? '', /keeps every check/);
    assert.match(invalidShape(existing, [...existing.observations, { ...existing.observations[0]!, id: 'obs-extra' }]) ?? '', /keeps every check/);
    const reworded = existing.observations.map((o, i) => i === 2 ? { ...o, check: { ...o.check!, question: 'Something easier' } } : o);
    assert.match(invalidShape(existing, reworded) ?? '', /as it was asked/);
    const retyped = existing.observations.map((o, i) => i === 2 ? { ...o, type: 'defect' as const } : o);
    assert.match(invalidShape(existing, retyped) ?? '', /as it was asked/, 'a check cannot become a defect and raise an issue');
    const bad = existing.observations.map((o, i) => i === 0 ? { ...o, check: { ...o.check!, answer: 'maybe' as never } } : o);
    assert.match(invalidShape(existing, bad) ?? '', /Unknown check answer/);
    assert.match(invalidShape({ observations: [] }, existing.observations) ?? '', /belong to an inspection/, 'a site update holds no checks');
  });

  await t.test('sending needs every answer, the details of each action and a drawn signature; nothing else', () => {
    const base = { id:'r', projectId:'p', reference:'X-SSI-001', visitDate:'2026-10-20', author:'G', state:'draft', version:1, revision:1, review:'not_required', reportType:'safety-inspection' } as Report;
    const blocking = (r: Report) => reviewReport(r).filter(f => f.blocking).map(f => f.field);
    const fresh = { ...base, observations: startingCards(inspection) };
    assert.equal(blocking(fresh).filter(f => f === 'answer').length, SAFETY_CHECKLIST.length);
    const allOk = { ...base, observations: answered(fresh.observations) };
    assert.deepEqual(blocking(allOk), ['signature'], 'a typed name alone does not sign an inspection');
    assert.deepEqual(blocking({ ...allOk, draftSignature: { name: 'G', dataUrl: drawn } }), []);
    const bare = { ...allOk, draftSignature: { name: 'G', dataUrl: drawn }, observations: allOk.observations.map((o, i) => i === 0 ? { ...o, check: { ...o.check!, answer: 'action' as const } } : o) };
    assert.deepEqual(blocking(bare), ['whatHappened', 'actionNeeded'], 'action needed says what is wrong and what has to happen');
    const warned = reviewReport(bare).filter(f => !f.blocking).map(f => f.field);
    assert.deepEqual(warned, ['owner', 'photos'], 'who and a photograph are worth adding, never required');
    assert.deepEqual(checkCounts(answered(fresh.observations, 'na', true)), { ok: 0, action: 1, na: SAFETY_CHECKLIST.length - 1, open: 0 });
  });

  await t.test('two versions of one check offer this one or that one, never both', () => {
    const cards = startingCards(inspection);
    const here = { observations: answered(cards, 'ok') } as Report, there = { observations: answered(cards, 'na') } as Report;
    const card = compareDrafts(here, there).cards[0]!;
    assert.equal(card.status, 'changed');
    assert.deepEqual(choicesFor(card), ['here', 'there']);
  });
});

test('an inspection end to end through the store, and every reader of sent reports', async t => {
  const root = mkdtempSync(join(tmpdir(), 'relay-report-types-'));
  process.env.RELAY_DATA_ROOT = root;
  try {
    let sent!: Report;
    await t.test('it is numbered on its own and sent signed, raising no issues or variations', async () => {
      const update = createReport('proj-011lme', engineer.name, engineer);
      assert.equal(update.reference, '011LME-SPR-001');
      assert.equal(update.reportType, undefined, 'a site update keeps the shape every older report has');
      const draft = createReport('proj-011lme', engineer.name, engineer, 'safety-inspection');
      assert.equal(draft.reference, '011LME-SSI-001', 'inspections count separately from site updates');
      assert.equal(draft.reportType, 'safety-inspection');
      assert.equal(draft.observations.length, SAFETY_CHECKLIST.length);
      assert.equal(createReport('proj-011lme', engineer.name, engineer).reference, '011LME-SPR-002');

      const saved = ok(saveDraft(draft.id, { ...draft, observations: answered(draft.observations, 'ok', true), draftSignature: { name: engineer.name, dataUrl: drawn } }, draft.version));
      const unsigned = await submitReport(draft.id, { name: engineer.name }, saved.version);
      assert.equal(unsigned.ok, false, 'the server asks for the drawing too');
      assert.match(unsigned.ok ? '' : unsigned.reason, /Sign the inspection/);
      sent = ok(await submitReport(draft.id, { name: engineer.name, dataUrl: drawn }, saved.version));
      assert.equal(sent.state, 'submitted');
      assert.equal(sent.signature?.dataUrl, drawn);
      assert.equal(listIssues('proj-011lme').length, 0, 'an action stays on the inspection');
    });

    await t.test('a site update keeps its own rule: it cannot be sent with no cards', async () => {
      const update = createReport('proj-014lme', engineer.name, engineer);
      const empty = await submitReport(update.id, { name: engineer.name }, update.version);
      assert.equal(empty.ok, false);
    });

    await t.test('the office register counts its answers, not its cards', () => {
      const row = reportsFor(manager, 'proj-011lme').items.find(r => r.id === sent.id)!;
      assert.equal(row.reportType, 'safety-inspection');
      assert.deepEqual(row.checks, { ok: SAFETY_CHECKLIST.length - 1, action: 1, na: 0, open: 0 });
    });

    await t.test('a correction keeps the checks and their answers, and must be signed again', async () => {
      const correction = ok(correctReport(sent.id, 'Wrong lead recorded'));
      assert.equal(correction.reportType, 'safety-inspection');
      assert.equal(correction.reference, sent.reference);
      assert.equal(correction.revision, 2);
      assert.deepEqual(correction.observations.map(o => o.check), sent.observations.map(o => o.check));
      assert.ok(reviewReport(correction).some(f => f.field === 'signature' && f.blocking));
      assert.equal(getReport(sent.id)?.state, 'submitted');
    });

    await t.test('the PDF is titled as an inspection and carries each question with its answer', async () => {
      const doc = await documentModel(sent);
      assert.equal(doc.documentTitle, 'Site Safety Inspection');
      assert.equal(doc.inspection, true);
      assert.deepEqual(doc.observations[0]!.check, { question: SAFETY_CHECKLIST[0]!.question, answer: 'Action needed', tone: 'action' });
      assert.equal(doc.observations[1]!.check?.answer, 'Satisfactory');
      const { reportType: _type, ...plain } = sent;
      const update = await documentModel({ ...plain, observations: [] });
      assert.equal(update.documentTitle, undefined, 'a site update keeps its title');
    });

    await t.test('the diary shows the inspection with its counts and only the check that needs action', () => {
      const diary = siteDiary({ reports: [sent], issues: [], variations: [] }, manager, 'proj-011lme');
      const entry = diary.days[0]!.entries[0]!;
      assert.deepEqual(entry.inspection, { name: 'Safety inspection', ok: SAFETY_CHECKLIST.length - 1, action: 1, na: 0 });
      assert.equal(entry.cards.length, 1);
      assert.deepEqual(entry.cards[0]!.check, { question: SAFETY_CHECKLIST[0]!.question, answer: 'Action needed', tone: 'action' });
      const filtered = siteDiary({ reports: [{ ...sent, observations: answered(sent.observations) }], issues: [], variations: [] }, manager, 'proj-011lme', { kind: 'check' });
      assert.equal(filtered.totalReports, 1, 'filtered to inspections, one with nothing to act on still shows');
      const found = siteDiary({ reports: [sent], issues: [], variations: [] }, manager, 'proj-011lme', { words: 'power tools' });
      assert.equal(found.totalReports, 0, 'only checks shown in the diary are searched there');
      assert.equal(siteDiary({ reports: [sent], issues: [], variations: [] }, manager, 'proj-011lme', { words: 'cut sheath' }).totalReports, 1);
    });

    await t.test('the weekly summary names the inspection rather than counting twelve cards', () => {
      const week = weeklySummary({ reports: [{ ...sent, visitDate: '2026-10-20' }], issues: [], variations: [] }, manager, 'proj-011lme', '2026-10-19', '2026-10-20');
      assert.deepEqual(week.reports[0]!.inspection, { name: 'Safety inspection', ok: SAFETY_CHECKLIST.length - 1, action: 1, na: 0 });
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
