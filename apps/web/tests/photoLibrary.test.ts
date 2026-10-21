import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Principal } from '@relay/platform';
import { isPhotoDay, matchesPhoto, photoDays, photoLibrary, type LibrarySources } from '../lib/photoLibrary';
import type { Issue, IssueEvent, Observation, Photo, Report, Variation } from '../lib/types';

const engineer: Principal = { id:'entra:eng' as never, oid:'eng', name:'Sam Spark', email:'s@example.test', role:'Engineer', trade:'Electrical' };
const other: Principal = { ...engineer, id:'entra:other' as never, oid:'other', name:'Pat Pipe', trade:'P&H' };

const photo = (id: string, capturedAt = ''): Photo => ({ id, dataUrl:`/api/media/${id}`, caption:'', capturedAt });
const card = (o: Partial<Observation>): Observation => ({ id:'o', type:'update', location:'', whatHappened:'', actionNeeded:'', owner:'', photos:[], ...o });
const report = (r: Partial<Report>): Report => ({ id:'r', projectId:'p1', reference:'011LME-SPR-001', visitDate:'2026-10-13', author:'Sam Spark', authorId:engineer.id,
  state:'submitted', version:1, revision:1, observations:[], review:'not_required', ...r } as Report);
const ev = (kind: IssueEvent['kind'], at: string, photos: Photo[] = []): IssueEvent => ({ kind, at, actor:'Morgan', note:'', photos });
const issue = (i: Partial<Issue>): Issue => ({ id:'i', reference:'011LME-ISS-001', projectId:'p1', location:'Level 3 riser', description:'Tray lid missing', actionNeeded:'', confirmation:'confirmed',
  work:'open', owner:'', targetDate:'', raisedByReport:'r', raisedAt:'2026-10-01T10:00:00Z', events:[], ...i });
const variation = (v: Partial<Variation>): Variation => ({ id:'v', reference:'011LME-VO-001', projectId:'p1', description:'Extra sockets', location:'Plant room', workDone:false,
  instruction:'pending', source:'report', raisedBy:'Sam Spark', raisedAt:'2026-10-01T10:00:00Z', events:[], ...v } as Variation);
const none: LibrarySources = { reports:[], issues:[], variations:[] };

test('lists photographs from sent reports only, newest visit first, never drafts or other projects', () => {
  const lib = photoLibrary({ ...none, reports:[
    report({ id:'old', visitDate:'2026-10-06', observations:[card({ location:'Roof', photos:[photo('a')] })] }),
    report({ id:'new', visitDate:'2026-10-13', reference:'011LME-SPR-002', authorTrade:'Electrical', observations:[
      card({ type:'defect', location:' Level 3  riser ', whatHappened:'Tray lid missing', photos:[photo('b', '2026-10-13T09:00:00Z'), photo('c', '2026-10-13T11:00:00Z')] })] }),
    report({ id:'draft', state:'draft', observations:[card({ photos:[photo('d')] })] }),
    report({ id:'away', projectId:'p2', observations:[card({ photos:[photo('e')] })] }),
  ] }, engineer, 'p1');
  assert.deepEqual(lib.photos.map(p => p.src), ['/api/media/c', '/api/media/b', '/api/media/a']);
  const c = lib.photos[0]!;
  assert.equal(c.group, 'defect'); assert.equal(c.label, 'Defect');
  assert.equal(c.location, 'Level 3 riser', 'spacing tidied, words as written');
  assert.equal(c.day, '2026-10-13'); assert.equal(c.trade, 'Electrical');
  assert.deepEqual(c.source, { kind:'report', id:'new', reference:'011LME-SPR-002' });
});

test("someone else's draft stays private, and an engineer's own draft is still left out", () => {
  const mine = photoLibrary({ ...none, reports:[report({ state:'draft', observations:[card({ photos:[photo('a')] })] })] }, engineer, 'p1');
  const theirs = photoLibrary({ ...none, reports:[report({ state:'draft', observations:[card({ photos:[photo('a')] })] })] }, other, 'p1');
  assert.equal(mine.photos.length, 0); assert.equal(theirs.photos.length, 0);
});

test('a photograph copied onto an issue shows once, from the report; later evidence shows from the issue', () => {
  const lib = photoLibrary({ ...none,
    reports:[report({ id:'r1', observations:[card({ type:'defect', photos:[photo('a')] })] })],
    issues:[issue({ events:[ev('raised', '2026-10-13T10:00:00Z', [photo('a')]), ev('closure_submitted', '2026-10-15T14:00:00Z', [photo('fix')]), ev('verified', '2026-10-16T09:00:00Z', [photo('ok')])] })],
  }, engineer, 'p1');
  assert.deepEqual(lib.photos.map(p => [p.src, p.source.kind, p.label]), [
    ['/api/media/ok', 'issue', 'Checked and closed'],
    ['/api/media/fix', 'issue', 'Put forward as fixed'],
    ['/api/media/a', 'report', 'Defect'],
  ]);
  assert.equal(lib.photos[0]!.group, 'fix');
  assert.equal(lib.photos[0]!.location, 'Level 3 riser');
});

test('a sent correction takes over its photographs; ones it dropped stay with the original', () => {
  const lib = photoLibrary({ ...none, reports:[
    report({ id:'orig', observations:[card({ photos:[photo('a'), photo('b')] })] }),
    report({ id:'fix', corrects:'orig', revision:2, observations:[card({ photos:[photo('a')] })] }),
  ] }, engineer, 'p1');
  const by = Object.fromEntries(lib.photos.map(p => [p.src, p.source.id]));
  assert.deepEqual(by, { '/api/media/a':'fix', '/api/media/b':'orig' });
});

test('individual defects, variation photographs and other kinds are grouped for the filter', () => {
  const lib = photoLibrary({
    reports:[report({ observations:[card({ type:'update', photos:[photo('u')] }), card({ type:'access', photos:[photo('x')] }), card({ type:'instruction', photos:[photo('i')] })] })],
    issues:[issue({ id:'solo', source:'individual', events:[ev('raised', '2026-10-14T10:00:00Z', [photo('s')])] }), issue({ id:'gone', confirmation:'withdrawn', events:[ev('raised', '2026-10-14T10:00:00Z', [photo('w')])] })],
    variations:[variation({ events:[{ kind:'note', at:'2026-10-14T12:00:00Z', actor:'Morgan', note:'', photos:[photo('v')] }] })],
  }, engineer, 'p1');
  const group = Object.fromEntries(lib.photos.map(p => [p.src.slice(11), p.group]));
  assert.deepEqual(group, { u:'progress', x:'defect', i:'variation', s:'defect', v:'variation' }, 'a withdrawn issue is left out');
});

test('the find box needs every word, anywhere, ignoring case and spacing', () => {
  const lib = photoLibrary({ ...none, reports:[report({ observations:[
    card({ location:'Level 3 riser', whatHappened:'Containment fixed', photos:[photo('a')] }),
    card({ type:'defect', location:'Plant room', whatHappened:'Riser door damaged', photos:[photo('b')] }),
  ] })] }, engineer, 'p1');
  const find = (words: string, group: '' | 'defect' = '') => lib.photos.filter(p => matchesPhoto(p, words, group)).map(p => p.src.slice(11)).sort();
  assert.deepEqual(find(''), ['a', 'b']);
  assert.deepEqual(find('RISER'), ['a', 'b']);
  assert.deepEqual(find('  level   3 '), ['a']);
  assert.deepEqual(find('riser', 'defect'), ['b']);
  assert.deepEqual(find('011LME-SPR-001 plant'), ['b'], 'the report reference counts');
  assert.deepEqual(find('roof'), []);
});

test('through a chain of corrections a photograph links to the latest revision that still carries it', () => {
  const lib = photoLibrary({ ...none, reports:[
    report({ id:'rev1', observations:[card({ photos:[photo('a')] })] }),
    report({ id:'rev2', corrects:'rev1', revision:2, observations:[card({ photos:[photo('a')] })] }),
    report({ id:'rev3', corrects:'rev2', revision:3, observations:[card({ photos:[] })] }),
  ] }, engineer, 'p1');
  assert.equal(lib.photos[0]!.source.id, 'rev2');
});

test("evidence added to an issue does not borrow the issue's trade for the person who added it", () => {
  const lib = photoLibrary({ ...none, issues:[issue({ affectedTrade:'HVAC', events:[ev('verified', '2026-10-16T09:00:00Z', [photo('ok')])] })] }, engineer, 'p1');
  assert.equal(lib.photos[0]!.trade, undefined);
});

test('a day choice lists each day with photographs, newest first, keeping a chosen day with none', () => {
  const lib = photoLibrary({ ...none, reports:[
    report({ id:'mon', visitDate:'2026-10-12', observations:[card({ photos:[photo('a')] })] }),
    report({ id:'tue', visitDate:'2026-10-13', reference:'011LME-SPR-002', observations:[card({ photos:[photo('b'), photo('c')] })] }),
    report({ id:'thu', visitDate:'2026-10-15', reference:'011LME-SPR-003', observations:[card({ photos:[photo('d')] })] }),
  ] }, engineer, 'p1');
  assert.deepEqual(photoDays(lib.photos), [{ day:'2026-10-15', count:1 }, { day:'2026-10-13', count:2 }, { day:'2026-10-12', count:1 }]);
  assert.deepEqual(photoDays(lib.photos, '2026-10-14').map(d => `${d.day}:${d.count}`), ['2026-10-15:1', '2026-10-14:0', '2026-10-13:2', '2026-10-12:1']);
  assert.deepEqual(photoDays(lib.photos, '2026-10-13').length, 3);
  assert.deepEqual(photoDays([]), []);
});

test('only a real calendar day is taken from the address', () => {
  assert.equal(isPhotoDay('2026-10-13'), true);
  assert.equal(isPhotoDay('2026-02-30'), false);
  assert.equal(isPhotoDay('13/10/2026'), false);
  assert.equal(isPhotoDay(''), false);
});
