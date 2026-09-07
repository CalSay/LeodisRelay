/**
 * A safety net, not a sync engine.
 *
 * Testing in flight mode showed the honest state of things: work typed without
 * signal lived only in React state, so a refresh or a crash lost it. That is
 * unacceptable in a site tool even in a prototype, so unsent changes are
 * mirrored to this device.
 *
 * What this is NOT, and must not quietly become: the offline engine specified
 * in blueprint 0.7. There is no ordered mutation queue, no media manifest, no
 * idempotency, no conflict resolution. Those live in @relay/platform, are
 * tested there, and belong in the real client.
 *
 * The reason to keep the distinction sharp is the status vocabulary. Proposal
 * section 5 requires "saved on this phone" and "received by Leodis" to be
 * separate things a person can tell apart, precisely because a success tick for
 * a local save that implies delivery is how work gets lost. So this module
 * exists to make the first of those states real and visible — never to make it
 * look like the second.
 */

import type { Report } from "./types";

const KEY = "relay-unsent-v1";

interface Cached {
  reportId: string;
  observations: Report["observations"];
  cachedAt: string;
}

type Store = Record<string, Cached>;

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Quota, or a browser refusing storage. The app keeps working; the safety
    // net is simply absent, which is the state we were in before.
  }
}

/** Mirror unsent work. Called on every change, before any network attempt. */
export function keep(report: Report): void {
  if (typeof window === "undefined") return;
  const store = read();
  store[report.id] = {
    reportId: report.id,
    observations: report.observations,
    cachedAt: new Date().toISOString(),
  };
  write(store);
}

/** Drop the copy once the server has confirmed it holds the work. */
export function release(reportId: string): void {
  if (typeof window === "undefined") return;
  const store = read();
  delete store[reportId];
  write(store);
}

/**
 * Unsent work for a report, if any.
 *
 * Only ever applied to a draft. A sent report is frozen, and a stale local copy
 * must never be allowed to reappear over something already issued.
 */
export function recover(report: Report): Report | null {
  if (typeof window === "undefined") return null;
  if (report.state !== "draft") return null;
  const cached = read()[report.id];
  return cached ? { ...report, observations: cached.observations } : null;
}

export function hasUnsent(reportId: string): boolean {
  if (typeof window === "undefined") return false;
  return read()[reportId] !== undefined;
}
