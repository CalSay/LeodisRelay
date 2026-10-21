import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewReport } from '../lib/review';
import { REPORT_TYPES, startingCards } from '../lib/reportTypes';
import type { Observation, Photo, Report } from '../lib/types';

const photo = (id: string, caption = ''): Photo => ({ id, dataUrl: 'data:image/jpeg;base64,AA==', caption, capturedAt: '2026-10-21T09:00:00Z' });
const card = (id: string, type: Observation['type'], photos: Photo[], extra: Partial<Observation> = {}): Observation =>
  ({ id, type, location: 'Level 2 corridor', whatHappened: 'Something', actionNeeded: '', owner: '', photos, ...extra });
const base = { id: 'r', projectId: 'p', reference: 'X-SPR-001', visitDate: '2026-10-21', author: 'G', state: 'draft', version: 1, revision: 1, review: 'not_required' } as Report;

test('photographs with no caption make one optional line on Check & send', async t => {
  await t.test('six uncaptioned photographs on three cards: one line, after the notes that matter, opening the first card', () => {
    const report = { ...base, observations: [
      card('a', 'update', [photo('1'), photo('2', 'Tray to grid C')]),
      card('b', 'defect', [photo('3'), photo('4'), photo('5')]),
      card('c', 'instruction', [], { workDone: true }),
      card('d', 'update', [photo('6'), photo('7')]),
    ] };
    const notes = reviewReport(report).filter(f => !f.blocking);
    const captions = notes.filter(f => f.field === 'caption');
    assert.equal(captions.length, 1);
    assert.equal(captions[0]!.message, '6 photographs have no caption');
    assert.equal(captions[0]!.observationId, 'a');
    assert.equal(notes.at(-1)!.field, 'caption', 'the caption line comes after the notes about a variation');
    assert.deepEqual(notes.slice(0, -1).map(f => f.field), ['photos', 'askedBy']);
  });

  await t.test('one photograph says so in the singular, and captioned photographs say nothing', () => {
    assert.equal(reviewReport({ ...base, observations: [card('a', 'update', [photo('1')])] }).find(f => f.field === 'caption')?.message, '1 photograph has no caption');
    assert.equal(reviewReport({ ...base, observations: [card('a', 'update', [photo('1', 'Riser')])] }).length, 0);
  });

  await t.test('a caption never stops sending', () => {
    const report = { ...base, observations: [card('a', 'defect', [photo('1'), photo('2')])] };
    assert.deepEqual(reviewReport(report).filter(f => f.blocking), []);
  });

  await t.test('an inspection has the same one line', () => {
    const type = REPORT_TYPES.find(r => r.checklist)!;
    const cards = startingCards(type).map((o, i) => ({ ...o, check: { ...o.check!, answer: 'ok' as const }, photos: i < 3 ? [photo(`p${i}`)] : [] }));
    const captions = reviewReport({ ...base, reportType: type.id, observations: cards } as Report).filter(f => f.field === 'caption');
    assert.equal(captions.length, 1);
    assert.equal(captions[0]!.message, '3 photographs have no caption');
    assert.equal(captions[0]!.blocking, false);
  });
});
