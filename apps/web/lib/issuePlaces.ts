import type { Issue } from './types';
import { sameLocation } from './issueLink';
import { naturalOrder } from './naturalOrder';

/** One place to pick on the Issues tab, as people typed it, and how many of the issues listed are there. */
export interface IssuePlace { place: string; count: number }

/**
 * The places typed on these issues, to pick where you are standing (2026-10-22).
 *
 * There is no list of places to keep up to date (EXP-4): the choices are the
 * places already written on the issues, one per place however it was typed
 * ("Flat 204 kitchen" and "flat 204 kitchen " are one), in the spelling used
 * most, in natural order ("Level 2" before "Level 10"). The count is what
 * `issuesAtPlace` would list, so a place also counts the smaller places inside
 * it ("Flat 204" counts "Flat 204 kitchen"). Issues with no place are not offered.
 */
export function issuePlaces(issues: Issue[]): IssuePlace[] {
  const spellings = new Map<string, Map<string, number>>();
  for (const i of issues) {
    const place = i.location.trim().replace(/\s+/g, ' ');
    if (!place) continue;
    const key = place.toLowerCase();
    const seen = spellings.get(key) ?? new Map<string, number>();
    seen.set(place, (seen.get(place) ?? 0) + 1);
    spellings.set(key, seen);
  }
  return [...spellings.values()]
    .map(seen => [...seen].sort((a, b) => b[1] - a[1])[0]![0])
    .map(place => ({ place, count: issuesAtPlace(issues, place).length }))
    .sort((a, b) => naturalOrder(a.place, b.place));
}

/**
 * The issues at `place` or a smaller place inside it, in the order given; every
 * issue when no place is chosen. Only inward: "Flat 204" lists "Flat 204
 * kitchen", but "Flat 204 kitchen" does not list "Flat 204" or every "Kitchen".
 */
export function issuesAtPlace(issues: Issue[], place: string): Issue[] {
  const length = squash(place).length;
  return length ? issues.filter(i => squash(i.location).length >= length && sameLocation(i, place)) : issues;
}
const squash = (place: string) => place.trim().toLowerCase().replace(/\s+/g, ' ');
