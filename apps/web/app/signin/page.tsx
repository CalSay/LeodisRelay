import { redirect } from "next/navigation";

import { resolveProvider } from "@/lib/auth/provider";
import { currentPrincipal } from "@/lib/auth/session";
import { safeReturnTo } from '@relay/platform';
import { EntryFrame } from '@/components/EntryFrame';
import { InstallRelay } from '@/components/InstallRelay';

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
  const destination = safeReturnTo(returnTo);
  if (await currentPrincipal()) redirect(destination);

  const { provider, missing } = resolveProvider();
  const isEntra = provider.kind === "entra";
  const href = `/api/auth/signin?returnTo=${encodeURIComponent(destination)}`;

  return (
    <EntryFrame><div className="entry-signin">
      <div className="entry-hero"><p className="entry-kicker">SITE / OFFICE / CONNECTED</p><div className="entry-hero-title">On site.<br />On record.<br />In RELAY.</div><div className="entry-rule" /><p className="entry-copy">Keep the detail.<br />Move the work forward.</p></div>
      <div className="entry-login">
        <p className="entry-kicker">YOUR WORKSPACE</p>
        <h1><span className="entry-desktop-title">Ready when you are.</span><span className="entry-mobile-title">Welcome to RELAY.</span></h1>
        <p className="entry-copy">{isEntra ? 'Sign in with your Leodis work account.' : 'Use local sign-in to explore the prototype.'}</p>
        {error && <p role="alert" className="entry-notice entry-error">{error}</p>}
        <a href={href} className="entry-cta">
          {isEntra && <span className="entry-ms" aria-hidden="true"><b /><b /><b /><b /></span>}
          {isEntra ? 'Sign in with Microsoft' : 'Continue with local sign-in'}
        </a>
        <p className="entry-fine">{destination === '/' ? 'Choose Developments or Compliance after signing in.' : 'After signing in, return to the page you requested.'}</p>
        {!isEntra && <div className="entry-notice"><strong>Development only — identity is not checked.</strong><br />Microsoft sign-in is not configured.<details><summary>Setup details</summary>Missing: {missing.join(', ')}.</details></div>}
        <InstallRelay />
      </div>
    </div></EntryFrame>
  );
}
