import type { DraftSignature, Observation, Report } from './types';
import { savedCopy } from './uploadStatus';

/**
 * Two versions of one draft: the one on this screen, and the one another tab
 * or device saved to the server first. Every card from both is shown, with a
 * choice wherever they differ, and nothing is merged without being shown.
 *
 * When this screen knows the server copy it last built on (`base`), the
 * suggested choice follows what actually changed: a card only the server
 * changed suggests the server's wording, and a card one side removed while the
 * other left it alone suggests leaving it out. Without a base (a draft opened
 * with no connection) a card in one version only might have been added here or
 * removed there, so every card from both is kept by default.
 */

/** `same`: identical in both. `changed`: in both, different. `here` / `there`: only on this screen / only on the server. */
export type CardStatus = 'same' | 'changed' | 'here' | 'there';
export interface CardDiff {
  id: string; status: CardStatus; here?: Observation; there?: Observation;
  /** What the base says happened, when it is known: which side changed or removed the card. */
  change?: 'changed-there' | 'changed-here' | 'removed-there' | 'removed-here';
}
/** The server copy this screen last built on: each card as savedCopy, and the signature as JSON. */
export interface DraftBase { cards: Record<string, string>; signature?: string }

/** Per card. `here` / `there` keeps that version, `both` keeps the two as separate cards, `none` leaves the card out. */
export type CardChoice = 'here' | 'there' | 'both' | 'none';

export interface DraftComparison {
  cards: CardDiff[];
  /** The signature differs (one has none, or a different name or drawing). */
  signature: boolean;
  /** Anything differs at all. When nothing does, the server's copy simply replaces this one. */
  differs: boolean;
  /** Which signature to suggest: the server's when only the server changed it. */
  signatureChoice: 'here' | 'there';
}

const sigCopy = (s: DraftSignature | undefined) => JSON.stringify(s ?? null);

/**
 * Cards in this screen's order, with cards only on the server placed after the
 * card they follow there, so a card added elsewhere appears where it was put.
 */
export function compareDrafts(here: Report, there: Report, base?: DraftBase): DraftComparison {
  const theirs = new Map(there.observations.map(o => [o.id, o]));
  const was = (o: Observation) => base?.cards[o.id];
  const cards: CardDiff[] = here.observations.map(o => {
    const other = theirs.get(o.id);
    if (!other) return { id: o.id, status: 'here', here: o, ...(was(o) === savedCopy(o) ? { change: 'removed-there' as const } : {}) };
    if (savedCopy(o) === savedCopy(other)) return { id: o.id, status: 'same', here: o, there: other };
    const change = was(o) === savedCopy(o) ? 'changed-there' as const : was(o) === savedCopy(other) ? 'changed-here' as const : undefined;
    return { id: o.id, status: 'changed', here: o, there: other, ...(change ? { change } : {}) };
  });
  const placed = new Set(cards.map(c => c.id));
  let after = -1;
  for (const o of there.observations) {
    if (placed.has(o.id)) { after = cards.findIndex(c => c.id === o.id); continue; }
    cards.splice(after + 1, 0, { id: o.id, status: 'there', there: o, ...(was(o) === savedCopy(o) ? { change: 'removed-here' as const } : {}) });
    after += 1;
  }
  const signature = sigCopy(here.draftSignature) !== sigCopy(there.draftSignature);
  const signatureChoice = signature && base?.signature !== undefined && base.signature === sigCopy(here.draftSignature) ? 'there' : 'here';
  return { cards, signature, differs: signature || cards.some(c => c.status !== 'same'), signatureChoice };
}

/**
 * What each card starts as. Where the base shows only one side touched a card,
 * that side's change; otherwise this screen's wording, and every card either
 * version has, so accepting the suggestions never loses an edit.
 */
export function defaultChoice(card: CardDiff): CardChoice {
  // A card removed on one side and edited on the other carries no `change`, so it is kept.
  if (card.change === 'changed-there') return 'there';
  if (card.change === 'removed-there' || card.change === 'removed-here') return 'none';
  return card.status === 'there' ? 'there' : 'here';
}

/** The choices that make sense for a card. */
export function choicesFor(card: CardDiff): CardChoice[] {
  switch (card.status) {
    case 'same': return ['here'];
    case 'changed': return ['here', 'there', 'both'];
    case 'here': return ['here', 'none'];
    case 'there': return ['there', 'none'];
  }
}

/**
 * The draft to save: the server's copy with the chosen cards and signature.
 * Built on the server's version, so the save that follows is accepted only if
 * nothing has changed again in the meantime. `newId` names the second card
 * when both wordings of one card are kept.
 */
export function mergeDrafts(
  here: Report, there: Report, comparison: DraftComparison,
  choices: Readonly<Record<string, CardChoice>>, signature: 'here' | 'there',
  newId: () => string,
): Report {
  const observations: Observation[] = [];
  for (const card of comparison.cards) {
    const allowed = choicesFor(card);
    const asked = choices[card.id] ?? defaultChoice(card);
    const choice = allowed.includes(asked) ? asked : defaultChoice(card);
    if (choice === 'none') continue;
    if (choice === 'here' && card.here) observations.push(card.here);
    else if (choice === 'there' && card.there) observations.push(card.there);
    else if (choice === 'both' && card.here && card.there) observations.push(card.here, { ...card.there, id: newId() });
  }
  const { draftSignature: _theirs, ...rest } = there;
  const kept = signature === 'here' ? here.draftSignature : there.draftSignature;
  return { ...rest, observations, ...(kept ? { draftSignature: kept } : {}) };
}

/** One line on what saving the chosen version does, so nothing is left out without saying so. */
export function mergeSummary(comparison: DraftComparison, choices: Readonly<Record<string, CardChoice>>): string {
  let kept = 0, dropped = 0, replaced = 0;
  for (const card of comparison.cards) {
    const allowed = choicesFor(card);
    const asked = choices[card.id] ?? defaultChoice(card);
    const choice = allowed.includes(asked) ? asked : defaultChoice(card);
    if (choice === 'none') dropped += 1;
    else kept += choice === 'both' ? 2 : 1;
    if (card.status === 'changed' && choice !== 'both') replaced += 1;
  }
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [`Saving keeps ${plural(kept, 'card', 'cards')}.`];
  if (dropped) parts.push(`${plural(dropped, 'card is', 'cards are')} left out.`);
  if (replaced) parts.push(`${plural(replaced, 'card keeps', 'cards keep')} one wording and drop${replaced === 1 ? 's' : ''} the other.`);
  return parts.join(' ');
}
