/**
 * Site updates the engineer tapped "Send to office" on with no signal
 * (2026-10-21). The report's editor sends one by itself when the phone has
 * signal again, as long as RELAY is open; if the page is closed first, the
 * home screen says it is still to go, and opening it sends it.
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

export interface WaitingToSend { reportId: string; principalId: string; at: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (given?: Store): Store | undefined => {
  if (given) return given;
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
};

function read(s: Store | undefined): WaitingToSend[] {
  if (!s) return [];
  try {
    const list: unknown = JSON.parse(s.getItem(SEND_ON_SIGNAL_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((w): w is WaitingToSend => !!w && typeof w.reportId === 'string' && typeof w.principalId === 'string' && typeof w.at === 'string') : [];
  } catch { return []; }
}

function write(s: Store | undefined, list: WaitingToSend[]): void {
  if (!s) return;
  try { if (list.length) s.setItem(SEND_ON_SIGNAL_KEY, JSON.stringify(list)); else s.removeItem(SEND_ON_SIGNAL_KEY); }
  catch { /* Storage blocked or full: the editor still sends while it is open. */ }
}

/** Reports `principalId` is waiting to send from this device. */
export const waitingToSend = (principalId: string, given?: Store): string[] =>
  read(store(given)).filter(w => w.principalId === principalId).map(w => w.reportId);

export const isWaitingToSend = (reportId: string, principalId: string, given?: Store): boolean =>
  waitingToSend(principalId, given).includes(reportId);

/** The engineer tapped Send with no signal: send it as soon as there is some. */
export function markWaitingToSend(reportId: string, principalId: string, at = new Date().toISOString(), given?: Store): void {
  const s = store(given);
  write(s, [...read(s).filter(w => !(w.reportId === reportId && w.principalId === principalId)), { reportId, principalId, at }]);
}

/** Sent, changed, refused or taken back: no longer waiting, for anyone on this device. */
export function clearWaitingToSend(reportId: string, given?: Store): void {
  const s = store(given);
  const list = read(s);
  if (list.some(w => w.reportId === reportId)) write(s, list.filter(w => w.reportId !== reportId));
}
