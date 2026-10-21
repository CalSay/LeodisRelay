import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found' };

/** Any address RELAY does not have: an old bookmark, a mistyped link, a record's page that has moved. */
export default function NotFound() {
  return <main className="wrap eng-page problem-page">
    <p className="problem-kicker">PAGE NOT FOUND</p>
    <h1>This page is not here.</h1>
    <p>The link may be out of date, or the page may have moved. Nothing you have saved is affected.</p>
    <div className="problem-actions">
      <Link href="/" className="problem-go">Go to your home page</Link>
      <Link href="/search">Search RELAY</Link>
    </div>
  </main>;
}
