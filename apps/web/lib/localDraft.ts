import type { Observation, Report } from "./types";
import type { DraftBase } from "./draftConflict";
import { fitStartedChecks, type SignedOffline, type StartedOffline } from "./offlineStart";

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
  /** The tab that held it. Only that tab's saves move its base version. */
  tab?:string;
  /** Set aside during a conflict: the server copy this work was built on, for the comparison after a reload. */
  base?:DraftBase;
  /** A report started on the offline page, not yet on the server (offlineStart.ts). */
  started?:StartedOffline;
  /** Last changed on the offline page: no editor holds it, so it goes up by itself. */
  heldOffline?:boolean;
  /** The save being sent for it, so a retry after a lost answer reuses the request id. */
  sending?:{ requestId:string; seq:number | string; expectedVersion:number };
  /** Why it could not go up last time. */
  problem?:string;
  /** An inspection signed on the offline page, to go to the office by itself if unchanged (offlineStart.ts). */
  signed?:SignedOffline;
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
  tab?:string;
}): Promise<void> {
  const held: HeldDraft = {
    key: keyFor(input.reportId, input.principalId),
    reportId: input.reportId,
    principalId: input.principalId,
    seq: input.seq,
    observations: input.observations,
    heldAt: new Date().toISOString(),
    ...(input.baseVersion !== undefined ? { baseVersion: input.baseVersion } : {}),
    ...(input.report ? { report: input.report } : {}),
    ...(input.tab ? { tab: input.tab } : {}),
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

/**
 * The held copy to restore when a draft opens: this tab's own set-aside work
 * first (it is mid-choice), then the ordinary copy (the latest unsaved edit,
 * whichever tab made it), then another tab's set-aside work. Another tab's
 * set-aside copy never displaces an ordinary copy, which would throw away
 * unsaved edits; it stays on the device and comes back once that copy is saved.
 */
export async function recover(
  reportId: string,
  principalId: string,
  tab?: string,
): Promise<HeldDraft | null> {
  try {
    const all = await run<HeldDraft[]>("readonly", (store) => store.getAll() as IDBRequest<HeldDraft[]>);
    const prefix = `${keyFor(reportId, principalId)}::aside::`;
    return pickHeld(all ?? [], keyFor(reportId, principalId), prefix, tab);
  } catch {
    return null;
  }
}

/** The choice `recover` makes, apart from IndexedDB so it can be tested. */
export function pickHeld(all: readonly HeldDraft[], key: string, asidePrefix: string, tab?: string): HeldDraft | null {
  const aside = all.filter((held) => held.key.startsWith(asidePrefix)).sort((a, b) => b.heldAt.localeCompare(a.heldAt));
  return (tab ? aside.find((held) => held.tab === tab) : undefined)
    ?? all.find((held) => held.key === key)
    ?? aside[0]
    ?? null;
}

/**
 * Keep this tab's work while it waits for the engineer to choose between two
 * versions. The ordinary held copy is one per person and draft, so the other
 * tab's next edit would replace it and its next save would release it; a copy
 * set aside under this tab's own key is touched by neither, and survives a
 * reload or a crash until the choice is saved.
 */
export async function setAside(input: {
  reportId: string; principalId: string; tab: string; seq: number | string;
  observations: Observation[]; baseVersion?: number; report?: Report; base?: DraftBase;
}): Promise<string> {
  const key = `${keyFor(input.reportId, input.principalId)}::aside::${input.tab}`;
  const held: HeldDraft = {
    key, reportId: input.reportId, principalId: input.principalId, seq: input.seq,
    observations: input.observations, heldAt: new Date().toISOString(),
    ...(input.baseVersion !== undefined ? { baseVersion: input.baseVersion } : {}),
    ...(input.report ? { report: input.report } : {}), tab: input.tab,
    ...(input.base ? { base: input.base } : {}),
  };
  await run("readwrite", (store) => store.put(held));
  return key;
}

/** The choice was made and is held as an ordinary copy: the set-aside one has done its job. */
export async function dropAside(key: string): Promise<void> {
  if (!key.includes('::aside::')) return;
  await run("readwrite", (store) => store.delete(key));
}

/**
 * A save from `tab` was acknowledged at `version`, so the copy that tab holds
 * is now built on it. A copy held by another tab is left alone: its edits were
 * made on the older version, and moving its base would let them overwrite the
 * save they never saw.
 */
export async function advanceBase(reportId:string,principalId:string,version:number,tab?:string):Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve,reject) => {
    const tx = db.transaction(STORE,'readwrite');
    const store = tx.objectStore(STORE);
    const key = keyFor(reportId,principalId);
    const request = store.get(key);
    request.onsuccess = () => {
      const held = request.result as HeldDraft | undefined;
      if (held && (!tab || !held.tab || held.tab === tab) && (held.baseVersion ?? 0) < version) store.put({...held,baseVersion:version,report:held.report ? {...held.report,version} : undefined});
    };
    tx.oncomplete = () => {db.close();resolve();};
    tx.onabort = () => {db.close();reject(tx.error);};
  });
}

export async function hasUnsent(reportId: string, principalId: string): Promise<boolean> {
  return (await recover(reportId, principalId)) !== null;
}

/** Every copy this device holds for one person, for the home screen's unfinished list. Empty if storage is unavailable. */
export async function listHeld(principalId: string): Promise<HeldDraft[]> {
  try {
    const all = await run<HeldDraft[]>("readonly", (store) => store.getAll() as IDBRequest<HeldDraft[]>);
    return (all ?? []).filter((held) => held.principalId === principalId);
  } catch {
    return [];
  }
}

/**
 * Change one held copy in a single transaction. `change` returns the new copy,
 * null to remove it, or undefined to leave it as it is; what it returns is
 * what `update` resolves to (the copy as it now stands, or null).
 */
export async function update(key:string,change:(held:HeldDraft)=>HeldDraft | null | undefined):Promise<HeldDraft | null> {
  const db = await openDb();
  return new Promise<HeldDraft | null>((resolve,reject) => {
    let result:HeldDraft | null = null;
    const tx = db.transaction(STORE,'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const held = request.result as HeldDraft | undefined;
      if (!held) return;
      const next = change(held);
      if (next === null) store.delete(key);
      else if (next) store.put(next);
      result = next === undefined ? held : next;
    };
    tx.oncomplete = () => {db.close();resolve(result);};
    tx.onabort = () => {db.close();reject(tx.error ?? new Error('Device storage failed.'));};
  });
}

/**
 * A report started offline now exists on the server: hold its cards as an
 * ordinary copy of that report, built on the version just made, and drop the
 * started copy, in one transaction so neither is lost or doubled. If this
 * device already holds a copy of that report (an earlier try got this far),
 * that copy is newer and is kept.
 */
export async function adoptStarted(startedKey:string,report:Report):Promise<string | null> {
  const db = await openDb();
  return new Promise<string | null>((resolve,reject) => {
    let adopted:string | null = null;
    const tx = db.transaction(STORE,'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(startedKey);
    request.onsuccess = () => {
      const held = request.result as HeldDraft | undefined;
      if (!held?.started) return;
      const key = keyFor(report.id, held.principalId);
      const existing = store.get(key);
      existing.onsuccess = () => {
        const observations = fitStartedChecks(held.observations,report.observations);
        // A signature goes with it, and is checked again before sending (heldSend.ts).
        const signed = held.signed;
        if (!existing.result) store.put({ key, reportId:report.id, principalId:held.principalId, seq:held.seq,
          observations, heldAt:held.heldAt, baseVersion:report.version, report, heldOffline:true, ...(signed ? { signed } : {}) } satisfies HeldDraft);
        store.delete(startedKey);
        adopted = key;
      };
    };
    tx.oncomplete = () => {db.close();resolve(adopted);};
    tx.onabort = () => {db.close();reject(tx.error ?? new Error('Device storage failed.'));};
  });
}
