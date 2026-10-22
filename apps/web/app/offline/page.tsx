import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };

/** Said when a page cannot load for want of signal. The work on the phone is on /offline.html, which needs none. */
export default function OfflinePage() {
  return <main className="wrap eng-page problem-page">
    <p className="problem-kicker">NO SIGNAL</p>
    <h1>RELAY cannot reach the office just now.</h1>
    <p>Anything already on this phone is kept, and goes up by itself when you have signal again.</p>
    <p><a href="/offline.html" className="problem-go">See what is on this phone</a></p>
  </main>;
}
