import type { Metadata } from 'next';
import { redirect } from "next/navigation";

import { resolveProvider } from "@/lib/auth/provider";
import { currentPrincipal } from "@/lib/auth/session";
import { signInErrorMessage } from "@/lib/auth/signInErrors";
import { safeReturnTo } from '@relay/platform';
import { EntryFrame } from '@/components/EntryFrame';
import { InstallRelay } from '@/components/InstallRelay';
import { SignedInElsewhere } from '@/components/SignedInElsewhere';

export const metadata: Metadata = { title: 'Sign in' };

export const dynamic = "force-dynamic";

/**
 * Sign in.
 *
 * States plainly which identity provider is in use. An interface that cannot
 * tell you whether it checked anyone's identity is worse than one that says it
 * did not — so when Entra is not configured, this page says so and names the
 * settings that are missing rather than looking like a working sign-in.
 */
/** One line on where signing in leads, so a first sign-in from the office's link is not a surprise. */
function afterSignIn(destination: string, isEntra: boolean): string {
  const account = isEntra ? 'Use the same Microsoft account as your work email. ' : '';
  if (destination === '/') return `${account}Then choose your company.`;
  if (destination === '/?open=app') return `${account}RELAY then opens.`;
  if (destination === '/developments') return `${account}RELAY then opens Leodis Developments.`;
  return `${account}RELAY then opens the page you were going to.`;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string; returnTo?: string }>;
}) {
  const { error: code, ref, returnTo } = await searchParams;
  const error = signInErrorMessage(code, ref);
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
        <p className="entry-fine">{afterSignIn(destination, isEntra)}</p>
        {!isEntra && <div className="entry-notice"><strong>Development only — identity is not checked.</strong><br />Microsoft sign-in is not configured.<details><summary>Setup details</summary>Missing: {missing.join(', ')}.</details></div>}
        <InstallRelay />
        <SignedInElsewhere destination={destination} />
      </div>
    </div></EntryFrame>
  );
}
