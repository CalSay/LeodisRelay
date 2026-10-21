/**
 * Site updates the engineer tapped "Send to office" on with no signal
 * (2026-10-21). One goes by itself when the phone has signal again, from
 * whichever RELAY page is open (lib/heldUpdate.ts, components/SendOnSignal.tsx),
 * and when RELAY is next opened; meanwhile the home screen says it is still to go.
 *
 * Kept per device in localStorage as report and person only: the work itself
 * is the copy the editor already holds on the phone (localDraft.ts), so
 * nothing here can send words or a signature the engineer did not check.
 * Going back to the cards, changing the signature, another version arriving
 * from elsewhere, or "Don't send yet" takes it off this list. A report sent
 * from another device keeps its line here until reopened on this one, which
 * is harmless: the home screen only reads it against drafts.
 */
export const SEND_ON_SIGNAL_KEY = 'relay-send-on-signal';

/**
 * `seq` is the held copy's edit number when Send was tapped, so only that
 * copy goes by itself away from its page; `what` names it for the words
 * ("site update"). Both are missing from lines written before 2026-10-21's
 * second change: those go only from the report's own page, as before.
 */
export interface WaitingToSend { reportId: string; principalId: string; at: string; seq?: number | string; what?: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (given?: Store): Store | undefined => {
  if (given) return given;
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
};

function read(s: Store | undefined): WaitingToSend[] {
  if (!s) return [];
  try {
    const list: unknown = JSON.parse(s.getItem(SEND_ON_SIGNAL_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((w): w is WaitingToSend => !!w && typeof w.reportId === 'string' && typeof w.principalId === 'string' && typeof w.at === 'string'
      && (w.seq === undefined || typeof w.seq === 'string' || typeof w.seq === 'number') && (w.what === undefined || typeof w.what === 'string')) : [];
  } catch { return []; }
}

/** Said on this page when the list changes (other tabs hear a storage event), so the home screen's words keep up. */
export const SEND_ON_SIGNAL_EVENT = 'relay-send-on-signal';

function write(s: Store | undefined, list: WaitingToSend[]): void {
  if (!s) return;
  try { if (list.length) s.setItem(SEND_ON_SIGNAL_KEY, JSON.stringify(list)); else s.removeItem(SEND_ON_SIGNAL_KEY); }
  catch { /* Storage blocked or full: the editor still sends while it is open. */ }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(SEND_ON_SIGNAL_EVENT));
}

/** Reports `principalId` is waiting to send from this device. */
export const waitingToSend = (principalId: string, given?: Store): string[] =>
  waitingLines(principalId, given).map(w => w.reportId);

/** The same, with what each line holds. */
export const waitingLines = (principalId: string, given?: Store): WaitingToSend[] =>
  read(store(given)).filter(w => w.principalId === principalId);

export const isWaitingToSend = (reportId: string, principalId: string, given?: Store): boolean =>
  waitingToSend(principalId, given).includes(reportId);

/** The engineer tapped Send with no signal: send it as soon as there is some. */
export function markWaitingToSend(reportId: string, principalId: string, at = new Date().toISOString(), given?: Store, held: Pick<WaitingToSend, 'seq' | 'what'> = {}): void {
  const s = store(given);
  write(s, [...read(s).filter(w => !(w.reportId === reportId && w.principalId === principalId)), { reportId, principalId, at,
    ...(held.seq !== undefined ? { seq: held.seq } : {}), ...(held.what ? { what: held.what } : {}) }]);
}

/** Sent, changed, refused or taken back: no longer waiting, for anyone on this device. */
export function clearWaitingToSend(reportId: string, given?: Store): void {
  const s = store(given);
  const list = read(s);
  if (list.some(w => w.reportId === reportId)) write(s, list.filter(w => w.reportId !== reportId));
}
