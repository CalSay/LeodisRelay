/**
 * Compliance Management sample model.
 *
 * Everything the Compliance workspace shows comes from here. It is invented,
 * seeded data — five clients, fourteen buildings, a few hundred assets with
 * service histories — generated deterministically so the same morning replays
 * on every load. Nothing persists: this is a prototype of the screens, not a
 * compliance record. When a real store exists it replaces this module, and the
 * views keep the same shapes.
 *
 * Dates are anchored to the real day the page opens, so "today" is always
 * today. The regime itself — requirement, standard, interval — is a plausible
 * reading of UK practice and must be confirmed with Leodis before it drives
 * anything.
 */

/* ------------------------------------------------------------------ dates */
export const pad = (n: number): string => String(n).padStart(2, '0');
export const pad3 = (n: number): string => String(n).padStart(3, '0');
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const TODAY: Date = startOfDay(new Date());
const MS = 864e5;
export const dayDiff = (a: Date, b: Date): number => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS);
export const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d: Date, m: number): Date => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
export const fmt = (d: Date | null | undefined): string => d ? `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}` : '—';
export const fmtS = (d: Date | null | undefined): string => d ? `${pad(d.getDate())} ${MON[d.getMonth()]}` : '—';
export const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1); };
export const longDate = (d: Date): string => `${DAYL[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
export const plural = (n: number, one: string, many?: string): string => `${n} ${n === 1 ? one : (many ?? one + 's')}`;
/** Monday of the current week. */
export const MONDAY: Date = addDays(TODAY, -((TODAY.getDay() + 6) % 7));

let seed = 20260908;
const R = (): number => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = <T,>(a: readonly T[]): T => a[Math.floor(R() * a.length)] as T;
const ri = (a: number, b: number): number => a + Math.floor(R() * (b - a + 1));

/* -------------------------------------------------------------- reference */
export type EngineerId = 'RA' | 'JW' | 'DP' | 'SK' | 'TB' | 'CS';
export interface Engineer { id: EngineerId; name: string; full: string; trades: string[]; gasSafe?: string; role?: string }
export const ENG: Record<EngineerId, Engineer> = {
  RA: { id: 'RA', name: 'R. Ashworth', full: 'Rachel Ashworth', trades: ['Fire alarm', 'Emergency lighting', 'Fire doors', 'Smoke control'] },
  JW: { id: 'JW', name: 'J. Whitaker', full: 'James Whitaker', trades: ['Gas', 'HVAC'], gasSafe: '5467213' },
  DP: { id: 'DP', name: 'D. Priestley', full: 'Dan Priestley', trades: ['Electrical', 'Emergency lighting', 'Lightning protection', 'Fire alarm'] },
  SK: { id: 'SK', name: 'S. Kaur', full: 'Simran Kaur', trades: ['Water hygiene'] },
  TB: { id: 'TB', name: 'T. Bright', full: 'Tom Bright', trades: ['Lifts', 'Smoke control', 'Extinguishers', 'HVAC'] },
  CS: { id: 'CS', name: 'Cal Say', full: 'Cal Say', trades: ['Fire doors', 'Extinguishers'], role: 'Compliance manager' },
};
export const ENGINEERS: Engineer[] = Object.values(ENG);
export const engineersFor = (trade: string): Engineer[] => { const l = ENGINEERS.filter(e => e.trades.includes(trade)); return l.length ? l : ENGINEERS; };
export const engName = (id: EngineerId | null | undefined): string => id && ENG[id] ? ENG[id].name : '—';
/** Which sample engineer a signed-in Relay trade maps to. */
export const engineerForTrade = (trade?: string): EngineerId => trade === 'HVAC' ? 'JW' : trade === 'P&H' ? 'SK' : trade === 'Electrical' ? 'DP' : 'RA';

export type RType = 'SVR' | 'CERT' | 'RA' | 'TER';
export const RTYPES: Record<RType, string> = { SVR: 'Service report', CERT: 'Certificate', RA: 'Risk assessment', TER: 'Thorough examination' };
export type CatId = 'FA' | 'EL' | 'EX' | 'FD' | 'GS' | 'EI' | 'WH' | 'LF' | 'SC' | 'LP' | 'AC';
export interface Cat { label: string; req: string; std: string; months: number; group: string; trade: string; rtype: RType; unit: string }
export const CATS: Record<CatId, Cat> = {
  FA: { label: 'Fire alarm', req: 'Service visit', std: 'BS 5839-1', months: 6, group: 'Fire & life safety', trade: 'Fire alarm', rtype: 'SVR', unit: 'panel' },
  EL: { label: 'Emergency lighting', req: 'Annual duration test', std: 'BS 5266-1', months: 12, group: 'Fire & life safety', trade: 'Emergency lighting', rtype: 'SVR', unit: 'system' },
  EX: { label: 'Extinguishers', req: 'Annual service', std: 'BS 5306-3', months: 12, group: 'Fire & life safety', trade: 'Extinguishers', rtype: 'SVR', unit: 'unit' },
  FD: { label: 'Fire doors', req: 'Quarterly check', std: 'Fire Safety (England) Regs 2022', months: 3, group: 'Fire & life safety', trade: 'Fire doors', rtype: 'SVR', unit: 'door' },
  GS: { label: 'Gas safety', req: 'Gas safety inspection', std: 'CP17 · Gas Safety Regs 1998', months: 12, group: 'Gas & electrical', trade: 'Gas', rtype: 'CERT', unit: 'appliance' },
  EI: { label: 'Electrical', req: 'Periodic inspection (EICR)', std: 'BS 7671', months: 60, group: 'Gas & electrical', trade: 'Electrical', rtype: 'CERT', unit: 'installation' },
  WH: { label: 'Water hygiene', req: 'Legionella risk assessment', std: 'ACoP L8 · HSG274', months: 24, group: 'Water & plant', trade: 'Water hygiene', rtype: 'RA', unit: 'system' },
  LF: { label: 'Lifts', req: 'Thorough examination', std: 'LOLER 1998', months: 6, group: 'Water & plant', trade: 'Lifts', rtype: 'TER', unit: 'lift' },
  SC: { label: 'Smoke control', req: 'Annual service', std: 'BS 7346-8', months: 12, group: 'Fire & life safety', trade: 'Smoke control', rtype: 'SVR', unit: 'vent' },
  LP: { label: 'Lightning protection', req: 'Annual test', std: 'BS EN 62305', months: 12, group: 'Gas & electrical', trade: 'Lightning protection', rtype: 'CERT', unit: 'system' },
  AC: { label: 'Air conditioning', req: 'F-gas leak check', std: 'F-gas Regs 2015', months: 12, group: 'Water & plant', trade: 'HVAC', rtype: 'SVR', unit: 'system' },
};
export const CAT_IDS = Object.keys(CATS) as CatId[];
export const intervalWord = (months: number): string => months >= 12 ? (months === 12 ? 'annual' : `${months / 12}-yearly`) : `${months}-monthly`;

export interface Client { code: string; name: string; contact: string; role: string; email: string; since: number }
export const CLIENTS: Client[] = [
  { code: 'NBE', name: 'Northbrook Estates', contact: 'Sam Ledgard', role: 'Portfolio manager', email: 's.ledgard@northbrook.example', since: 2019 },
  { code: 'AVH', name: 'Aire Valley Housing', contact: 'M. Okafor', role: 'Housing compliance lead', email: 'm.okafor@airevalley.example', since: 2021 },
  { code: 'HPT', name: 'Headrow Property Trust', contact: 'Priya Nair', role: 'Estates director', email: 'p.nair@headrowpt.example', since: 2020 },
  { code: 'SCA', name: "St Chad's Academy Trust", contact: 'Helen Marsh', role: 'Head of estates', email: 'h.marsh@stchads.example', since: 2024 },
  { code: 'MFL', name: 'Marshall Facilities', contact: 'Tom Barlow', role: 'Facilities manager', email: 't.barlow@marshallfm.example', since: 2022 },
];
export const CL: Record<string, Client> = Object.fromEntries(CLIENTS.map(c => [c.code, c]));

export interface Site { addr: string; parking: string; access: string; route: string; phone: string; hours: string }
export const SITE: Record<string, Site> = {
  WP3: { addr: '3 Wellington Place, Leeds LS1 4AP', parking: 'Visitor bays, car park B off Whitehall Road — book via A. Fenton the day before', access: 'Sign in at reception for a contractor pass. Plant room keys from security desk; return before leaving.', route: 'Roof plant via core B lift to 6, then the plant stair. Permit to work for hot works only.', phone: '0113 496 0331', hours: '07:00–19:00 weekdays' },
  KR4: { addr: 'Unit 4, Kirkstall Retail Park, Kirkstall Road, Leeds LS4 2AT', parking: 'Customer car park; use the bays nearest the goods-in door', access: 'Report to the back-of-house door and ask for the duty manager. No pass needed.', route: 'Plant room is off the warehouse behind the roller door. Lift motor room via the mezzanine stair.', phone: '0113 496 0418', hours: 'Store hours 08:00–20:00; plant work before 10:00 preferred' },
  GWO: { addr: 'Granary Wharf Offices, Wharf Approach, Leeds LS1 4BR', parking: 'No parking on the wharf. Use Granary Wharf multi-storey (paid); claim on expenses', access: 'Reception on the ground floor. Ask for R. Malik; roof access needs the roof key and a second person present.', route: 'AOV at stair 1 head — roof hatch above the 4th floor landing.', phone: '0113 496 0522', hours: '08:00–18:00 weekdays' },
  ARC: { addr: 'Aire Court, Goodman Street, Hunslet, Leeds LS10 1NZ', parking: 'Residents’ car park — use the two visitor bays by the bin store, display the Leodis card', access: 'Key safe by the main entrance; code from the office. M. Okafor visits Tuesdays and Thursdays.', route: 'Panel in the ground floor plant cupboard, left of the lobby. Repeater in the lobby. Flat entrance doors need a knock first — tenants are in during the day.', phone: '0113 496 0207', hours: 'Communal areas any time; flat doors 09:30–16:00' },
  BFH: { addr: 'Bramley Fall House, Fall Lane, Bramley, Leeds LS13 3JH', parking: 'Staff car park at the rear; the scheme manager will open the gate', access: 'Ring the office bell. L. Grant on site 08:00–16:00. Residents are elderly — announce yourself in the lounge.', route: 'Plant room off the laundry. Lift motor room key on the office board.', phone: '0113 496 0644', hours: '08:00–16:00' },
  KLG: { addr: 'Kirkstall Lodge, Abbey Road, Leeds LS5 3NA', parking: 'On-street on Abbey Road; avoid the school run 15:00–15:45', access: 'Key safe by the door, code from the office. No one on site — call M. Okafor if anything is unexpected.', route: 'Panel in the entrance hall. Central battery unit in the plant cupboard under the stair.', phone: '0113 496 0207', hours: 'Any time; be out by 17:00 for residents' },
  HRC: { addr: 'Headrow Chambers, 34 The Headrow, Leeds LS1 8EQ', parking: 'None. Nearest is the Q-Park on Albion Street. Loading bay on Cookridge Street, 20 min max', access: 'Porters’ lodge, ground floor. Contractor sign-in and permit; G. Pollard holds keys to all risers.', route: 'Listed building — nothing fixed to the plaster without asking. Emergency lighting test switches are in each riser cupboard.', phone: '0113 496 0790', hours: '07:30–18:30 weekdays' },
  PRH: { addr: 'Park Row House, 19 Park Row, Leeds LS1 5JF', parking: 'Loading bay behind the building off Bond Court, 30 min', access: 'Reception; J. Cole issues the roof key. Two-person rule on the roof.', route: 'Boilers and VRF on the roof via the goods lift to 7 then the plant stair.', phone: '0113 496 0803', hours: '07:30–18:00 weekdays' },
  APA: { addr: 'Albion Place Arcade, Albion Place, Leeds LS1 6JL', parking: 'Q-Park Albion Street. Trolley from the van via the Briggate entrance', access: 'Management suite above unit 9. F. Hughes on site; service corridor key from the centre office.', route: 'Roof vents via the service stair at the Briggate end.', phone: '0113 496 0866', hours: 'Arcade opens 09:00; plant work before then' },
  SCP: { addr: "St Chad's Primary School, Otley Road, Far Headingley, Leeds LS16 5JT", parking: 'Staff car park; visitor bays by the main office', access: 'Main office for a visitor badge and DBS check. B. Aldridge escorts in teaching hours.', route: 'Boiler house is the detached block behind the KS1 building. Water tank in the roof void via the caretaker’s hatch.', phone: '0113 496 0912', hours: 'Term time: before 08:30, after 15:30 or by arrangement' },
  CGA: { addr: 'Cross Gates Academy, Poole Road, Cross Gates, Leeds LS15 7LQ', parking: 'Visitor bays at the front; sign in at reception', access: 'Reception badge and DBS check. N. Osei escorts; radio channel 3.', route: 'Boiler house behind the sports hall. Platform lift in the teaching block, key from estates.', phone: '0113 496 0955', hours: 'Term time: before 08:30, after 15:30' },
  SGP: { addr: 'Seacroft Grange Primary, Brooklands View, Leeds LS14 6SA', parking: 'Staff car park off Brooklands View', access: 'Main office badge. P. Walsh holds all keys; he starts at 06:30.', route: 'Boiler room at the end of the main corridor. Roof void via the hall store.', phone: '0113 496 0977', hours: 'Term time: before 08:30, after 15:30' },
  HDP: { addr: 'Hunslet Depot, Balm Road, Hunslet, Leeds LS10 2TP', parking: 'Anywhere in the yard clear of the loading bays', access: 'Gatehouse sign-in; hi-vis and boots on site. T. Barlow in the depot office.', route: 'Workshop bays 1–6 from the yard. Heaters are high level — MEWP available from the depot with 24 h notice.', phone: '0113 496 0123', hours: '06:00–18:00 weekdays' },
  LDW: { addr: 'Leeds Dock Warehouse, Armouries Way, Leeds LS10 1LE', parking: 'Yard, by the goods-in office', access: 'Goods-in office; O. Brennan. Warehouse floor needs hi-vis; forklifts operating.', route: 'Roof vents via the fixed ladder at the north end. Harness required.', phone: '0113 496 0177', hours: '07:00–19:00' },
};
const codeSum = (s: string): number => [...s].reduce((n, c) => n + c.charCodeAt(0), 0);
export const driveMin = (from: string | null, to: string): number => from === null ? 9 + (codeSum(to) % 22) : from === to ? 0 : 9 + ((codeSum(from) * 7 + codeSum(to) * 13) % 26);
export const miles = (min: number): string => (min * 0.36).toFixed(1);
export const mapsUrl = (code: string): string => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SITE[code]?.addr ?? code)}`;

/* ------------------------------------------------------------ building spec */
type Profile = { ok: number; soon: number; late: number; none: number };
const PROF: Record<string, Profile> = {
  office: { ok: .82, soon: .12, late: .02, none: .04 }, resi: { ok: .72, soon: .12, late: .05, none: .11 },
  school: { ok: .70, soon: .10, late: .04, none: .16 }, tidy: { ok: .90, soon: .10, late: 0, none: 0 },
};
interface HistSpec { daysAgo: number; eng: EngineerId; result: 'pass' | 'fault'; notes: string }
interface Spec {
  cat: CatId; n: number; name: string | ((i: number) => string); make: string; loc: string | ((i: number) => string);
  /** Days since the last service (negative = never). Omit for a seeded random spread. */
  lastDaysAgo?: number | null; grp?: boolean; seq?: number; instYearsAgo?: number; wy?: number; wnote?: string;
  /** Warranty end as days from today, when the story needs a particular date. */
  wEndIn?: number;
  serial?: (i: number) => string; battDays?: number; hist?: HistSpec[];
}
const S = (cat: CatId, n: number, name: Spec['name'], make: string, loc: Spec['loc'], o?: Partial<Spec>): Spec => ({ cat, n, name, make, loc, ...o });
/** Last-service offset that puts the next due date `daysFromNow` days away. */
const dueIn = (cat: CatId, daysFromNow: number): number => -dayDiff(addMonths(addDays(TODAY, daysFromNow), -CATS[cat].months), TODAY);
export interface Building { code: string; client: string; name: string; kind: string; rp: string; prof: string; specs: Spec[] }
export const BUILDINGS: Building[] = [
  { code: 'WP3', client: 'NBE', name: 'Wellington Place — Block 3', kind: 'Offices · 6 floors', rp: 'Building manager: A. Fenton', prof: 'office', specs: [
    S('FA', 1, 'Fire alarm panel', 'Gent Vigilon · 2 loop', 'Ground floor reception', { instYearsAgo: 7, wy: 5 }),
    S('EL', 1, 'Emergency lighting — 120 luminaires', 'Self-contained LED', 'All floors'),
    S('EX', 18, 'Extinguishers', 'Mixed CO₂ / foam / water', 'Fire points, all floors', { grp: true }),
    S('GS', 3, i => `Gas boiler ${i}`, 'Remeha Quinta Ace 115', 'Roof plant room', { lastDaysAgo: dueIn('GS', 22), instYearsAgo: 5, wy: 5, wEndIn: 34, serial: i => `RQA115-21-0883${i}` }),
    S('EI', 1, 'Electrical installation', 'TP&N · 6 distribution boards', 'Basement switchroom', { lastDaysAgo: 820 }),
    S('WH', 1, 'Domestic water system', 'CWS tanks ×2 · calorifier', 'Roof plant room'),
    S('LF', 2, i => `Passenger lift ${i}`, 'Otis Gen2', i => `Core ${'AB'[i - 1]}`, { instYearsAgo: 7, wy: 2 }),
    S('SC', 1, 'AOV — stair 1 head', 'Colt actuator', 'Stair 1'),
    S('LP', 1, 'Lightning protection system', 'Copper tape · 8 down conductors', 'Roof'),
    S('AC', 2, i => `VRF system — floors ${i === 1 ? '1–3' : '4–6'}`, 'Daikin VRV IV', 'Roof', { instYearsAgo: 7, wy: 5 }),
  ] },
  { code: 'KR4', client: 'NBE', name: 'Kirkstall Retail Park — Unit 4', kind: 'Retail · warehouse & plant room', rp: 'Store manager: K. Dhillon', prof: 'office', specs: [
    S('FA', 1, 'Fire alarm panel', 'Kentec Syncro', 'Back-of-house corridor'),
    S('EL', 1, 'Emergency lighting — 38 luminaires', 'Self-contained LED', 'Sales floor & warehouse'),
    S('EX', 9, 'Extinguishers', 'CO₂ / foam', 'Fire points', { grp: true }),
    S('GS', 1, 'Gas heater — warehouse', 'Powrmatic NVx', 'Warehouse'),
    S('EI', 1, 'Electrical installation', 'TP&N · 3 boards', 'Plant room', { lastDaysAgo: 1300 }),
    S('WH', 1, 'Domestic water system', 'Mains-fed · point-of-use heaters', 'Staff area'),
    S('LF', 1, 'Passenger lift', 'Kone MonoSpace', 'Mezzanine core', { lastDaysAgo: dueIn('LF', 14), instYearsAgo: 8, wy: 2 }),
  ] },
  { code: 'GWO', client: 'NBE', name: 'Granary Wharf Offices', kind: 'Offices · 4 floors', rp: 'Facilities: R. Malik', prof: 'office', specs: [
    S('FA', 1, 'Fire alarm panel', 'Advanced MxPro 5', 'Reception'),
    S('EL', 1, 'Emergency lighting — 76 luminaires', 'Self-contained LED', 'All floors'),
    S('EX', 14, 'Extinguishers', 'Mixed', 'Fire points', { grp: true }),
    S('EI', 1, 'Electrical installation', 'TP&N · 4 boards', 'Basement', { lastDaysAgo: 1430 }),
    S('WH', 1, 'Domestic water system', 'CWS tank · calorifier', 'Roof plant'),
    S('LF', 1, 'Passenger lift', 'Schindler 3300', 'Main core', { instYearsAgo: 9, wy: 2 }),
    S('SC', 1, 'AOV — stair head', 'Colt actuator', 'Stair 1', { lastDaysAgo: dueIn('SC', -28), instYearsAgo: 5, wy: 5, wEndIn: -8, wnote: 'Actuator' }),
    S('LP', 1, 'Lightning protection system', 'Copper tape · 6 down conductors', 'Roof'),
    S('AC', 1, 'VRF system', 'Mitsubishi City Multi', 'Roof', { instYearsAgo: 6, wy: 5 }),
  ] },
  { code: 'ARC', client: 'AVH', name: 'Aire Court, Hunslet', kind: 'Residential · 36 flats · 5 storeys', rp: 'Responsible person: M. Okafor', prof: 'resi', specs: [
    S('FA', 1, 'Fire alarm panel', 'Advanced MxPro 5 · 4 loop', 'Ground floor plant cupboard', { lastDaysAgo: dueIn('FA', -6), instYearsAgo: 3, wy: 5, wEndIn: 552, wnote: 'Panel', serial: () => 'MX5-0417-2231', battDays: 56, hist: [
      { daysAgo: dueIn('FA', -6), eng: 'RA', result: 'pass', notes: 'Six-monthly service. All zones tested; 2 optical detectors replaced on loop 3; batteries load-tested OK; event log cleared.' },
      { daysAgo: dueIn('FA', -6) + 182, eng: 'RA', result: 'pass', notes: 'Six-monthly service. No faults. Cause-and-effect checked against AOV interface.' },
      { daysAgo: dueIn('FA', -6) + 364, eng: 'DP', result: 'fault', notes: 'Sounder fault on level 2 corridor circuit. Isolated and remedial raised; closed eight days later after cable repair.' },
      { daysAgo: dueIn('FA', -6) + 547, eng: 'RA', result: 'pass', notes: 'Six-monthly service. No faults.' },
    ] }),
    S('FA', 1, 'Repeater panel', 'Advanced MxPro 5 repeater', 'Entrance lobby', { seq: 2, lastDaysAgo: dueIn('FA', -6), instYearsAgo: 3, wy: 5 }),
    S('EL', 1, 'Emergency lighting — communal, 42 luminaires', 'Self-contained LED', 'Corridors & stairs', { lastDaysAgo: dueIn('EL', 50) }),
    S('EX', 6, 'Extinguishers', 'Water mist', 'Plant & bin stores', { grp: true, lastDaysAgo: dueIn('EX', 157) }),
    S('FD', 36, i => `Flat ${i} entrance`, 'FD30S · timber', i => `Floor ${Math.floor((i - 1) / 8)}`, { grp: true, lastDaysAgo: 4, hist: [
      { daysAgo: 4, eng: 'RA', result: 'fault', notes: '36 flat entrance doors inspected. Three fail to self-close from 45°: flats 7, 19 and 31. Closers need adjustment or replacement. Remedial raised. All others: strips, seals and gaps satisfactory.' },
      { daysAgo: 95, eng: 'CS', result: 'pass', notes: '36 doors inspected. All self-close and latch; intumescent strips and cold smoke seals intact; gaps within 3–4 mm.' },
      { daysAgo: 186, eng: 'CS', result: 'pass', notes: '36 doors inspected. One damaged cold smoke seal (flat 22) replaced on the day.' },
    ] }),
    S('GS', 1, 'Communal heating plant', 'Ideal Evomax 2 ×2', 'Ground floor plant room', { lastDaysAgo: dueIn('GS', 208), instYearsAgo: 8, wy: 5 }),
    S('EI', 1, 'Electrical installation — landlord supplies', 'Landlord DB · 3 boards', 'Meter room', { lastDaysAgo: 728 }),
    S('WH', 1, 'Cold water storage — roof tank', 'GRP sectional tank · 4,000 L', 'Roof tank room', { lastDaysAgo: dueIn('WH', -24) }),
    S('SC', 2, i => `AOV — stair ${i} head`, 'Unknown actuator', i => `Stair ${i}`, { lastDaysAgo: null }),
  ] },
  { code: 'BFH', client: 'AVH', name: 'Bramley Fall House', kind: 'Sheltered housing · 24 units', rp: 'Scheme manager: L. Grant', prof: 'resi', specs: [
    S('FA', 1, 'Fire alarm panel', 'C-TEC XFP', 'Office', { lastDaysAgo: 112 }),
    S('EL', 1, 'Emergency lighting — 31 luminaires', 'Self-contained LED', 'Corridors', { lastDaysAgo: dueIn('EL', 25) }),
    S('EX', 5, 'Extinguishers', 'Water mist', 'Corridors', { grp: true }),
    S('FD', 24, i => `Flat ${i} entrance`, 'FD30S · timber', i => `Floor ${Math.floor((i - 1) / 12)}`, { grp: true, lastDaysAgo: dueIn('FD', 28) }),
    S('GS', 1, 'Communal boiler', 'Worcester GB162', 'Plant room', { lastDaysAgo: 109, instYearsAgo: 6, wy: 7 }),
    S('EI', 1, 'Electrical installation — landlord', 'Landlord DB', 'Meter cupboard', { lastDaysAgo: 600 }),
    S('WH', 1, 'Domestic water system', 'CWS tank · calorifier', 'Plant room', { lastDaysAgo: 282 }),
    S('LF', 1, 'Passenger lift', 'Stannah · traction', 'Main stair', { instYearsAgo: 10, wy: 1 }),
    S('SC', 1, 'AOV — stair head', 'Unknown', 'Main stair', { lastDaysAgo: null }),
  ] },
  { code: 'KLG', client: 'AVH', name: 'Kirkstall Lodge', kind: 'Residential · 18 flats · 3 storeys', rp: 'Responsible person: M. Okafor', prof: 'resi', specs: [
    S('FA', 1, 'Fire alarm panel', 'C-TEC CFP', 'Entrance'),
    S('EL', 1, 'Emergency lighting — central battery', 'Central battery unit · 22 luminaires', 'Plant cupboard'),
    S('EX', 4, 'Extinguishers', 'Water mist', 'Corridors', { grp: true }),
    S('FD', 18, i => `Flat ${i} entrance`, 'FD30S · composite', i => `Floor ${Math.floor((i - 1) / 6)}`, { grp: true }),
    S('GS', 1, 'Communal boiler', 'Vaillant ecoTEC', 'Plant cupboard'),
    S('EI', 1, 'Electrical installation — landlord', 'Landlord DB', 'Meter cupboard'),
    S('WH', 1, 'Domestic water system', 'Mains-fed · unvented cylinder', 'Plant cupboard'),
  ] },
  { code: 'HRC', client: 'HPT', name: 'Headrow Chambers', kind: 'Offices · Grade II listed · 5 floors', rp: 'Building manager: G. Pollard', prof: 'office', specs: [
    S('FA', 1, 'Fire alarm panel', 'Gent Vigilon', 'Porters’ lodge'),
    S('EL', 1, 'Emergency lighting — 84 luminaires', 'Self-contained LED', 'All floors', { lastDaysAgo: dueIn('EL', 7) }),
    S('EX', 12, 'Extinguishers', 'Mixed', 'Fire points', { grp: true }),
    S('EI', 1, 'Electrical installation', 'TP&N · 5 boards', 'Basement'),
    S('WH', 1, 'Domestic water system', 'CWS tank · 2 calorifiers', 'Roof plant'),
    S('LF', 1, 'Passenger lift', 'Stannah · traction', 'Main core', { instYearsAgo: 11, wy: 1 }),
    S('LP', 1, 'Lightning protection system', 'Copper tape · 5 down conductors', 'Roof'),
    S('AC', 1, 'Split systems — server room', 'Daikin ×2', 'Third floor', { instYearsAgo: 4, wy: 5 }),
  ] },
  { code: 'PRH', client: 'HPT', name: 'Park Row House', kind: 'Offices · 7 floors', rp: 'Facilities: J. Cole', prof: 'office', specs: [
    S('FA', 1, 'Fire alarm panel', 'Advanced MxPro 5', 'Reception'),
    S('EL', 1, 'Emergency lighting — 110 luminaires', 'Self-contained LED', 'All floors'),
    S('EX', 10, 'Extinguishers', 'Mixed', 'Fire points', { grp: true }),
    S('GS', 1, 'Gas boilers ×2', 'Hamworthy Wessex', 'Roof plant', { instYearsAgo: 7, wy: 5 }),
    S('EI', 1, 'Electrical installation', 'TP&N · 8 boards', 'Basement', { lastDaysAgo: 5 }),
    S('WH', 1, 'Domestic water system', 'CWS tanks ×2', 'Roof plant'),
    S('LF', 1, 'Passenger lift', 'Otis Gen2', 'Main core', { instYearsAgo: 7, wy: 2 }),
    S('AC', 3, i => `VRF condenser ${i}`, 'Mitsubishi City Multi', 'Roof', { instYearsAgo: 5, wy: 5, wEndIn: 74 }),
  ] },
  { code: 'APA', client: 'HPT', name: 'Albion Place Arcade', kind: 'Retail arcade · 14 units', rp: 'Centre manager: F. Hughes', prof: 'office', specs: [
    S('FA', 1, 'Fire alarm panel', 'Kentec Syncro', 'Management suite'),
    S('EL', 1, 'Emergency lighting — 46 luminaires', 'Self-contained LED', 'Arcade & service corridor'),
    S('EX', 8, 'Extinguishers', 'Mixed', 'Service corridor', { grp: true }),
    S('EI', 1, 'Electrical installation — landlord', 'TP&N · 2 boards', 'Switchroom'),
    S('SC', 1, 'Smoke vent — arcade roof', 'Colt louvres ×4', 'Roof'),
    S('LP', 1, 'Lightning protection system', 'Copper tape', 'Roof'),
  ] },
  { code: 'SCP', client: 'SCA', name: "St Chad's Primary", kind: 'School · 2 blocks · 310 pupils', rp: 'Site manager: B. Aldridge', prof: 'school', specs: [
    S('FA', 1, 'Fire alarm panel', 'Kentec Syncro AS', 'Main entrance'),
    S('EL', 1, 'Emergency lighting — 52 luminaires', 'Self-contained LED', 'Both blocks'),
    S('EX', 11, 'Extinguishers', 'Mixed', 'Corridors & kitchen', { grp: true }),
    S('FD', 14, i => `Corridor door ${i}`, 'FD30S · timber', i => (i <= 8 ? 'Main block' : 'KS1 block'), { grp: true, lastDaysAgo: null }),
    S('GS', 1, 'Boilers ×2', 'Remeha Avanta Plus', 'Boiler house'),
    S('EI', 1, 'Electrical installation', 'TP&N · 4 boards', 'Boiler house', { lastDaysAgo: 1640 }),
    S('WH', 1, 'Domestic water system', 'CWS tank · calorifier', 'Roof void', { lastDaysAgo: dueIn('WH', -19) }),
    S('LP', 1, 'Lightning protection system', 'Copper tape', 'Roof'),
  ] },
  { code: 'CGA', client: 'SCA', name: 'Cross Gates Academy', kind: 'Secondary · sports hall · 1,100 pupils', rp: 'Estates: N. Osei', prof: 'school', specs: [
    S('FA', 1, 'Fire alarm panel', 'Advanced MxPro 5 · 6 loop', 'Reception'),
    S('EL', 1, 'Emergency lighting — 190 luminaires', 'Self-contained LED', 'All blocks'),
    S('EX', 16, 'Extinguishers', 'Mixed', 'Corridors, labs, kitchen', { grp: true, lastDaysAgo: dueIn('EX', 19) }),
    S('FD', 22, i => `Corridor door ${i}`, 'FD30S · timber', i => (i <= 12 ? 'Teaching block' : 'Sports hall'), { grp: true, lastDaysAgo: null }),
    S('GS', 1, 'Boilers ×3', 'Hoval UltraGas', 'Boiler house'),
    S('EI', 1, 'Electrical installation', 'TP&N · 11 boards', 'Switchroom'),
    S('WH', 1, 'Domestic water system', 'CWS tanks ×2 · showers', 'Sports hall plant'),
    S('LF', 1, 'Platform lift', 'Aritco 7000', 'Teaching block', { instYearsAgo: 5, wy: 2 }),
    S('LP', 1, 'Lightning protection system', 'Unknown', 'Roof', { lastDaysAgo: null }),
  ] },
  { code: 'SGP', client: 'SCA', name: 'Seacroft Grange Primary', kind: 'School · single block', rp: 'Site manager: P. Walsh', prof: 'school', specs: [
    S('FA', 1, 'Fire alarm panel', 'C-TEC XFP', 'Entrance'),
    S('EL', 1, 'Emergency lighting — 40 luminaires', 'Self-contained LED', 'Corridors & hall'),
    S('EX', 9, 'Extinguishers', 'Mixed', 'Corridors & kitchen', { grp: true }),
    S('FD', 12, i => `Corridor door ${i}`, 'FD30S · timber', 'Main corridor', { grp: true }),
    S('GS', 1, 'Boilers ×2', 'Ideal Evomax', 'Boiler room'),
    S('EI', 1, 'Electrical installation', 'TP&N · 3 boards', 'Boiler room'),
    S('WH', 1, 'Domestic water system', 'CWS tank · calorifier', 'Roof void'),
  ] },
  { code: 'HDP', client: 'MFL', name: 'Hunslet Depot', kind: 'Industrial · workshop & offices', rp: 'Depot manager: T. Barlow', prof: 'tidy', specs: [
    S('FA', 1, 'Fire alarm panel', 'Kentec Syncro', 'Gatehouse'),
    S('EL', 1, 'Emergency lighting — 64 luminaires', 'Self-contained LED', 'Workshop & offices'),
    S('EX', 31, 'Extinguishers', 'Mixed · incl. 6 powder', 'Workshop bays & offices', { grp: true, lastDaysAgo: dueIn('EX', 26) }),
    S('GS', 1, 'Warehouse heaters ×4', 'Powrmatic NVx', 'Workshop'),
    S('EI', 1, 'Electrical installation', 'TP&N · 6 boards', 'Switchroom'),
    S('WH', 1, 'Domestic water system', 'Mains-fed · showers', 'Welfare block'),
    S('LP', 1, 'Lightning protection system', 'Copper tape', 'Workshop roof'),
  ] },
  { code: 'LDW', client: 'MFL', name: 'Leeds Dock Warehouse', kind: 'Warehouse · mezzanine offices', rp: 'Site lead: O. Brennan', prof: 'tidy', specs: [
    S('FA', 1, 'Fire alarm panel', 'Advanced MxPro 5', 'Goods-in office'),
    S('EL', 1, 'Emergency lighting — 58 luminaires', 'Self-contained LED', 'Warehouse & mezzanine'),
    S('EX', 14, 'Extinguishers', 'Mixed', 'Fire points', { grp: true }),
    S('EI', 1, 'Electrical installation', 'TP&N · 4 boards', 'Switchroom'),
    S('LP', 1, 'Lightning protection system', 'Copper tape', 'Roof'),
    S('SC', 1, 'Smoke vents — warehouse roof', 'Colt louvres ×8', 'Roof'),
  ] },
];
export const BL: Record<string, Building> = Object.fromEntries(BUILDINGS.map(b => [b.code, b]));
export const buildingsOf = (client: string): Building[] => BUILDINGS.filter(b => b.client === client);

/* ------------------------------------------------------------------ records */
export interface Asset { id: string; client: string; building: string; cat: CatId; seq: number; name: string; make: string; loc: string; installed: Date | null; warrantyEnd: Date | null; warrantyNote: string | null; serial: string | null; batt: Date | null; groupId: string; remedials: string[] }
export interface Booking { date: Date; eng: EngineerId; note?: string; onSite?: boolean }
/** Assets serviced together on one visit, with one report. A single asset is a group of one. */
export interface Group { id: string; client: string; building: string; cat: CatId; assetIds: string[]; last: Date | null; booking: Booking | null; notified: Date | null; label: string }
export interface Event { id: string; type: string; date: Date; eng: EngineerId; result: 'pass' | 'fault'; notes: string; assetIds: string[]; groupId: string; cat: CatId; building: string; client: string }
export interface Remedial { id: string; assetId: string; title: string; raised: Date; owner: EngineerId | null; target: Date; status: 'open' | 'closed'; closed: Date | null }
export interface Visit { id: string; date: Date; time: string; eng: EngineerId; building: string; items: string[]; status: 'planned' | 'onsite' | 'done'; filed: string[]; started?: string; finished?: string; note?: string }

export const assets: Asset[] = [], groups: Group[] = [], events: Event[] = [], remedials: Remedial[] = [], visits: Visit[] = [];
export const AS: Record<string, Asset> = {}, GR: Record<string, Group> = {};
let remSeq = 33, vseq = 400;

const FIND: Record<CatId, [string, string]> = {
  FA: ['All zones tested from the panel; sounders audible throughout. Batteries load-tested and within capacity. Event log reviewed and cleared.', 'Fault on one sounder circuit; isolated and remedial raised. All other zones tested satisfactory.'],
  EL: ['Full duration test completed; all luminaires held for 3 hours. Charging indicators normal.', 'Duration test completed; 3 luminaires failed to hold 3 hours and are marked for battery replacement.'],
  EX: ['All extinguishers inspected, weighed and tagged. Pressure gauges in the green. Signage and brackets in order.', 'All inspected. One unit found under pressure and replaced; one bracket loose and refixed.'],
  FD: ['All doors inspected. Self-close and latch from 45°; intumescent strips and cold smoke seals intact; gaps within 3–4 mm.', 'All doors inspected. Two fail to latch reliably; closers adjusted on the day and re-tested satisfactory.'],
  GS: ['Tightness test satisfactory. Combustion analysis within manufacturer limits. Flue integrity and ventilation checked. Appliance safe to use.', 'Appliance classified At Risk: flue joint seal deteriorated. Turned off with responsible person’s consent; remedial raised.'],
  EI: ['Periodic inspection complete. Installation satisfactory for continued use. No C1 or C2 observations; C3 improvements listed.', 'Periodic inspection complete: unsatisfactory. Two C2 observations (missing RCD protection to socket circuits). Remedial raised.'],
  WH: ['Risk assessment reviewed and reissued. Tank condition good; temperatures within HSG274 ranges; no dead legs identified.', 'Risk assessment reissued. Sentinel outlet temperatures below 50 °C at two points; flushing regime and TMV service recommended.'],
  LF: ['Thorough examination complete. No defects affecting safe operation. Next examination due in six months.', 'Thorough examination complete. Defect: door protection device intermittent. Repair required within 28 days.'],
  SC: ['Vent opened and closed on test from fire alarm signal and manual control. Actuator and weather seals sound.', 'Actuator slow to open on test; lubricated and re-tested satisfactory. Monitor at next visit.'],
  LP: ['Continuity and earth resistance within BS EN 62305 limits at all test points. Conductors and clamps visually sound.', 'Two down-conductor joints showing corrosion; cleaned and re-made. One test clamp replaced.'],
  AC: ['F-gas leak check complete; no leaks detected. Refrigerant charge recorded on the system log.', 'Minor leak detected at outdoor unit flare; charge topped up and joint remade. Follow-up check in 30 days.'],
};
export const findings = (cat: CatId, fault: boolean): string => FIND[cat][fault ? 1 : 0];

function autoLast(months: number, prof: Profile): Date | null {
  const r = R(); let acc = 0; let bucket: keyof Profile = 'ok';
  for (const k of ['ok', 'soon', 'late', 'none'] as const) { acc += prof[k]; if (r < acc) { bucket = k; break; } }
  if (bucket === 'none') return null;
  const ahead = bucket === 'ok' ? ri(31, Math.max(45, months * 30 - 10)) : bucket === 'soon' ? ri(1, 30) : ri(-40, -1);
  return addMonths(addDays(TODAY, ahead), -months);
}
const daysAgoDate = (n: number | null | undefined): Date | null => n === null || n === undefined ? null : addDays(TODAY, -n);

function build(): void {
  for (const b of BUILDINGS) {
    const prof = PROF[b.prof] ?? PROF.office!; const seqByCat: Partial<Record<CatId, number>> = {};
    for (const sp of b.specs) {
      const cat = CATS[sp.cat];
      const sharedLast = sp.lastDaysAgo === undefined ? autoLast(cat.months, prof) : daysAgoDate(sp.lastDaysAgo);
      const made: Asset[] = [];
      for (let i = 1; i <= sp.n; i++) {
        const seq = sp.seq ?? (seqByCat[sp.cat] = (seqByCat[sp.cat] ?? 0) + 1);
        const id = `${b.client}-${b.code}-${sp.cat}-${pad(seq)}`;
        const installed = sp.instYearsAgo ? addDays(addMonths(TODAY, -sp.instYearsAgo * 12), -ri(0, 200)) : null;
        const a: Asset = {
          id, client: b.client, building: b.code, cat: sp.cat, seq,
          name: typeof sp.name === 'function' ? sp.name(i) : sp.name, make: sp.make, loc: typeof sp.loc === 'function' ? sp.loc(i) : sp.loc,
          installed, warrantyEnd: sp.wEndIn !== undefined ? addDays(TODAY, sp.wEndIn) : installed && sp.wy ? addMonths(installed, sp.wy * 12) : null,
          warrantyNote: sp.wnote ?? (sp.wy ? `${sp.wy}-year manufacturer` : null),
          serial: sp.serial ? sp.serial(i) : (installed ? `${sp.cat}${Math.floor(R() * 9e5 + 1e5)}` : null),
          batt: sp.battDays ? addDays(TODAY, sp.battDays) : null, groupId: '', remedials: [],
        };
        assets.push(a); AS[id] = a; made.push(a);
      }
      const mkGroup = (list: Asset[], last: Date | null): void => {
        const first = list[0]!;
        const g: Group = { id: `G-${first.id}`, client: b.client, building: b.code, cat: sp.cat, assetIds: list.map(a => a.id), last, booking: null, notified: null, label: list.length > 1 ? `${cat.label} · ${plural(list.length, cat.unit)}` : first.name };
        list.forEach(a => { a.groupId = g.id; }); groups.push(g); GR[g.id] = g;
        if (sp.hist) { for (const h of sp.hist) events.push({ id: '', type: '', date: addDays(TODAY, -h.daysAgo), eng: h.eng, result: h.result, notes: h.notes, assetIds: g.assetIds.slice(), groupId: g.id, cat: sp.cat, building: b.code, client: b.client }); }
        else if (g.last) {
          const k = ri(2, 4);
          for (let i = 0; i < k; i++) {
            const date = i === 0 ? g.last : addDays(addMonths(g.last, -cat.months * i), ri(-6, 6));
            if (dayDiff(TODAY, date) > 1700) break;
            const fault = i > 0 && R() < 0.15;
            events.push({ id: '', type: '', date, eng: pick(engineersFor(cat.trade)).id, result: fault ? 'fault' : 'pass', notes: findings(sp.cat, fault), assetIds: g.assetIds.slice(), groupId: g.id, cat: sp.cat, building: b.code, client: b.client });
          }
        }
      };
      if (sp.grp) mkGroup(made, sharedLast);
      else made.forEach(a => mkGroup([a], sp.lastDaysAgo === undefined && sp.n > 1 ? autoLast(cat.months, prof) : sharedLast));
    }
  }
  // Reference numbers per building and report type, in date order.
  const counters: Record<string, number> = {};
  for (const e of events.slice().sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const t = CATS[e.cat].rtype; const key = `${e.building}-${t}`; counters[key] = (counters[key] ?? 0) + 1;
    e.id = `${e.client}-${e.building}-${t}-${pad3(counters[key]!)}`; e.type = RTYPES[t];
  }
}
build();

export function nextRef(building: string, rtype: RType): string {
  const n = events.filter(e => e.building === building && CATS[e.cat].rtype === rtype).length + 1;
  return `${BL[building]!.client}-${building}-${rtype}-${pad3(n)}`;
}
export const gOf = (assetId: string): Group => GR[AS[assetId]!.groupId]!;

/* Seeded bookings and remedials — the story on top of the generated base. */
gOf('HPT-HRC-EL-01').booking = { date: TODAY, eng: 'DP', note: 'Annual 3-hour duration test', onSite: true };
gOf('NBE-KR4-LF-01').booking = { date: addDays(TODAY, 10), eng: 'TB', note: 'LOLER thorough examination' };
gOf('MFL-HDP-EX-01').booking = { date: addDays(TODAY, 14), eng: 'TB', note: 'Annual service · all 31 units' };
gOf('AVH-BFH-EL-01').booking = { date: addDays(TODAY, 21), eng: 'RA', note: 'Duration test' };
gOf('SCA-CGA-EX-01').booking = { date: addDays(TODAY, 16), eng: 'TB', note: 'Annual service' };
const REM = (id: string, assetId: string, title: string, raisedAgo: number, owner: EngineerId | null, targetIn: number, closedAgo?: number): void => {
  const r: Remedial = { id, assetId, title, raised: addDays(TODAY, -raisedAgo), owner, target: addDays(TODAY, targetIn), status: closedAgo === undefined ? 'open' : 'closed', closed: closedAgo === undefined ? null : addDays(TODAY, -closedAgo) };
  remedials.push(r); AS[assetId]!.remedials.push(id);
};
REM('REM-031', 'AVH-ARC-FD-07', 'Self-closer fails from 45° — adjust or replace', 4, null, 24);
REM('REM-032', 'AVH-ARC-FD-19', 'Self-closer fails from 45° — adjust or replace', 4, null, 24);
REM('REM-033', 'AVH-ARC-FD-31', 'Self-closer fails from 45° — adjust or replace', 4, null, 24);
REM('REM-028', 'NBE-GWO-SC-01', 'Actuator seized on monthly test — replace', 12, 'TB', 7);
REM('REM-029', 'HPT-HRC-EL-01', '3 luminaires failed monthly flick test — replace batteries', 7, 'DP', 7);
REM('REM-027', 'HPT-PRH-AC-03', 'Refrigerant loss detected — trace and repair', 19, 'TB', 11);
REM('REM-026', 'SCA-SCP-EX-04', 'Extinguisher missing from bracket — replace', 21, 'CS', 2);
REM('REM-030', 'MFL-HDP-FA-01', 'Zone 3 detector intermittent fault — investigate', 6, 'RA', 8);
REM('REM-025', 'AVH-KLG-EL-01', 'Central battery unit low capacity — replace cells', 27, 'DP', 4);
REM('REM-021', 'NBE-WP3-GS-02', 'Gas valve lockout — replaced under warranty', 571, 'JW', -564, 571);
REM('REM-019', 'AVH-ARC-FA-01', 'Level 2 sounder circuit fault — cable repair', dueIn('FA', -6) + 364, 'DP', -(dueIn('FA', -6) + 350), dueIn('FA', -6) + 356);

/* ---------------------------------------------------------------- derived */
export type StatusKey = 'ok' | 'soon' | 'late' | 'none';
export interface Status { key: StatusKey; next: Date | null; days: number | null; word: string }
export function status(g: Group): Status {
  if (!g.last) return { key: 'none', next: null, days: null, word: 'No record' };
  const next = addMonths(g.last, CATS[g.cat].months); const days = dayDiff(next, TODAY);
  if (days < 0) return { key: 'late', next, days, word: 'Overdue' };
  if (days <= 30) return { key: 'soon', next, days, word: 'Due' };
  return { key: 'ok', next, days, word: 'In date' };
}
export const remedialById = (id: string): Remedial | undefined => remedials.find(r => r.id === id);
export const openRems = (a: Asset): Remedial[] => a.remedials.map(remedialById).filter((r): r is Remedial => !!r && r.status === 'open');
export const groupRems = (g: Group): Remedial[] => g.assetIds.flatMap(id => openRems(AS[id]!));
export interface Rollup { ok: number; soon: number; late: number; none: number; total: number }
export function rollup(list: Group[]): Rollup {
  const c: Rollup = { ok: 0, soon: 0, late: 0, none: 0, total: 0 };
  for (const g of list) { c[status(g).key] += g.assetIds.length; c.total += g.assetIds.length; }
  return c;
}
export const groupsOfBuilding = (code: string): Group[] => groups.filter(g => g.building === code);
export const groupsOfClient = (code: string): Group[] => groups.filter(g => g.client === code);
const daysOf = (g: Group): number => status(g).days ?? 999;
export const dueItems = (win: number): Group[] => groups.filter(g => { const s = status(g); return s.key === 'soon' || (win > 30 && s.key === 'ok' && (s.days ?? 999) <= win); }).sort((a, b) => daysOf(a) - daysOf(b));
export const lateItems = (): Group[] => groups.filter(g => status(g).key === 'late').sort((a, b) => daysOf(a) - daysOf(b));
export const noneItems = (): Group[] => groups.filter(g => status(g).key === 'none');
export const eventsOf = (g: Group): Event[] => events.filter(e => e.groupId === g.id).sort((a, b) => b.date.getTime() - a.date.getTime());
export const eventById = (id: string): Event | undefined => events.find(e => e.id === id);
export const warrantyWatch = (): Asset[] => assets.filter(a => a.warrantyEnd && dayDiff(a.warrantyEnd, TODAY) <= 90 && dayDiff(a.warrantyEnd, TODAY) >= -60).sort((a, b) => a.warrantyEnd!.getTime() - b.warrantyEnd!.getTime());
export const pathTo = (a: Asset): string => `#/portfolio/${a.client}/${a.building}/${a.id}`;
export interface Attention { t: string; s: string; go: string }
export function attentionItems(): Attention[] {
  const out: Attention[] = [];
  const lateUnbooked = lateItems().filter(g => !g.booking);
  if (lateUnbooked[0]) { const g = lateUnbooked[0]; const s = status(g); out.push({ t: `${plural(lateUnbooked.length, 'statutory item')} overdue and not booked`, s: `Oldest: ${g.label} at ${BL[g.building]!.name}, ${-(s.days ?? 0)} days past its date.`, go: '#/overdue' }); }
  const un = remedials.filter(r => r.status === 'open' && !r.owner);
  if (un[0]) out.push({ t: `${plural(un.length, 'remedial')} unassigned`, s: `${un[0].title} · ${BL[AS[un[0].assetId]!.building]!.name}.`, go: '#/remedials/unassigned' });
  const ww = warrantyWatch().filter(a => dayDiff(a.warrantyEnd!, TODAY) <= 45);
  if (ww[0]) out.push({ t: `${plural(ww.length, 'warranty', 'warranties')} ending or lapsed`, s: ww.map(a => `${a.name} (${BL[a.building]!.name.split(' —')[0]}) ${fmtS(a.warrantyEnd)}`).join(' · '), go: pathTo(ww[0]) });
  const nr = noneItems();
  if (nr.length) out.push({ t: `${plural(nr.length, 'requirement')} with no record`, s: 'Held on the register with no certificate or service date entered.', go: '#/overdue/norecord' });
  return out;
}

/* --------------------------------------------------------------- schedule */
const SLOTS = ['08:30', '11:00', '13:30', '15:30'];
function mkVisit(date: Date, time: string, eng: EngineerId, building: string, items: string[], st: Visit['status'], extra?: Partial<Visit>): Visit {
  const v: Visit = { id: `V-${++vseq}`, date, time, eng, building, items, status: st, filed: [], ...extra }; visits.push(v); return v;
}
export function fileEvent(g: Group, date: Date, eng: EngineerId, result: 'pass' | 'fault', notes?: string): Event {
  const cat = CATS[g.cat];
  const e: Event = { id: nextRef(g.building, cat.rtype), type: RTYPES[cat.rtype], date, eng, result, notes: notes ?? findings(g.cat, result === 'fault'), assetIds: g.assetIds.slice(), groupId: g.id, cat: g.cat, building: g.building, client: g.client };
  events.push(e); if (!g.last || date > g.last) g.last = date; g.booking = null; g.notified = null; return e;
}
function schedule(): void {
  // Office bookings become visits.
  for (const g of groups.filter(g => g.booking)) {
    const b = g.booking!; const same = visits.find(v => v.building === g.building && dayDiff(v.date, b.date) === 0 && v.eng === b.eng);
    if (same) { same.items.push(g.id); continue; }
    mkVisit(b.date, b.onSite ? '08:30' : '11:00', b.eng, g.building, [g.id], b.onSite ? 'onsite' : 'planned', b.onSite ? { started: '08:12' } : {});
  }
  // The story: Rachel is at Aire Court now, servicing the overdue panels.
  mkVisit(TODAY, '08:30', 'RA', 'ARC', [gOf('AVH-ARC-FA-01').id, gOf('AVH-ARC-FA-02').id, gOf('AVH-ARC-FD-07').id], 'onsite', { started: '08:41', note: 'Panels overdue since last week. Check the three failed door closers while there.' });
  // Fill each engineer's fortnight from what is due in their trades. Days
  // already gone this week hold completed visits, but only for items that were
  // merely due: anything overdue or unrecorded is still waiting, which is what
  // the office screens are for.
  for (const eng of ENGINEERS) {
    const taken = new Set(visits.flatMap(v => v.items));
    const mine = groups.filter(g => !taken.has(g.id) && eng.trades.includes(CATS[g.cat].trade) && status(g).key !== 'ok').sort((a, b) => daysOf(a) - daysOf(b));
    const perDay = eng.id === 'CS' ? 1 : 2;
    const byBuilding = (list: Group[]): string[][] => { const m: Record<string, string[]> = {}; for (const g of list) (m[g.building] ??= []).push(g.id); return Object.values(m).map(ids => ids.slice(0, 4)); };
    const place = (date: Date, batches: string[][], done: boolean): string[][] => {
      let used = visits.filter(v => v.eng === eng.id && dayDiff(v.date, date) === 0).length;
      while (batches.length && used < perDay) {
        const items = batches.shift()!; const code = GR[items[0]!]!.building;
        const times = visits.filter(v => v.eng === eng.id && dayDiff(v.date, date) === 0).map(v => v.time);
        const time = SLOTS.find(t => !times.includes(t)) ?? '15:30';
        const v = mkVisit(date, time, eng.id, code, items, done ? 'done' : 'planned', done ? { started: time, finished: SLOTS[Math.min(3, SLOTS.indexOf(time) + 1)] ?? '15:30' } : {});
        for (const gid of items) { const g = GR[gid]!; if (done) v.filed.push(fileEvent(g, date, eng.id, R() < 0.15 ? 'fault' : 'pass').id); else if (!g.booking) g.booking = { date, eng: eng.id, note: CATS[g.cat].req }; }
        used++;
      }
      return batches;
    };
    const isWeekday = (d: Date): boolean => d.getDay() !== 0 && d.getDay() !== 6;
    // Completed visits earlier this week, from items that were imminently due.
    let past = byBuilding(mine.filter(g => status(g).key === 'soon' && (status(g).days ?? 99) <= 10));
    for (let d = MONDAY; d < TODAY && past.length; d = addDays(d, 1)) if (isWeekday(d)) past = place(d, past, true);
    const placed = new Set(visits.flatMap(v => v.items));
    // Everything else from today forward, over the next two working weeks.
    let future = byBuilding(mine.filter(g => !placed.has(g.id)));
    for (let d = TODAY, n = 0; future.length && n < 14; d = addDays(d, 1), n++) if (isWeekday(d)) future = place(d, future, false);
  }
  visits.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));
}
schedule();
export const visitsOn = (eng: EngineerId, date: Date): Visit[] => visits.filter(v => v.eng === eng && dayDiff(v.date, date) === 0);
export const visitById = (id: string): Visit | undefined => visits.find(v => v.id === id);
export const isDoneItem = (v: Visit, gid: string): boolean => v.filed.some(id => eventById(id)?.groupId === gid);

/* ------------------------------------------------------------------ forms */
/**
 * Service form templates, one per requirement. PLACEHOLDERS: a plausible first
 * draft of what each standard asks for, to be replaced by Leodis's actual forms.
 */
export type FieldType = 'check' | 'yn' | 'num' | 'choice' | 'text' | 'time';
export interface Field { id: string; label: string; t: FieldType; req: boolean; unit?: string; opts?: string[] }
export interface FormTemplate { title: string; sections: { h: string; f: Field[] }[] }
const C = (id: string, label: string, o?: Partial<Field>): Field => ({ id, label, t: 'check', req: true, ...o });
const N = (id: string, label: string, unit: string, o?: Partial<Field>): Field => ({ id, label, t: 'num', req: true, unit, ...o });
const Y = (id: string, label: string, o?: Partial<Field>): Field => ({ id, label, t: 'yn', req: true, ...o });
const T = (id: string, label: string): Field => ({ id, label, t: 'text', req: false });
const CH = (id: string, label: string, opts: string[]): Field => ({ id, label, t: 'choice', req: true, opts });
export const FORMS: Record<CatId, FormTemplate> = {
  FA: { title: 'Fire alarm service', sections: [
    { h: 'Panel and power', f: [C('mains', 'Mains supply present and healthy'), C('batt', 'Standby batteries — condition and date'), N('battv', 'Battery voltage on load', 'V'), N('chg', 'Charger output', 'V'), CH('faults', 'Faults shown on panel', ['None', 'Fault cleared on site', 'Fault remains — remedial'])] },
    { h: 'Functional test', f: [N('zones', 'Zones tested this visit', 'zones'), CH('pct', 'Detectors tested', ['25%', '50%', '100%']), C('sound', 'Sounders audible in all areas'), C('vis', 'Visual alarm devices operate'), C('cae', 'Cause and effect — AOV, door holders, lift grounding', { req: false }), C('arc', 'Signal received at monitoring centre', { req: false })] },
    { h: 'Record', f: [Y('log', 'Logbook updated on site'), N('false', 'False alarms since last visit', '', { req: false }), T('obs', 'Observations and variations')] },
  ] },
  EL: { title: 'Emergency lighting duration test', sections: [
    { h: 'Duration test', f: [{ id: 'start', label: 'Test started', t: 'time', req: true }, N('lum', 'Luminaires under test', ''), N('fail', 'Failed to hold 3 hours', ''), C('chg', 'Charging indicators normal after restoration'), C('exit', 'Exit signage legible and lit')] },
    { h: 'Record', f: [Y('log', 'Logbook updated'), T('obs', 'Failed luminaire locations and observations')] },
  ] },
  EX: { title: 'Extinguisher annual service', sections: [
    { h: 'Inventory', f: [N('n', 'Units inspected', ''), N('miss', 'Units missing from location', ''), N('cond', 'Units condemned or replaced', '')] },
    { h: 'Condition', f: [C('press', 'Pressure gauges / weights within limits'), C('hose', 'Hoses, nozzles and pins'), C('seal', 'Tamper seals intact'), C('tag', 'Service tags dated'), C('sign', 'Signage and brackets')] },
    { h: 'Record', f: [T('obs', 'Observations')] },
  ] },
  FD: { title: 'Fire door quarterly check', sections: [
    { h: 'Doors', f: [N('n', 'Doors inspected', ''), N('fail', 'Doors failing to self-close and latch', ''), T('failwhich', 'Which doors failed')] },
    { h: 'Condition', f: [C('gap', 'Gaps within 3–4 mm'), C('strip', 'Intumescent strips and cold smoke seals'), C('glaz', 'Glazing and beads'), C('hinge', 'Hinges — three, CE marked, secure'), C('sign', 'Signage present')] },
    { h: 'Record', f: [T('obs', 'Observations')] },
  ] },
  GS: { title: 'Gas safety inspection (CP17)', sections: [
    { h: 'Appliance', f: [Y('ident', 'Appliance details match the register'), C('tight', 'Tightness test'), N('pres', 'Operating pressure', 'mbar'), N('ratio', 'CO/CO₂ ratio', '')] },
    { h: 'Installation', f: [C('flue', 'Flue integrity and termination'), C('vent', 'Ventilation adequate'), C('safe', 'Safety devices operate'), C('pipe', 'Pipework and supports')] },
    { h: 'Classification', f: [CH('class', 'Appliance classification', ['Safe to use', 'At Risk (AR)', 'Immediately Dangerous (ID)']), Y('notice', 'Warning notice issued', { req: false }), T('obs', 'Observations')] },
  ] },
  EI: { title: 'Periodic inspection (EICR)', sections: [
    { h: 'Scope', f: [N('boards', 'Distribution boards inspected', ''), N('circ', 'Circuits tested', ''), CH('samp', 'Sampling', ['100%', '50%', '25%'])] },
    { h: 'Results', f: [C('zs', 'Earth fault loop impedance within limits'), C('rcd', 'RCD trip times within limits'), N('c1', 'C1 observations', ''), N('c2', 'C2 observations', ''), N('c3', 'C3 observations', ''), Y('sat', 'Installation satisfactory for continued use')] },
    { h: 'Record', f: [T('obs', 'Observations')] },
  ] },
  WH: { title: 'Legionella risk assessment review', sections: [
    { h: 'Storage', f: [C('tank', 'Tank condition, lid and insect screen'), N('cold', 'Cold water storage temperature', '°C'), N('flow', 'Calorifier flow temperature', '°C'), N('ret', 'Calorifier return temperature', '°C')] },
    { h: 'Outlets', f: [C('coldout', 'Sentinel cold outlets below 20 °C'), C('hotout', 'Sentinel hot outlets above 50 °C within a minute'), N('dead', 'Dead legs identified', ''), Y('disinf', 'Disinfection recommended')] },
    { h: 'Record', f: [Y('scheme', 'Written scheme reviewed with duty holder'), T('obs', 'Observations')] },
  ] },
  LF: { title: 'Thorough examination (LOLER)', sections: [
    { h: 'Examination', f: [C('gear', 'Safety gear and overspeed governor'), C('doors', 'Doors, locks and protection devices'), C('ropes', 'Ropes / belts and terminations'), C('brake', 'Brake and machine'), C('pit', 'Pit, car top and machine room')] },
    { h: 'Outcome', f: [Y('unsafe', 'Defects affecting safe operation'), N('within', 'Repairs required within', 'days', { req: false }), T('obs', 'Defects and observations')] },
  ] },
  SC: { title: 'Smoke control annual service', sections: [
    { h: 'Operation', f: [C('alarm', 'Opens on fire alarm signal'), C('man', 'Opens and closes on manual control'), C('reset', 'Resets and holds closed'), C('seal', 'Weather seals and frame')] },
    { h: 'Record', f: [CH('act', 'Actuator condition', ['Good', 'Serviceable — monitor', 'Replace']), T('obs', 'Observations')] },
  ] },
  LP: { title: 'Lightning protection annual test', sections: [
    { h: 'Testing', f: [N('pts', 'Test points tested', ''), N('ohm', 'Highest earth resistance', 'Ω'), C('cont', 'Continuity of conductors'), C('joint', 'Joints, clamps and fixings')] },
    { h: 'Record', f: [T('obs', 'Observations')] },
  ] },
  AC: { title: 'F-gas leak check', sections: [
    { h: 'System', f: [N('kg', 'Refrigerant charge', 'kg'), CH('method', 'Leak detection method', ['Electronic detector', 'Bubble test', 'UV dye']), Y('leak', 'Leak found'), C('label', 'F-gas label present and legible')] },
    { h: 'Record', f: [Y('log', 'F-gas log updated'), T('obs', 'Observations')] },
  ] },
};
export interface Draft { a: Record<string, string>; photos: number; signed: boolean; started: string }
export const drafts: Record<string, Draft> = {};
export const formFor = (g: Group): FormTemplate => FORMS[g.cat];
export const allFields = (g: Group): Field[] => formFor(g).sections.flatMap(s => s.f);
export interface Progress { done: number; total: number; pct: number; signed: boolean; photos: number }
export function progress(g: Group): Progress {
  const d = drafts[g.id]; const req = allFields(g).filter(f => f.req);
  const done = d ? req.filter(f => d.a[f.id] !== undefined && d.a[f.id] !== '').length : 0;
  return { done, total: req.length, pct: req.length ? Math.round(100 * done / req.length) : 0, signed: !!d?.signed, photos: d?.photos ?? 0 };
}
export const isDraft = (g: Group): boolean => !!drafts[g.id];
export const nowClock = (): string => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function ensureDraft(g: Group): Draft { return drafts[g.id] ??= { a: {}, photos: 0, signed: false, started: nowClock() }; }
export interface Composed { fault: boolean; notes: string; remTitle: string }
export function composeNotes(g: Group, d: Draft): Composed {
  const fields = allFields(g); const a = d.a;
  const fails = fields.filter(f => f.t === 'check' && a[f.id] === 'fail').map(f => f.label);
  const bad = fields.filter(f => (f.t === 'yn' && (['unsafe', 'leak', 'disinf'].includes(f.id) ? a[f.id] === 'yes' : (f.id === 'sat' && a[f.id] === 'no'))) || (f.t === 'choice' && /At Risk|Immediately|Replace|remains/.test(a[f.id] ?? ''))).map(f => `${f.label}: ${a[f.id]}`);
  const nums = fields.filter(f => f.t === 'num' && a[f.id] !== undefined && a[f.id] !== '').map(f => `${f.label.toLowerCase()} ${a[f.id]}${f.unit ? ' ' + f.unit : ''}`);
  const failedUnits = Number(a.fail ?? 0);
  const fault = fails.length > 0 || bad.length > 0 || failedUnits > 0 || Number(a.c1 ?? 0) + Number(a.c2 ?? 0) > 0;
  const parts: string[] = [];
  if (fails.length) parts.push(`Failed: ${fails.join('; ')}.`); if (bad.length) parts.push(bad.join('. ') + '.');
  if (failedUnits > 0) parts.push(`${failedUnits} failed${a.failwhich ? ` (${a.failwhich})` : ''}.`);
  if (!fault) parts.push(findings(g.cat, false)); if (nums.length) parts.push(`Readings: ${nums.join(', ')}.`); if (a.obs) parts.push(a.obs);
  const cat = CATS[g.cat];
  return { fault, notes: parts.join(' '), remTitle: fails[0] ? `${fails[0]} — failed at ${cat.req.toLowerCase()}` : bad[0] ?? (failedUnits > 0 ? `${failedUnits} ${cat.unit}s failed — ${a.failwhich ?? 'see report'}` : `Fault found at ${cat.req.toLowerCase()}`) };
}

/* -------------------------------------------------------------- mutations */
/* A tiny store: every change bumps a version and notifies subscribers, so both
   views re-render from the same module state. */
let version = 0; const subs = new Set<() => void>();
export const getVersion = (): number => version;
export function subscribe(fn: () => void): () => void { subs.add(fn); return () => { subs.delete(fn); }; }
function changed(): void { version++; subs.forEach(fn => fn()); }

export function raiseRemedial(assetId: string, title: string, owner: EngineerId | null, target: Date, raised = TODAY): Remedial {
  const id = `REM-${pad3(++remSeq)}`; const r: Remedial = { id, assetId, title, raised, owner, target, status: 'open', closed: null };
  remedials.push(r); AS[assetId]!.remedials.push(id); changed(); return r;
}
export function fileReport(g: Group, date: Date, eng: EngineerId, result: 'pass' | 'fault', notes: string, remTitle?: string, visit?: Visit | null): { event: Event; remedial: Remedial | null } {
  const event = fileEvent(g, date, eng, result, notes); if (visit) visit.filed.push(event.id);
  let remedial: Remedial | null = null;
  if (result === 'fault') { const id = `REM-${pad3(++remSeq)}`; remedial = { id, assetId: g.assetIds[0]!, title: remTitle ?? `Fault found at ${CATS[g.cat].req.toLowerCase()} — see ${event.id}`, raised: date, owner: null, target: addDays(date, 28), status: 'open', closed: null }; remedials.push(remedial); AS[remedial.assetId]!.remedials.push(id); }
  delete drafts[g.id]; changed(); return { event, remedial };
}
export function book(g: Group, date: Date, eng: EngineerId, note: string, also: Group[] = []): void {
  g.booking = { date, eng, note }; for (const x of also) x.booking = { date, eng, note: `Same visit as ${g.label}` }; changed();
}
export function unbook(g: Group): void { g.booking = null; changed(); }
export function notify(g: Group): void { g.notified = TODAY; changed(); }
export function notifyAll(): number { const l = lateItems().filter(g => !g.notified); l.forEach(g => { g.notified = TODAY; }); if (l.length) changed(); return l.length; }
export function assign(r: Remedial, owner: EngineerId, target: Date): void { r.owner = owner; r.target = target; changed(); }
export function closeRemedial(r: Remedial, by: EngineerId): void { r.status = 'closed'; r.closed = TODAY; r.owner ??= by; changed(); }
export function startVisit(v: Visit): void { v.status = 'onsite'; v.started ??= nowClock(); for (const gid of v.items) GR[gid]!.booking = { date: v.date, eng: v.eng, onSite: true }; changed(); }
export function completeVisit(v: Visit): void { v.status = 'done'; v.finished = nowClock(); for (const gid of v.items) { const g = GR[gid]!; if (g.booking?.onSite) g.booking = null; } changed(); }
export function setAnswer(g: Group, field: string, value: string): void { ensureDraft(g).a[field] = value; changed(); }
export function addPhoto(g: Group): void { ensureDraft(g).photos++; changed(); }
export function sign(g: Group): void { ensureDraft(g).signed = true; changed(); }
export function sendForm(g: Group, eng: EngineerId, visit: Visit | null): { event: Event; remedial: Remedial | null } {
  const c = composeNotes(g, ensureDraft(g)); return fileReport(g, TODAY, eng, c.fault ? 'fault' : 'pass', c.notes, c.remTitle, visit);
}
