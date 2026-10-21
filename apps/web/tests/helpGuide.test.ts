import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GLOSSARY, GUIDE, GUIDE_LINKS, WHATS_NEW, addedLabel, canOpen, defaultTab, linksFor, markSeen, readSeen, readTab, unseen, whatsNewFor, type WhatsNew } from '../lib/helpGuide';
import { CHECK_ANSWERS } from '../lib/reportTypes';
import { backLabel, safeViewReturn } from '../lib/viewNavigation';
import { ISSUE_WORK } from '../lib/status';

// Compiled to .test-build/tests, so the app's routes are two levels up.
const APP = join(__dirname, '..', '..', 'app');
const routeExists = (href: string) => {
  const path = new URL(href, 'https://relay.invalid').pathname;
  return existsSync(join(APP, ...path.split('/').filter(Boolean), 'page.tsx'));
};

test('every link in Help goes to a page that exists', () => {
  const hrefs = [...WHATS_NEW.flatMap(e => e.link ? [e.link.href] : []), ...GUIDE_LINKS.map(l => l.href)];
  assert.ok(hrefs.length > 10);
  for (const href of hrefs) assert.ok(routeExists(href), `no page for ${href}`);
});

test('what is new has stable, unique ids, real dates, newest first', () => {
  const ids = WHATS_NEW.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const e of WHATS_NEW) {
    assert.match(e.id, /^[a-z0-9-]+$/);
    assert.match(e.added, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(e.added)), e.added);
    assert.ok(e.title.trim() && e.text.trim());
  }
  for (let i = 1; i < WHATS_NEW.length; i++) assert.ok(WHATS_NEW[i - 1]!.added >= WHATS_NEW[i]!.added, `${WHATS_NEW[i]!.id} is out of order`);
});

test('each tab shows its own entries and links plus the shared ones', () => {
  const site = whatsNewFor('site'), office = whatsNewFor('office');
  assert.ok(site.every(e => e.audience !== 'office'));
  assert.ok(office.every(e => e.audience !== 'site'));
  assert.ok(site.some(e => e.id === 'offline-start') && !office.some(e => e.id === 'offline-start'));
  assert.ok(office.some(e => e.id === 'companies') && !site.some(e => e.id === 'companies'));
  // Engineers cannot open the office-only pages, so their tab never offers them.
  assert.ok(!linksFor('site').some(l => ['/coverage', '/companies', '/office'].includes(l.href)));
  assert.ok(linksFor('office').some(l => l.href === '/coverage'));
  for (const tab of ['site', 'office'] as const) assert.ok(GUIDE[tab].length >= 3 && GUIDE[tab].every(s => s.steps.length > 0));
});

test('engineers land on the site tab and everyone else on the office tab', () => {
  assert.equal(defaultTab('Engineer'), 'site');
  assert.equal(defaultTab('Manager'), 'office');
  assert.equal(defaultTab('Admin'), 'office');
  assert.equal(readTab('office', 'Engineer'), 'office');
  assert.equal(readTab('site', 'Manager'), 'site');
  assert.equal(readTab('nonsense', 'Engineer'), 'site');
  assert.equal(readTab(undefined, undefined), 'office');
});

test('entries are new until seen, and the stored list keeps only ids that exist', () => {
  const entries: WhatsNew[] = [
    { id: 'b', added: '2026-10-20', audience: 'all', title: 'B', text: 'b' },
    { id: 'a', added: '2026-10-19', audience: 'site', title: 'A', text: 'a' },
    { id: 'o', added: '2026-10-18', audience: 'office', title: 'O', text: 'o' },
  ];
  // Never opened Help: everything for the tab is new.
  assert.deepEqual(unseen('site', new Set(), entries).map(e => e.id), ['b', 'a']);
  const stored = markSeen(new Set(['gone']), whatsNewFor('site', entries), entries);
  assert.deepEqual(stored.sort(), ['a', 'b']);
  assert.deepEqual(unseen('site', new Set(stored), entries), []);
  // The office-only entry is still new on the office tab.
  assert.deepEqual(unseen('office', new Set(stored), entries).map(e => e.id), ['o']);
});

test('a damaged stored list reads as nothing seen, never as an error', () => {
  assert.deepEqual([...readSeen(null)], []);
  assert.deepEqual([...readSeen('not json')], []);
  assert.deepEqual([...readSeen('{"a":1}')], []);
  assert.deepEqual([...readSeen('["a",2,null,"b"]')], ['a', 'b']);
});

test('the words Help explains are the words the screens use', () => {
  const words = new Set(GLOSSARY.flatMap(g => g.terms.map(t => t.term)));
  for (const label of Object.values(ISSUE_WORK)) assert.ok(words.has(label), `issue status "${label}" is explained`);
  for (const a of CHECK_ANSWERS) assert.ok(words.has(a.label), `check answer "${a.label}" is explained`);
  for (const w of ['Received', 'Seen', 'Awaiting instruction', 'Instructed', 'Declined', 'As reported']) assert.ok(words.has(w), w);
});

test('dates say the day, and the year only when it is not this year', () => {
  assert.equal(addedLabel('2026-10-20', '2026-12-01'), '20 Oct');
  assert.equal(addedLabel('2025-03-04', '2026-01-01'), '4 Mar 2025');
});

test('a page opened from Help comes back to Help, on the same tab', () => {
  assert.equal(safeViewReturn('/help?for=site', '/engineer'), '/help?for=site');
  assert.equal(backLabel('/help?for=office'), 'Back to Help');
});

test('an engineer reading the office tab is not offered pages they cannot open', () => {
  for (const href of ['/office', '/office#/issues', '/coverage', '/companies?returnTo=%2Fhelp']) {
    assert.equal(canOpen(href, false), false, href);
    assert.equal(canOpen(href, true), true, href);
  }
  for (const href of ['/search', '/diary', '/engineer', '/my-week']) assert.equal(canOpen(href, false), true, href);
});
