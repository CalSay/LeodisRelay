import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { putRecord, getRecord, database } from '../lib/storage';
import { fieldsEqual, refreshIssues, sharePointDay } from '../lib/sharepoint/issues';
import { refreshVariations } from '../lib/sharepoint/variations';
import { graph } from '../lib/sharepoint/graph';
import { OPERATIONS } from '../lib/sharepoint/config';
import { projectIdentity } from '../lib/projects';
import type { Issue, Variation } from '../lib/types';

const root = mkdtempSync(join(tmpdir(), 'relay-sharepoint-dates-'));
process.env.RELAY_DATA_ROOT = root;
after(() => { database().close(); rmSync(root, { recursive: true, force: true }); });

test('a SharePoint date-only value reads as the same UK day however the list stored it', () => {
  // Summer: midnight on a UK site is 23:00Z the day before; RELAY's own "YYYY-MM-DD" may come back as 00:00Z.
  for (const stored of ['2026-06-14', '2026-06-14T00:00:00Z', '2026-06-13T23:00:00Z', '2026-06-14T07:00:00Z']) assert.equal(sharePointDay(stored), '2026-06-14', stored);
  // Winter: UK midnight is UTC midnight.
  for (const stored of ['2026-12-14', '2026-12-14T00:00:00Z']) assert.equal(sharePointDay(stored), '2026-12-14', stored);
  // Either side of the clock changes (29 March and 25 October 2026): UK midnight in UTC.
  assert.equal(sharePointDay('2026-03-29T00:00:00Z'), '2026-03-29');
  assert.equal(sharePointDay('2026-03-29T23:00:00Z'), '2026-03-30');
  assert.equal(sharePointDay('2026-10-24T23:00:00Z'), '2026-10-25');
  assert.equal(sharePointDay('2026-10-26T00:00:00Z'), '2026-10-26');
  for (const empty of ['', null, undefined]) assert.equal(sharePointDay(empty), '');
  // Readback after a write treats both storages as the day RELAY sent.
  assert.equal(fieldsEqual({ Target_x0020_Date: '2026-06-13T23:00:00Z' }, { Target_x0020_Date: '2026-06-14' }), true);
  assert.equal(fieldsEqual({ InstructedOn: '2026-06-14T00:00:00Z' }, { InstructedOn: '2026-06-14' }), true);
  assert.equal(fieldsEqual({ InstructedOn: '2026-06-12T23:00:00Z' }, { InstructedOn: '2026-06-14' }), false);
});

test('an issue target date and a variation instructed date read from SharePoint keep their UK day in summer', async () => {
  process.env.RELAY_SHAREPOINT_MODE = 'read';
  process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS = '7';
  const original = graph.request;
  try {
    const project = projectIdentity('7');
    putRecord('projects', { id: project, projectNumber: '011LME', projectName: 'Tetley Hall', clientName: 'Client', clientAccountNumber: '', division: 'M&E', status: '4. Active',
      projectManager: '', projectManagerEmail: '', reviewRequired: false, source: { siteId: OPERATIONS.site, listId: OPERATIONS.projects, itemId: '7' } });
    putRecord('sharepoint-status', { id: 'projects', at: Date.now() });
    const issue = (n: number, target: string) => ({ id: String(100 + n), eTag: `"i${n}"`, fields: {
      Title: `DEMO-011LME-ISS-00${n}`, RELAY_x0020_Issue_x0020_ID: `sp-date-iss-${n}`, ProjectLookupId: '7',
      Confirmation_x0020_Status: 'Confirmed', Work_x0020_Status: 'Assigned', Description: 'Fire stopping', Location: 'Riser',
      Raised_x0020_At: '2026-06-01T10:00:00Z', Target_x0020_Date: target } });
    const variation = (n: number, instructed: string) => ({ id: String(200 + n), eTag: `"v${n}"`, fields: {
      Title: `DEMO-011LME-VO-00${n} | Extra sockets`, RelayVariationId: `sp-date-vo-${n}`, ProjectLookupId: '7',
      Description: 'Extra sockets', Location: 'Flat 4', Instruction: 'Instructed', RaisedAt: '2026-06-01T10:00:00Z', InstructedOn: instructed } });
    graph.request = (async (path: string) => {
      if (path.includes('/lists?$select')) return { value: [{ id: 'people', displayName: 'User Information List' }] };
      if (path.includes('/lists/people/items')) return { value: [] };
      if (path.includes(`/lists/${OPERATIONS.issues}/items`)) return { value: [issue(1, '2026-06-13T23:00:00Z'), issue(2, '2026-06-14T00:00:00Z'), issue(3, '')] };
      if (path.includes(`/lists/${OPERATIONS.variations}/items`)) return { value: [variation(1, '2026-06-13T23:00:00Z'), variation(2, '2026-06-14T00:00:00Z')] };
      throw Error(`Unexpected Graph request ${path}`);
    }) as typeof graph.request;
    await refreshIssues();
    await refreshVariations();
    assert.equal(getRecord<Issue>('issues', 'sp-date-iss-1')?.targetDate, '2026-06-14', 'stored as UK midnight');
    assert.equal(getRecord<Issue>('issues', 'sp-date-iss-2')?.targetDate, '2026-06-14', 'stored as UTC midnight');
    assert.equal(getRecord<Issue>('issues', 'sp-date-iss-3')?.targetDate, '', 'no target date');
    assert.equal(getRecord<Variation>('variations', 'sp-date-vo-1')?.instructedOn, '2026-06-14', 'stored as UK midnight');
    assert.equal(getRecord<Variation>('variations', 'sp-date-vo-2')?.instructedOn, '2026-06-14', 'stored as UTC midnight');
  } finally {
    graph.request = original;
    process.env.RELAY_SHAREPOINT_MODE = 'off';
    delete process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS;
  }
});
