/**
 * How long a read of a SharePoint list is reused (2026-10-22). Every page that
 * shows issues or variations used to read the whole list from Microsoft before
 * answering, so on the pilot each tap on a phone waited for SharePoint's paged
 * list (200 rows a request, one request after another). Now a read is reused:
 *
 * - within FRESH_MS of the last read, the stored copy is used as it is;
 * - up to STALE_MS, the stored copy answers at once and a new read starts in
 *   the background, so the next page has it;
 * - after that, or before the first read, or when `force` is set (anything
 *   about to change a record), the page waits for SharePoint as before.
 *
 * Only edits made in SharePoint itself are affected: RELAY's own changes are
 * written to the local store straight away and are never replaced by a read
 * until they have been sent.
 */
export const FRESH_MS = 15_000;
export const STALE_MS = 10 * 60_000;

export type Refresh = (force?: boolean) => Promise<void>;

export function recentRead(read: () => Promise<void>, clock: () => number = Date.now): Refresh {
  let readAt: number | undefined;
  let running: Promise<void> | undefined;
  const start = () => {
    if (running) return running;
    const startedAt = clock();
    running = read().then(() => { readAt = startedAt; }).finally(() => { running = undefined; });
    return running;
  };
  return async (force = false) => {
    const age = readAt === undefined ? Infinity : clock() - readAt;
    if (!force && age < FRESH_MS) return;
    if (!force && age < STALE_MS) {
      // A failed background read leaves the stored copy; the next page tries again.
      start().catch(() => {});
      return;
    }
    return start();
  };
}
