#!/usr/bin/env node
/**
 * Builds worst-case PDFs of every report and inspection type from
 * scripts/long-pdf-cases.mjs (notes at the 10,000-character limit, long and
 * accented names, many cards and photographs, tall and very wide photographs,
 * typed and drawn signatures, a correction, an almost empty report) and checks
 * each one, reading it back with pdf.js:
 *
 *   - the layout engine never had to place a block taller than a page (it
 *     says so, then draws the block over the footer and off the paper);
 *   - every page has its footer: what the document is, and "Page n of N";
 *   - no text runs off the page, or into the footer or the top margin;
 *   - no line is drawn over another (a title wrapped onto itself);
 *   - every long box is there in full, to its last words;
 *   - no section heading or card title is the last thing on a page;
 *   - photographs keep their shape and are big enough to see;
 *   - the page count is in the expected range and the file is no bigger
 *     than its photographs and a little more.
 *
 *     npm run build:packages
 *     node scripts/verify-long-pdfs.mjs [out-dir] [--png]
 *
 * With out-dir the PDFs are written there (and with --png, page images at
 * 60 dpi, which needs pdftoppm). Nothing is stored, filed or sent.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const { renderReportPdf } = await import(pathToFileURL(join(root, 'packages/documents/dist/index.js')).href);
const { buildCases } = await import(pathToFileURL(join(root, 'scripts/long-pdf-cases.mjs')).href);
const require = createRequire(join(root, 'apps/web/package.json'));
const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
const standardFontDataUrl = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';

const outArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const out = outArg ? resolve(outArg) : undefined;
const png = process.argv.includes('--png');
if (out) await mkdir(out, { recursive: true });

/** Pages each case may take. Wide enough for small wording changes; a jump means something moved. */
const PAGES = {
  'site-update-many': [20, 34], 'site-update-at-limit': [22, 38], 'site-update-correction': [3, 7],
  'site-update-almost-empty': [1, 1], 'site-update-nothing': [1, 1],
  'safety-inspection': [14, 24], 'handover-inspection': [14, 24], 'first-fix-inspection': [14, 24],
  'tower-inspection': [14, 24], 'tower-inspection-all-clear': [1, 2],
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const BODY_BOTTOM = 92; // the page's bottom padding: nothing but the footer below it
const FOOTER_LINE = 20; // baseline of the footer's words
const FOOTER_MARKS = 46; // baseline of the ACCREDITATIONS label
const H2_SIZE = 7.5;
const CARD_TITLE_SIZE = 11.5;
const CARD_NUMBER_SIZE = 12;

let failures = 0;
const fail = (name, message) => { failures += 1; console.log(`  ✗ ${name}: ${message}`); };
// Without spaces or hyphens: a long run (a link, a reference) is broken with a hyphen added.
const flat = (text) => text.replace(/[\s-]+/g, '');

/** The text items and photographs on each page, with their place in points from the bottom left. */
async function readPdf(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, standardFontDataUrl, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.filter(i => 'str' in i && i.str.trim()).map(i => ({
      str: i.str, x: i.transform[4], y: i.transform[5], size: Math.hypot(i.transform[2], i.transform[3]), width: i.width,
    }));
    // Walk the drawing operators for where each image lands.
    const ops = await page.getOperatorList();
    const images = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    const times = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    ops.fnArray.forEach((fn, k) => {
      const args = ops.argsArray[k];
      if (fn === pdfjs.OPS.save) stack.push(ctm);
      else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === pdfjs.OPS.transform) ctm = times(ctm, args);
      else if (fn === pdfjs.OPS.paintImageXObject) {
        images.push({ pixels: { width: args[1], height: args[2] }, x: ctm[4], y: ctm[5] + Math.min(0, ctm[3]), width: Math.abs(ctm[0]), height: Math.abs(ctm[3]) });
      }
    });
    pages.push({ items, images, text: items.map(i => i.str).join(' ') });
  }
  return pages;
}

/** Each long box should be in the PDF to its last words. */
function longTexts(report) {
  const texts = [];
  if (report.correction) texts.push(report.correction.reason);
  for (const o of report.observations) {
    for (const t of [o.whatHappened, o.actionNeeded, o.owner, o.location]) if (t.trim().length > 200) texts.push(t);
    for (const p of o.photos) if (p.caption.length > 200) texts.push(p.caption);
  }
  return texts;
}

function photoBytes(report) {
  const seen = new Set();
  let total = 0;
  for (const o of report.observations) for (const p of o.photos) {
    if (seen.has(p.dataUrl)) continue;
    seen.add(p.dataUrl);
    total += Buffer.from(p.dataUrl.slice(p.dataUrl.indexOf(',') + 1), 'base64').length;
  }
  return total;
}

const cases = await buildCases();
for (const [name, report] of Object.entries(cases)) {
  // react-pdf says when it had to place a block taller than a page.
  const warnings = [];
  const warn = console.warn, error = console.error, log = console.log;
  console.warn = console.error = console.log = (...args) => warnings.push(args.join(' '));
  let bytes;
  try { bytes = await renderReportPdf(report); } finally { Object.assign(console, { warn, error, log }); }
  if (out) {
    const file = join(out, `${name}.pdf`);
    await writeFile(file, bytes);
    if (png) execFileSync('pdftoppm', ['-png', '-r', '60', file, join(out, name)]);
  }
  const pages = await readPdf(bytes);
  const before = failures;
  const tooTall = warnings.filter(w => /can't wrap between pages/.test(w));
  if (tooTall.length) fail(name, `${tooTall.length} block(s) taller than a page, drawn off the paper`);

  const [min, max] = PAGES[name] ?? [1, 200];
  if (pages.length < min || pages.length > max) fail(name, `${pages.length} pages, expected ${min} to ${max}`);

  const title = [report.documentTitle ?? 'Site Progress Report'].join('');
  pages.forEach((page, i) => {
    const n = i + 1;
    if (!page.text.includes(`Page ${n} of ${pages.length}`)) fail(name, `page ${n} has no "Page ${n} of ${pages.length}"`);
    if (!page.text.includes(title) || !page.text.includes(report.reference)) fail(name, `page ${n} footer does not name the document and reference`);
    for (const item of page.items) {
      const footer = Math.abs(item.y - FOOTER_LINE) < 1.5 || Math.abs(item.y - FOOTER_MARKS) < 1.5;
      if (item.x < MARGIN - 1 || item.x + item.width > A4.width - MARGIN + 1) fail(name, `page ${n}: "${item.str.slice(0, 40)}" runs off the side (x ${item.x.toFixed(0)} to ${(item.x + item.width).toFixed(0)})`);
      else if (!footer && item.y < BODY_BOTTOM - 4) fail(name, `page ${n}: "${item.str.slice(0, 40)}" runs into the footer (y ${item.y.toFixed(0)})`);
      else if (item.y > A4.height - 30) fail(name, `page ${n}: "${item.str.slice(0, 40)}" runs into the top margin`);
    }
    // Lines of the same size in the same column drawn closer than the type is tall overlap.
    const big = page.items.filter(i => i.size >= 11).sort((a, b) => b.y - a.y);
    for (let k = 1; k < big.length; k += 1) {
      const [a, b] = [big[k - 1], big[k]];
      if (a.size === b.size && Math.abs(a.x - b.x) < 2 && a.y - b.y > 0.5 && a.y - b.y < a.size * 1.05) {
        fail(name, `page ${n}: "${b.str.slice(0, 30)}" is drawn over the line above it`);
      }
    }
    // Nothing should end a page on a heading or a card's title, with what it heads
    // overleaf: the last few lines on the page are headings, with other words above
    // them. (A title as long as a page, typed into the place box, may run on.)
    // A section heading is a line of 7.5pt letters; a card's head is the line
    // with its 11.5pt title and 12pt number (and its 6pt label beside them).
    const near = (item, size) => Math.abs(item.size - size) < 0.2;
    const heading = (line) => line.every(item => near(item, H2_SIZE)) || line.some(item => near(item, CARD_TITLE_SIZE) || near(item, CARD_NUMBER_SIZE));
    const lines = [];
    for (const item of page.items.filter(i => i.y >= BODY_BOTTOM - 4).sort((a, b) => a.y - b.y)) {
      const line = lines.at(-1);
      if (line && item.y - line[0].y < 1.5) line.push(item); else lines.push([item]);
    }
    const trailing = lines.findIndex(line => !heading(line));
    if (n < pages.length && trailing > 0 && trailing <= 3) {
      fail(name, `page ${n} ends on a heading: "${lines.slice(0, trailing).reverse().map(line => line.map(item => item.str).join('')).join(' ')}"`);
    }
    for (const image of page.images) {
      // The accreditation marks are page furniture in the footer strip, under the body.
      if (image.y + image.height <= FOOTER_MARKS + 20 && image.height <= 30) {
        if (Math.abs(image.width / image.height - image.pixels.width / image.pixels.height) > 0.03 * image.pixels.width / image.pixels.height) fail(name, `page ${n}: an accreditation mark is drawn stretched`);
        continue;
      }
      const signature = image.height <= 43 && image.width > image.height * 2.5 && image.pixels.width === 600;
      const drawn = image.width / image.height;
      const actual = image.pixels.width / image.pixels.height;
      if (Math.abs(drawn - actual) / actual > 0.03) fail(name, `page ${n}: a ${image.pixels.width}×${image.pixels.height} photograph is drawn stretched (${image.width.toFixed(0)}×${image.height.toFixed(0)}pt)`);
      if (!signature && Math.min(image.width, image.height) < 40) fail(name, `page ${n}: a ${image.pixels.width}×${image.pixels.height} photograph is only ${image.width.toFixed(0)}×${image.height.toFixed(0)}pt`);
      if (image.y < BODY_BOTTOM - 4 || image.x + image.width > A4.width - MARGIN + 1) fail(name, `page ${n}: a photograph runs off the page or into the footer`);
    }
  });

  const all = flat(pages.map(p => p.text).join(''));
  for (const text of longTexts(report)) {
    const end = flat(text.trim()).slice(-60);
    if (!all.includes(end)) fail(name, `a long box is cut short: "…${text.trim().slice(-40)}" is missing`);
  }

  const photos = photoBytes(report);
  const overhead = bytes.length - photos;
  if (overhead > 400_000) fail(name, `${(overhead / 1024).toFixed(0)} KB beyond its photographs`);

  const photoCount = report.observations.reduce((sum, o) => sum + o.photos.length, 0);
  if (failures === before) {
    console.log(`  ✓ ${name}: ${pages.length} pages, ${(bytes.length / 1024 / 1024).toFixed(2)} MB (${photoCount} photographs, ${(overhead / 1024).toFixed(0)} KB besides)`);
  }
}

if (failures) { console.log(`\n${failures} problem(s) in the worst-case PDFs.`); process.exit(1); }
console.log(`\nAll ${Object.keys(cases).length} worst-case PDFs passed.`);
