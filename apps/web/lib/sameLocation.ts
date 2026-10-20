import type { Observation } from './types';

/** Locations match when they read the same, ignoring case and spaces at either end. */
export function sameLocationText(a: string, b: string): boolean {
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
  return !!x && x === y;
}

/**
 * Another card at the same place as `source`.
 *
 * Only the location carries over. What was found, the action, who needs to
 * respond, photographs, a linked issue and the variation answers all belong to
 * the earlier card, so the new one starts from `fresh` (a blank card) with its
 * own id and kind. Copying evidence would put one photograph on two records.
 */
export function cardAtSameLocation(source: Observation, fresh: Observation): Observation {
  return { ...fresh, location: source.location.trim() };
}

/**
 * The cards with `card` placed after the source card and any cards already
 * added at the same place straight after it, so a run of cards for one room
 * stays together and in the order they were added. If the source has gone,
 * the card goes on the end.
 */
export function insertAfterSameLocation(observations: Observation[], sourceId: string, card: Observation): Observation[] {
  const at = observations.findIndex(o => o.id === sourceId);
  const source = observations[at];
  if (!source) return [...observations, card];
  let end = at + 1;
  while (end < observations.length && sameLocationText(observations[end]?.location ?? '', source.location)) end++;
  return [...observations.slice(0, end), card, ...observations.slice(end)];
}
