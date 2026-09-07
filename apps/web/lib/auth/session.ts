import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { cookies } from "next/headers";

import { expiryFrom, isExpired, type Principal, type Session } from "@relay/platform";

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
const FILE = join(process.cwd(), ".relay-prototype", "sessions.json");

interface Store {
  sessions: Session[];
}

function load(): Store {
  try {
    if (!existsSync(FILE)) return { sessions: [] };
    return JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch {
    return { sessions: [] };
  }
}

function save(store: Store): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2), "utf8");
}

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
  // Secure in production only, or sign-in cannot be tested over plain http.
  secure: process.env.NODE_ENV === "production",
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

  const store = load();
  // Expired rows are cleared on write rather than accumulating forever.
  store.sessions = store.sessions.filter((s) => !isExpired(s, issuedAt));
  store.sessions.push(session);
  save(store);

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

  const session = load().sessions.find((s) => s.id === id);
  if (!session) return null;
  if (isExpired(session, new Date())) return null;
  return session;
}

export async function currentPrincipal(): Promise<Principal | null> {
  return (await currentSession())?.principal ?? null;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    const store = load();
    // Removed server-side as well as from the browser: clearing only the cookie
    // leaves a session that still works if the value is recovered.
    store.sessions = store.sessions.filter((s) => s.id !== id);
    save(store);
  }
  jar.delete(SESSION_COOKIE);
}
