/**
 * Sign-in rules.
 *
 * Pure logic, so the parts that are easy to get quietly wrong — session expiry,
 * the state parameter, where a user is sent after signing in — are tested
 * rather than trusted. The provider-specific machinery lives with the
 * application; none of it belongs here.
 */

import type { PrincipalId } from "@relay/contracts";

export interface Principal {
  readonly id: PrincipalId;
  /** Entra object id. Stable for the life of the account, unlike an address. */
  readonly oid: string;
  readonly name: string;
  readonly email: string;
}

export interface Session {
  readonly id: string;
  readonly principal: Principal;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * Provisional. Long enough that an engineer is not signing in repeatedly during
 * a working day, short enough that a lost phone is not indefinitely useful.
 * Wants confirming against how Leodis actually work.
 */
export const PROVISIONAL_SESSION_HOURS = 12;

export function isExpired(session: Session, now: Date): boolean {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

export function expiryFrom(issuedAt: Date, hours = PROVISIONAL_SESSION_HOURS): string {
  return new Date(issuedAt.getTime() + hours * 3_600_000).toISOString();
}

/**
 * Compare the state returned by the identity provider with the one we issued.
 *
 * Length-constant comparison: a state check that leaks timing is a state check
 * that can be guessed at. Missing or empty values fail rather than passing
 * trivially, which is the mistake this kind of check usually contains.
 */
export function stateMatches(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Where to send someone after they sign in.
 *
 * Only a path within this application is ever accepted. A `returnTo` carried
 * through a sign-in flow is attacker-supplied by definition, and returning an
 * absolute URL is how a sign-in link becomes an open redirect — the user
 * authenticates against a genuine provider and lands somewhere else entirely.
 */
export function safeReturnTo(candidate: string | null | undefined, fallback = "/"): string {
  if (!candidate) return fallback;
  // Must be a single-slash-rooted path. "//host" and "https://host" are both
  // absolute, and "\\host" is treated as absolute by some browsers.
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (candidate.includes("://")) return fallback;
  return candidate;
}

/**
 * Who a person is, for the domain.
 *
 * Identity comes from the provider's stable object id rather than from an
 * address: people change name and email, and a report signed off two years ago
 * must still resolve to the same person.
 */
export function principalIdFor(oid: string): PrincipalId {
  return `entra:${oid}` as PrincipalId;
}
