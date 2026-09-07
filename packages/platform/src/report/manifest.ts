/**
 * Media manifests.
 *
 * A submission names the media it depends on. The server accepts the report for
 * processing only once every named object is present, verified and permitted.
 *
 * The rule this exists to enforce: uploading bytes to storage does not by
 * itself produce a report receipt (blueprint 0.7). Photographs travel as
 * independent transfers, so a submission can easily arrive with eight of twelve
 * images in place. Treating that as received would file a report with missing
 * evidence and no error.
 */

import type { MediaId } from "@relay/contracts";

export interface ManifestEntry {
  readonly mediaId: MediaId;
  /** Hash the device computed. The server compares against the stored object. */
  readonly sha256: string;
}

export interface MediaManifest {
  readonly entries: readonly ManifestEntry[];
}

/** What the server actually holds for one object. */
export interface StoredMediaObject {
  readonly mediaId: MediaId;
  /** The upload completed and the object exists. */
  readonly uploadComplete: boolean;
  /** Hash computed by the server from the stored bytes, once complete. */
  readonly verifiedSha256?: string;
  /** Whether the submitting principal may reference this object at all. */
  readonly permitted: boolean;
}

export interface ManifestShortfall {
  /** Named in the manifest, nothing stored. */
  readonly missing: readonly MediaId[];
  /** Stored but the upload never finished. */
  readonly incomplete: readonly MediaId[];
  /** Stored and complete, but the bytes do not match what the device declared. */
  readonly mismatched: readonly MediaId[];
  /** Exists, but this principal may not reference it. */
  readonly forbidden: readonly MediaId[];
}

export type ManifestVerification =
  | { readonly kind: "complete" }
  | { readonly kind: "incomplete"; readonly shortfall: ManifestShortfall };

/**
 * A mismatch is never repaired by accepting the stored bytes. It means the
 * device and the server disagree about what was captured, and the only safe
 * response is to re-upload that object under the same media id.
 */
export function verifyManifest(
  manifest: MediaManifest,
  stored: readonly StoredMediaObject[],
): ManifestVerification {
  const byId = new Map(stored.map((object) => [object.mediaId, object]));

  const missing: MediaId[] = [];
  const incomplete: MediaId[] = [];
  const mismatched: MediaId[] = [];
  const forbidden: MediaId[] = [];

  for (const entry of manifest.entries) {
    const object = byId.get(entry.mediaId);
    if (object === undefined) {
      missing.push(entry.mediaId);
      continue;
    }
    if (!object.permitted) {
      forbidden.push(entry.mediaId);
      continue;
    }
    if (!object.uploadComplete || object.verifiedSha256 === undefined) {
      incomplete.push(entry.mediaId);
      continue;
    }
    if (object.verifiedSha256 !== entry.sha256) {
      mismatched.push(entry.mediaId);
    }
  }

  const clean =
    missing.length === 0 &&
    incomplete.length === 0 &&
    mismatched.length === 0 &&
    forbidden.length === 0;

  return clean
    ? { kind: "complete" }
    : { kind: "incomplete", shortfall: { missing, incomplete, mismatched, forbidden } };
}

/**
 * Progress for the device, so it can say "8 of 12 photographs uploaded" rather
 * than showing a spinner of unknown duration. Counts objects that are genuinely
 * usable, not merely present.
 */
export function uploadProgress(
  manifest: MediaManifest,
  stored: readonly StoredMediaObject[],
): { readonly ready: number; readonly total: number } {
  const byId = new Map(stored.map((object) => [object.mediaId, object]));
  const ready = manifest.entries.filter((entry) => {
    const object = byId.get(entry.mediaId);
    return (
      object !== undefined &&
      object.permitted &&
      object.uploadComplete &&
      object.verifiedSha256 === entry.sha256
    );
  }).length;
  return { ready, total: manifest.entries.length };
}

/**
 * Which objects the device should retry.
 *
 * Forbidden objects are excluded deliberately: re-uploading will not grant
 * permission, and retrying would loop. Those need a person.
 */
export function retryableMedia(shortfall: ManifestShortfall): readonly MediaId[] {
  return [...shortfall.missing, ...shortfall.incomplete, ...shortfall.mismatched];
}
