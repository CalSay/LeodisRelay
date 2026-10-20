import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISSUE_COLUMNS, VARIATION_COLUMNS, exportFileName, instructionWords, issueRows, toCsv, variationRows } from '../lib/registerExport';
import { queryIssues } from '../lib/issueQuery';
import type { Issue, Variation } from '../lib/types';

const TODAY = '2026-10-20';
const PROJECTS: Record<string, { projectNumber: string; projectName: string }> = { p1: { projectNumber: '011LME', projectName: 'Tetley Hall' } };
const context = { day: TODAY, project: (id: string) => PROJECTS[id], reportReference: (id: string) => id === 'r1' ? '011LME-SPR-004' : undefined };

function issue(id: string, extra: Partial<Issue> = {}): Issue {
  return { id, reference: `011LME-ISS-${id}`, projectId: 'p1', location: 'Level 1', description: `Issue ${id}`, actionNeeded: '', confirmation: 'confirmed',
    work: 'assigned', owner: 'Sparks Ltd', targetDate: '', raisedByReport: 'r1', raisedAt: '2026-10-01T09:00:00Z', events: [], ...extra } as Issue;
}
function variation(id: string, extra: Partial<Variation> = {}): Variation {
  return { id, reference: `011LME-VO-${id}`, projectId: 'p1', description: `Variation ${id}`, location: 'Plant room', workDone: false, instruction: 'pending',
    source: 'report', raisedBy: 'Dan', raisedAt: '2026-10-02T10:00:00Z', raisedByReport: 'r1', events: [], ...extra } as Variation;
}
const column = (rows: unknown[][], name: string, row = 1) => rows[row]![(rows[0] as string[]).indexOf(name)];

test('a CSV opens cleanly in Excel: byte-order mark, CRLF rows, quoted commas, quotes and line breaks', () => {
  const csv = toCsv([['Ref', 'Note'], ['A-1', 'Riser 2, level 3'], ['A-2', 'He said "now"\nthen left'], ['A-3', undefined]]);
  assert.ok(csv.startsWith('﻿Ref,Note\r\n'));
  assert.equal(csv, '﻿Ref,Note\r\nA-1,"Riser 2, level 3"\r\nA-2,"He said ""now""\nthen left"\r\nA-3,\r\n');
});

test('typed text that Excel would run as a formula is led with an apostrophe; numbers stay numbers', () => {
  const csv = toCsv([['=HYPERLINK("x")', '+44 113', '-cable', '@SUM(A1)', -120.5, 0]]);
  assert.equal(csv, '﻿"\'=HYPERLINK(""x"")",\'+44 113,\'-cable,\'@SUM(A1),-120.5,0\r\n');
});

test('file names carry the register, the project when there is one, and the day', () => {
  assert.equal(exportFileName('issues', TODAY), 'relay-issues-2026-10-20.csv');
  assert.equal(exportFileName('variations', TODAY, '011LME'), 'relay-variations-011LME-2026-10-20.csv');
  assert.equal(exportFileName('issues', TODAY, '01/1 "x"'), 'relay-issues-011x-2026-10-20.csv');
});

test('issue rows use the register\'s words, with work and confirmation as two facts', () => {
  const rows = issueRows([
    issue('1', { targetDate: '2026-10-15', reportedBy: 'Dan', events: [{ at: '2026-10-12T08:00:00Z', actor: 'Office', kind: 'assigned', note: '', photos: [] }] }),
    issue('2', { targetDate: TODAY, work: 'awaiting_verification', confirmation: 'disputed' }),
    issue('3', { work: 'closed', owner: ' ' }),
    issue('4', { confirmation: 'withdrawn', raisedByReport: '', source: 'individual' }),
    issue('5', { confirmation: 'provisional', raisedByReport: 'r9', affectedTrade: 'HVAC' }),
  ], { ...context, reviewOn: () => false });
  assert.deepEqual(rows[0], [...ISSUE_COLUMNS]);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[1]!.slice(0, 3), ['011LME-ISS-1', '011LME', 'Tetley Hall']);
  assert.equal(column(rows, 'Days past target'), 5);
  assert.equal(column(rows, 'Raised on'), '2026-10-01');
  assert.equal(column(rows, 'Raised from'), '011LME-SPR-004');
  assert.equal(column(rows, 'Raised by'), 'Dan');
  assert.equal(column(rows, 'Last change'), '2026-10-12', 'the newest event, not the day raised');
  assert.equal(column(rows, 'Verification'), 'Not put forward as fixed');
  assert.equal(column(rows, 'Days past target', 2), undefined, 'a target of today is not late');
  assert.equal(column(rows, 'Work', 2), 'Fixed, waiting for verification');
  assert.equal(column(rows, 'Confirmation', 2), 'Disputed');
  assert.equal(column(rows, 'Responsible company', 3), 'Unassigned');
  assert.equal(column(rows, 'Verification', 3), 'Verified and closed');
  assert.equal(column(rows, 'Work', 4), 'Withdrawn');
  assert.equal(column(rows, 'Verification', 4), undefined);
  assert.equal(column(rows, 'Raised from', 4), 'Flagged on site');
  assert.equal(column(rows, 'Confirmation', 5), 'As reported', 'no review on this project, so not "Not reviewed"');
  assert.equal(column(rows, 'Raised from', 5), 'Report', 'a report that is not to hand is named, not guessed');
  assert.equal(column(rows, 'Trade', 5), 'HVAC');
  assert.equal(issueRows([issue('6', { confirmation: 'provisional' })], { ...context, reviewOn: () => true })[1]![(ISSUE_COLUMNS as readonly string[]).indexOf('Confirmation')], 'Not reviewed');
});

test('the download takes the whole search in the register\'s order, not one page', () => {
  const many = Array.from({ length: 120 }, (_, n) => issue(String(n + 1).padStart(3, '0'), { targetDate: n % 3 ? '' : '2026-10-01' }));
  const screen = queryIssues(many, { view: 'open', page: 1, pageSize: 50 }, { day: TODAY });
  const file = queryIssues(many, { view: 'open', page: 1, pageSize: Number.MAX_SAFE_INTEGER }, { day: TODAY });
  assert.equal(screen.issues.length, 50);
  assert.equal(file.issues.length, 120);
  assert.deepEqual(file.issues.slice(0, 50).map(i => i.id), screen.issues.map(i => i.id));
  assert.equal(file.pages, 1);
});

test('variation rows carry the money as numbers, worked with the register\'s arithmetic', () => {
  const rows = variationRows([
    variation('001', { instruction: 'instructed', quotedValue: 1200, instructedValue: 1100, labourHours: 10, labourRate: 45, partsCost: 200, instructionReference: 'CVI-12', instructedBy: 'J. Client', instructedOn: '2026-10-10' }),
    variation('002', { workDone: true, askedBy: 'Site manager', quotedValue: 800 }),
    variation('003', { instruction: 'declined', quotedValue: 500, labourHours: 2, labourRate: 50 }),
    (({ raisedByReport: _, ...v }) => v)(variation('004', { source: 'office' })) as Variation,
  ], context);
  assert.deepEqual(rows[0], [...VARIATION_COLUMNS]);
  assert.equal(column(rows, 'Instruction'), 'Instructed');
  assert.equal(column(rows, 'Quoted (£)'), 1200);
  assert.equal(column(rows, 'Instructed (£)'), 1100);
  assert.equal(column(rows, 'Expected cost (£)'), 650);
  assert.equal(column(rows, 'Margin (£)'), 450);
  assert.equal(column(rows, 'Margin (%)'), 40.9);
  assert.equal(column(rows, 'Client reference'), 'CVI-12');
  assert.equal(column(rows, 'Raised from'), '011LME-SPR-004');
  assert.equal(column(rows, 'Work already done', 2), 'Yes');
  assert.equal(column(rows, 'Instruction', 2), 'Done, not instructed');
  assert.equal(column(rows, 'Asked for on site by', 2), 'Site manager');
  assert.equal(column(rows, 'Instructed (£)', 2), undefined, 'not instructed, so no instructed value');
  assert.equal(column(rows, 'Margin (£)', 3), undefined, 'declined, so no margin, as on screen');
  assert.equal(column(rows, 'Expected cost (£)', 3), 100);
  assert.equal(column(rows, 'Instruction', 4), 'Needs a quote');
  assert.equal(column(rows, 'Raised from', 4), 'Raised in the office');
  assert.equal(instructionWords(variation('005', { quotedValue: 10 })), 'Awaiting instruction');
});
