import type { CheckAnswer, Observation, Report } from './types';

/**
 * The kinds of report an engineer can write (EXP-5).
 *
 * Every type shares the same capture, draft recovery, photographs, sending,
 * revisions and PDF. What differs is declared here: the document's name and
 * reference code, whether the engineer builds the report from free cards or
 * answers a fixed checklist, whether a drawn signature is required, and
 * whether sending raises issues and variations.
 *
 * A report with no `reportType` is a site progress report: every report
 * written before types existed is one.
 */
export type ReportTypeId = 'progress' | 'safety-inspection' | 'handover-inspection' | 'first-fix-inspection';

export interface ChecklistItem {
  /** Stable key, kept on the card so a later change of wording never moves an answer. */
  item: string;
  question: string;
  /** What to look at, in site words. Shown under the question; not printed. */
  hint: string;
}

export interface ReportTypeDef {
  id: ReportTypeId;
  /** The engineer's word for it. */
  name: string;
  /** The short label on its home screen tile: "Safety", "First fix". */
  tag: string;
  /** Printed on the document. */
  document: string;
  /** The middle of the reference: 011LME-SPR-004, 011LME-SSI-001. */
  code: string;
  /** One line on the home screen tile. */
  blurb: string;
  /** Fixed questions, answered one by one. Absent: free cards. */
  checklist?: readonly ChecklistItem[];
  /** On a checklist, the prompt in an action's "What needs doing". */
  actionPrompt?: string;
  /** The person who inspected signs for it: a typed name alone is not enough. */
  drawnSignature: boolean;
  /**
   * Sending raises issues from defects and access cards, and variations from
   * variation cards. On a checklist, each check answered "Action needed"
   * raises an issue, so it says where and joins the snag list.
   */
  raisesRecords: boolean;
}

/**
 * A weekly walk round Leodis's own work areas. The items are the ones a site
 * manager would expect an M&E contractor to check; they are a first set, kept
 * here so the office can change the wording without touching sent reports
 * (each card keeps the question it was asked).
 */
export const SAFETY_CHECKLIST: readonly ChecklistItem[] = [
  { item: 'housekeeping', question: 'Work areas tidy, waste cleared, walkways clear', hint: 'Offcuts, packaging, trailing leads, anything to trip on.' },
  { item: 'access', question: 'Safe ways in and out, edges and openings protected', hint: 'Stairs, routes, risers, holes in floors and ceilings.' },
  { item: 'height', question: 'Ladders, steps, towers and podiums checked and used safely', hint: 'Tags in date, outriggers and guardrails in place.' },
  { item: 'electrical', question: 'Temporary supplies, leads and power tools in date and undamaged', hint: 'PAT labels, 110V where needed, no damaged cables.' },
  { item: 'isolation', question: 'Isolations locked off and labelled before work on or near live systems', hint: 'Locks, tags and permits for electrical and pipework.' },
  { item: 'hot-works', question: 'Hot works under permit, with a fire extinguisher at hand', hint: 'Brazing, soldering, grinding. Fire watch kept after.' },
  { item: 'fire', question: 'Fire points and escape routes clear and signed', hint: 'Nothing stored on escape routes or in front of fire points.' },
  { item: 'ppe', question: 'Everyone wearing the right PPE, in good condition', hint: 'Hard hat, boots, hi-vis, gloves and eye protection for the task.' },
  { item: 'substances', question: 'Hazardous substances stored, labelled and with COSHH sheets', hint: 'Solvents, flux, adhesives, gas bottles stored upright.' },
  { item: 'rams', question: 'Method statements briefed and signed by everyone on the task', hint: 'The RAMS on site match the work being done today.' },
  { item: 'storage', question: 'Materials and plant stored safely, not blocking routes', hint: 'Stacks stable, pipe and containment racked, no lifting hazards.' },
  { item: 'welfare', question: 'Welfare facilities clean and available', hint: 'Toilets, washing, drinking water, somewhere to eat.' },
];

/**
 * A walk round one area before it is handed over: is Leodis's M&E work there
 * finished, tested and ready to close up? Unlike the safety inspection, what
 * needs action here is unfinished or faulty work of our own, so each action
 * raises an issue on the snag list and is tracked to closure there.
 */
export const HANDOVER_CHECKLIST: readonly ChecklistItem[] = [
  { item: 'containment', question: 'Containment, tray and trunking complete, supported and lidded', hint: 'Lids on, supports at the right spacing, no sharp edges or open ends.' },
  { item: 'pipework', question: 'Pipework and ductwork complete, supported and insulated', hint: 'Brackets, insulation joints taped, no drips or weeps at joints.' },
  { item: 'fittings', question: 'Fittings and terminals fitted, level and undamaged', hint: 'Sockets, switches, lights, grilles, radiators, sanitaryware.' },
  { item: 'fire-stopping', question: 'Holes through fire walls and floors sealed', hint: 'Every service penetration we made, sealed and labelled where required.' },
  { item: 'access-panels', question: 'Access panels where valves, dampers and junction boxes need reaching', hint: 'Can each one be reached once the ceiling or boxing is closed?' },
  { item: 'ceiling-void', question: 'Ceiling voids and risers ready to close', hint: 'Nothing loose, nothing left to finish, no debris left behind.' },
  { item: 'labelling', question: 'Circuits, valves and equipment labelled', hint: 'Board schedules filled in, valve tags, pipe and duct markers.' },
  { item: 'testing', question: 'Electrical tested and pipework pressure tested, with results recorded', hint: 'Test sheets signed for this area; any failures put right and retested.' },
  { item: 'commissioning', question: 'Systems working: lighting, power, heating, ventilation, water and controls', hint: 'Switched on and seen working, not just connected.' },
  { item: 'making-good', question: 'Damage to other trades’ work made good', hint: 'Walls, ceilings, floors and finishes we marked or opened up.' },
  { item: 'clean', question: 'Equipment clean, protective film and packaging removed', hint: 'Fittings wiped, labels and film off, offcuts and boxes cleared.' },
  { item: 'paperwork', question: 'Certificates and as-fitted details ready for the O&M manual', hint: 'Test certificates, commissioning sheets, marked-up drawings.' },
];

/**
 * A walk round one area before its ceilings, walls, risers or boxing are
 * closed: is Leodis's first fix there complete, tested, labelled and safe from
 * the boards going on? Opening a ceiling again costs far more than a walk
 * round, and a signed record shows the area was ready when it was closed. As
 * on the handover inspection, what needs action is our own work, so each
 * action raises an issue on the snag list. The checks are a first draft for
 * the office to change.
 */
export const FIRST_FIX_CHECKLIST: readonly ChecklistItem[] = [
  { item: 'first-fix', question: 'First fix complete: cables, pipes and ducts run to every point on the drawings', hint: 'Drops, tails and spurs left where they are needed, nothing still to run.' },
  { item: 'containment', question: 'Containment and cables fixed and supported, nothing resting on the ceiling grid', hint: 'Clipped or on tray at the right spacing, lids on, no cables lying on boards or grid.' },
  { item: 'pipework', question: 'Pipework and ductwork supported, jointed and insulated', hint: 'Brackets at the right spacing, insulation complete and taped, vapour barrier unbroken on chilled pipes.' },
  { item: 'pressure-test', question: 'Pipework pressure tested and passed, with the result recorded', hint: 'Test sheet signed for this area. Nothing closed in before it has been tested.' },
  { item: 'drainage', question: 'Soil, waste and condensate pipes tested and falling the right way', hint: 'Test done, joints watertight, falls checked, no dips that will hold water.' },
  { item: 'electrical-test', question: 'Cables that will be hidden tested, with results recorded', hint: 'Continuity and insulation resistance on circuits that are about to be covered.' },
  { item: 'positions', question: 'Back boxes, grilles and fittings set out for the finishes', hint: 'Boxes at the right height and flush to the board line, positions match the ceiling grid.' },
  { item: 'access', question: 'Access panels agreed where valves, dampers and junction boxes need reaching', hint: 'Every one we will need again can be reached once it is closed.' },
  { item: 'fire-stopping', question: 'Holes through fire walls and floors sealed', hint: 'Every service penetration we made, sealed with the right product and labelled where required.' },
  { item: 'protected', question: 'Our services clear of board fixings and kept in safe zones', hint: 'Cables in safe zones or protected, pipes clear of stud and screw lines.' },
  { item: 'labelling', question: 'Hidden services labelled and marked on the drawings', hint: 'Junction boxes, valves and routes labelled and marked up before they are covered.' },
  { item: 'clear', question: 'Void clear of offcuts, packaging and tools', hint: 'Nothing left inside that should not be closed in.' },
];

export const REPORT_TYPES: readonly ReportTypeDef[] = [
  { id: 'progress', name: 'Site update', tag: 'Site update', document: 'Site Progress Report', code: 'SPR', blurb: 'Progress, defects, variations and access, one card at a time', drawnSignature: false, raisesRecords: true },
  { id: 'safety-inspection', name: 'Safety inspection', tag: 'Safety', document: 'Site Safety Inspection', code: 'SSI', blurb: `${SAFETY_CHECKLIST.length} checks, each satisfactory, action needed or not applicable`, checklist: SAFETY_CHECKLIST, actionPrompt: 'What has to happen to make it safe', drawnSignature: true, raisesRecords: false },
  { id: 'handover-inspection', name: 'Handover inspection', tag: 'Handover', document: 'Pre-Handover Inspection', code: 'PHI', blurb: `${HANDOVER_CHECKLIST.length} checks on an area before handover; actions go on the snag list`, checklist: HANDOVER_CHECKLIST, actionPrompt: 'What has to happen before handover', drawnSignature: true, raisesRecords: true },
  { id: 'first-fix-inspection', name: 'First fix inspection', tag: 'First fix', document: 'First Fix Inspection', code: 'FFI', blurb: `${FIRST_FIX_CHECKLIST.length} checks on an area before ceilings and walls are closed; actions go on the snag list`, checklist: FIRST_FIX_CHECKLIST, actionPrompt: 'What has to happen before it is closed in', drawnSignature: true, raisesRecords: true },
];

/** The report types started from a checklist, one home screen tile each. */
export const CHECKLIST_TYPES: readonly ReportTypeDef[] = REPORT_TYPES.filter(t => t.checklist);

/** Whether this check raises an issue when its report is sent: an action on a checklist that raises records. */
export const raisesIssue = (type: ReportTypeDef, o: Pick<Observation, 'check'>): boolean =>
  Boolean(type.checklist && type.raisesRecords && o.check?.answer === 'action');

export const isReportType = (value: unknown): value is ReportTypeId => REPORT_TYPES.some(t => t.id === value);
export const reportTypeOf = (report: { reportType?: ReportTypeId | undefined }): ReportTypeDef =>
  REPORT_TYPES.find(t => t.id === (report.reportType ?? 'progress')) ?? REPORT_TYPES[0]!;

export const CHECK_ANSWERS: readonly { value: CheckAnswer; label: string; short: string; tone: 'ok' | 'action' | 'na' }[] = [
  { value: 'ok', label: 'Satisfactory', short: 'OK', tone: 'ok' },
  { value: 'action', label: 'Action needed', short: 'Action', tone: 'action' },
  { value: 'na', label: 'Not applicable', short: 'N/A', tone: 'na' },
];
export const answerLabel = (answer: CheckAnswer | undefined): string => CHECK_ANSWERS.find(a => a.value === answer)?.label ?? 'Not answered';

/** The cards a new report of this type starts with: one per check, unanswered. */
export function startingCards(type: ReportTypeDef): Observation[] {
  return (type.checklist ?? []).map(c => ({
    id: `obs-check-${c.item}`, type: 'check', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [],
    check: { item: c.item, question: c.question },
  }));
}

/** The question's hint, for a card whose item is still in the checklist. */
export const checkHint = (type: ReportTypeDef, item: string): string => type.checklist?.find(c => c.item === item)?.hint ?? '';

/**
 * Whether a save keeps the report's shape. A checklist report holds exactly
 * the checks it started with, each asking the question it was asked: an
 * answer can change, a check cannot be added, removed or reworded. A card
 * report holds no checks.
 */
export function invalidShape(existing: Pick<Report, 'reportType' | 'observations'>, incoming: readonly Observation[]): string | null {
  const type = reportTypeOf(existing);
  if (!type.checklist) return incoming.some(o => o.type === 'check' || o.check !== undefined) ? 'Checks belong to an inspection, not a site update.' : null;
  if (incoming.length !== existing.observations.length) return 'An inspection keeps every check: answer one rather than adding or removing it.';
  const before = new Map(existing.observations.map(o => [o.id, o]));
  for (const o of incoming) {
    const was = before.get(o.id);
    if (!was || o.type !== 'check' || !o.check || o.check.item !== was.check?.item || o.check.question !== was.check?.question) return 'An inspection keeps every check as it was asked.';
    if (o.check.answer !== undefined && !CHECK_ANSWERS.some(a => a.value === o.check!.answer)) return 'Unknown check answer.';
    // Only a correction links a check to the issue it raised, and the server sets that link.
    if (o.linkedIssueId !== was.linkedIssueId || (o.linkedIssueId !== undefined && !type.raisesRecords)) return 'A check is not linked to an issue.';
  }
  return null;
}

/** Answers so far, for the check step and the office: how many of each, and how many are still open. */
export function checkCounts(observations: readonly Observation[]): Record<CheckAnswer | 'open', number> {
  const counts = { ok: 0, action: 0, na: 0, open: 0 };
  for (const o of observations) if (o.type === 'check') counts[o.check?.answer ?? 'open'] += 1;
  return counts;
}
