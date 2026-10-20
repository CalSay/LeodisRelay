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
export type ReportTypeId = 'progress' | 'safety-inspection';

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
  /** Printed on the document. */
  document: string;
  /** The middle of the reference: 011LME-SPR-004, 011LME-SSI-001. */
  code: string;
  /** One line on the home screen tile. */
  blurb: string;
  /** Fixed questions, answered one by one. Absent: free cards. */
  checklist?: readonly ChecklistItem[];
  /** The person who inspected signs for it: a typed name alone is not enough. */
  drawnSignature: boolean;
  /** Sending raises issues from defects and access cards, and variations from variation cards. */
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

export const REPORT_TYPES: readonly ReportTypeDef[] = [
  { id: 'progress', name: 'Site update', document: 'Site Progress Report', code: 'SPR', blurb: 'Progress, defects, variations and access, one card at a time', drawnSignature: false, raisesRecords: true },
  { id: 'safety-inspection', name: 'Safety inspection', document: 'Site Safety Inspection', code: 'SSI', blurb: `${SAFETY_CHECKLIST.length} checks, each satisfactory, action needed or not applicable`, checklist: SAFETY_CHECKLIST, drawnSignature: true, raisesRecords: false },
];

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
    if (o.linkedIssueId !== undefined) return 'A check is not linked to an issue.';
  }
  return null;
}

/** Answers so far, for the check step and the office: how many of each, and how many are still open. */
export function checkCounts(observations: readonly Observation[]): Record<CheckAnswer | 'open', number> {
  const counts = { ok: 0, action: 0, na: 0, open: 0 };
  for (const o of observations) if (o.type === 'check') counts[o.check?.answer ?? 'open'] += 1;
  return counts;
}
