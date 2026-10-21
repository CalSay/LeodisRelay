import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { renderReportPdf, type DocReport } from '@relay/documents';
import { documentModel } from '../lib/documentModel';
import type { Report } from '../lib/types';

/** The words on each page of a rendered PDF, read back with pdf.js. */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fonts = join(dirname(createRequire(__filename).resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, standardFontDataUrl: fonts }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  return pages;
}

const base: DocReport = {
  reference: '011LME-SPR-004', projectName: 'Tetley Hall Block E', projectNumber: '011LME', clientName: 'Northgate Living',
  clientAccountNumber: 'NGL-1', visitDate: '2026-10-19', author: 'Sam Patel', revision: 1, approved: true,
  observations: [],
};
const card = (id: string, over: Partial<DocReport['observations'][number]> = {}): DocReport['observations'][number] => ({
  id, typeLabel: 'Progress update', tone: 'neutral', location: `Flat ${id}`, whatHappened: 'Second fix complete.', actionNeeded: '', owner: '', photos: [], ...over,
});

test('every page says what the document is, which project, and which page', async () => {
  const observations = Array.from({ length: 30 }, (_, i) => card(String(i + 1), { whatHappened: 'Containment complete and lidded along the corridor. '.repeat(4) }));
  const pages = await pageTexts(await renderReportPdf({ ...base, observations }));
  assert.ok(pages.length > 2);
  pages.forEach((text, i) => {
    assert.match(text, /Site Progress Report · Tetley Hall Block E · 011LME-SPR-004 · Revision 1 · Approved for issue/);
    assert.match(text, new RegExp(`Page ${i + 1} of ${pages.length}`));
  });
});

test('a project name the footer font cannot set does not stop the PDF', async () => {
  const pages = await pageTexts(await renderReportPdf({ ...base, projectName: 'Łódź Wharf 🏗 Block A' }));
  // ó is in the footer font; Ł and ź fall back to plain letters, and the emoji is left out.
  assert.match(pages[0]!, /Site Progress Report · Lódz Wharf Block A · 011LME-SPR-004/);
});

test('a summary row carries the number of the update it came from, and the card says who acts', async () => {
  const observations = [card('1'), card('2', { typeLabel: 'Defect', tone: 'defect', actionNeeded: 'Fit the collars.', owner: 'Apex Fire' }), card('3', { actionNeeded: 'Confirm the date.' })];
  const text = (await pageTexts(await renderReportPdf({ ...base, observations }))).join(' ');
  assert.match(text, /02 Flat 2 Fit the collars\. Apex Fire 03 Flat 3 Confirm the date\. Awaiting confirmation/);
  assert.match(text, /Owner: Apex Fire/);
  assert.match(text, /Owner: Awaiting confirmation/);
});

test('signatures say how and when they were made', async () => {
  const signedAt = '2026-10-19T15:32:00Z';
  const drawn = (await pageTexts(await renderReportPdf({ ...base, signature: { name: 'Sam Patel', signedAt, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' } }))).join(' ');
  assert.match(drawn, /Drawn signature · 19\/10\/2026, 16:32/);
  const nameOnly = (await pageTexts(await renderReportPdf({ ...base, signature: { name: 'Sam Patel', signedAt } }))).join(' ');
  assert.match(nameOnly, /Sent without a drawn signature · 19\/10\/2026, 16:32/);
  const unsigned = (await pageTexts(await renderReportPdf({ ...base, approved: false }))).join(' ');
  assert.match(unsigned, /Not signed yet/);
});

test('an inspection opens its results with a tally', async () => {
  const check = (id: string, tone: 'ok' | 'action' | 'na', answer: string) =>
    card(id, { typeLabel: 'Inspection check', location: '', whatHappened: '', check: { question: `Check ${id}`, answer, tone } });
  const observations = [check('a', 'ok', 'Satisfactory'), check('b', 'ok', 'Satisfactory'), check('c', 'action', 'Action needed'), check('d', 'na', 'Not applicable')];
  const text = (await pageTexts(await renderReportPdf({ ...base, documentTitle: 'Site Safety Inspection', inspection: true, observations }))).join(' ');
  // Headings are letter-spaced, so pdf.js reads them a letter at a time.
  assert.match(text, /S U L T S 4 checks 2 satisfactory 1 action needed 1 not applicable/);
});

test('a correction says which revision it replaces and why, from the report itself', async () => {
  const report: Report = {
    id: 'rep-2', projectId: 'p1', reference: '011LME-SPR-004', visitDate: '2026-10-19', author: 'Sam Patel', state: 'submitted', version: 3,
    revision: 3, observations: [], review: 'not_required', corrects: 'rep-1', correctionReason: '  Wrong level on the riser defect. ',
    projectSnapshot: { projectId: 'p1', projectName: 'Tetley Hall Block E', projectNumber: '011LME', clientName: 'Northgate', clientAccountNumber: 'NGL-1' } as never,
  };
  const model = await documentModel(report);
  assert.deepEqual(model.correction, { replacesRevision: 2, reason: 'Wrong level on the riser defect.' });
  const { corrects: _corrects, correctionReason: _reason, ...original } = report;
  assert.equal((await documentModel(original)).correction, undefined);
  const [first] = await pageTexts(await renderReportPdf(model));
  // Letter-spaced labels read back a letter at a time, so compare without spaces.
  assert.match(first!.replace(/\s/g, ''), /REVISION3·REPLACESREVISION2Reason:Wronglevelontheriserdefect\./);
});
