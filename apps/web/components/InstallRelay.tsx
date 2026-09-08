'use client';

import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{outcome:'accepted'|'dismissed'}>;
}

/** Guidance is always available in a browser; native installation is feature-detected. */
export function InstallRelay() {
  const [installed,setInstalled] = useState(false);
  const [prompt,setPrompt] = useState<InstallPrompt | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
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
      setMessage(choice.outcome === 'accepted' ? 'Follow your browser’s installation steps, then open RELAY from its app icon.' : 'Installation cancelled. You can continue using RELAY here.');
    } catch {setMessage('Use the browser instructions below to install RELAY.');}
    finally {setPrompt(null);setBusy(false);}
  }
  if (installed) return null;
  return <aside className="install-help" aria-label="Install RELAY">
    <details>
      <summary>Install RELAY on your phone</summary>
      <div className="install-help-body">
        <p>Add RELAY to your home screen and open it like an app. Use your usual Leodis Microsoft account.</p>
        {prompt && <button className="btn-primary" disabled={busy} onClick={install}>{busy ? 'Opening installer…' : 'Install RELAY'}</button>}
        <p role="status" aria-live="polite">{message}</p>
        <h2>iPhone or iPad</h2>
        <ol><li>Open this website in Safari.</li><li>Open the Share menu (it may be inside the More menu).</li><li>Choose <strong>Add to Home Screen</strong>. Keep <strong>Open as Web App</strong> enabled if shown, then tap <strong>Add</strong>.</li></ol>
        <h2>Android</h2>
        <ol><li>Open this website in Chrome.</li><li>Tap <strong>Install RELAY</strong> above if available, or open Chrome’s three-dot menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong> and follow the prompts. Wording varies by phone.</li></ol>
        <p>If you opened RELAY inside Teams or an email app, open the link in Safari or Chrome first. On a computer, look for the browser’s install option.</p>
        <p>Installation does not enable full offline working. Connect to sign in, upload photographs and submit reports. Offline recovery currently covers previously retained draft text.</p>
        <p>Updates come from RELAY’s website. Save your work before closing and reopening the app; do not uninstall it or clear browser data while work is waiting to save.</p>
      </div>
    </details>
  </aside>;
}
