'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Shown in place of a page that broke while it was drawn. It says the work is
 * safe and what to do, never the error itself; the reference is for whoever
 * looks at the server's log, and stays small.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return <main className="wrap eng-page problem-page">
    <p className="problem-kicker">SOMETHING WENT WRONG</p>
    <h1>RELAY could not show this page.</h1>
    <p>Anything you have saved is safe, and a report or inspection you were writing is kept on this device. Trying again usually works.</p>
    <div className="problem-actions">
      <button type="button" className="problem-go" disabled={busy} onClick={() => start(() => { router.refresh(); reset(); })}>Try again</button>
      <Link href="/">Go to your home page</Link>
    </div>
    <p className="problem-fine">If it keeps happening, tell the office what you were doing.{error.digest ? ` Reference ${error.digest}.` : ''}</p>
  </main>;
}
