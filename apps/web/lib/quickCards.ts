import type { Observation } from './types';

/**
 * A card with nothing in it: no place, no words, no photograph, no link and
 * none of a variation's answers. Its kind does not count, and nor does the
 * trade a defect fills in by itself from the engineer's own. A site update
 * opens on a blank progress card so the first card is one tap away; one never
 * used is left off when the engineer goes to check and send, since nothing in
 * it can be lost and it would only stop the report being sent.
 */
export function isBlankCard(o: Observation): boolean {
  return !o.check
    && !o.location.trim() && !o.whatHappened.trim() && !o.actionNeeded.trim() && !o.owner.trim()
    && o.photos.length === 0 && !o.linkedIssueId
    && o.variationReason === undefined && o.workDone === undefined && !o.askedBy?.trim()
    && o.roughSize === undefined && o.partsEstimate === undefined;
}

/** The cards less the blank ones; the same array when there are none, so nothing is saved for no change. */
export function withoutBlankCards(observations: Observation[]): Observation[] {
  return observations.some(isBlankCard) ? observations.filter(o => !isBlankCard(o)) : observations;
}

/**
 * The places to offer on a card: the ones already on this report first, the
 * latest card's first, then the project's recent places, each once whatever
 * its case or spacing. A second card in the same room is one tap, even before
 * the first has been saved.
 */
export function placesToOffer(observations: Observation[], exceptId: string, recent: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (place: string) => {
    const tidy = place.trim().replace(/\s+/g, ' ');
    const key = tidy.toLowerCase();
    if (!tidy || seen.has(key)) return;
    seen.add(key); out.push(tidy);
  };
  for (const o of [...observations].reverse()) if (o.id !== exceptId && !o.check) add(o.location);
  for (const place of recent) add(place);
  return out;
}
