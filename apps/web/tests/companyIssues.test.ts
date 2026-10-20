import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyIssues, matchCompanies } from '../lib/companyIssues';
import type { Issue, IssueEvent } from '../lib/types';

function issue(id: string, extra: Partial<Issue> = {}): Issue {
  return { id, reference: `011LME-ISS-${id}`, projectId: 'p1', location: 'Level 1', description: `Issue ${id}`, actionNeeded: '', confirmation: 'confirmed',
    work: 'assigned', owner: 'Sparks Ltd', targetDate: '', raisedByReport: '', raisedAt: '2026-10-01T09:00:00Z', events: [], ...extra } as Issue;
}
const verified = (at: string): IssueEvent => ({ at, actor: 'Office', kind: 'verified', note: '', photos: [] });
const PROJECTS = [{ id: 'p1', projectNumber: '011LME', projectName: 'Tetley Hall' }, { id: 'p2', projectNumber: '014LME', projectName: 'Kirkstall Gate' }];
const TODAY = '2026-10-20';

test('counts each company\'s work across projects: to put right, past target and fixed for the office to check', () => {
  const r = companyIssues([
    issue('1', { targetDate: '2026-10-19' }),
    issue('2', { targetDate: '2026-10-20' }),
    issue('3', { projectId: 'p2', work: 'in_progress', targetDate: '2026-10-01' }),
    issue('4', { work: 'awaiting_verification', targetDate: '2026-09-01' }),
    issue('5', { work: 'closed' }),
    issue('6', { confirmation: 'withdrawn' }),
  ], PROJECTS, TODAY);
  assert.equal(r.companies.length, 1);
  const [c] = r.companies;
  assert.equal(c!.toDo, 3);
  assert.equal(c!.overdue, 3, 'a target of today is not yet late; fixed but unchecked work past its target is, as on the register');
  assert.equal(c!.fixed, 1);
  assert.equal(c!.closedRecently, 0, 'closed without an office check in the window');
  assert.deepEqual(c!.projects.map(p => [p.projectNumber, p.toDo, p.overdue, p.fixed]), [['011LME', 2, 2, 1], ['014LME', 1, 1, 0]]);
  assert.equal(r.since, '2026-09-23');
});

test('each project line carries the company as written on that project, for its snag list, exactly as its picker lists it', () => {
  const r = companyIssues([
    issue('1', { owner: 'Acme Ltd', raisedAt: '2026-09-01T09:00:00Z', work: 'closed', events: [{ at: '2026-10-10T09:00:00Z', actor: 'Office', kind: 'verified', note: '', photos: [] }] }),
    issue('2', { owner: 'ACME  LTD', raisedAt: '2026-10-02T09:00:00Z' }),
    issue('3', { owner: 'acme ltd', projectId: 'p2', raisedAt: '2026-10-03T09:00:00Z' }),
  ], PROJECTS, TODAY);
  assert.equal(r.companies[0]!.owner, 'Acme Ltd');
  assert.deepEqual(r.companies[0]!.projects.map(p => p.owner), ['ACME  LTD', 'acme ltd']);
});

test('a company typed with different case or spacing is one company, labelled as first written', () => {
  const r = companyIssues([
    issue('2', { owner: 'sparks  ltd', raisedAt: '2026-10-05T09:00:00Z' }),
    issue('1', { owner: ' Sparks Ltd ', raisedAt: '2026-10-02T09:00:00Z' }),
    issue('3', { owner: 'Sparks Ltd (North)' }),
  ], PROJECTS, TODAY);
  assert.deepEqual(r.companies.map(c => [c.owner, c.toDo]), [['Sparks Ltd', 2], ['Sparks Ltd (North)', 1]]);
});

test('the oldest item still to put right is named with its age; fixed work does not count', () => {
  const r = companyIssues([
    issue('old-fixed', { raisedAt: '2026-08-01T09:00:00Z', work: 'awaiting_verification' }),
    issue('b', { raisedAt: '2026-09-30T23:30:00Z' }),
    issue('a', { raisedAt: '2026-10-10T09:00:00Z' }),
  ], PROJECTS, TODAY);
  assert.deepEqual(r.companies[0]!.oldest, { raisedOn: '2026-10-01', days: 19, reference: '011LME-ISS-b', issueId: 'b' }, 'raised late on 30 Sept UTC is 1 Oct in London');
});

test('closures verified in the last four weeks are counted, and a company with only those still shows', () => {
  const r = companyIssues([
    issue('1', { owner: 'Done Co', work: 'closed', events: [verified('2026-10-15T10:00:00Z')] }),
    issue('2', { owner: 'Done Co', work: 'closed', events: [verified('2026-09-22T10:00:00Z')] }),
    issue('3', { owner: 'Done Co', work: 'closed', events: [verified('2026-09-23T10:00:00Z')] }),
    issue('4', { owner: 'Done Co', work: 'closed', confirmation: 'withdrawn', events: [verified('2026-10-15T10:00:00Z')] }),
    issue('5', { owner: 'Late Co', targetDate: '2026-10-01' }),
  ], PROJECTS, TODAY);
  const done = r.companies.find(c => c.owner === 'Done Co')!;
  assert.equal(done.closedRecently, 2, 'the window starts 27 days back; withdrawn issues are left out');
  assert.equal(done.toDo + done.fixed, 0);
  assert.deepEqual(done.projects, []);
  assert.deepEqual(r.companies.map(c => c.owner), ['Late Co', 'Done Co'], 'past target first');
});

test('issues with nobody named are counted apart, not as a company', () => {
  const r = companyIssues([issue('1', { owner: '' }), issue('2', { owner: '  ', targetDate: '2026-10-01' }), issue('3', { owner: '', work: 'awaiting_verification' })], PROJECTS, TODAY);
  assert.deepEqual(r.companies, []);
  assert.deepEqual(r.unassigned, { toDo: 2, overdue: 1, fixed: 1 });
});

test('orders by past target, then by work to put right, and lists trades in a fixed order', () => {
  const r = companyIssues([
    issue('1', { owner: 'Busy Co' }), issue('2', { owner: 'Busy Co' }),
    issue('3', { owner: 'Late Co', targetDate: '2026-10-01', affectedTrade: 'HVAC' }),
    issue('4', { owner: 'Late Co', reporterTrade: 'Electrical' }),
    issue('5', { owner: 'Abc Co' }),
    issue('6', { owner: 'Unknown project', projectId: 'gone' }),
  ], PROJECTS, TODAY);
  assert.deepEqual(r.companies.map(c => c.owner), ['Late Co', 'Busy Co', 'Abc Co', 'Unknown project']);
  assert.deepEqual(r.companies[0]!.trades, ['Electrical', 'HVAC']);
  assert.equal(r.companies[3]!.projects[0]!.projectName, 'gone', 'a project missing from the list shows its id');
});

test('finding a company matches every word typed, ignoring case and spacing', () => {
  const { companies } = companyIssues([issue('1', { owner: 'Acme Mechanical Ltd' }), issue('2', { owner: 'Sparks Ltd' })], PROJECTS, TODAY);
  assert.deepEqual(matchCompanies(companies, '  ltd  ACME ').map(c => c.owner), ['Acme Mechanical Ltd']);
  assert.equal(matchCompanies(companies, 'ltd').length, 2);
  assert.equal(matchCompanies(companies, '').length, 2);
  assert.equal(matchCompanies(companies, 'zzz').length, 0);
});
