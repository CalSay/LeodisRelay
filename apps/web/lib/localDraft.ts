import type { Observation, Report } from "./types";

/**
 * Unsent work held on the device.
 *
 * Three faults were found in review and are fixed here.
 *
 * Writes resolved when the IndexedDB *request* succeeded, which is before the
 * transaction commits. A transaction that later aborted — a quota failure is
 * the likely case — did so after this had already reported success. Everything
 * now resolves on transaction completion, which is the only point at which the
 * data is actually durable.
 *
 * Records were not scoped to a person. On a shared device the next engineer to
 * sign in would recover work belonging to the last one.
 *
 * Releasing a held copy keyed on the report id alone, so a save that completed
 * late deleted edits typed after it was sent. Each held copy now carries the
 * sequence number of the edit it represents, and is only released when the
 * acknowledged sequence is the one still held.
 *
 * This remains a safety net rather than the offline engine: no ordered mutation
 * queue, no media manifest, no idempotency. Those live in @relay/platform.
 */

const DB_NAME = "relay-drafts";
const STORE = "unsent";
const VERSION = 2;

export interface HeldDraft {
  /** Composite key, so one device can hold work for several people safely. */
  key: string;
  reportId: string;
  principalId: string;
  /** Monotonic per report. Identifies exactly which edit this copy is. */
  seq: number | string;
  observations: Observation[];
  heldAt: string;
  baseVersion?:number;
  report?:Report;
}

function keyFor(reportId: string, principalId: string): string {
  return `${principalId}::${reportId}`;
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
      // Version 1 keyed on reportId alone and held no principal. Recovering
      // those records for the wrong person is exactly the fault being fixed,
      // so the old store is dropped rather than migrated.
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Device storage is unavailable."));
    request.onblocked = () => reject(new Error("Device storage is blocked."));
  });
}

/**
 * Run one transaction and resolve only when it commits.
 *
 * The request's result is captured on success, but the promise settles on
 * `oncomplete`. Resolving earlier is what allowed a later abort to arrive after
 * the caller had been told the write succeeded.
 */
function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T;
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => {
          // Let the transaction's own abort handler settle the promise.
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onabort = () => {
          db.close();
          reject(
            tx.error?.name === "QuotaExceededError"
              ? new Error("This device is out of storage space.")
              : (tx.error ?? request.error ?? new Error("Device storage failed.")),
          );
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Device storage failed."));
        };
      }),
  );
}

/**
 * Mirror unsent work.
 *
 * Rejects rather than reporting false success. The caller is expected to show
 * that prominently: it means the only copy is in the page, and closing the tab
 * loses it.
 */
export async function keep(input: {
  reportId: string;
  principalId: string;
  seq: number | string;
  observations: Observation[];
  baseVersion?:number;
  report?:Report;
}): Promise<void> {
  const held: HeldDraft = {
    key: keyFor(input.reportId, input.principalId),
    reportId: input.reportId,
    principalId: input.principalId,
    seq: input.seq,
    observations: input.observations,
    heldAt: new Date().toISOString(),
    baseVersion:input.baseVersion,
    report:input.report,
  };
  await run("readwrite", (store) => store.put(held));
}

/**
 * Release the held copy, but only if it is the one just acknowledged.
 *
 * A save that completes after further typing must not delete the newer copy.
 * Keying the release on the sequence number makes a late acknowledgement
 * harmless instead of destructive.
 */
export async function releaseIfCurrent(
  reportId: string,
  principalId: string,
  acknowledgedSeq: number | string,
): Promise<void> {
  try {
    const key = keyFor(reportId, principalId);
    const db = await openDb();
    await new Promise<void>((resolve,reject) => {
      const tx = db.transaction(STORE,'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        const held = request.result as HeldDraft | undefined;
        if (held?.seq === acknowledgedSeq) store.delete(key);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Failing to clear a stale copy is harmless: recovery only ever applies to
    // a draft, and the next successful save overwrites it.
  }
}

export async function recover(
  reportId: string,
  principalId: string,
): Promise<HeldDraft | null> {
  try {
    const held = await run<HeldDraft | undefined>("readonly", (store) =>
      store.get(keyFor(reportId, principalId)),
    );
    return held ?? null;
  } catch {
    return null;
  }
}

export async function advanceBase(reportId:string,principalId:string,version:number):Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve,reject) => {
    const tx = db.transaction(STORE,'readwrite');
    const store = tx.objectStore(STORE);
    const key = keyFor(reportId,principalId);
    const request = store.get(key);
    request.onsuccess = () => {
      const held = request.result as HeldDraft | undefined;
      if (held && (held.baseVersion ?? 0) < version) store.put({...held,baseVersion:version,report:held.report ? {...held.report,version} : undefined});
    };
    tx.oncomplete = () => {db.close();resolve();};
    tx.onabort = () => {db.close();reject(tx.error);};
  });
}

export async function hasUnsent(reportId: string, principalId: string): Promise<boolean> {
  return (await recover(reportId, principalId)) !== null;
}
