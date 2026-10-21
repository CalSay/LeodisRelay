import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };
export default function OfflinePage() {
  return (
    <main className="wrap">
      <div className="empty" style={{ marginTop: 48 }}>
        No signal, so RELAY cannot reach the office just now. Anything already on this phone is kept, and goes up by itself when you have signal again.
      </div>
    </main>
  );
}
