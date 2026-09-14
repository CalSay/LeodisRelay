import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectStatusGroups, sharePointOrdered } from '../lib/projectGroups';

test('cached projects are restored to their captured SharePoint positions', () => {
  const cacheRows = [
    { id: '102', sharePointOrder: 7 },
    { id: '16', sharePointOrder: 0 },
    { id: '85', sharePointOrder: 6 },
  ];

  assert.deepEqual(sharePointOrdered(cacheRows).map(project => project.id), ['16', '85', '102']);
});

test('projects are grouped by status while retaining their SharePoint order', () => {
  const projects = [
    { id: '16', status: '5. Defects Liability' },
    { id: '17', status: '5. Defects Liability' },
    { id: '85', status: '4. Active' },
    { id: '102', status: '4. Active' },
    { id: '118', status: '4. Active' },
  ];

  const groups = projectStatusGroups(projects);

  assert.deepEqual(groups.map(group => group.label), ['Active', 'Defects liability period']);
  assert.deepEqual(groups[0]!.projects.map(project => project.id), ['85', '102', '118']);
  assert.deepEqual(groups[1]!.projects.map(project => project.id), ['16', '17']);
});
