/**
 * Site information: what an engineer needs to find and get into a site, kept
 * by the office and read on site. Address, working hours, how to get in and
 * where to park, safety notes and the people to call.
 *
 * Free text throughout. Nothing here is a location catalogue or a required
 * field, and nothing is sent anywhere: the office types it once and everyone
 * on the project reads the same copy. The project list does not hold these
 * details today, so RELAY keeps them; if it gains them, they should come from
 * there instead.
 */

export interface SiteContact { name: string; role: string; phone: string }

export interface SiteInfoFields {
  address: string;
  hours: string;
  access: string;
  safety: string;
  contacts: SiteContact[];
}

export interface SiteInfoChange { at: string; by: string; fields: SiteInfoField[] }

export interface SiteInfo extends SiteInfoFields {
  id: string;
  projectId: string;
  /** Starts at 1 and goes up by one per save, so a save made on an older copy can be refused. */
  version: number;
  updatedAt: string;
  updatedBy: string;
  updatedById?: string;
  /** The latest changes first, kept short: who changed what and when, not the old wording. */
  history: SiteInfoChange[];
}

export type SiteInfoField = keyof SiteInfoFields;

export const SITE_INFO_LIMITS = { address: 300, hours: 300, access: 1500, safety: 1500, name: 80, role: 80, phone: 30, contacts: 8, history: 10 } as const;

/** The words the page uses for each field, also used in the change history. */
export const SITE_INFO_LABELS: Record<SiteInfoField, string> = {
  address: 'Address', hours: 'Site hours', access: 'Getting in and parking', safety: 'Safety and induction', contacts: 'Contacts',
};

export const EMPTY_SITE_INFO: SiteInfoFields = { address: '', hours: '', access: '', safety: '', contacts: [] };

const PHONE = /^\+?[0-9][0-9 ()-]*$/;

/** Line breaks kept (an address or access note reads better over lines); other control characters dropped. */
const clean = (value: unknown): string => typeof value === 'string'
  ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').split('\n').map(line => line.trimEnd()).join('\n').trim()
  : '';

export type SiteInfoInput = { ok: true; value: SiteInfoFields } | { ok: false; reason: string };

/**
 * What the office typed, tidied and checked. Every field may be left blank;
 * a contact row with nothing in it is dropped, and one with a number needs a
 * name so an engineer knows who they are ringing.
 */
export function readSiteInfoInput(body: unknown): SiteInfoInput {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'Nothing to save.' };
  const b = body as Record<string, unknown>;
  const value: SiteInfoFields = { address: clean(b.address), hours: clean(b.hours), access: clean(b.access), safety: clean(b.safety), contacts: [] };
  for (const key of ['address', 'hours', 'access', 'safety'] as const) {
    if (b[key] !== undefined && typeof b[key] !== 'string') return { ok: false, reason: `${SITE_INFO_LABELS[key]} must be text.` };
    if (value[key].length > SITE_INFO_LIMITS[key]) return { ok: false, reason: `${SITE_INFO_LABELS[key]} is too long. Keep it under ${SITE_INFO_LIMITS[key]} characters.` };
  }
  if (b.contacts !== undefined && !Array.isArray(b.contacts)) return { ok: false, reason: 'Contacts must be a list.' };
  for (const raw of (b.contacts ?? []) as unknown[]) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Each contact needs a name and a phone number.' };
    const r = raw as Record<string, unknown>;
    const contact = { name: clean(r.name).replace(/\n+/g, ' '), role: clean(r.role).replace(/\n+/g, ' '), phone: clean(r.phone).replace(/\s+/g, ' ') };
    if (!contact.name && !contact.role && !contact.phone) continue;
    if (!contact.name) return { ok: false, reason: 'Each contact needs a name, so the engineer knows who they are ringing.' };
    if (!contact.phone) return { ok: false, reason: `Add a phone number for ${contact.name}, or remove them.` };
    if (!PHONE.test(contact.phone) || contact.phone.replace(/\D/g, '').length < 6) return { ok: false, reason: `The number for ${contact.name} does not look like a phone number. Use digits, spaces and an optional + at the start.` };
    if (contact.name.length > SITE_INFO_LIMITS.name || contact.role.length > SITE_INFO_LIMITS.role || contact.phone.length > SITE_INFO_LIMITS.phone) return { ok: false, reason: `The details for ${contact.name.slice(0, 40)} are too long.` };
    value.contacts.push(contact);
  }
  if (value.contacts.length > SITE_INFO_LIMITS.contacts) return { ok: false, reason: `Keep to ${SITE_INFO_LIMITS.contacts} contacts or fewer.` };
  return { ok: true, value };
}

/** Which fields differ, in the page's order. */
export function changedFields(before: SiteInfoFields, after: SiteInfoFields): SiteInfoField[] {
  return (Object.keys(SITE_INFO_LABELS) as SiteInfoField[]).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export function isEmptySiteInfo(info: SiteInfoFields): boolean {
  return !info.address && !info.hours && !info.access && !info.safety && !info.contacts.length;
}

/** A number a phone can dial. A UK number typed with a leading 0 stays as typed; the phone handles it. */
export function telHref(phone: string): string {
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${phone.replace(/\D/g, '')}`;
}

/** Opens the address in the phone's maps app (Google Maps on Android, the browser or Google Maps on iPhone). */
export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s*\n\s*/g, ', '))}`;
}

/** The record after a save: a new version, the saver, and a line of history when something changed. */
export function nextSiteInfo(current: SiteInfo | undefined, projectId: string, fields: SiteInfoFields, by: { name: string; id?: string }, at: string): SiteInfo {
  const changed = changedFields(current ?? EMPTY_SITE_INFO, fields);
  return {
    id: projectId, projectId, ...fields,
    version: (current?.version ?? 0) + 1,
    updatedAt: at, updatedBy: by.name, ...(by.id ? { updatedById: by.id } : {}),
    history: [...(changed.length ? [{ at, by: by.name, fields: changed }] : []), ...(current?.history ?? [])].slice(0, SITE_INFO_LIMITS.history),
  };
}
