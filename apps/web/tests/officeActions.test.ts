import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewReport, officeActions, opensAsSeen, previousWorkingDay, sinceWords } from '../lib/officeActions';
import type { Issue, ReportSummary } from '../lib/types';

const report = (id: string, over: Partial<ReportSummary>): ReportSummary => ({ id, state: 'submitted', projectId: 'proj-a', reference: `A-SPR-${id}`, author: 'Sam', serverAcknowledgedAt: '2026-10-20T09:00:00Z', ...over }) as ReportSummary;
/** A report the server never received: no serverAcknowledgedAt at all. */
const unreceived = (id: string, over: Partial<ReportSummary> = {}): ReportSummary => { const { serverAcknowledgedAt: _, ...rest } = report(id, over); return rest as ReportSummary; };
const issue = (id: string, over: Partial<Issue>): Issue => ({ id, projectId: 'proj-a', reference: `A-ISS-${id}`, description: 'Gap', location: 'Riser', owner: '', work: 'open', confirmation: 'provisional', targetDate: '', raisedAt: '2026-10-01T09:00:00Z', events: [], ...over }) as Issue;

test('the previous working day skips the weekend', () => {
  assert.equal(previousWorkingDay('2026-10-20'), '2026-10-19'); // Tuesday → Monday
  assert.equal(previousWorkingDay('2026-10-19'), '2026-10-16'); // Monday → Friday
  assert.equal(previousWorkingDay('2026-10-18'), '2026-10-16'); // Sunday → Friday
  assert.equal(previousWorkingDay('2026-10-17'), '2026-10-16'); // Saturday → Friday
  assert.equal(previousWorkingDay('2026-11-02'), '2026-10-30'); // across a month
  assert.equal(sinceWords('2026-10-19', '2026-10-20'), 'since yesterday');
  assert.equal(sinceWords('2026-10-16', '2026-10-19'), 'since Friday');
});

test('new means received on the previous working day or since, in London time', () => {
  // 23:30 UTC on Sunday 18 Oct is 00:30 on Monday in London (BST).
  assert.equal(isNewReport(report('1', { serverAcknowledgedAt: '2026-10-18T23:30:00Z' }), '2026-10-19'), true);
  assert.equal(isNewReport(report('2', { serverAcknowledgedAt: '2026-10-18T22:30:00Z' }), '2026-10-19'), false);
  assert.equal(isNewReport(report('3', { state: 'draft' }), '2026-10-19'), false);
  assert.equal(isNewReport(unreceived('4'), '2026-10-19'), false);
});

test('the four groups pick and order what each one means', () => {
  const reports = [
    report('old-unread', { serverAcknowledgedAt: '2026-10-12T09:00:00Z' }),
    report('new-read', { serverAcknowledgedAt: '2026-10-20T08:00:00Z', acknowledged: { by: 'Pat', byId: 'pat', at: '2026-10-20T08:30:00Z' } }),
    report('new-unread', { serverAcknowledgedAt: '2026-10-19T15:00:00Z' }),
    unreceived('draft', { state: 'draft' }),
  ];
  const issues = [
    issue('unowned-new', { raisedAt: '2026-10-15T09:00:00Z' }),
    issue('unowned-old', { raisedAt: '2026-10-02T09:00:00Z' }),
    issue('owned', { owner: 'Acme Electrical', work: 'assigned' }),
    issue('closed-unowned', { work: 'closed' }),
    issue('withdrawn-unowned', { confirmation: 'withdrawn' }),
    issue('verify-recent', { owner: 'Acme', work: 'awaiting_verification', events: [{ at: '2026-10-19T10:00:00Z' }] as Issue['events'] }),
    issue('verify-waiting', { owner: 'Acme', work: 'awaiting_verification', events: [{ at: '2026-10-10T10:00:00Z' }] as Issue['events'] }),
  ];
  const a = officeActions(reports, issues, '2026-10-20');
  assert.equal(a.since, '2026-10-19');
  assert.deepEqual(a.newReports.map(r => r.id), ['new-read', 'new-unread']);
  assert.deepEqual(a.notRead.map(r => r.id), ['old-unread', 'new-unread']);
  assert.deepEqual(a.unassigned.map(i => i.id), ['unowned-old', 'unowned-new']);
  assert.deepEqual(a.verify.map(i => i.id), ['verify-waiting', 'verify-recent']);
});

test('an unassigned issue waiting for verification counts in both groups', () => {
  const a = officeActions([], [issue('x', { work: 'awaiting_verification', owner: ' ' })], '2026-10-20');
  assert.equal(a.unassigned.length, 1);
  assert.equal(a.verify.length, 1);
});

test('opening a sent report marks it seen only for the office, never for its author', () => {
  const sent = report('1', { authorId: 'sam' });
  const manager = { id: 'pat', role: 'Manager' }, admin = { id: 'ada', role: 'Admin' };
  assert.equal(opensAsSeen(sent, manager), true);
  assert.equal(opensAsSeen(sent, admin), true);
  assert.equal(opensAsSeen(sent, { id: 'eng', role: 'Engineer' }), false, 'an engineer reading it is not the office');
  assert.equal(opensAsSeen(sent, { id: 'sam', role: 'Manager' }), false, 'nor is the author, even in the office');
  assert.equal(opensAsSeen(report('2', { state: 'draft' }), manager), false, 'a draft is never seen');
  assert.equal(opensAsSeen(report('3', { acknowledged: { by: 'Pat', at: '2026-10-20T10:00:00Z' } }), admin), false, 'once is enough');
});
