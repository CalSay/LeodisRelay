import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { expiryFrom, isExpired, type Principal, type Session } from "@relay/platform";
import { atomic, database, getRecord, putRecord } from '../storage';
import { hasRole } from './access';

/**
 * Server-side sessions with an opaque cookie.
 *
 * Blueprint 0.8 asks for server-side session handling rather than putting
 * claims in the browser, and this follows it: the cookie carries nothing but an
 * unguessable identifier, so a session can be ended from the server and a
 * stolen cookie reveals nothing about the person it belonged to.
 *
 * Storage is the prototype's JSON file. The shape is deliberately narrow —
 * create, read, destroy — so replacing it with a table changes this file only.
 */

const SESSION_COOKIE = "relay_session";
const STATE_COOKIE = "relay_oauth_state";
const RETURN_COOKIE = "relay_oauth_return";

/** 256 bits from a cryptographic source. Session ids are guessed, not derived. */
function token(): string {
  return randomBytes(32).toString("base64url");
}

export function newState(): string {
  return token();
}

const BASE_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // A deliberately enabled LAN demo can use HTTP with local identity only.
  // Entra and normal production deployments always retain Secure cookies.
  secure: process.env.NODE_ENV === "production" && !(
    process.env.RELAY_ALLOW_LOCAL_AUTH === "yes" &&
    process.env.RELAY_LOCAL_HTTP === "yes" &&
    !process.env.ENTRA_TENANT_ID &&
    !process.env.ENTRA_CLIENT_ID &&
    !process.env.ENTRA_CLIENT_SECRET
  ),
};

export async function beginSignIn(state: string, returnTo: string): Promise<void> {
  const jar = await cookies();
  // Short-lived: these exist only for the round trip to the identity provider.
  jar.set(STATE_COOKIE, state, { ...BASE_COOKIE, maxAge: 600 });
  jar.set(RETURN_COOKIE, returnTo, { ...BASE_COOKIE, maxAge: 600 });
}

export async function takeSignInState(): Promise<{ state?: string; returnTo?: string }> {
  const jar = await cookies();
  const state = jar.get(STATE_COOKIE)?.value;
  const returnTo = jar.get(RETURN_COOKIE)?.value;
  // Single use. A state that survives its exchange can be replayed.
  jar.delete(STATE_COOKIE);
  jar.delete(RETURN_COOKIE);
  return { ...(state ? { state } : {}), ...(returnTo ? { returnTo } : {}) };
}

export async function createSession(principal: Principal): Promise<Session> {
  const issuedAt = new Date();
  const session: Session = {
    id: token(),
    principal,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiryFrom(issuedAt),
  };

  atomic(() => {
    database().prepare("DELETE FROM records WHERE kind='sessions' AND json_extract(data,'$.expiresAt')<=?").run(issuedAt.toISOString());
    putRecord('sessions',session);
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, {
    ...BASE_COOKIE,
    expires: new Date(session.expiresAt),
  });

  return session;
}

/** The signed-in person, or null. Expiry is enforced here, not at the cookie. */
export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const session = getRecord<Session>('sessions',id);
  if (!session) return null;
  if (isExpired(session, new Date())) return null;
  // Pre-role sessions must reauthenticate; never silently promote existing users.
  if (!hasRole(session.principal)) return null;
  return session;
}

export async function currentPrincipal(): Promise<Principal | null> {
  return (await currentSession())?.principal ?? null;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) database().prepare("DELETE FROM records WHERE kind='sessions' AND id=?").run(id);
  jar.delete(SESSION_COOKIE);
}
