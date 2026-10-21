import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Signed in again' };

/** Where "Sign in again" from the signed-out prompt lands, in its own tab. */
export default function SignedInAgain() {
  return <main className="wrap eng-page problem-page">
    <p className="problem-kicker">SIGNED IN</p>
    <h1>You are signed in again.</h1>
    <p>Go back to the tab you were working in. RELAY carries on there, and anything waiting to save is saved. You can close this tab.</p>
    <p><Link href="/" className="problem-go">Go to your home page</Link></p>
  </main>;
}
