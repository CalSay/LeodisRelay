import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeViewReturn, withViewReturn } from '../lib/viewNavigation';

test('detail links preserve an Office hash route across full pages', () => {
  const office = '/office#/projects/project-1/issue/issue-1';
  const href = withViewReturn('/issues/issue-1', office);

  assert.equal(href, '/issues/issue-1?returnTo=%2Foffice%23%2Fprojects%2Fproject-1%2Fissue%2Fissue-1');
  assert.equal(safeViewReturn(office, '/engineer'), office);
});

test('detail return paths cannot leave RELAY or jump into an unrelated route', () => {
  assert.equal(safeViewReturn('//attacker.invalid', '/engineer'), '/engineer');
  assert.equal(safeViewReturn('/api/auth/signout', '/engineer'), '/engineer');
  assert.equal(safeViewReturn('/office\\evil', '/engineer'), '/engineer');
});
