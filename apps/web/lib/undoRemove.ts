import type { Observation, Photo } from './types';
import { mediaId } from './media';

/**
 * What was just removed from a draft, kept so it can be put back exactly as it
 * was: the same card or photograph object, with its id, so putting it back
 * restores the record rather than saving a copy of it, and a photograph whose
 * bytes already reached the server is not sent again.
 */
export type Removed =
  | { kind: 'card'; card: Observation; at: number; after: string | null; picking: boolean }
  | { kind: 'photo'; cardId: string; photo: Photo; at: number; after: string | null };

/** The cards without `cardId`, and what to keep for undo. Nothing changes if the card is not there. */
export function removeCard(observations: Observation[], cardId: string, picking = false): { observations: Observation[]; removed?: Removed } {
  const at = observations.findIndex(o => o.id === cardId);
  const card = observations[at];
  if (!card) return { observations };
  return {
    observations: observations.filter(o => o.id !== cardId),
    removed: { kind: 'card', card, at, after: observations[at - 1]?.id ?? null, picking },
  };
}

/** The cards with one photograph taken off `cardId`, and what to keep for undo. */
export function removePhoto(observations: Observation[], cardId: string, photoId: string): { observations: Observation[]; removed?: Removed } {
  const card = observations.find(o => o.id === cardId);
  const at = card ? card.photos.findIndex(p => p.id === photoId) : -1;
  const photo = card?.photos[at];
  if (!card || !photo) return { observations };
  return {
    observations: observations.map(o => o.id === cardId ? { ...o, photos: o.photos.filter(p => p.id !== photoId) } : o),
    removed: { kind: 'photo', cardId, photo, at, after: card.photos[at - 1]?.id ?? null },
  };
}

/**
 * The cards with `removed` put back where it was: after whatever was in front
 * of it if that is still there, otherwise at its old position.
 *
 * Undoing twice changes nothing, so the card or photograph is never there
 * twice. Returns null when a photograph's card has gone, as there is nowhere
 * to put it back.
 */
export function restoreRemoved(observations: Observation[], removed: Removed): Observation[] | null {
  if (removed.kind === 'card') {
    if (observations.some(o => o.id === removed.card.id)) return observations;
    return placeBack(observations, removed.card, removed.after, removed.at);
  }
  const card = observations.find(o => o.id === removed.cardId);
  if (!card) return null;
  if (card.photos.some(p => p.id === removed.photo.id)) return observations;
  const photos = placeBack(card.photos, removed.photo, removed.after, removed.at);
  return observations.map(o => o.id === removed.cardId ? { ...o, photos } : o);
}

function placeBack<T extends { id: string }>(items: T[], item: T, after: string | null, at: number): T[] {
  const anchor = after === null ? -1 : items.findIndex(x => x.id === after);
  const index = after === null ? 0 : anchor >= 0 ? anchor + 1 : Math.min(at, items.length);
  return [...items.slice(0, index), item, ...items.slice(index)];
}

/**
 * Whether Undo can be offered. A photograph kept inline in a draft from before
 * the upload service is accepted by the server only while it still holds it,
 * so once the removal has saved it could not be put back: no Undo is offered
 * rather than one that would fail.
 */
export function canUndo(removed: Removed): boolean {
  const photos = removed.kind === 'card' ? removed.card.photos : [removed.photo];
  return photos.every(p => mediaId(p.dataUrl) !== null);
}

/** One line saying what was removed, for the undo bar. Card and photo numbers count from 1. */
export function removedLabel(removed: Removed, cardNumber: number, kindLabel: string): { title: string; detail: string } {
  const no = String(cardNumber).padStart(2, '0');
  if (removed.kind === 'photo') {
    return { title: `Photograph ${String(removed.at + 1).padStart(2, '0')} removed`, detail: removed.photo.caption.trim() || `From card ${no}` };
  }
  const { card } = removed;
  const photos = card.photos.length ? ` · ${card.photos.length} photograph${card.photos.length === 1 ? '' : 's'}` : '';
  return { title: `Card ${no} removed`, detail: `${removed.picking ? 'New card' : kindLabel} · ${card.location.trim() || 'no location'}${photos}` };
}
