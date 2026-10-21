'use client';

import './globals.css';

/**
 * The last resort, when the frame around every page broke too. It stands on
 * its own (no header, no shared components) so it still shows when they fail.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en-GB">
    <body>
      <main className="wrap eng-page problem-page">
        <p className="problem-kicker">RELAY · SOMETHING WENT WRONG</p>
        <h1>RELAY could not open this page.</h1>
        <p>Anything you have saved is safe, and a report or inspection you were writing is kept on this device.</p>
        <div className="problem-actions">
          <button type="button" className="problem-go" onClick={() => reset()}>Try again</button>
          <a href="/">Go to your home page</a>
        </div>
        <p className="problem-fine">If it keeps happening, tell the office what you were doing.{error.digest ? ` Reference ${error.digest}.` : ''}</p>
      </main>
    </body>
  </html>;
}
