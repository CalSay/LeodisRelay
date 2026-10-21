#!/usr/bin/env node
/**
 * Renders one PDF of every kind RELAY produces, from realistic sample data, so
 * they can be looked at side by side: a site update with photographs, a draft,
 * one sent without review, a correction, and each inspection type with a drawn
 * or typed signature.
 *
 *     npm run build:packages
 *     node scripts/render-sample-pdfs.mjs <out-dir> [--png]
 *
 * --png also writes page images (needs pdftoppm from poppler-utils).
 * Photographs and the drawn signature are made here with sharp, so the script
 * needs no files. Nothing is stored, filed or sent.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'apps/web/package.json'));
const sharp = require('sharp');
const { renderReportPdf } = await import(pathToFileURL(join(root, 'packages/documents/dist/index.js')).href);

const out = resolve(process.argv[2] ?? 'output/sample-pdfs');
const png = process.argv.includes('--png');
await mkdir(out, { recursive: true });

/** A photograph-shaped image: a soft gradient with a few shapes, as JPEG. */
async function photo(width, height, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},18%,70%)"/><stop offset="1" stop-color="hsl(${hue + 30},14%,32%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="${width * 0.1}" y="${height * 0.55}" width="${width * 0.8}" height="${height * 0.08}" fill="hsl(${hue},10%,22%)"/>
    <circle cx="${width * 0.7}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.12}" fill="hsl(${hue + 180},30%,60%)"/>
    <text x="${width * 0.06}" y="${height * 0.12}" font-size="${Math.round(height / 14)}" font-family="sans-serif" fill="#fff">${width}×${height}</text>
  </svg>`;
  const bytes = await sharp(Buffer.from(svg)).jpeg({ quality: 72 }).toBuffer();
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

async function drawnSignature() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <path d="M 30,150 C 80,20 120,180 170,90 S 260,40 300,140 S 420,60 470,120 L 560,100" stroke="#1a1a40" stroke-width="5" fill="none"/></svg>`;
  return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')}`;
}

const landscape = await photo(1600, 1200, 30);
const portrait = await photo(1200, 1600, 200);
const wide = await photo(1600, 500, 100);
const signature = await drawnSignature();

const project = {
  projectName: 'Tetley Hall Block E',
  projectNumber: '011LME',
  clientName: 'Northgate Living (Leeds) Ltd',
  clientAccountNumber: 'NGL-00412',
  visitDate: '2026-10-19',
  author: 'Sam Patel',
};

let n = 0;
const pic = (dataUrl, caption) => ({ id: `p${++n}`, dataUrl, caption, capturedAt: '2026-10-19T09:41:00Z' });
const card = (id, typeLabel, tone, location, whatHappened, actionNeeded = '', owner = '', photos = []) =>
  ({ id, typeLabel, tone, location, whatHappened, actionNeeded, owner, photos });

const siteCards = [
  card('o1', 'Progress update', 'neutral', 'Level 3, flats 301–306',
    'First fix electrics complete in all six flats. Containment to the corridor ceiling void is in and lidded. Ready for the dry liners from Wednesday.',
    '', '', [pic(landscape, 'Flat 303 kitchen, first fix complete'), pic(portrait, 'Corridor containment, looking north'), pic(wide, 'Riser 2 from the landing')]),
  card('o2', 'Defect', 'defect', 'Level 2 riser cupboard',
    'Fire stopping missing around the two 110mm soil pipes where they pass through the slab. The collars have been delivered but not fitted. This needs doing before the riser door is hung on Friday, otherwise the door will have to come off again to reach it.',
    'Fit the intumescent collars and seal round both pipes, then label the penetrations.', 'Apex Fire Protection', [pic(portrait, 'Both pipes through the slab, no collars')]),
  card('o3', 'Variation required', 'variation', 'Ground floor, bin store',
    'Client asked for two extra external-grade sockets on the bin store wall for the compactor. Not on the drawings.',
    'Instruction needed before we fit them.', ''),
  card('o4', 'Access restriction', 'access', 'Level 4',
    'Scaffold boarded out across the stair core. No access to flats 401–404 until Thursday.',
    'Confirm when the scaffold comes down.', 'Main contractor site manager'),
  card('o5', 'Progress update', 'neutral', 'Plant room',
    'Boiler flue route agreed with the structural engineer on site. Reference DB-L3-A/RISER-02/CIRCUIT-14-SPUR-RCBO-32A-TYPE-A-30MA-CONFIRMED-ON-SITE-WITH-ELECTRICAL-DESIGNER-2026-10-19 written on the board. ' +
    'The commissioning engineer is booked for the week of 2 November. Gas meter is in and the supply is capped. Pressure test on the heating flow and return passed at 6 bar for 30 minutes and the sheet is signed. ' +
    'Pumps are on their bases but not wired. Controls panel arrives on Tuesday. '.repeat(3),
    '', '', [pic(landscape, 'Plant room from the door'), pic(landscape, 'Pressure test gauge at 6 bar'), pic(portrait, 'Gas meter, capped'), pic(landscape, 'Pump bases')]),
  card('o6', 'Defect', 'defect', 'Flat 206 bathroom',
    'Shower valve fitted 150mm too low against the tiling drawing.', 'Move the valve up to 1100mm before tiling.', 'Leodis P&H', [pic(landscape, 'Valve height measured at 950mm')]),
];

const checks = (list, answers) => list.map(([item, question], i) => {
  const a = answers[i] ?? ['ok'];
  const tone = a[0];
  const answer = tone === 'ok' ? 'Satisfactory' : tone === 'action' ? 'Action needed' : 'Not applicable';
  return { id: `c-${item}`, typeLabel: 'Inspection check', tone: 'neutral', location: a[1] ?? '', whatHappened: a[2] ?? '', actionNeeded: a[3] ?? '', owner: a[4] ?? '', photos: a[5] ?? [],
    check: { question, answer, tone } };
});

const SAFETY = [['housekeeping', 'Work areas tidy, waste cleared, walkways clear'], ['access', 'Safe ways in and out, edges and openings protected'], ['height', 'Ladders, steps, towers and podiums checked and used safely'], ['electrical', 'Temporary supplies, leads and power tools in date and undamaged'], ['isolation', 'Isolations locked off and labelled before work on or near live systems'], ['hot-works', 'Hot works under permit, with a fire extinguisher at hand'], ['fire', 'Fire points and escape routes clear and signed'], ['ppe', 'Everyone wearing the right PPE, in good condition'], ['substances', 'Hazardous substances stored, labelled and with COSHH sheets'], ['rams', 'Method statements briefed and signed by everyone on the task'], ['storage', 'Materials and plant stored safely, not blocking routes'], ['welfare', 'Welfare facilities clean and available']];
const HANDOVER = [['containment', 'Containment, tray and trunking complete, supported and lidded'], ['pipework', 'Pipework and ductwork complete, supported and insulated'], ['fittings', 'Fittings and terminals fitted, level and undamaged'], ['fire-stopping', 'Holes through fire walls and floors sealed'], ['access-panels', 'Access panels where valves, dampers and junction boxes need reaching'], ['ceiling-void', 'Ceiling voids and risers ready to close'], ['labelling', 'Circuits, valves and equipment labelled'], ['testing', 'Electrical tested and pipework pressure tested, with results recorded'], ['commissioning', 'Systems working: lighting, power, heating, ventilation, water and controls'], ['making-good', 'Damage to other trades’ work made good'], ['clean', 'Equipment clean, protective film and packaging removed'], ['paperwork', 'Certificates and as-fitted details ready for the O&M manual']];
const FIRST_FIX = [['first-fix', 'First fix complete: cables, pipes and ducts run to every point on the drawings'], ['containment', 'Containment and cables fixed and supported, nothing resting on the ceiling grid'], ['pipework', 'Pipework and ductwork supported, jointed and insulated'], ['pressure-test', 'Pipework pressure tested and passed, with the result recorded'], ['drainage', 'Soil, waste and condensate pipes tested and falling the right way'], ['electrical-test', 'Cables that will be hidden tested, with results recorded'], ['positions', 'Back boxes, grilles and fittings set out for the finishes'], ['access', 'Access panels agreed where valves, dampers and junction boxes need reaching'], ['fire-stopping', 'Holes through fire walls and floors sealed'], ['protected', 'Our services clear of board fixings and kept in safe zones'], ['labelling', 'Hidden services labelled and marked on the drawings'], ['clear', 'Void clear of offcuts, packaging and tools']];

const TOWER = [['tag', 'Inspection tag in place and up to date'], ['built', 'Built by a trained person to the maker’s instructions'], ['ground', 'Standing on firm, level ground or a sound floor'], ['base', 'Castors locked and adjustable legs set level'], ['stabilisers', 'Stabilisers or outriggers fitted where the instructions need them'], ['braces', 'Frames and braces all fitted, in the right places and locked'], ['components', 'No damaged parts: nothing bent, cracked, split or worn'], ['platform', 'Platform complete, locked down and level'], ['guardrails', 'Guardrails and toe boards on the working platform'], ['access', 'Safe way up on the inside'], ['surroundings', 'Clear of overhead hazards, edges, openings and traffic'], ['loading', 'Within its height and safe working load']];

const typed = {
  name: 'Sam Patel', signedAt: '2026-10-19T15:32:00Z', typed: true, signedInAs: 'sam.patel@leodis.example',
  statement: 'I carried out this inspection and this record is accurate. Typing my name and ticking this box is my signature.',
};
const drawn = { name: 'Sam Patel', signedAt: '2026-10-19T15:32:00Z', dataUrl: signature };

const samples = {
  'site-update': { ...project, reference: '011LME-SPR-004', revision: 1, approved: true, observations: siteCards, signature: drawn },
  'site-update-draft': { ...project, reference: '011LME-SPR-005', revision: 1, approved: false, observations: siteCards.slice(0, 2) },
  'site-update-no-review': { ...project, reference: '011LME-SPR-006', revision: 1, approved: false, submittedWithoutReview: true, observations: siteCards.slice(2, 4), signature: { name: 'Sam Patel', signedAt: '2026-10-19T15:32:00Z' } },
  'site-update-correction': { ...project, reference: '011LME-SPR-004', revision: 2, approved: false, submittedWithoutReview: true,
    correction: { reason: 'Defect in the riser was on level 2, not level 3, and the owner was wrong.', replacesRevision: 1 },
    observations: siteCards.slice(1, 2), signature: drawn },
  'safety-inspection': { ...project, documentTitle: 'Site Safety Inspection', inspection: true, reference: '011LME-SSI-003', revision: 1, approved: false, submittedWithoutReview: true, signature: drawn,
    observations: checks(SAFETY, [['ok'], ['action', 'Level 4 stair core', 'Open edge at the top of the stair with no handrail; a single strap across it.', 'Fit a proper edge barrier before anyone works on level 4.', 'Main contractor site manager', [pic(portrait, 'Strap across the open edge')]], ['ok'], ['action', '', 'Two 110V leads with taped joins in the plant room.', 'Take both out of use and replace them today.', 'Leodis Electrical'], ['ok'], ['na'], ['ok', '', 'Fire point on level 2 moved by the dry liners; now back in place.'], ['ok'], ['na'], ['ok'], ['ok'], ['ok']]) },
  'handover-inspection': { ...project, documentTitle: 'Pre-Handover Inspection', inspection: true, reference: '011LME-PHI-001', revision: 1, approved: true, signature: typed,
    observations: checks(HANDOVER, [['ok'], ['ok'], ['action', 'Flat 304 bedroom', 'Two sockets loose in the back box.', 'Tighten and re-test both sockets.', 'Leodis Electrical', [pic(landscape, 'Socket pulled away from the wall')]], ['action', 'Riser 2, level 3', 'One penetration not sealed.', 'Seal and label.', ''], ['ok'], ['ok'], ['action', 'Flats 301–306 consumer units', 'Board schedules blank.', 'Fill in the circuit schedules.', 'Leodis Electrical'], ['ok'], ['ok'], ['na'], ['ok'], ['ok']]) },
  'first-fix-inspection': { ...project, documentTitle: 'First Fix Inspection', inspection: true, reference: '011LME-FFI-002', revision: 1, approved: false, submittedWithoutReview: true, signature: typed,
    observations: checks(FIRST_FIX, Array.from({ length: 12 }, () => ['ok'])) },
  'tower-inspection': { ...project, documentTitle: 'Tower and Podium Inspection', inspection: true, inspected: { label: 'Tower or podium', value: 'T3, level 2 east corridor' }, reference: '011LME-TPI-001', revision: 1, approved: false, submittedWithoutReview: true, signature: drawn,
    observations: checks(TOWER, [['ok'], ['ok'], ['ok'], ['action', '', 'One castor brake will not lock.', 'Tag it out of use until the castor is replaced.', 'Leodis Electrical', [pic(landscape, 'Castor brake on the north-east leg')]], ['na'], ['ok'], ['ok'], ['ok'], ['action', '', 'Toe board missing on the south side.', 'Fit the toe board before anyone goes up.', ''], ['ok'], ['ok'], ['ok']]) },
};

for (const [name, report] of Object.entries(samples)) {
  const bytes = await renderReportPdf(report);
  const file = join(out, `${name}.pdf`);
  await writeFile(file, bytes);
  if (png) execFileSync('pdftoppm', ['-png', '-r', '60', file, join(out, name)]);
  console.log(`${name}.pdf`);
}
