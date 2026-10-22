'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{outcome:'accepted'|'dismissed'}>;
}

/**
 * Guidance is always available in a browser; native installation is
 * feature-detected.
 *
 * Shown on the sign-in and home screens only. It used to sit above the content
 * of every page, which put a band of installation advice permanently above the
 * report an engineer was in the middle of writing. These are the two screens
 * someone is actually on when they think about installing it.
 */
export function InstallRelay({alwaysShow=false}: {alwaysShow?:boolean} = {}) {
  const [installed,setInstalled] = useState(false);
  const [prompt,setPrompt] = useState<InstallPrompt | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const pathname = usePathname();
  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const detect = () => setInstalled(mode.matches || (navigator as Navigator & {standalone?:boolean}).standalone === true);
    const capture = (event:Event) => {event.preventDefault();setPrompt(event as InstallPrompt);};
    const complete = () => {setInstalled(true);setPrompt(null);};
    detect();
    mode.addEventListener('change',detect);
    window.addEventListener('beforeinstallprompt',capture);
    window.addEventListener('appinstalled',complete);
    return () => {
      mode.removeEventListener('change',detect);
      window.removeEventListener('beforeinstallprompt',capture);
      window.removeEventListener('appinstalled',complete);
    };
  },[]);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);setMessage('');
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === 'accepted' ? 'Follow your phone’s steps, then open RELAY from its new icon.' : 'Not added. You can keep using RELAY here.');
    } catch {setMessage('Use the steps below instead.');}
    finally {setPrompt(null);setBusy(false);}
  }
  if (!alwaysShow && (installed || !['/','/signin'].includes(pathname))) return null;
  return <aside className="install-help" aria-label="Put RELAY on your home screen">
    <details>
      <summary>Put RELAY on your home screen</summary>
      <div className="install-help-body">
        <p>Do this once, and RELAY opens from an icon like any other app. Sign in with the same Leodis Microsoft account you use for work email.</p>
        {prompt && <button className="btn-primary" disabled={busy} onClick={install}>{busy ? 'Opening…' : 'Install RELAY'}</button>}
        <p role="status" aria-live="polite">{message}</p>
        <h2>iPhone</h2>
        <ol><li>Open this page in Safari.</li><li>Tap Share, the square with an arrow. It may be under the <strong>⋯</strong> button.</li><li>Tap <strong>Add to Home Screen</strong>. If you see <strong>Open as Web App</strong>, leave it on. Then tap <strong>Add</strong>.</li></ol>
        <h2>Android</h2>
        <ol><li>Open this page in Chrome.</li><li>Tap <strong>Install RELAY</strong> above if you see it. If not, tap Chrome’s <strong>⋮</strong> menu.</li><li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>. The words differ a little between phones. If it asks, choose <strong>Install</strong>, not Create shortcut: a shortcut opens RELAY in Chrome with the web address at the top.</li></ol>
        <p>Opened the link from Teams or an email? Open it in Safari or Chrome first.</p>
        <p>No signal on site? Open RELAY once with signal so it knows your sites. After that, with no signal you can still start your site update and take photos: they stay on your phone. Open RELAY again with signal to sign and send it. If the signal drops after you tap “Send to office”, RELAY keeps it and sends it by itself when signal comes back, while RELAY is open.</p>
        <p>Don’t clear your browser’s data or remove RELAY while something is waiting to send.</p>
      </div>
    </details>
  </aside>;
}
