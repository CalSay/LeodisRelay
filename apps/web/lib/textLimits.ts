/** The most one text box on a card or check may hold. Far beyond anything typed on site (security review, 2026-10-21). */
export const TEXT_MAX = 10_000;

/** The longest of a card's boxes, when it is over the limit, so the card can say so before a save is refused. */
export function overLimit(o: { location: string; whatHappened: string; actionNeeded: string; owner: string }): number | null {
  const longest = Math.max(o.location.length, o.whatHappened.length, o.actionNeeded.length, o.owner.length);
  return longest > TEXT_MAX ? longest : null;
}
