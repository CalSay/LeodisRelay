import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backLabel, safeViewReturn, viewName, withViewReturn } from '../lib/viewNavigation';

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

test('a result opened from search returns to the same search', () => {
  const search = '/search?q=riser&project=p1';
  assert.equal(safeViewReturn(search, '/engineer'), search);
});

test('an issue opened from a snag list returns to the same list', () => {
  const list = '/issues/snag-list?project=p1&owner=Sparks+Ltd&returnTo=%2Foffice%23%2Fissues';
  assert.equal(safeViewReturn(list, '/engineer'), list);
});

test('a record opened from a weekly summary returns to the same week', () => {
  const week = '/weekly-summary?project=p1&week=2026-10-12&returnTo=%2Foffice';
  assert.equal(safeViewReturn(week, '/engineer'), week);
});

test('a record opened from my week returns to the same week', () => {
  const mine = '/my-week?week=2026-10-12&returnTo=%2Fengineer';
  assert.equal(safeViewReturn(mine, '/office'), mine);
});

test('a record opened from the photo library returns to the same photographs', () => {
  const photos = '/photos?project=p1&q=riser&show=defect&returnTo=%2Foffice';
  assert.equal(safeViewReturn(photos, '/engineer'), photos);
});

test('a report opened from site coverage returns to the same fortnight', () => {
  const coverage = '/coverage?start=2026-09-28&returnTo=%2Foffice%23%2Fprojects';
  assert.equal(safeViewReturn(coverage, '/office'), coverage);
});

test('a snag list or issue opened from open issues by company returns to the same search', () => {
  const companies = '/companies?q=acme&returnTo=%2Foffice%23%2Fissues';
  assert.equal(safeViewReturn(companies, '/office'), companies);
});

test('Back links name the page they return to, in its own navigation words', () => {
  assert.equal(backLabel('/engineer?project=p1'), 'Back to Site');
  assert.equal(backLabel('/engineer?project=p1&view=reports'), 'Back to Reports');
  assert.equal(backLabel('/engineer?project=p1&view=issues'), 'Back to Issues');
  assert.equal(backLabel('/office#/issues'), 'Back to Office');
  assert.equal(backLabel('/search?q=riser&returnTo=%2Fengineer'), 'Back to Search results');
  assert.equal(backLabel('/search'), 'Back to Search');
  assert.equal(backLabel('/companies?returnTo=%2Foffice'), 'Back to Issues by company');
  assert.equal(backLabel('/issues/snag-list?project=p1'), 'Back to Snag list');
  assert.equal(backLabel('/my-week?week=2026-10-12'), 'Back to My week');
  assert.equal(backLabel('/safety-actions?project=p1'), 'Back to Safety actions');
});

test('an unknown return path falls back to a plain name, never a guess', () => {
  assert.equal(viewName('/api/auth/signout'), undefined);
  assert.equal(viewName(''), undefined);
  assert.equal(backLabel('/reports/r1', 'Projects'), 'Back to Projects');
  assert.equal(backLabel('/nowhere'), 'Back to previous page');
});
