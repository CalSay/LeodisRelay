/**
 * What people are told when a request to RELAY's server fails.
 *
 * Every message says three things in the app's own voice: what happened,
 * whether the person's work is safe, and what to do next. A status code, a
 * proxy's error page or a browser's "Failed to fetch" is never the message;
 * the server's own `reason` is used when it gave one, because those are
 * already written for people.
 *
 * `kept` is the caller's word on the work ("What you typed is still here."),
 * because only the screen knows whether there was any.
 */

export type FailureKind = 'signed-out' | 'cross-site' | 'too-big' | 'server' | 'not-found' | 'refused';

/** Said by middleware when a change does not come from a RELAY page (lib/crossSite.ts). */
export const CROSS_SITE_CODE = 'cross-site';

export function failureKind(status: number, code?: string): FailureKind {
  if (status === 401) return 'signed-out';
  if (status === 403 && code === CROSS_SITE_CODE) return 'cross-site';
  if (status === 413) return 'too-big';
  if (status === 404) return 'not-found';
  if (status >= 500 || status === 429 || status === 408) return 'server';
  return 'refused';
}

/** A failure the server or the network will likely clear by itself: worth trying again without asking. */
export function passingFailure(status: number | undefined, code?: string): boolean {
  if (status === undefined) return false;
  const kind = failureKind(status, code);
  return kind === 'server' || kind === 'signed-out' || kind === 'cross-site';
}

const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ');

/**
 * The words for a failed request. `what` is the failure as a sentence ("The
 * note could not be saved."); `reason` is the server's own words, if any.
 */
export function failureMessage(status: number, reason: string | undefined, what: string, kept?: string, code?: string): string {
  switch (failureKind(status, code)) {
    case 'signed-out':
      return join(what, 'You have been signed out.', kept, 'Sign in again, then try again.');
    case 'cross-site':
      return join(what, 'RELAY could not tell it came from its own page, so nothing was changed.', kept, 'Reload the page and try again.');
    case 'too-big':
      return join(what, reason && !/^Request|^Payload/i.test(reason) ? reason : 'It is too big to send.', kept);
    case 'server':
      // A reason from RELAY itself (SharePoint not answering, say) is better than a guess.
      if (reason) return join(reason, kept);
      return join(what, status === 502 || status === 503 || status === 504
        ? 'RELAY’s server could not be reached just now.'
        : 'Something went wrong on RELAY’s server.', kept, 'Try again in a minute. If it keeps happening, tell the office.');
    case 'not-found':
      // "No such issue." is the server talking to itself; a fuller reason is kept.
      return reason && !/^No such |not found\.?$/i.test(reason) ? join(reason, kept) : join(what, 'It could not be found. It may have been removed, or the link may be wrong.', kept);
    default:
      return reason ? join(reason, kept) : join(what, kept, 'Try again. If it keeps happening, tell the office.');
  }
}

/** The event the sign-in prompt listens for (components/SignedOutPrompt.tsx). */
export const SIGNED_OUT_EVENT = 'relay:signed-out';

/** Tell the page the session has gone, so the sign-in prompt shows once, wherever the failure was. */
export function noteSignedOut(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
}

/** An error with the failure's status kept, so a screen can tell signed out or a server fault from a refusal. */
export class RequestFailure extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
  get kind(): FailureKind { return failureKind(this.status, this.code); }
}

/**
 * The error for a failed response, from its body already read as JSON (or
 * `{}` when it was not JSON, as a proxy's error page is not).
 */
export function failure(status: number, body: { reason?: unknown; code?: unknown } | null | undefined, what: string, kept?: string): RequestFailure {
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason : undefined;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  if (status === 401) noteSignedOut();
  return new RequestFailure(failureMessage(status, reason, what, kept, code), status, code);
}

/** No connection at all: fetch itself rejected. */
export function offlineMessage(what: string, kept?: string): string {
  return join(what, 'There is no connection.', kept, 'Try again when there is signal.');
}
