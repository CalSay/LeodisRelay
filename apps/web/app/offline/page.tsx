import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };
export default function OfflinePage() {
  return (
    <main className="wrap">
      <div className="empty" style={{ marginTop: 48 }}>
        RELAY is offline. Reconnect to sign in or open a server report; work already held on this phone will sync when the app can connect again.
      </div>
    </main>
  );
}
