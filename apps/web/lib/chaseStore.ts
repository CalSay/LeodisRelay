import type { Principal } from '@relay/platform';
import { atomic, getRecord, putRecord, records } from './storage';
import { chaseProblem, groupChases, type Chase, type ChaseInput, type CompanyChases } from './companyChases';
import { companyKey } from './companyIssues';

/**
 * Chase notes in the local store, kind `company-chases`. RELAY's own record,
 * like a report's acknowledgement: the SharePoint issue list has no place for
 * it and nothing here is written there. Rules in `companyChases.ts`.
 */

const KIND = 'company-chases';
const REQUEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChaseOutcome = { ok: true; value: Chase } | { ok: false; status: number; reason: string };

/**
 * Keep one chase, attributed to whoever is signed in. `requestId` is the
 * form's own id, so a retry after a lost reply returns the first save rather
 * than logging the call twice; the same id with different words is refused.
 */
export function logChase(input: ChaseInput & { requestId: string }, principal: Principal, today: string): ChaseOutcome {
  if (!REQUEST.test(input.requestId)) return { ok: false, status: 422, reason: 'Invalid request.' };
  const problem = chaseProblem(input, today);
  return atomic(() => {
    const id = `chase-${input.requestId.toLowerCase()}`;
    const previous = getRecord<Chase>(KIND, id);
    const owner = input.owner.trim().replace(/\s+/g, ' ');
    const note = input.note.trim();
    const promisedBy = input.promisedBy.trim();
    if (previous) {
      const same = previous.byId === principal.id && previous.companyKey === companyKey(owner) && previous.note === note && (previous.promisedBy ?? '') === promisedBy;
      return same ? { ok: true, value: previous } : { ok: false, status: 409, reason: 'This chase was already saved with different words. Reload the page.' };
    }
    // Checked after the replay, so a retry the day after a promise date still returns what was saved.
    if (problem) return { ok: false, status: 422, reason: problem };
    const chase: Chase = { id, companyKey: companyKey(owner), owner, note, ...(promisedBy ? { promisedBy } : {}), by: principal.name, byId: principal.id, at: new Date().toISOString() };
    putRecord(KIND, chase);
    return { ok: true, value: chase };
  });
}

/** The chases for these companies, newest first. */
export function chasesFor(keys: Iterable<string>): Record<string, CompanyChases> {
  return groupChases(records<Chase>(KIND), keys);
}
