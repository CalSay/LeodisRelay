import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companiesByTrade, companiesForIssue, projectSuggestions } from '../lib/suggestions';
import type { Issue, Observation, Report, Variation } from '../lib/types';

const card = (o: Partial<Observation>): Observation => ({ id: 'o', type: 'defect', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], ...o });
const report = (at: string, observations: Observation[], r: Partial<Report> = {}): Report => ({ id: at, projectId: 'p1', reference: 'R', visitDate: at.slice(0, 10), author: 'Sam',
  state: 'submitted', version: 1, revision: 1, observations, review: 'not_required', serverAcknowledgedAt: at, ...r } as Report);
const issue = (raisedAt: string, i: Partial<Issue>): Issue => ({ id: raisedAt, reference: 'I', projectId: 'p1', location: '', description: '', actionNeeded: '', confirmation: 'confirmed',
  work: 'open', owner: '', targetDate: '', raisedByReport: '', raisedAt, events: [], ...i } as Issue);
const variation = (raisedAt: string, location: string): Variation => ({ id: raisedAt, reference: 'V', projectId: 'p1', description: '', location, workDone: false, raisedAt, events: [] } as unknown as Variation);
const none = { reports: [], issues: [], variations: [] };

test('companies come from who was asked to respond on sent defect and access cards, newest first', () => {
  const s = projectSuggestions({ ...none, reports: [
    report('2026-10-01T09:00:00Z', [card({ owner: 'Main contractor' }), card({ type: 'access', owner: 'Site manager' })]),
    report('2026-10-08T09:00:00Z', [card({ owner: 'Dryline Ltd' })]),
  ] });
  assert.deepEqual(s.companies, ['Dryline Ltd', 'Main contractor', 'Site manager']);
});

test('drafts, progress and variation cards, and blank or "unknown" answers are not suggested', () => {
  const s = projectSuggestions({ ...none, reports: [
    report('2026-10-01T09:00:00Z', [card({ owner: 'Private draft co', location: 'Draft room' })], { state: 'draft' }),
    report('2026-10-02T09:00:00Z', [card({ type: 'update', owner: 'Progress co' }), card({ type: 'instruction', owner: 'Client' }), card({ owner: '  ' }), card({ owner: 'Unknown' }), card({ owner: 'TBC' })]),
  ] });
  assert.deepEqual(s.companies, []);
  assert.ok(!s.locations.includes('Draft room'));
});

test('an owner the office gave an issue counts from when it was last changed', () => {
  const s = projectSuggestions({ ...none,
    reports: [report('2026-10-05T09:00:00Z', [card({ owner: 'Main contractor' })])],
    issues: [issue('2026-09-01T09:00:00Z', { owner: 'Sparks & Co', events: [{ at: '2026-10-10T09:00:00Z', actor: 'Office', kind: 'assigned', note: '', photos: [] } as Issue['events'][number]] })],
  });
  assert.deepEqual(s.companies, ['Sparks & Co', 'Main contractor']);
});

test('wording differing only in case or spacing is one suggestion, shown as last typed', () => {
  const s = projectSuggestions({ ...none, reports: [
    report('2026-10-01T09:00:00Z', [card({ owner: 'main contractor', location: 'level 2  riser' })]),
    report('2026-10-03T09:00:00Z', [card({ owner: ' Main Contractor ', location: 'Level 2 riser' })]),
  ] });
  assert.deepEqual(s.companies, ['Main Contractor']);
  assert.deepEqual(s.locations, ['Level 2 riser']);
});

test('places come from sent reports, issues and variations, newest first and capped', () => {
  const s = projectSuggestions({
    reports: [report('2026-10-02T09:00:00Z', [card({ type: 'update', location: 'Plant room' })])],
    issues: [issue('2026-10-03T09:00:00Z', { location: 'Roof' })],
    variations: [variation('2026-10-01T09:00:00Z', 'Core B')],
  });
  assert.deepEqual(s.locations, ['Roof', 'Plant room', 'Core B']);
  const many = projectSuggestions({ ...none, issues: Array.from({ length: 20 }, (_, n) => issue(`2026-10-${String(n + 1).padStart(2, '0')}T09:00:00Z`, { location: `Flat ${n + 1}`, owner: `Firm ${n + 1}` })) });
  assert.equal(many.locations.length, 12);
  assert.equal(many.companies.length, 12);
  assert.equal(many.locations[0], 'Flat 20');
});

test('each trade offers the companies already put on its issues here, newest first, from the trade the engineer chose', () => {
  const assigned = (at: string) => [{ at, actor: 'Office', kind: 'assigned', note: '', photos: [] } as Issue['events'][number]];
  const byTrade = companiesByTrade([
    issue('2026-10-01T09:00:00Z', { affectedTrade: 'P&H', owner: 'Aire Plumbing' }),
    issue('2026-10-02T09:00:00Z', { affectedTrade: 'P&H', owner: 'Leeds Heating', events: assigned('2026-10-09T09:00:00Z') }),
    issue('2026-10-03T09:00:00Z', { affectedTrade: 'P&H', owner: 'aire plumbing ' }),
    issue('2026-10-04T09:00:00Z', { affectedTrade: 'P&H', owner: 'TBC' }),
    issue('2026-10-05T09:00:00Z', { affectedTrade: 'Electrical', owner: 'Northbank Electrical' }),
    // The reporter's own trade is not whose work it is.
    issue('2026-10-06T09:00:00Z', { reporterTrade: 'HVAC', owner: 'Main contractor' }),
    issue('2026-10-07T09:00:00Z', { affectedTrade: 'Other / non-Leodis', owner: 'Main contractor' }),
  ]);
  assert.deepEqual(byTrade, { 'P&H': ['Leeds Heating', 'aire plumbing'], Electrical: ['Northbank Electrical'] });
  assert.deepEqual(companiesForIssue({ affectedTrade: 'P&H' }, byTrade), ['Leeds Heating', 'aire plumbing']);
  assert.deepEqual(companiesForIssue({ affectedTrade: 'HVAC' }, byTrade), []);
  // "Other" is many trades and companies, so it never points at one.
  assert.deepEqual(companiesForIssue({ affectedTrade: 'Other / non-Leodis' }, byTrade), []);
  assert.deepEqual(companiesForIssue({}, byTrade), []);
  assert.deepEqual(companiesForIssue({ affectedTrade: 'P&H' }, undefined), []);
  assert.deepEqual(projectSuggestions({ ...none, issues: [issue('2026-10-01T09:00:00Z', { affectedTrade: 'HVAC', owner: 'Cool Air Ltd' })] }).byTrade, { HVAC: ['Cool Air Ltd'] });
});
