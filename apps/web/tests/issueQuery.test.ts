import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Principal } from '@relay/platform';
import { issueQueryParams, openAtPlace, parseIssueQuery, placeFromRoute, placeRegisterHash, queryIssues, type IssueQuery } from '../lib/issueQuery';
import type { Issue } from '../lib/types';
import { putRecord, database } from '../lib/storage';
import { issueRegister } from '../lib/issueStore';
import { refreshIssues } from '../lib/sharepoint/issues';
import { graph } from '../lib/sharepoint/graph';
import { OPERATIONS } from '../lib/sharepoint/config';
import { projectIdentity } from '../lib/projects';

const root = mkdtempSync(join(tmpdir(), 'relay-issue-query-'));
process.env.RELAY_DATA_ROOT = root;
after(() => { database().close(); rmSync(root, { recursive: true, force: true }); });

const day = '2026-10-20';
const issue = (i: Partial<Issue>): Issue => ({ id: 'i', reference: '011LME-ISS-001', projectId: 'p1', location: '', description: '', actionNeeded: '', confirmation: 'confirmed',
  work: 'assigned', owner: '', targetDate: '', raisedByReport: '', raisedAt: '2026-10-01T10:00:00Z', events: [], ...i });
const query = (q: Partial<IssueQuery> = {}): IssueQuery => ({ view: 'open', page: 1, pageSize: 50, ...q });
const ids = (r: { issues: Issue[] }) => r.issues.map(i => i.id);

const register = [
  issue({ id: 'riser', reference: '011LME-ISS-001', location: 'Level 3, Riser 2', owner: 'Acme Electrical Ltd', affectedTrade: 'Electrical' }),
  issue({ id: 'plant', reference: '011LME-ISS-002', location: 'Plant room', owner: 'Pipeworks (North) Ltd', affectedTrade: 'P&H', work: 'awaiting_verification' }),
  issue({ id: 'stair', reference: '011LME-ISS-003', location: 'Stair core B', owner: 'acme electrical ltd', reporterTrade: 'Electrical', work: 'closed' }),
  issue({ id: 'late', reference: '014LME-ISS-001', projectId: 'p2', location: 'riser 2 level 1', owner: '', targetDate: '2026-10-10', work: 'open', confirmation: 'provisional' }),
  issue({ id: 'gone', reference: '014LME-ISS-002', projectId: 'p2', location: 'Roof', confirmation: 'withdrawn', work: 'open' }),
];

test('location matches every word in any order, ignoring case and spacing', () => {
  assert.deepEqual(ids(queryIssues(register, query({ location: 'RISER  2' }), { day })).sort(), ['late', 'riser']);
  assert.deepEqual(ids(queryIssues(register, query({ location: 'level 3 riser' }), { day })), ['riser']);
  assert.deepEqual(ids(queryIssues(register, query({ location: 'basement' }), { day })), []);
});

test('open at a place on an issue\'s sheet is what the register opens on for that project and place', () => {
  const site = [...register,
    issue({ id: 'flat', reference: '011LME-ISS-004', location: 'Flat 204 kitchen' }),
    issue({ id: 'flat-again', reference: '011LME-ISS-005', location: 'kitchen,  flat 204', work: 'awaiting_verification' }),
    issue({ id: 'flat-shut', reference: '011LME-ISS-006', location: 'Flat 204 kitchen', work: 'closed' }),
    issue({ id: 'flat-gone', reference: '011LME-ISS-007', location: 'Flat 204 kitchen', confirmation: 'withdrawn' }),
    issue({ id: 'flat-elsewhere', reference: '014LME-ISS-003', projectId: 'p2', location: 'Flat 204 kitchen' })];
  for (const [projectId, place] of [['p1', 'Flat 204 kitchen'], ['p1', 'Riser 2'], ['p2', 'riser 2'], ['p2', 'Flat 204 kitchen'], ['p1', 'Basement']] as const) {
    const register = queryIssues(site, query({ projectId, location: place }), { day });
    assert.deepEqual(openAtPlace(site, projectId, place).map(i => i.id).sort(), ids(register).sort(), `${projectId} ${place}`);
  }
  assert.deepEqual(openAtPlace(site, 'p1', 'Flat 204 kitchen').map(i => i.id).sort(), ['flat', 'flat-again'], 'closed and withdrawn left out, other projects too');
  assert.deepEqual(openAtPlace(site, 'p1', '  '), [], 'no place, nothing to count');
});

test('a number in the place is a whole number, so Flat 12 is not Flat 120, 212 or 12A', () => {
  const site = [issue({ id: 'twelve', location: 'Flat 12' }), issue({ id: 'twelve-kitchen', location: 'kitchen, flat 12' }),
    issue({ id: 'hundred', location: 'Flat 120' }), issue({ id: 'other', location: 'Flat 212 kitchen' }), issue({ id: 'level-10', location: 'Level 10' }),
    issue({ id: 'part', location: 'Flat 2.04' })];
  assert.deepEqual(ids(queryIssues(site, query({ location: 'flat 12' }), { day })).sort(), ['twelve', 'twelve-kitchen']);
  assert.deepEqual(openAtPlace(site, 'p1', 'Flat 12').map(i => i.id).sort(), ['twelve', 'twelve-kitchen']);
  assert.deepEqual(ids(queryIssues(site, query({ location: 'level 1' }), { day })), [], 'Level 1 is not Level 10');
  assert.deepEqual(ids(queryIssues(site, query({ location: 'flat 2' }), { day })), ['part'], 'Flat 2 still finds Flat 2.04, as #165 counts it');
  assert.deepEqual(ids(queryIssues(site, query({ location: 'kitch' }), { day })).sort(), ['other', 'twelve-kitchen'], 'words are still found inside longer words');
});

test('the register link carries the project and the place as typed, and reads back', () => {
  const hash = placeRegisterHash('proj-011lme', ' Flat 204 /  kitchen ');
  assert.equal(hash, '#/issues/show/open/proj-011lme/Flat%20204%20%2F%20kitchen');
  const parts = hash.replace(/^#\/?/, '').split('/');
  assert.equal(parts.length, 5, 'a slash in the place stays inside one part');
  assert.equal(placeFromRoute(parts[4]), 'Flat 204 / kitchen');
  assert.equal(placeFromRoute(null), '');
  assert.equal(placeFromRoute('%E0%A4%A'), '', 'a part that cannot be read is no place');
});

test('the responsible company is matched as typed, not against a maintained list', () => {
  assert.deepEqual(ids(queryIssues(register, query({ view: 'all', company: 'acme' }), { day })).sort(), ['riser', 'stair']);
  assert.deepEqual(ids(queryIssues(register, query({ company: 'pipeworks north' }), { day })), ['plant']);
  assert.deepEqual(ids(queryIssues(register, query({ company: 'acme plumbing' }), { day })), []);
  assert.deepEqual(ids(queryIssues(register, query({ company: 'Pipeworks (North)' }), { day })), ['plant']);
});

test('verification status: not put forward, waiting for verification, verified and closed', () => {
  const v = (verification: IssueQuery['verification']) => ids(queryIssues(register, query({ view: 'all', verification }), { day })).sort();
  assert.deepEqual(v('not_put_forward'), ['late', 'riser']);
  assert.deepEqual(v('awaiting'), ['plant']);
  assert.deepEqual(v('verified'), ['stair']);
  // Withdrawn issues are in none of the three, but still in the whole register.
  assert.equal(queryIssues(register, query({ view: 'all' }), { day }).total, 5);
});

test('counts for each chip follow the other filters; trade falls back to the reporter', () => {
  const r = queryIssues(register, query({ trade: 'Electrical' }), { day });
  assert.deepEqual(ids(r), ['riser']);
  assert.deepEqual([r.counts.open, r.counts.closed, r.counts.all, r.counts.verify], [1, 1, 2, 0]);
  const p2 = queryIssues(register, query({ projectId: 'p2' }), { day });
  assert.deepEqual([p2.counts.open, p2.counts.overdue, p2.counts.unassigned, p2.counts.notReviewed, p2.counts.closed], [1, 1, 1, 1, 1]);
  // Suggestions name every owner in the register, whatever the filters.
  // One suggestion per company however its case was typed.
  assert.deepEqual(r.owners, ['Acme Electrical Ltd', 'Pipeworks (North) Ltd']);
});

test('"not reviewed" counts only projects that use review', () => {
  const both = [issue({ id: 'a', confirmation: 'provisional' }), issue({ id: 'b', projectId: 'p2', confirmation: 'provisional' })];
  const r = queryIssues(both, query({ view: 'notReviewed' }), { day, reviewOn: id => id === 'p1' });
  assert.deepEqual([r.counts.notReviewed, ...ids(r)], [1, 'a']);
});

test('the oldest closure to verify follows the search and skips my own', () => {
  const waiting = [
    issue({ id: 'old', work: 'awaiting_verification', raisedAt: '2026-09-01T10:00:00Z', owner: 'Pipeworks Ltd', closureSubmittedById: 'me' }),
    issue({ id: 'mid', work: 'awaiting_verification', raisedAt: '2026-09-05T10:00:00Z', owner: 'Pipeworks Ltd' }),
    issue({ id: 'acme', work: 'awaiting_verification', raisedAt: '2026-09-02T10:00:00Z', owner: 'Acme Electrical Ltd' }),
  ];
  const mine = (i: Issue) => i.closureSubmittedById === 'me';
  assert.equal(queryIssues(waiting, query({ company: 'pipeworks' }), { day, mine }).oldestToVerify?.id, 'mid');
  assert.equal(queryIssues(waiting, query(), { day, mine }).oldestToVerify?.id, 'acme');
  assert.equal(queryIssues(waiting, query({ location: 'roof' }), { day, mine }).oldestToVerify, undefined);
});

test('pages cover the whole register once, in a stable order, and a page past the end shows the last', () => {
  const many = Array.from({ length: 123 }, (_, n) => issue({ id: `i${n}`, reference: `011LME-ISS-${String(n + 1).padStart(3, '0')}`, location: n % 2 ? 'Riser' : 'Corridor',
    targetDate: n % 3 ? '' : '2026-11-01', raisedAt: `2026-09-${String(1 + (n % 28)).padStart(2, '0')}T10:00:00Z` }));
  const seen: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = queryIssues(many, query({ page }), { day });
    assert.equal(r.total, 123); assert.equal(r.pages, 3); assert.equal(r.page, page);
    assert.equal(r.issues.length, page < 3 ? 50 : 23);
    seen.push(...ids(r));
  }
  assert.equal(new Set(seen).size, 123);
  const past = queryIssues(many, query({ page: 9 }), { day });
  assert.equal(past.page, 3);
  assert.deepEqual(ids(past), seen.slice(100));
  // Sorting runs before the page is cut, so page 1 descending starts at the last reference.
  const sorted = queryIssues(many, query({ sort: { key: 'reference', direction: 'descending' }, pageSize: 10 }), { day });
  assert.equal(sorted.issues[0]!.reference, '011LME-ISS-123');
  const riser = queryIssues(many, query({ location: 'riser', pageSize: 20, page: 3 }), { day });
  assert.deepEqual([riser.total, riser.pages, riser.issues.length], [61, 4, 20]);
});

test('the address round-trips, and anything unknown falls back to the default', () => {
  const q = query({ view: 'closed', projectId: 'p2', location: 'riser 2', company: 'Acme', verification: 'verified', sort: { key: 'target', direction: 'descending' }, page: 3, pageSize: 25 });
  assert.deepEqual(parseIssueQuery(issueQueryParams(q)), { ...q, trade: undefined });
  assert.deepEqual(parseIssueQuery(new URLSearchParams('view=everything&verification=maybe&sort=colour&page=-2&pageSize=5000')),
    { view: 'open', projectId: undefined, trade: undefined, location: undefined, company: undefined, verification: undefined, sort: undefined, page: 1, pageSize: 200 });
});

const manager: Principal = { id: 'entra:mgr' as never, oid: 'mgr', name: 'Morgan', email: 'm@example.test', role: 'Manager' };

test('the register reads the store and only for someone with a role', () => {
  process.env.RELAY_SHAREPOINT_MODE = 'off';
  for (const i of register) putRecord('issues', i);
  assert.equal(issueRegister(manager, query({ view: 'all' }), day).total, 5);
  assert.equal(issueRegister({ ...manager, role: undefined } as unknown as Principal, query({ view: 'all' }), day).total, 0);
});

test('SharePoint-backed: every Graph page of the issue list is in the register, which pages on its own terms', async () => {
  process.env.RELAY_SHAREPOINT_MODE = 'read';
  process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS = '7';
  const original = graph.request;
  try {
    const project = projectIdentity('7');
    // A project list read moments ago, so only the issue list is fetched.
    putRecord('projects', { id: project, projectNumber: '011LME', projectName: 'Tetley Hall', clientName: 'Client', clientAccountNumber: '', division: 'M&E', status: '4. Active',
      projectManager: '', projectManagerEmail: '', reviewRequired: false, source: { siteId: OPERATIONS.site, listId: OPERATIONS.projects, itemId: '7' } });
    putRecord('projects', { id: projectIdentity('8'), projectNumber: '099LME', projectName: 'Not in scope', clientName: 'Client', clientAccountNumber: '', division: 'M&E', status: '4. Active',
      projectManager: '', projectManagerEmail: '', reviewRequired: false, source: { siteId: OPERATIONS.site, listId: OPERATIONS.projects, itemId: '8' } });
    putRecord('sharepoint-status', { id: 'projects', at: Date.now() });
    const row = (n: number, itemId = '7') => ({ id: String(1000 + n), eTag: `"e${n}"`, fields: {
      Title: `DEMO-011LME-ISS-${String(n).padStart(3, '0')}`, RELAY_x0020_Issue_x0020_ID: `sp-iss-${itemId}-${n}`, ProjectLookupId: itemId,
      Confirmation_x0020_Status: 'Confirmed', Work_x0020_Status: n % 10 === 0 ? 'Awaiting verification' : 'Assigned',
      Description: `Issue ${n}`, Location: n % 2 ? `Riser ${n}` : 'Corridor', External_x0020_Owner: n % 4 ? 'Acme Electrical Ltd' : 'Pipeworks Ltd',
      Raised_x0020_At: '2026-10-01T10:00:00Z', Target_x0020_Date: '' } });
    const second = 'https://graph.microsoft.com/v1.0/issues-page-2';
    const requested: string[] = [];
    graph.request = (async (path: string) => {
      requested.push(path);
      if (path.includes('/lists?$select')) return { value: [{ id: 'people', displayName: 'User Information List' }] };
      if (path.includes('/lists/people/items')) return { value: [{ id: '11', eTag: 'p', fields: { Title: 'Sam Spark', EMail: 'sam@example.test' } }] };
      // Graph returns the list 200 items at a time; the second page comes from nextLink.
      if (path.includes(`/lists/${OPERATIONS.issues}/items`)) return { value: Array.from({ length: 200 }, (_, n) => row(n + 1)), '@odata.nextLink': second };
      if (path === second) return { value: [...Array.from({ length: 30 }, (_, n) => row(n + 201)), row(1, '8')] };
      throw Error(`Unexpected Graph request ${path}`);
    }) as typeof graph.request;
    await refreshIssues();
    assert.ok(requested.includes(second), 'the second Graph page was read');

    const all = issueRegister(manager, query({ projectId: project, pageSize: 100 }), day);
    assert.equal(all.total, 230, 'both Graph pages, nothing from the project out of scope');
    assert.equal(all.pages, 3);
    const seen = new Set<string>();
    for (let page = 1; page <= all.pages; page++) for (const i of issueRegister(manager, query({ projectId: project, pageSize: 100, page }), day).issues) seen.add(i.id);
    assert.equal(seen.size, 230);
    assert.ok(seen.has('sp-iss-7-230'), 'an issue only on the second Graph page is reachable');

    const filtered = issueRegister(manager, query({ location: 'riser', company: 'pipeworks', verification: 'awaiting', pageSize: 5 }), day);
    // Odd numbers are risers, multiples of four are Pipeworks, multiples of ten wait for verification: none is all three.
    assert.equal(filtered.total, 0);
    const waiting = issueRegister(manager, query({ view: 'verify', company: 'acme', pageSize: 5, page: 2 }), day);
    // Multiples of ten up to 230 that are not multiples of four: 10, 30, 50 ... 230 → 12.
    assert.deepEqual([waiting.total, waiting.pages, waiting.page, waiting.issues.length], [12, 3, 2, 5]);
    assert.ok(waiting.issues.every(i => i.work === 'awaiting_verification' && i.owner === 'Acme Electrical Ltd'));
  } finally {
    graph.request = original;
    process.env.RELAY_SHAREPOINT_MODE = 'off';
    delete process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS;
  }
});
