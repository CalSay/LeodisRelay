import type { Observation, Report } from './types';
import { compareDrafts, type DraftBase } from './draftConflict';

/**
 * A draft was sent from another tab or device while this screen still held
 * changes that never reached the server. The sent revision is never touched:
 * the changes are offered as a correction, a new draft at the next revision.
 *
 * What goes into it is the sent report with this screen's own changes laid on
 * top. Where the screen knows the server copy it last built on (`base`), a card
 * the other screen changed or removed, and this one left alone, keeps the sent
 * version, so starting the correction never quietly undoes what was sent. Where
 * both changed a card, or the base is not known, this screen's wording is used
 * and the card is marked to check: the sent wording stays on file in the sent
 * revision either way. A card only in the sent report is kept unless this
 * screen is known to have removed it.
 */

/** `changed`: edited here. `added`: only on this screen. `removed`: removed here, still in the sent report. */
export type UnsentKind = 'changed' | 'added' | 'removed';
/**
 * Why a change needs a look before the correction is sent.
 * `both`: the other screen changed this card too; this screen's wording is used.
 * `removed-there`: the other screen removed the card this screen edited; it is put back.
 * `maybe-removed`: with no base it cannot be told whether the other screen removed it.
 * `edited-there`: this screen removed it, but the other screen edited it, so it is kept.
 */
export type UnsentCheck = 'both' | 'removed-there' | 'maybe-removed' | 'edited-there';
export interface UnsentChange {
  id: string; kind: UnsentKind;
  /** The card as it goes into the correction, or as it was sent for a removal. */
  card: Observation;
  check?: UnsentCheck;
}
export interface UnsentWork {
  /** This screen's changes the sent report does not have, in correction order. Empty when nothing is lost. */
  changes: UnsentChange[];
  /** The cards to start the correction with. */
  observations: Observation[];
}

export function unsentWork(here: Report, sent: Report, base?: DraftBase): UnsentWork {
  // The signature is left out: the sent report carries its own, and a correction is signed when it is sent.
  const { draftSignature: _here, ...mine } = here;
  const { draftSignature: _sent, ...theirs } = sent;
  const inBase = (id: string) => base?.cards[id] !== undefined;
  const changes: UnsentChange[] = [];
  const observations: Observation[] = [];
  for (const card of compareDrafts(mine as Report, theirs as Report, base).cards) {
    if (card.status === 'same') observations.push(card.there!);
    else if (card.status === 'changed') {
      if (card.change === 'changed-there') { observations.push(card.there!); continue; }
      observations.push(card.here!);
      changes.push({ id: card.id, kind: 'changed', card: card.here!, ...(card.change === 'changed-here' ? {} : { check: 'both' as const }) });
    } else if (card.status === 'here') {
      // Removed on the other screen before it sent, and not touched here.
      if (card.change === 'removed-there') continue;
      observations.push(card.here!);
      // In the base, so it was there before: the other screen removed a card this one edited.
      if (inBase(card.id)) changes.push({ id: card.id, kind: 'changed', card: card.here!, check: 'removed-there' });
      else changes.push({ id: card.id, kind: 'added', card: card.here!, ...(base ? {} : { check: 'maybe-removed' as const }) });
    } else if (card.change === 'removed-here') {
      changes.push({ id: card.id, kind: 'removed', card: card.there! });
    } else {
      observations.push(card.there!);
      // Removed here but edited on the other screen: kept, and said so rather than dropped quietly.
      if (inBase(card.id)) changes.push({ id: card.id, kind: 'removed', card: card.there!, check: 'edited-there' });
    }
  }
  return { changes, observations };
}

/**
 * The cards on the correction draft the server made. Starting a correction
 * points each defect or access card at the issue the sent report raised, so
 * sending it adds a sighting rather than a second issue; the same card from
 * this screen gets the same link.
 */
export function carryIntoCorrection(observations: readonly Observation[], correction: Report): Observation[] {
  const linked = new Map(correction.observations.filter(o => o.linkedIssueId).map(o => [o.id, o.linkedIssueId!]));
  return observations.map(o => !o.linkedIssueId && linked.has(o.id) ? { ...o, linkedIssueId: linked.get(o.id)! } : o);
}

/** What the correction is for, printed on it. Suggested, and the engineer can change it. */
export const SENT_ELSEWHERE_REASON = 'Adds changes that had not been saved when this report was sent from another screen.';
