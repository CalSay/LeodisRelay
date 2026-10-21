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
  assert.match(drawn, /Drawn signature · 19 Oct 2026, 16:32/);
  const nameOnly = (await pageTexts(await renderReportPdf({ ...base, signature: { name: 'Sam Patel', signedAt } }))).join(' ');
  assert.match(nameOnly, /Sent without a drawn signature · 19 Oct 2026, 16:32/);
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

test('a card of many short lines is not kept to one page and cut off', async () => {
  const flats = Array.from({ length: 70 }, (_, i) => `Flat ${101 + i} sockets loose`).join('\n');
  const text = (await pageTexts(await renderReportPdf({ ...base, observations: [card('1', { whatHappened: flats, actionNeeded: 'Tighten all of them.' })] }))).join(' ');
  for (let i = 0; i < 70; i += 1) assert.match(text, new RegExp(`Flat ${101 + i} sockets loose`));
  assert.match(text, /Tighten all of them\./);
});

test('an inspection says what was found wrong beside each action arising', async () => {
  const check = (id: string, over: Partial<DocReport['observations'][number]>) =>
    card(id, { typeLabel: 'Inspection check', location: '', whatHappened: '', check: { question: `Check ${id}`, answer: 'Action needed', tone: 'action' }, ...over });
  const long = `Scaffold tie missing at the second lift ${'and the board beside it is split along its length '.repeat(5)}end.`;
  const observations = [
    check('a', { whatHappened: 'Open edge with only a strap across it.', actionNeeded: 'Fit an edge barrier.', owner: 'Main contractor' }),
    check('b', { whatHappened: '', actionNeeded: 'Replace the lead.' }),
    check('c', { whatHappened: long, actionNeeded: 'Tie it in.' }),
  ];
  const pages = await pageTexts(await renderReportPdf({ ...base, documentTitle: 'Site Safety Inspection', inspection: true, observations }));
  const all = pages.join(' ');
  const arising = all.slice(all.search(/A R I S I N G/), all.search(/R E S U L T S/));
  assert.match(arising, /Found: Open edge with only a strap across it\. Fit an edge barrier\./);
  // A check with no notes shows only its action, with nothing invented.
  assert.match(arising, /Check b Replace the lead\./);
  assert.equal(arising.match(/Found:/g)?.length, 2);
  // Long notes are cut at a word and point to the full notes further on.
  assert.match(arising, /Found: Scaffold tie missing at the second lift .*… \(see 03 below\) Tie it in\./);
  assert.doesNotMatch(arising, /end\./);
  assert.match(all, /along its length end\./);
});

test('a site update summary is unchanged: no Found line', async () => {
  const text = (await pageTexts(await renderReportPdf({ ...base, observations: [card('1', { actionNeeded: 'Make good.', typeLabel: 'Defect', tone: 'defect' })] }))).join(' ');
  assert.doesNotMatch(text, /Found:/);
});

test('a draft with nothing on it yet says so, not that the visit raised nothing', async () => {
  const empty = (await pageTexts(await renderReportPdf({ ...base, approved: false }))).join(' ');
  assert.match(empty, /Nothing recorded yet\. Cards added to the report show here\./);
  assert.doesNotMatch(empty, /No actions or decisions arise/);
  const quiet = (await pageTexts(await renderReportPdf({ ...base, observations: [card('1')] }))).join(' ');
  assert.match(quiet, /No actions or decisions arise from this visit\./);
});

test('boxes at the 10,000-character limit are printed in full, and the summary points to the card', async () => {
  const words = (n: number, end: string) => `${'Fire stopping missing around the soil pipes in riser 2. '.repeat(Math.ceil(n / 56)).slice(0, n - end.length - 1)} ${end}`;
  const observations = [card('1', { typeLabel: 'Defect', tone: 'defect', whatHappened: words(10_000, 'notes end.'), actionNeeded: words(10_000, 'action end.'), owner: words(10_000, 'owner end.') })];
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')); };
  let pages: string[];
  try { pages = await pageTexts(await renderReportPdf({ ...base, correction: { replacesRevision: 1, reason: words(10_000, 'reason end.') }, observations })); }
  finally { console.warn = warn; }
  // A block kept on one page but taller than one is drawn under the footer and off the paper.
  assert.deepEqual(warnings.filter(w => /can't wrap/.test(w)), []);
  const all = pages.join(' ');
  for (const end of ['notes end.', 'action end.', 'owner end.', 'reason end.']) assert.match(all, new RegExp(end));
  const summary = all.slice(0, all.search(/U P D A T E S/));
  assert.equal(summary.match(/… \(see 01 below\)/g)?.length, 2);
  assert.doesNotMatch(summary, /action end\.|owner end\./);
});

test('a long project name wraps beside the reference instead of running off the page', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fonts = join(dirname(createRequire(__filename).resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';
  const bytes = await renderReportPdf({ ...base, projectName: 'Tetley Hall Block E – Residential Conversion, Phase 2 (Café Façade & Courtyard Apartments)' });
  const page = await (await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, standardFontDataUrl: fonts }).promise).getPage(1);
  const items = (await page.getTextContent()).items.filter(item => 'str' in item && item.str.trim()) as { str: string; width: number; transform: number[] }[];
  const reference = items.find(item => item.str === '011LME-SPR-004')!;
  assert.ok(reference.transform[4]! + reference.width <= 595.28 - 42 + 0.5, 'the reference stays inside the margin');
  const title = items.filter(item => Math.abs(item.transform[3]! - 21) < 0.1).map(item => item.transform[5]!).sort((a, b) => b - a);
  assert.ok(title.length >= 2, 'the name wraps');
  for (let i = 1; i < title.length; i += 1) assert.ok(title[i - 1]! - title[i]! >= 21, 'its lines are not drawn over each other');
});
