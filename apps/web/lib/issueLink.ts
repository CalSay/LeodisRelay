import type { Issue, Photo } from './types';

/** How many open issues the link picker lists before "Show all". */
export const LINK_PICKER_SIZE = 6;

/**
 * The open issues a card can be linked to, in the order the picker lists them.
 *
 * Issues at the card's location come first, so a repeat sighting is near the
 * top; otherwise the order the server gave is kept. The issue the card is
 * already linked to is always listed, even when it would fall past the limit,
 * so the picker never hides the current answer. `hidden` is how many more a
 * "Show all" would add.
 */
export function linkCandidates(issues: Issue[], location: string, linkedId: string | undefined, showAll = false): { shown: Issue[]; hidden: number } {
  const ordered = issues.slice().sort((a, b) => Number(sameLocation(b, location)) - Number(sameLocation(a, location)));
  if (showAll) return { shown: ordered, hidden: 0 };
  const shown = ordered.slice(0, LINK_PICKER_SIZE);
  const linked = linkedId ? ordered.find(i => i.id === linkedId) : undefined;
  if (linked && !shown.includes(linked)) shown.unshift(linked);
  return { shown, hidden: ordered.length - shown.length };
}

/**
 * True when the places are the same, or one is inside the other, ignoring case
 * and spaces: "Block E" matches "Block E, flat 2.04", and "Flat 2" matches
 * "Flat 2.04", so a defect seen again in a smaller or larger part of the same
 * place still finds its issue. Places are typed, not picked from a list, so this
 * is the nearest RELAY has to "the same place". The shorter one has to sit
 * between word edges: "Level 1" does not match "Level 12", nor "Riser 2" "Riser 20".
 */
export function sameLocation(issue: Issue, location: string): boolean {
  const a = squash(issue.location), b = squash(location);
  if (!a || !b) return false;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  for (let at = long.indexOf(short); at >= 0; at = long.indexOf(short, at + 1)) {
    const starts = !wordChar(long[at - 1]) || !wordChar(short[0]);
    const ends = !wordChar(long[at + short.length]) || !wordChar(short.at(-1));
    if (starts && ends) return true;
  }
  return false;
}
const squash = (place: string) => place.trim().toLowerCase().replace(/\s+/g, ' ');
const wordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);

/**
 * What a defect or access card asks about (2026-10-22): only the open issues at
 * the card's place, plus the issue it is linked to wherever that is, so a link
 * made before is never hidden. `elsewhere` is how many other open issues a
 * "Link to an issue somewhere else" fold would list. With no place typed yet,
 * nothing is asked about.
 */
export function issuesHere(issues: Issue[], location: string, linkedId: string | undefined): { here: Issue[]; elsewhere: number } {
  const here = issues.filter(i => sameLocation(i, location) || i.id === linkedId);
  return { here, elsewhere: issues.length - here.length };
}

/** The first photograph on the issue's history, which is usually the one taken when it was raised. */
export function issueThumbnail(issue: Issue): Photo | undefined {
  return (issue.events ?? []).find(e => e.photos?.length)?.photos[0];
}

/** "ISS-004" from "011LME-ISS-004": the project prefix is the same on every row. */
export function shortReference(reference: string): string {
  const parts = reference.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : reference;
}
