/**
 * Quick actions on a received report: client-side types and the rules the
 * Inbox reader uses to decide which corrections to offer.
 *
 * The server is the authority (it answers 409 when a record has moved on);
 * these rules only stop the office from being offered a button that is bound
 * to be refused, and say why.
 */
import type { Correction, CorrectionAction, Issue, Variation } from '@/lib/types';
import { isActive, isOverdue, shortRef } from './model';

export type { Correction, CorrectionAction } from '@/lib/types';
export type CorrectionTarget = Correction['targetType'];
export interface CorrectionBody {
  reportId: string; observationId: string; action: CorrectionAction;
  targetType: CorrectionTarget; targetId?: string; relatedId?: string; note: string;
}
export interface CorrectionResult { correction: Correction; issue?: Issue; variation?: Variation; related?: Issue | Variation }

export const OUR_CONTRACT = 'Leodis M&E (our contract)';

/** Quick actions are for managers and administrators; the server enforces the same. */
export const canCorrect = (role: string): boolean => role === 'Manager' || role === 'Admin';

export const isWithinContract = (v: Variation): boolean => v.instruction === 'within_contract';
export const duplicateOf = (r: Issue | Variation): string | undefined => r.duplicateOf;

export type Target = { type: 'issue'; record: Issue } | { type: 'variation'; record: Variation } | { type: 'observation' };
export interface ModeRule { on: boolean; why?: string }

function variationState(v: Variation): string {
  if (isWithinContract(v)) return 'within contract';
  return v.instruction === 'instructed' ? 'instructed' : v.instruction === 'declined' ? 'declined' : 'awaiting instruction';
}

/** Which modes a section offers, and for the ones switched off, the reason. */
export function modesFor(t: Target): Partial<Record<CorrectionAction, ModeRule>> {
  if (t.type === 'observation') return { note: { on: true } };
  const code = shortRef(t.record.reference);
  if (t.type === 'issue') {
    const i = t.record;
    const gone = !isActive(i) ? `${code} is ${i.confirmation === 'withdrawn' ? 'withdrawn' : 'closed'}, so it can't be changed from here.` : undefined;
    const dup = duplicateOf(i) ? `${code} is already linked to another issue.` : undefined;
    const ours = i.owner.trim() === OUR_CONTRACT ? `${code} is already ${OUR_CONTRACT}.` : undefined;
    return {
      within_contract: { on: !(gone || dup || ours), why: gone ?? dup ?? ours },
      already_raised: { on: !(gone || dup), why: gone ?? dup },
      note: { on: true },
    };
  }
  const v = t.record;
  const moved = v.instruction !== 'pending' ? `${code} is ${variationState(v)}, so only a pending variation can be changed.` : undefined;
  const dup = duplicateOf(v) ? `${code} is already linked to another variation.` : undefined;
  return {
    within_contract: { on: !(moved || dup), why: moved ?? dup },
    already_raised: { on: !(moved || dup), why: moved ?? dup },
    note: { on: true },
  };
}

/** Open records of the same kind on the same project that a new record might duplicate. */
export function pickPool(t: Target, issues: Issue[], variations: Variation[]): (Issue | Variation)[] {
  if (t.type === 'issue') return issues.filter(i => i.projectId === t.record.projectId && i.id !== t.record.id && isActive(i) && !duplicateOf(i));
  if (t.type === 'variation') return variations.filter(v => v.projectId === t.record.projectId && v.id !== t.record.id && v.instruction === 'pending' && !duplicateOf(v));
  return [];
}

/** A short status, as one of the office's tags, for a record offered in the duplicate picker. */
export function pickTag(r: Issue | Variation, day: string): { label: string; cls: string } {
  if ('work' in r) {
    if (isOverdue(r, day)) return { label: 'Overdue', cls: 'tag-alert' };
    if (r.work === 'awaiting_verification') return { label: 'Ready to verify', cls: 'tag-caution' };
    if (!r.owner.trim()) return { label: 'Unassigned', cls: 'tag-caution' };
    return { label: 'Open', cls: 'tag-quiet' };
  }
  if (r.workDone) return { label: 'Work done without instruction', cls: 'tag-alert' };
  if (r.quotedValue === undefined) return { label: 'Not priced', cls: 'tag-caution' };
  return { label: 'Awaiting instruction', cls: 'tag-quiet' };
}

/**
 * The owner an issue had before it was moved to our contract. Read from the
 * correction's detail ("From X to Y") when it says so; otherwise the owner the
 * engineer recorded on the section.
 */
export function priorOwner(c: Correction, recorded: string): string {
  const m = /from\s+(.+?)\s+to\s+/i.exec(c.detail);
  return m?.[1]?.trim() || recorded.trim() || 'no owner';
}
