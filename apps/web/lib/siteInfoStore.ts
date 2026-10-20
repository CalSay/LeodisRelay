import { atomic, getRecord, putRecord } from './storage';
import { EMPTY_SITE_INFO, changedFields, nextSiteInfo, type SiteInfo, type SiteInfoFields } from './siteInfo';

/** One site information record per project, in the local store. */
export function getSiteInfo(projectId: string): SiteInfo | undefined {
  return getRecord<SiteInfo>('site-info', projectId);
}

export type SiteInfoSave = { ok: true; value: SiteInfo | undefined } | { ok: false; status: 409; current: SiteInfo | undefined };

/**
 * Saves the office's copy when it was made from the latest version (0 for a
 * project with none yet). Two people editing at once do not overwrite each
 * other: the second is shown what the first saved. A save that changes
 * nothing leaves the record, its version and its history as they were.
 */
export function saveSiteInfo(projectId: string, fields: SiteInfoFields, expectedVersion: number, by: { name: string; id?: string }, at = new Date().toISOString()): SiteInfoSave {
  return atomic(() => {
    const current = getSiteInfo(projectId);
    if ((current?.version ?? 0) !== expectedVersion) return { ok: false, status: 409, current };
    if (current && !changedFields(current, fields).length) return { ok: true, value: current };
    if (!current && !changedFields(EMPTY_SITE_INFO, fields).length) return { ok: true, value: undefined };
    const next = nextSiteInfo(current, projectId, fields, by, at);
    putRecord('site-info', next);
    return { ok: true, value: next };
  });
}
