import type { Observation } from './types';

/** Where a card or a photograph is, in the words the engineer sees. */
export type Where = 'server' | 'uploading' | 'pending' | 'phone';
export const WHERE: Record<Where, string> = {
  server: 'On the server',
  uploading: 'Uploading',
  pending: 'Not yet on the server',
  phone: 'Only on this phone',
};

/**
 * A card as the server last accepted it, for comparing with what is on screen.
 * Kept as text so a card is "on the server" only when every word and caption matches.
 */
export const savedCopy = (o: Observation): string => JSON.stringify(o, (_key, value: unknown) =>
  // Keys sorted, so a card the server stored in a different key order still matches.
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value);

export interface CardWhere {
  where: Where;
  /** The card's words, choices and captions match the server's copy; new photographs are counted apart. */
  text: boolean;
  photos: number;
  photosOnServer: number;
  /** Each photograph, in the card's order. */
  each: Where[];
}

/**
 * A photograph is on the server once the server's copy of the card includes
 * it: the server only accepts a card whose photographs it already holds
 * (validatePhotos.ts). Bytes uploaded for a card that has not saved yet are not
 * with the office, so they still count as pending.
 * `offline`: the server could not be reached, so pending work is only on this phone.
 */
export function photoWhere(photoId: string, uploading: boolean, savedIds: ReadonlySet<string>, offline: boolean): Where {
  if (savedIds.has(photoId)) return 'server';
  if (uploading) return 'uploading';
  return offline ? 'phone' : 'pending';
}

/** `saved`: the server's copy of this card (savedCopy), if it has one. */
export function cardWhere(o: Observation, saved: string | undefined, uploading: ReadonlySet<string>, offline: boolean): CardWhere {
  const server = saved === undefined ? undefined : JSON.parse(saved) as Observation;
  const savedIds = new Set(server?.photos.map(p => p.id) ?? []);
  const photos = o.photos.map(p => photoWhere(p.id, uploading.has(p.id), savedIds, offline));
  const photosOnServer = photos.filter(w => w === 'server').length;
  const whole = saved === savedCopy(o);
  // New photographs are counted on their own, so a card whose only change is
  // an added photo still has its words on the server.
  const text = whole || (!!server && server.photos.every(p => o.photos.some(q => q.id === p.id))
    && savedCopy({ ...o, photos: o.photos.filter(p => savedIds.has(p.id)) }) === saved);
  const where: Where = whole ? 'server'
    : photos.includes('uploading') ? 'uploading'
    : offline ? 'phone' : 'pending';
  return { where, text, photos: photos.length, photosOnServer, each: photos };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One line for the check step: is everything with the office, and if not, what is still to go up.
 * `others`: changes outside the cards on screen that also wait for a save.
 */
export function reportWhere(cards: readonly CardWhere[], offline: boolean, others: { removed: number; signature: boolean; noun?: 'card' | 'check' } = { removed: 0, signature: false }): { where: Where; text: string } {
  // An inspection's cards are its checks, and the engineer knows them by that name.
  const noun = others.noun ?? 'card';
  const photos = cards.reduce((n, c) => n + c.photos, 0);
  const left = cards.filter(c => !c.text).length;
  const leftPhotos = photos - cards.reduce((n, c) => n + c.photosOnServer, 0);
  if (!cards.length && !others.removed && !others.signature) return { where: 'server', text: '' };
  if (!left && !leftPhotos && !others.removed && !others.signature) {
    return { where: 'server', text: `${cards.length === 1 ? `The ${noun}` : cards.length === 2 ? `Both ${noun}s` : `All ${cards.length} ${noun}s`}${photos ? ` and ${photos === 1 ? (cards.length === 1 ? 'its photo' : '1 photo') : `${photos} photos`}` : ''} ${cards.length === 1 && !photos ? 'is' : 'are'} on the server.` };
  }
  const items = [left && plural(left, noun), leftPhotos && plural(leftPhotos, 'photo'),
    others.removed && plural(others.removed, `removed ${noun}`), others.signature && 'the signature'].filter((x): x is string => !!x);
  const parts = items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0]!;
  const sentence = parts.charAt(0).toUpperCase() + parts.slice(1);
  const many = left + leftPhotos + others.removed + (others.signature ? 1 : 0) > 1;
  if (cards.some(c => c.where === 'uploading')) return { where: 'uploading', text: `${sentence} ${many ? 'are' : 'is'} still uploading.` };
  return offline
    ? { where: 'phone', text: `${sentence} ${many ? 'are' : 'is'} only on this phone. ${many ? 'They go up by themselves' : 'It goes up by itself'} when the server can be reached.` }
    : { where: 'pending', text: `${sentence} ${many ? 'are' : 'is'} not yet on the server.` };
}
