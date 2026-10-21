import { ApiError } from './api';
import { PhotoRefused } from './localMedia';

/**
 * What the report editor says when a save or a send does not reach the
 * server, other than for no signal (which has its own words and state).
 *
 * Each says what happened, where the work is, and what happens next. `held`
 * is whether this device took a copy: only then may it say the work is kept.
 * `cardOf` names the card a photograph is on, so a refused one can be found.
 */
export type SaveProblemState = 'signedout' | 'server' | 'error';

const kept = (held: boolean) => held ? 'Your work is kept on this phone.' : 'This device would not keep a copy, so do not close this page.';

export function saveProblem(error: unknown, held: boolean, cardOf: (photoId: string) => string | undefined): { state: SaveProblemState; message: string } {
  if (error instanceof PhotoRefused) {
    const card = cardOf(error.photoId);
    const why = error.reason ? `${error.reason[0]!.toLowerCase()}${error.reason.slice(1)}` : 'the server would not take it.';
    return { state: 'error', message: `A photograph on ${card ? `the card “${card}”` : 'a card'} was not accepted: ${why} Remove it and take it again. ${kept(held)}` };
  }
  if (error instanceof ApiError && error.signedOut) {
    return { state: 'signedout', message: `You have been signed out, so this is not saved to the server yet. ${kept(held)} Sign in again and it saves by itself.` };
  }
  if (error instanceof ApiError && error.passing) {
    return { state: 'server', message: `RELAY’s server is not answering just now, so this is not saved to the server yet. ${kept(held)} RELAY tries again by itself.` };
  }
  const said = error instanceof Error && error.message ? error.message : 'This could not be saved to the server.';
  return { state: 'error', message: `${said} ${kept(held)}` };
}

export function sendProblem(error: unknown, held: boolean, cardOf: (photoId: string) => string | undefined): string {
  if (error instanceof ApiError && error.signedOut) return `You have been signed out, so this has not been sent. ${kept(held)} Sign in again, then send it.`;
  if (error instanceof ApiError && error.passing) return `RELAY’s server is not answering just now, so this has not been sent. ${kept(held)} Try again in a minute.`;
  if (error instanceof PhotoRefused) return saveProblem(error, held, cardOf).message.replace('was not accepted', 'was not accepted, so this has not been sent');
  const said = error instanceof Error && error.message ? error.message : 'This could not be sent.';
  return `${said} ${kept(held)}`;
}
