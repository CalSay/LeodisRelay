import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { search, searchWords, SEARCH_LIMIT, type SearchSources } from '../lib/search';
import type { Issue, Observation, Report, Variation } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };
const manager: Principal = { ...other, id:'entra:mgr' as never, oid:'mgr', name:'Morgan', role:'Manager' };

const card = (o: Partial<Observation>): Observation => ({ id:'o', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], ...o });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-01', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', serverAcknowledgedAt:'2026-10-01T10:00:00Z', ...r } as Report);
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'', description:'', actionNeeded:'', confirmation:'provisional',
  work:'open', owner:'', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'', location:'', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Sam Spark', raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);

const sources: SearchSources = {
  projects:[{ id:'p1', projectName:'Tetley Hall Block E', projectNumber:'011LME' }, { id:'p2', projectName:'Kirkgate Works', projectNumber:'014LME' }],
  reports:[
    report({ id:'sent', observations:[card({ location:'Level 3 riser', whatHappened:'Cable tray brackets not fixed to the slab' })] }),
    report({ id:'mine', state:'draft', reference:'011LME-SPR-002', observations:[card({ location:'Level 3 riser', whatHappened:'Draft note about the riser' })] }),
    report({ id:'theirs', state:'draft', reference:'011LME-SPR-003', author:'Pat Pipe', authorId:other.id, observations:[card({ location:'Level 3 riser', whatHappened:'Private riser draft' })] }),
  ],
  issues:[
    issue({ id:'leak', description:'Leak at the valve', location:'Plant room', owner:'Acme Plumbing', events:[{ at:'2026-10-03T09:00:00Z', actor:'Morgan', kind:'progress', note:'Acme booked for Thursday', photos:[] }] }),
    issue({ id:'riser', reference:'011LME-ISS-002', description:'Fire stopping missing', location:'Level 3 Riser', raisedAt:'2026-10-02T10:00:00Z', work:'closed' }),
    issue({ id:'elsewhere', reference:'014LME-ISS-001', projectId:'p2', description:'Fire stopping missing', location:'Stair core', raisedAt:'2026-10-04T10:00:00Z' }),
  ],
  variations:[
    variation({ id:'vo1', description:'Extra sockets in the café', location:'Ground floor', askedBy:'Client PM', workDone:true }),
    variation({ id:'vo4', reference:'011LME-VO-004', description:'Move the riser door', location:'Level 3', instruction:'instructed', instructionReference:'CI-17' }),
  ],
};
const ids = (g: { hits: { id: string }[] }) => g.hits.map(h => h.id);

test('every word must appear somewhere in the record, in any order and case', () => {
  const r = search('RISER level', sources, engineer);
  assert.deepEqual(ids(r.issues), ['riser']);
  assert.deepEqual(ids(r.variations), ['vo4']);
  assert.deepEqual(ids(r.reports).sort(), ['mine', 'sent']);
  assert.equal(search('riser kitchen', sources, engineer).issues.total, 0);
});

test('another person’s draft is never searched; a manager sees no drafts but their own', () => {
  assert.ok(!ids(search('private', sources, engineer).reports).includes('theirs'));
  assert.deepEqual(ids(search('riser', sources, other).reports).sort(), ['sent', 'theirs']);
  assert.deepEqual(ids(search('riser', sources, manager).reports), ['sent']);
  const mine = search('draft note', sources, engineer).reports.hits[0]!;
  assert.equal(mine.status, 'Your draft');
});

test('notes, responsible companies, history and project names are searched', () => {
  assert.deepEqual(ids(search('acme', sources, engineer).issues), ['leak']);
  assert.match(search('thursday', sources, engineer).issues.hits[0]!.snippet, /^History: Acme booked for Thursday/);
  assert.deepEqual(ids(search('cafe', sources, engineer).variations), ['vo1'], 'accents do not matter');
  assert.deepEqual(ids(search('CI-17', sources, engineer).variations), ['vo4']);
  assert.deepEqual(ids(search('kirkgate fire', sources, engineer).issues), ['elsewhere']);
  assert.match(search('brackets', sources, engineer).reports.hits[0]!.snippet, /^Note: Cable tray brackets/);
});

test('a typed reference comes first, then the newest', () => {
  const r = search('fire stopping', sources, engineer);
  assert.deepEqual(ids(r.issues), ['elsewhere', 'riser'], 'newest first when the words match equally');
  assert.deepEqual(ids(search('VO-004', sources, engineer).variations), ['vo4']);
  const both = search('011LME-ISS-002', sources, engineer).issues;
  assert.equal(both.hits[0]!.id, 'riser');
});

test('the project filter, statuses in RELAY’s words and the result limit', () => {
  assert.deepEqual(ids(search('fire', sources, engineer, 'p1').issues), ['riser']);
  const r = search('riser', sources, engineer);
  assert.equal(r.issues.hits[0]!.status, 'Closed');
  assert.equal(search('sockets', sources, engineer).variations.hits[0]!.status, 'Done, not instructed');
  assert.equal(r.variations.hits[0]!.status, 'Instructed');
  const many = { ...sources, issues:Array.from({ length:SEARCH_LIMIT + 5 }, (_, n) => issue({ id:`i${n}`, description:`Snag ${n}` })) };
  const g = search('snag', many, engineer).issues;
  assert.equal(g.hits.length, SEARCH_LIMIT);
  assert.equal(g.total, SEARCH_LIMIT + 5);
});

test('too short or empty queries return nothing rather than everything', () => {
  for (const q of ['', ' ', 'a', '--']) {
    const r = search(q, sources, engineer);
    assert.equal(r.reports.total + r.issues.total + r.variations.total, 0, q);
  }
  assert.deepEqual(searchWords('  Level-3, riser Riser '), ['level 3', 'riser']);
  assert.deepEqual(ids(search('level-3 riser', sources, engineer).issues), ['riser'], 'a dash matches a space');
  assert.deepEqual(ids(search('vo 004', sources, engineer).variations), ['vo4']);
});
