'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePrincipal } from './PrincipalContext';
import { sendHeldWork, type HeldSendResult } from '@/lib/heldSend';
import { OFFLINE_PERSON_KEY, OFFLINE_TYPES_KEY, offlineTypes, sentLine } from '@/lib/offlineStart';

/**
 * Work held on this device from the offline page goes up by itself once RELAY
 * opens with a connection, on whichever page opens first, and says so once.
 *
 * Not started on a report's own page: its editor already saves and compares
 * its held copy. A send already running when a report opens carries on, and
 * the editor waits for it (heldSendSettled) before reading anything.
 *
 * It also leaves the signed-in person on the device (name and id only), so the
 * offline page can open their held work when RELAY starts with no signal, and
 * the inspection checklists, so it can start an inspection as well.
 */
export function HeldWork() {
  const principal = usePrincipal();
  const pathname = usePathname();
  const router = useRouter();
  const [result, setResult] = useState<HeldSendResult | null>(null);

  useEffect(() => {
    try {
      if (principal) localStorage.setItem(OFFLINE_PERSON_KEY, JSON.stringify({ id: principal.id, name: principal.name }));
      else localStorage.removeItem(OFFLINE_PERSON_KEY);
      // The inspections and their checks, so the offline page can start one too.
      if (principal) localStorage.setItem(OFFLINE_TYPES_KEY, JSON.stringify(offlineTypes()));
    } catch { /* Storage blocked: the offline page says to reconnect. */ }
  }, [principal]);

  const editor = pathname.startsWith('/reports/');
  useEffect(() => {
    if (!principal || editor || typeof indexedDB === 'undefined') return;
    let cancelled = false;
    const send = () => void sendHeldWork(principal.id).then(outcome => {
      if (cancelled || (!outcome.sent.length && !outcome.problems.length)) return;
      setResult(outcome);
      if (outcome.sent.length) router.refresh();
    }, () => undefined);
    send();
    window.addEventListener('online', send);
    return () => { cancelled = true; window.removeEventListener('online', send); };
  }, [principal, editor, router]);

  if (!result || editor) return null;
  const one = result.sent.length === 1 ? result.sent[0] : undefined;
  return <div className="held-send">
    {result.sent.length > 0 && <div className="note note-ok" role="status">
      <strong>{sentLine(result.sent)}</strong>{' '}
      {one ? <Link href={`/reports/${one.reportId}`}>Open {one.reference.split('-').slice(1).join('-')}{one.projectName ? ` · ${one.projectName}` : ''}</Link>
        : <span>{result.sent.map(s => s.reference.split('-').slice(1).join('-')).join(', ')}.{result.sent.some(s => !s.submitted) ? ' Drafts are under Unfinished reports.' : ''}</span>}
      <button type="button" className="held-send-close" onClick={() => setResult(r => r && { ...r, sent: [] })} aria-label="Dismiss">Dismiss</button>
    </div>}
    {result.problems.map((p, i) => <div key={i} className="note note-bad" role="alert">
      <strong>{p.title}: {p.headline ?? 'still only on this phone.'}</strong> {p.reason}{' '}
      {p.reportId ? <Link href={`/reports/${p.reportId}`}>Open it</Link> : <a href="/offline.html">See what is on this phone</a>}
    </div>)}
  </div>;
}
