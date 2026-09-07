import { ConfidentialClientApplication } from "@azure/msal-node";
import { principalIdFor, type Principal } from "@relay/platform";

/**
 * Where identity comes from.
 *
 * Two implementations behind one interface. Entra is the real one and the one
 * the design assumes (blueprint 0.8). The local one exists so the prototype can
 * be worked on and demonstrated before a tenant administrator has created the
 * app registration, and so nobody is tempted to leave authentication out
 * entirely while waiting.
 *
 * Which one is in use is decided by configuration and stated on the sign-in
 * screen, because an interface that cannot tell you whether it checked anyone's
 * identity is worse than one that plainly says it did not.
 */

export interface AuthProvider {
  readonly kind: "entra" | "local";
  /** Where to send the browser to begin sign-in. */
  authorizeUrl(input: { state: string; returnTo: string }): Promise<string>;
  /** Exchange the code the provider returns for a principal. */
  complete(input: { code: string }): Promise<Principal>;
}

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Only what is needed to identify a person. Nothing about their mailbox or files. */
const SCOPES = ["openid", "profile", "email", "User.Read"];

export function entraProvider(config: EntraConfig): AuthProvider {
  const app = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      clientSecret: config.clientSecret,
    },
  });

  return {
    kind: "entra",
    async authorizeUrl({ state }) {
      return app.getAuthCodeUrl({
        scopes: SCOPES,
        redirectUri: config.redirectUri,
        state,
        // Always ask, rather than silently reusing whichever account the
        // browser happens to be signed into. Engineers share devices.
        prompt: "select_account",
      });
    },
    async complete({ code }) {
      const result = await app.acquireTokenByCode({
        code,
        scopes: SCOPES,
        redirectUri: config.redirectUri,
      });

      const claims = (result.idTokenClaims ?? {}) as {
        oid?: string;
        name?: string;
        preferred_username?: string;
        email?: string;
      };

      const oid = claims.oid ?? result.uniqueId;
      if (!oid) {
        throw new Error("Microsoft did not return an account identifier.");
      }

      return {
        id: principalIdFor(oid),
        oid,
        name: claims.name ?? claims.preferred_username ?? "Unknown",
        email: claims.email ?? claims.preferred_username ?? "",
      };
    },
  };
}

/**
 * Local sign-in for development.
 *
 * Accepts a name and grants a session. It authenticates nobody, which is why it
 * refuses to load outside development: a stub provider reachable in production
 * is not a stub, it is an open door.
 */
export function localProvider(): AuthProvider {
  if (process.env.NODE_ENV === "production" && process.env.RELAY_ALLOW_LOCAL_AUTH !== "yes") {
    throw new Error(
      "Local sign-in is not available outside development. Configure Entra, or set " +
        "RELAY_ALLOW_LOCAL_AUTH=yes deliberately for a demonstration build.",
    );
  }

  return {
    kind: "local",
    async authorizeUrl({ state, returnTo }) {
      const params = new URLSearchParams({ state, returnTo });
      return `/signin/local?${params.toString()}`;
    },
    async complete({ code }) {
      // The "code" is the name typed on the local sign-in screen.
      const name = decodeURIComponent(code).trim() || "Local user";
      const oid = `local-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      return {
        id: principalIdFor(oid),
        oid,
        name,
        email: "",
      };
    },
  };
}

export interface ProviderStatus {
  provider: AuthProvider;
  /** Set when Entra is intended but not yet configured. */
  missing: string[];
}

/**
 * Choose a provider from the environment.
 *
 * Entra is used as soon as all four values are present. Until then the local
 * provider is used and the missing settings are reported, so the gap is visible
 * rather than silent.
 */
export function resolveProvider(): ProviderStatus {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const redirectUri =
    process.env.ENTRA_REDIRECT_URI ?? "http://localhost:4310/api/auth/callback";

  const missing = [
    !tenantId && "ENTRA_TENANT_ID",
    !clientId && "ENTRA_CLIENT_ID",
    !clientSecret && "ENTRA_CLIENT_SECRET",
  ].filter((v): v is string => typeof v === "string");

  if (missing.length === 0) {
    return {
      provider: entraProvider({
        tenantId: tenantId!,
        clientId: clientId!,
        clientSecret: clientSecret!,
        redirectUri,
      }),
      missing: [],
    };
  }

  return { provider: localProvider(), missing };
}
