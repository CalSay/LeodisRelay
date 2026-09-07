import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveProvider } from "@/lib/auth/provider";
import { currentPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Sign in.
 *
 * States plainly which identity provider is in use. An interface that cannot
 * tell you whether it checked anyone's identity is worse than one that says it
 * did not — so when Entra is not configured, this page says so and names the
 * settings that are missing rather than looking like a working sign-in.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const { error, returnTo } = await searchParams;
  if (await currentPrincipal()) redirect(returnTo ?? "/");

  const { provider, missing } = resolveProvider();
  const isEntra = provider.kind === "entra";
  const href = `/api/auth/signin${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <main className="wrap" style={{ maxWidth: 460 }}>
      <div className="pagehead">
        <div>
          <h1>Sign in</h1>
          <p className="sub">Relay is for Leodis staff</p>
        </div>
      </div>

      {error && (
        <div className="note note-bad" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href={href} className="btn-primary btn-wide" style={{ display: "block", textAlign: "center", padding: "14px 0", borderRadius: 3 }}>
          {isEntra ? "Sign in with Microsoft" : "Continue"}
        </Link>
      </div>

      {isEntra ? (
        <p className="footnote">
          You will be taken to Microsoft to sign in with your Leodis account. Relay asks only for
          your name and email address.
        </p>
      ) : (
        <div className="note note-bad" style={{ marginTop: 24 }}>
          <strong>Microsoft sign-in is not configured.</strong> Nobody&apos;s identity is being
          checked — anyone can sign in as anyone. Missing:{" "}
          <span className="ref">{missing.join(", ")}</span>.
        </div>
      )}
    </main>
  );
}
