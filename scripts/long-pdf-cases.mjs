/**
 * Worst-case reports for the PDF checks: what a real site puts in a report
 * rather than tidy sample data. Long notes up to the 10,000-character limit
 * (apps/web/lib/textLimits.ts), long and accented company and person names,
 * many cards and checks, many photographs including tall and very wide ones,
 * typed and drawn signatures, a correction, and a report with almost nothing
 * in it. Used by scripts/verify-long-pdfs.mjs.
 *
 * Photographs are made with sharp from noise, so they compress like real
 * photographs rather than like flat colour, and are put through the same
 * resize and quality the app uses for its PDF copy (lib/imageProcessing.ts).
 */
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const sharp = createRequire(join(root, 'apps/web/package.json'))('sharp');

export const TEXT_MAX = 10_000;

/** A phone photograph of `width`×`height`, as the app's PDF copy of it. */
async function photo(width, height, seed) {
  // Coarse noise blown up and blurred reads (and compresses) like a real scene;
  // a fine grain on top stands in for sensor noise.
  const cw = Math.max(8, Math.round(width / 24)), ch = Math.max(8, Math.round(height / 24));
  let x = seed * 9301 + 49297;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const coarse = Buffer.alloc(cw * ch * 3);
  for (let i = 0; i < coarse.length; i += 1) coarse[i] = 60 + Math.floor(rand() * 150);
  const base = await sharp(coarse, { raw: { width: cw, height: ch, channels: 3 } }).resize(width, height, { kernel: 'cubic' }).blur(2).raw().toBuffer();
  for (let i = 0; i < base.length; i += 1) base[i] = Math.max(0, Math.min(255, base[i] + Math.floor(rand() * 24) - 12));
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${width * 0.04}" y="${Math.min(height, width) * 0.12}" font-size="${Math.round(Math.min(width, height) / 9)}" font-family="sans-serif" fill="#fff">${width}×${height}</text></svg>`);
  const original = await sharp(base, { raw: { width, height, channels: 3 } }).composite([{ input: label }]).jpeg({ quality: 92 }).toBuffer();
  const pdf = await sharp(original).rotate().flatten({ background: '#ffffff' })
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: false }).toBuffer();
  return `data:image/jpeg;base64,${pdf.toString('base64')}`;
}

async function drawnSignature() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <path d="M 30,150 C 80,20 120,180 170,90 S 260,40 300,140 S 420,60 470,120 L 560,100" stroke="#1a1a40" stroke-width="5" fill="none"/></svg>`;
  return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')}`;
}

/** Site prose, repeated in turn until `length` characters, ending on a full stop. */
const PROSE = [
  'Containment to the corridor ceiling void is in and lidded from grid line C to grid line F.',
  'The dry liners have boarded over two back boxes in flat 304 and they will need cutting out again.',
  'Fire stopping is missing around the two 110mm soil pipes where they pass through the slab in riser 2.',
  'Spoke to Siobhán from the main contractor about access to level 4; the scaffold stays until Thursday.',
  'Pressure test on the heating flow and return passed at 6 bar for 30 minutes and the sheet is signed.',
  'The commissioning engineer is booked for the week of 2 November, subject to the controls panel arriving.',
  'Two 110V leads with taped joins were found in the plant room and taken out of use straight away.',
  'Board schedules in flats 301 to 306 are blank; Zoë O’Connor is filling them in from the test sheets.',
];
export function prose(length, start = 0) {
  let text = '';
  for (let i = start; text.length < length; i += 1) text += `${text ? ' ' : ''}${PROSE[i % PROSE.length]}`;
  if (text.length <= length) return text;
  const cut = text.slice(0, length - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}.`.slice(0, length);
}

/** A list typed one line at a time, as a snag list is: many short lines. */
const lines = (count, what) => Array.from({ length: count }, (_, i) => `Flat ${101 + i}: ${what}`).join('\n');

export const LONG_COMPANY = 'Ó Súilleabháin & D’Arcy-Ellingham Mechanical, Electrical and Public Health Building Services (Yorkshire and the Humber) Ltd';
export const LONG_PERSON = 'Siobhán Ní Mhaoldhomhnaigh-O’Shaughnessy';

const project = {
  projectName: 'Tetley Hall Block E – Residential Conversion, Phase 2 (Café Façade & Courtyard Apartments)',
  projectNumber: '011LME',
  clientName: 'Northgate Living (Leeds) Ltd for Brontë Quarter Developments LLP',
  clientAccountNumber: 'NGL-00412-HÔTEL-DE-VILLE',
  visitDate: '2026-10-19',
  author: LONG_PERSON,
};

export async function buildCases() {
  const shapes = {
    landscape: await photo(1600, 1200, 1),
    portrait: await photo(1200, 1600, 2),
    tall: await photo(500, 2000, 3), // a riser photographed top to bottom
    wide: await photo(4000, 600, 4), // a corridor panorama
    square: await photo(1200, 1200, 5),
  };
  const signature = await drawnSignature();
  // Every photograph is its own picture, as on site, so the file size is real.
  const SIZES = { landscape: [1600, 1200], portrait: [1200, 1600], tall: [500, 2000], wide: [4000, 600], square: [1200, 1200] };
  let n = 0;
  const pic = async (shape, caption) => {
    const id = (n += 1);
    const dataUrl = id <= 5 ? shapes[shape] : await photo(...SIZES[shape], id + 10);
    return { id: `p${id}`, dataUrl, caption, capturedAt: '2026-10-19T09:41:00Z' };
  };
  const mixed = (count, start = 0) => Promise.all(Array.from({ length: count }, (_, i) => {
    const shape = ['landscape', 'portrait', 'tall', 'wide', 'square'][(i + start) % 5];
    return pic(shape, i % 4 === 3 ? prose(400, i) : i % 7 === 6 ? '' : `${shape === 'wide' ? 'Corridor panorama' : shape === 'tall' ? 'Riser 2, bottom to top' : 'Flat 30' + (i % 9)}, photograph ${i + 1}`);
  }));
  const card = (id, typeLabel, tone, location, whatHappened, actionNeeded = '', owner = '', photos = []) =>
    ({ id, typeLabel, tone, location, whatHappened, actionNeeded, owner, photos });

  const TYPES = [['Progress update', 'neutral'], ['Defect', 'defect'], ['Variation required', 'variation'], ['Access restriction', 'access']];
  const manyCards = [];
  for (let i = 0; i < 40; i += 1) {
    const [label, tone] = TYPES[i % 4];
    const acts = tone !== 'neutral';
    manyCards.push(card(`m${i}`, label, tone, i % 5 === 2 ? `Level ${i % 6}, flats ${i}01–${i}12, corridor, riser cupboard and the landing outside the lift lobby` : `Level ${i % 6}, flat ${i}0${i % 9}`,
      prose(120 + (i * 97) % 1400, i), acts ? prose(80 + (i * 53) % 400, i + 3) : '', acts ? (i % 3 === 0 ? '' : i % 3 === 1 ? LONG_COMPANY : 'Leodis P&H') : '',
      i % 6 === 0 ? await mixed(i % 12 === 0 ? 5 : 2, i) : []));
  }

  const atLimit = [
    card('x1', 'Defect', 'defect', prose(600, 2), prose(TEXT_MAX, 0), prose(TEXT_MAX, 4), LONG_COMPANY, await mixed(2)),
    card('x2', 'Progress update', 'neutral', 'Riser 2, levels 1 to 6', lines(120, 'sockets loose in the back box, tighten and re-test'), '', '', []),
    card('x3', 'Defect', 'defect', 'Plant room', 'Reference written on the board: DB-L3-A/RISER-02/CIRCUIT-14-SPUR-RCBO-32A-TYPE-A-30MA-CONFIRMED-ON-SITE https://leodis.sharepoint.com/sites/Operations/Shared%20Documents/011LME/Drawings/M-E-L3-RISER-02-REV-C.pdf',
      'Check the reference against the drawing.', prose(TEXT_MAX, 1), []),
    card('x4', 'Variation required', 'variation', LONG_COMPANY, prose(2000, 5), prose(3000, 6), `${LONG_PERSON} for ${LONG_COMPANY}`, []),
    card('x5', 'Progress update', 'neutral', 'Whole building, every floor', prose(300, 7), '', '', await mixed(30)),
    // Every box full, the place too, and a photograph with a caption of the same length.
    card('x6', 'Access restriction', 'access', prose(TEXT_MAX, 3), prose(TEXT_MAX, 5), prose(TEXT_MAX, 6), prose(TEXT_MAX, 7),
      [{ ...(await pic('landscape', '')), caption: prose(TEXT_MAX, 1) }]),
  ];

  const typed = {
    name: LONG_PERSON, signedAt: '2026-07-19T15:32:00Z', typed: true, signedInAs: 'siobhan.ni-mhaoldhomhnaigh-oshaughnessy@leodisdevelopments.onmicrosoft.com',
    statement: 'I carried out this inspection and this record is accurate. Typing my name and ticking this box is my signature.',
  };
  const drawn = { name: LONG_PERSON, signedAt: '2026-10-19T15:32:00Z', dataUrl: signature };

  const QUESTIONS = {
    safety: ['Work areas tidy, waste cleared, walkways clear', 'Safe ways in and out, edges and openings protected', 'Ladders, steps, towers and podiums checked and used safely', 'Temporary supplies, leads and power tools in date and undamaged', 'Isolations locked off and labelled before work on or near live systems', 'Hot works under permit, with a fire extinguisher at hand', 'Fire points and escape routes clear and signed', 'Everyone wearing the right PPE, in good condition', 'Hazardous substances stored, labelled and with COSHH sheets', 'Method statements briefed and signed by everyone on the task', 'Materials and plant stored safely, not blocking routes', 'Welfare facilities clean and available'],
    handover: ['Containment, tray and trunking complete, supported and lidded', 'Pipework and ductwork complete, supported and insulated', 'Fittings and terminals fitted, level and undamaged', 'Holes through fire walls and floors sealed', 'Access panels where valves, dampers and junction boxes need reaching', 'Ceiling voids and risers ready to close', 'Circuits, valves and equipment labelled', 'Electrical tested and pipework pressure tested, with results recorded', 'Systems working: lighting, power, heating, ventilation, water and controls', 'Damage to other trades’ work made good', 'Equipment clean, protective film and packaging removed', 'Certificates and as-fitted details ready for the O&M manual'],
    firstFix: ['First fix complete: cables, pipes and ducts run to every point on the drawings', 'Containment and cables fixed and supported, nothing resting on the ceiling grid', 'Pipework and ductwork supported, jointed and insulated', 'Pipework pressure tested and passed, with the result recorded', 'Soil, waste and condensate pipes tested and falling the right way', 'Cables that will be hidden tested, with results recorded', 'Back boxes, grilles and fittings set out for the finishes', 'Access panels agreed where valves, dampers and junction boxes need reaching', 'Holes through fire walls and floors sealed', 'Our services clear of board fixings and kept in safe zones', 'Hidden services labelled and marked on the drawings', 'Void clear of offcuts, packaging and tools'],
    tower: ['Inspection tag in place and up to date', 'Built by a trained person to the maker’s instructions', 'Standing on firm, level ground or a sound floor', 'Castors locked and adjustable legs set level', 'Stabilisers or outriggers fitted where the instructions need them', 'Frames and braces all fitted, in the right places and locked', 'No damaged parts: nothing bent, cracked, split or worn', 'Platform complete, locked down and level', 'Guardrails and toe boards on the working platform', 'Safe way up on the inside', 'Clear of overhead hazards, edges, openings and traffic', 'Within its height and safe working load'],
  };
  const ANSWER = { ok: 'Satisfactory', action: 'Action needed', na: 'Not applicable', open: 'Not answered' };
  /** Every check failed, with long notes, long actions, long owners and photographs. */
  const worstChecks = (questions, where) => Promise.all(questions.map(async (question, i) => {
    const tone = i === 11 ? 'open' : i === 10 ? 'na' : 'action';
    return {
      id: `c${i}`, typeLabel: 'Inspection check', tone: 'neutral',
      location: where ? (i % 3 === 0 ? `Flats ${i}01–${i}06, corridor and riser cupboard on level ${i}` : `Flat ${i}0${i}`) : '',
      whatHappened: tone === 'action' ? (i === 0 ? prose(TEXT_MAX, i) : i === 1 ? lines(60, 'one penetration not sealed') : prose(200 + i * 350, i)) : '',
      actionNeeded: tone === 'action' ? (i === 2 ? prose(TEXT_MAX, i + 2) : prose(60 + i * 40, i + 1)) : '',
      owner: tone === 'action' ? [LONG_COMPANY, '', 'Leodis Electrical', `${LONG_PERSON}, Apex Fire Protection`][i % 4] : '',
      photos: i % 4 === 0 ? await mixed(i === 4 ? 12 : 3, i) : [],
      check: { question, answer: ANSWER[tone], tone },
    };
  }));
  const inspection = (documentTitle, reference, questions, extra = {}) => ({
    ...project, documentTitle, inspection: true, reference, revision: 1, approved: false, submittedWithoutReview: true, ...extra,
  });

  return {
    'site-update-many': { ...project, reference: '011LME-SPR-104', revision: 1, approved: true, observations: manyCards, signature: drawn },
    'site-update-at-limit': { ...project, reference: '011LME-SPR-105', revision: 1, approved: false, submittedWithoutReview: true, observations: atLimit, signature: typed },
    'site-update-correction': { ...project, reference: '011LME-SPR-104', revision: 3, approved: false, submittedWithoutReview: true,
      correction: { replacesRevision: 2, reason: prose(TEXT_MAX, 3) }, observations: manyCards.slice(0, 3), signature: drawn },
    'site-update-almost-empty': { ...project, projectName: 'A', clientName: '', clientAccountNumber: '', projectNumber: '', reference: '011LME-SPR-106', revision: 1, approved: false,
      observations: [card('e1', 'Progress update', 'neutral', '', '', '', '', [])] },
    'site-update-nothing': { ...project, reference: '011LME-SPR-107', revision: 1, approved: false, observations: [] },
    'safety-inspection': inspection('Site Safety Inspection', '011LME-SSI-103', QUESTIONS.safety, { signature: drawn, observations: await worstChecks(QUESTIONS.safety, false) }),
    'handover-inspection': inspection('Pre-Handover Inspection', '011LME-PHI-101', QUESTIONS.handover, { approved: true, signature: typed, observations: await worstChecks(QUESTIONS.handover, true) }),
    'first-fix-inspection': inspection('First Fix Inspection', '011LME-FFI-102', QUESTIONS.firstFix, { signature: typed, observations: await worstChecks(QUESTIONS.firstFix, true) }),
    'tower-inspection': inspection('Tower and Podium Inspection', '011LME-TPI-101', QUESTIONS.tower, {
      inspected: { label: 'Tower or podium', value: 'T3 – Boss Clima 3T, level 2 east corridor outside flats 201–206, by the café façade scaffold'.slice(0, 120) },
      signature: drawn, observations: await worstChecks(QUESTIONS.tower, false) }),
    'tower-inspection-all-clear': inspection('Tower and Podium Inspection', '011LME-TPI-102', QUESTIONS.tower, {
      inspected: { label: 'Tower or podium', value: 'P1' }, signature: typed,
      observations: QUESTIONS.tower.map((question, i) => ({ id: `t${i}`, typeLabel: 'Inspection check', tone: 'neutral', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], check: { question, answer: 'Satisfactory', tone: 'ok' } })) }),
  };
}
