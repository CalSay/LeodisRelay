'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePrincipal } from './PrincipalContext';
import { announceDefectResult, heldDefectsToSend, sendHeldDefect, sendingNow } from '@/lib/heldDefect';
import { OFFLINE_PERSON_KEY } from '@/lib/offlineStart';
import type { Issue } from '@/lib/types';

/** How often to try again while a defect waits, since many phones never say signal is back. */
const RETRY_MS = 15_000;

/**
 * Defects tapped "Send" with no signal go to the office by themselves once
 * RELAY can get through (lib/heldDefect.ts), on whichever page is open, like
 * a site update (#105): when the phone says it is online, when RELAY comes
 * back into view, and every little while besides. Nothing waits on
 * background sync, so a closed RELAY sends nothing until it is opened again.
 *
 * The defect screen showing the same defect says it went itself; anywhere
 * else this says so once, with a link to the issue.
 */
export function DefectsOnSignal() {
  const principal = usePrincipal();
  const [sent, setSent] = useState<Issue[]>([]);
  const [problems, setProblems] = useState<{ projectId: string; reason: string }[]>([]);

  useEffect(() => {
    if (!principal) return;
    let stopped = false;
    const trySend = () => {
      // Another person signed in on this phone since this tab opened: the upload would go in their name.
      try { if (JSON.parse(localStorage.getItem(OFFLINE_PERSON_KEY) ?? 'null')?.id !== principal.id) return; } catch { return; }
      for (const { key, defect } of heldDefectsToSend(principal.id)) {
        // Already on its way from a tap on the defect screen, which shows how it went.
        if (sendingNow(defect.requestId)) continue;
        void sendHeldDefect(key, defect, true).then(result => {
          if (result.kind === 'skipped' || !announceDefectResult(key, defect.requestId, result) || stopped || result.kind === 'waiting') return;
          if (result.kind === 'sent') setSent(list => list.some(i => i.id === result.issue.id) ? list : [...list, result.issue]);
          else setProblems(list => [...list, { projectId: defect.projectId, reason: result.reason }]);
        }, () => undefined);
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') trySend(); };
    trySend();
    const timer = setInterval(trySend, RETRY_MS);
    window.addEventListener('online', trySend);
    window.addEventListener('focus', trySend);
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('online', trySend); window.removeEventListener('focus', trySend); document.removeEventListener('visibilitychange', onVisible); };
  }, [principal]);

  if (!sent.length && !problems.length) return null;
  return <div className="held-send">
    {sent.map(issue => <div key={issue.id} className="note note-ok" role="status">
      <strong>Defect sent to the office by itself once there was signal: {issue.reference}.</strong>{' '}
      <Link href={`/issues/${issue.id}`}>Open it</Link>
      <button type="button" className="held-send-close" onClick={() => setSent(list => list.filter(i => i.id !== issue.id))} aria-label="Dismiss">Dismiss</button>
    </div>)}
    {problems.map((p, i) => <div key={i} className="note note-bad" role="alert">
      <strong>Defect not sent: still only on this phone.</strong> {p.reason}{' '}
      {/* A full load: the engineer home reads its view from the address only when it opens. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href={`/engineer?${new URLSearchParams({ project: p.projectId, view: 'defect' })}`}>Open it</a>
      <button type="button" className="held-send-close" onClick={() => setProblems(list => list.filter((_, j) => j !== i))} aria-label="Dismiss">Dismiss</button>
    </div>)}
  </div>;
}
