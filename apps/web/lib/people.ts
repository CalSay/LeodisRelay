import { randomUUID } from 'node:crypto';
import type { Principal } from '@relay/platform';
import { ASSIGNMENTS, INITIAL_ROSTER, type Assignment } from './auth/roster';
import { atomic, getRecord, putRecord, records } from './storage';

/**
 * People as Relay knows them: the name to show and the role on the assignment
 * checklist. Neither grants anything. Access and the role that counts are read
 * from Microsoft Entra at sign-in; this only decides what Relay calls someone
 * and who the Admin expects to see on the team.
 *
 * Record kind `people`, keyed by the lower-cased work email so a person can be
 * named before they have ever signed in.
 */

export type PersonAction = 'added' | 'renamed' | 'assignment' | 'removed' | 'restored';
export interface PersonLogEntry { at: string; actorId: string; actor: string; action: PersonAction; from?: string; to?: string }
export interface Person {
  id: string;
  email: string;
  relayName?: string;
  assignment?: Assignment;
  removed?: boolean;
  addedById?: string;
  addedAt?: string;
  log: PersonLogEntry[];
}
export interface ChecklistEntry { email: string; assignment: Assignment; relayName?: string; person?: Person; addedByRelay: boolean }

export type PeopleResult = { ok: true; status: 200; person: Person } | { ok: false; status: 400 | 403 | 404 | 409 | 422; reason: string };

const KIND = 'people';
const DOMAIN = /^[^@\s]+@leodisme\.com$/i;

export const personKey = (email: string) => email.trim().toLowerCase();
/** Trimmed, with runs of whitespace collapsed to one space. */
export const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');
export const isAssignment = (value: unknown): value is Assignment => typeof value === 'string' && (ASSIGNMENTS as readonly string[]).includes(value);

function rosterEntry(email: string) { return INITIAL_ROSTER.find(r => r.email.toLowerCase() === personKey(email)); }
function stored(email: string) { return getRecord<Person>(KIND, personKey(email)); }

/** The initial roster with the changes Admins have made in Relay layered over it. */
export function peopleChecklist(): ChecklistEntry[] {
  const people = new Map(records<Person>(KIND).map(p => [p.id, p]));
  const out: ChecklistEntry[] = [];
  const seen = new Set<string>();
  for (const r of INITIAL_ROSTER) {
    const key = personKey(r.email); seen.add(key);
    const person = people.get(key);
    if (person?.removed) continue;
    out.push({ email: key, assignment: person?.assignment ?? r.assignment, ...(person?.relayName ? { relayName: person.relayName } : {}), ...(person ? { person } : {}), addedByRelay: false });
  }
  for (const person of people.values()) {
    // Someone only named (they signed in without being listed) is not on the checklist.
    if (seen.has(person.id) || person.removed || !person.assignment) continue;
    out.push({ email: person.id, assignment: person.assignment, ...(person.relayName ? { relayName: person.relayName } : {}), person, addedByRelay: true });
  }
  return out;
}

/** The name set in Relay for this email, whether or not they are still on the checklist. */
export function relayNameForEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return stored(email)?.relayName || undefined;
}

/** Relay names keyed by account id, joined through the identities recorded at sign-in. */
export function relayNamesById(): Record<string, string> {
  const names = new Map(records<Person>(KIND).filter(p => p.relayName).map(p => [p.id, p.relayName!]));
  const out: Record<string, string> = {};
  if (!names.size) return out;
  for (const identity of records<{ id: string; email?: string }>('identities')) {
    const name = identity.email ? names.get(personKey(identity.email)) : undefined;
    if (name) out[identity.id] = name;
  }
  return out;
}

const fail = (status: 400 | 403 | 404 | 409 | 422, reason: string): PeopleResult => ({ ok: false, status, reason });
function validEmail(email: unknown): string | null { return typeof email === 'string' && DOMAIN.test(email.trim()) ? personKey(email) : null; }
function validName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = cleanName(name);
  return clean.length >= 2 && clean.length <= 80 ? clean : null;
}
const NAME_RULE = 'Enter a name between 2 and 80 characters.';
const EMAIL_RULE = 'Use a @leodisme.com work email.';
const ROLE_RULE = 'Choose one of the app roles.';

function entry(actor: Principal, action: PersonAction, from?: string, to?: string): PersonLogEntry {
  return { at: new Date().toISOString(), actorId: actor.id, actor: actor.name, action, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) };
}
function save(actor: Principal, before: Person | undefined, after: Person, action: PersonAction): Person {
  putRecord(KIND, after);
  putRecord('audit', { id: randomUUID(), action: `person-${action}`, actorId: actor.id, email: after.email, at: after.log.at(-1)?.at ?? new Date().toISOString(),
    ...(before?.relayName !== after.relayName ? { previousName: before?.relayName ?? null, name: after.relayName ?? null } : {}),
    ...(before?.assignment !== after.assignment ? { previousAssignment: before?.assignment ?? null, assignment: after.assignment ?? null } : {}),
    ...(!!before?.removed !== !!after.removed ? { removed: !!after.removed } : {}) });
  return after;
}
/** The stored record, or a fresh one seeded from the roster. */
function base(email: string): Person { return stored(email) ?? { id: email, email, log: [] }; }
/** On the checklist right now: listed on the roster or added in Relay, and not removed. */
function listed(email: string): boolean {
  const person = stored(email);
  if (person?.removed) return false;
  return !!rosterEntry(email) || !!person?.assignment;
}
function signedIn(email: string): boolean {
  return records<{ email?: string }>('identities').some(i => i.email && personKey(i.email) === email);
}

export function addPerson(actor: Principal, input: { email: unknown; name: unknown; assignment: unknown }): PeopleResult {
  const email = validEmail(input.email); if (!email) return fail(422, EMAIL_RULE);
  const name = validName(input.name); if (!name) return fail(422, NAME_RULE);
  if (!isAssignment(input.assignment)) return fail(422, ROLE_RULE);
  const assignment = input.assignment;
  return atomic(() => {
    if (listed(email)) return fail(409, 'Already on the checklist.');
    const before = stored(email);
    const current = base(email);
    const log = [...current.log, entry(actor, before?.removed ? 'restored' : 'added', undefined, assignment)];
    if (current.relayName !== name) log.push(entry(actor, 'renamed', current.relayName, name));
    const after: Person = { ...current, email, relayName: name, assignment, removed: false, addedById: actor.id, addedAt: new Date().toISOString(), log };
    return { ok: true as const, status: 200 as const, person: save(actor, before, after, before?.removed ? 'restored' : 'added') };
  });
}

export function renamePerson(actor: Principal, input: { email: unknown; name: unknown }): PeopleResult {
  const email = validEmail(input.email); if (!email) return fail(422, EMAIL_RULE);
  const name = validName(input.name); if (!name) return fail(422, NAME_RULE);
  return atomic(() => {
    // Anyone listed, or anyone who has signed in, can be named.
    if (!listed(email) && !signedIn(email) && !stored(email)) return fail(404, 'That person is not on the checklist and has not signed in.');
    const before = stored(email);
    const current = base(email);
    if (current.relayName === name) return { ok: true as const, status: 200 as const, person: current };
    const after: Person = { ...current, relayName: name, log: [...current.log, entry(actor, 'renamed', current.relayName, name)] };
    return { ok: true as const, status: 200 as const, person: save(actor, before, after, 'renamed') };
  });
}

export function setAssignment(actor: Principal, input: { email: unknown; assignment: unknown }): PeopleResult {
  const email = validEmail(input.email); if (!email) return fail(422, EMAIL_RULE);
  if (!isAssignment(input.assignment)) return fail(422, ROLE_RULE);
  const assignment = input.assignment;
  return atomic(() => {
    if (!listed(email)) return fail(404, 'That person is not on the checklist.');
    const before = stored(email);
    const current = base(email);
    const was = current.assignment ?? rosterEntry(email)?.assignment;
    if (was === assignment) return { ok: true as const, status: 200 as const, person: current };
    const after: Person = { ...current, assignment, log: [...current.log, entry(actor, 'assignment', was, assignment)] };
    return { ok: true as const, status: 200 as const, person: save(actor, before, after, 'assignment') };
  });
}

export function removePerson(actor: Principal, input: { email: unknown }): PeopleResult {
  const email = validEmail(input.email); if (!email) return fail(422, EMAIL_RULE);
  return atomic(() => {
    const before = stored(email);
    if (before?.removed) return fail(409, 'Already removed from the checklist.');
    if (!listed(email)) return fail(404, 'That person is not on the checklist.');
    const current = base(email);
    const assignment = current.assignment ?? rosterEntry(email)?.assignment;
    const after: Person = { ...current, ...(assignment ? { assignment } : {}), removed: true, log: [...current.log, entry(actor, 'removed', assignment)] };
    return { ok: true as const, status: 200 as const, person: save(actor, before, after, 'removed') };
  });
}

export function restorePerson(actor: Principal, input: { email: unknown }): PeopleResult {
  const email = validEmail(input.email); if (!email) return fail(422, EMAIL_RULE);
  return atomic(() => {
    const before = stored(email);
    if (!before?.removed) return listed(email) ? fail(409, 'Already on the checklist.') : fail(404, 'That person was never on the checklist.');
    const assignment = before.assignment ?? rosterEntry(email)?.assignment;
    if (!assignment) return fail(409, 'Add them with a role instead.');
    const after: Person = { ...before, assignment, removed: false, log: [...before.log, entry(actor, 'restored', undefined, assignment)] };
    return { ok: true as const, status: 200 as const, person: save(actor, before, after, 'restored') };
  });
}
