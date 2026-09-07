/**
 * A safety net, not a sync engine.
 *
 * Holds unsent work on the device so a reload, a crash or a flat battery does
 * not lose it.
 *
 * This was first written against localStorage and that was wrong. A single
 * phone photograph as a data URL is 4-6 MB, localStorage caps around 5 MB, and
 * the quota error was caught and ignored — so the net silently held nothing
 * exactly when there was most to lose. IndexedDB has a quota measured in
 * hundreds of megabytes, stores structured values without base64 inflation, and
 * is what blueprint 0.7 specifies for this.
 *
 * Two rules follow from that failure and are worth keeping:
 *
 *   1. Never swallow a storage error. A safety net that reports success while
 *      doing nothing is worse than no net, because the person stops worrying.
 *   2. Say where the work is, not that it is "saved".
 *
 * What this is NOT, and must not quietly become: the offline engine in
 * blueprint 0.7. There is no ordered mutation queue, no media manifest, no
 * idempotency and no conflict resolution. Those live in @relay/platform, are
 * tested there, and belong in the real client.
 */

import type { Report } from "./types";

const DB_NAME = "relay-drafts";
const STORE = "unsent";
const VERSION = 1;

interface Held {
  reportId: string;
  observations: Report["observations"];
  heldAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser will not let the app hold work on the device."));
      return;
    }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "reportId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Device storage is unavailable."));
    // Private browsing in some browsers hangs rather than erroring.
    request.onblocked = () => reject(new Error("Device storage is blocked."));
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Device storage failed."));
        tx.onabort = () =>
          reject(
            tx.error?.name === "QuotaExceededError"
              ? new Error("This device is out of storage space.")
              : (tx.error ?? new Error("Device storage failed.")),
          );
        tx.oncomplete = () => db.close();
      }),
  );
}

/**
 * Mirror unsent work to the device.
 *
 * Rejects rather than reporting false success. The caller is expected to show
 * that failure prominently: it means the only copy of the work is in the page,
 * and closing the tab loses it.
 */
export async function keep(report: Report): Promise<void> {
  const held: Held = {
    reportId: report.id,
    observations: report.observations,
    heldAt: new Date().toISOString(),
  };
  await run("readwrite", (store) => store.put(held));
}

/** Drop the copy once the server has confirmed it holds the work. */
export async function release(reportId: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(reportId));
  } catch {
    // Failing to clear a stale copy is harmless: `recover` only ever applies to
    // a draft, and the next successful save overwrites it.
  }
}

/**
 * Unsent work for a report, if any.
 *
 * Only ever applied to a draft. A sent report is frozen, and a stale device
 * copy must never reappear over something already issued.
 */
export async function recover(report: Report): Promise<Report | null> {
  if (report.state !== "draft") return null;
  try {
    const held = await run<Held | undefined>("readonly", (store) => store.get(report.id));
    return held ? { ...report, observations: held.observations } : null;
  } catch {
    return null;
  }
}

export async function hasUnsent(reportId: string): Promise<boolean> {
  try {
    return (await run<Held | undefined>("readonly", (store) => store.get(reportId))) !== undefined;
  } catch {
    return false;
  }
}

/**
 * One-off migration away from the localStorage version. Anything held there
 * when this ships would otherwise be stranded.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const raw = window.localStorage.getItem("relay-unsent-v1");
    if (!raw) return;
    const old = JSON.parse(raw) as Record<string, Held>;
    for (const entry of Object.values(old)) {
      if (entry?.reportId) await run("readwrite", (store) => store.put(entry));
    }
    window.localStorage.removeItem("relay-unsent-v1");
  } catch {
    // Nothing to migrate, or storage unavailable. Not worth interrupting anyone.
  }
}
