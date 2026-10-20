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

/** True when either location contains the other, ignoring case and outer spaces. */
export function sameLocation(issue: Issue, location: string): boolean {
  const a = issue.location.trim().toLowerCase(), b = location.trim().toLowerCase();
  return !!a && !!b && (a.includes(b) || b.includes(a));
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
