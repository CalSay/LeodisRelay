'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { usePrincipal } from './PrincipalContext';
import { announceDefectResult, heldDefectsToSend, refusedNow, sendHeldDefect, sendingNow } from '@/lib/heldDefect';
import { sendWaitingUpdate, updateSending } from '@/lib/heldUpdate';
import { OFFLINE_PERSON_KEY } from '@/lib/offlineStart';
import { SEND_ON_SIGNAL_KEY, waitingLines } from '@/lib/sendOnSignal';
import { SHOWN_HERE_EVENT, shownHere } from '@/lib/shownHere';
import type { Issue, Report } from '@/lib/types';

/** How often to try again while something waits, since many phones never say signal is back. */
const RETRY_MS = 15_000;

/** "a defect", "your site update", "2 defects". */
const count = (n: number, one: string, many: string) => n === 1 ? one : `${n} ${many}`;
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Work tapped "Send" with no signal goes to the office by itself once RELAY
 * can get through, on whichever page is open: defects (lib/heldDefect.ts,
 * 2026-10-21) and site updates (lib/heldUpdate.ts, the same evening). It
 * tries when the phone says it is online, when RELAY comes back into view,
 * and every little while besides. Nothing waits on background sync, so a
 * closed RELAY sends nothing until it is opened again, and then it does.
 *
 * A report's own page sends that report itself, and the defect screen showing
 * the same defect says it went itself; anywhere else this says so once, with
 * a link. While anything waits it says so in one line, in the words the
 * defect screen uses, leaving out what the open screen already shows.
 */
export function SendOnSignal() {
  const principal = usePrincipal();
  const pathname = usePathname();
  const router = useRouter();
  const [sent, setSent] = useState<Issue[]>([]);
  const [problems, setProblems] = useState<{ projectId: string; reason: string }[]>([]);
  const [updatesSent, setUpdatesSent] = useState<{ report: Report; what: string }[]>([]);
  const [updateProblems, setUpdateProblems] = useState<{ reportId: string; what: string; reason: string }[]>([]);
  const [waiting, setWaiting] = useState<{ updates: string[]; defects: number; offline: boolean }>({ updates: [], defects: 0, offline: false });
  /** The report whose own page is open: it sends itself, and says so itself. */
  const here = pathname.startsWith('/reports/') ? decodeURIComponent(pathname.split('/')[2] ?? '') : '';

  const look = useCallback(() => {
    if (!principal) return;
    const defects = heldDefectsToSend(principal.id).filter(d => !refusedNow(d.defect.requestId) && !shownHere(d.key)).length;
    const updates = waitingLines(principal.id).filter(w => w.reportId !== here && w.seq !== undefined).map(w => w.what ?? 'report');
    setWaiting({ updates, defects, offline: typeof navigator !== 'undefined' && navigator.onLine === false });
  }, [principal, here]);

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
          if (!stopped) look();
          if (result.kind === 'skipped' || !announceDefectResult(key, defect.requestId, result) || stopped || result.kind === 'waiting') return;
          if (result.kind === 'sent') setSent(list => list.some(i => i.id === result.issue.id) ? list : [...list, result.issue]);
          else setProblems(list => [...list, { projectId: defect.projectId, reason: result.reason }]);
        }, () => undefined);
      }
      for (const line of waitingLines(principal.id)) {
        // Its own page is open: the page sends it, and shows how it went.
        if (line.reportId === here || updateSending(line.reportId)) continue;
        void sendWaitingUpdate(line.reportId, principal.id).then(result => {
          if (stopped) return;
          look();
          if (result.kind === 'sent') {
            setUpdatesSent(list => list.some(s => s.report.id === result.report.id) ? list : [...list, { report: result.report, what: line.what ?? 'report' }]);
            // The home screen's "Send today's update" and lists come from the server.
            router.refresh();
          } else if (result.kind === 'refused') setUpdateProblems(list => [...list.filter(p => p.reportId !== result.reportId), { reportId: result.reportId, what: result.what, reason: result.reason }]);
        }, () => undefined);
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') trySend(); };
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === SEND_ON_SIGNAL_KEY || e.key.startsWith('relay-defect')) look(); };
    trySend();
    look();
    const timer = setInterval(trySend, RETRY_MS);
    window.addEventListener('online', trySend);
    window.addEventListener('online', look);
    window.addEventListener('offline', look);
    window.addEventListener('focus', trySend);
    window.addEventListener('storage', onStorage);
    window.addEventListener(SHOWN_HERE_EVENT, look);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true; clearInterval(timer);
      window.removeEventListener('online', trySend); window.removeEventListener('online', look); window.removeEventListener('offline', look);
      window.removeEventListener('focus', trySend); window.removeEventListener('storage', onStorage); window.removeEventListener(SHOWN_HERE_EVENT, look);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [principal, here, look, router]);

  // The line, said as the defect screen says it: what is kept, and that it goes by itself.
  const updates = waiting.updates.length === 1 ? [`your ${waiting.updates[0]}`]
    : waiting.updates.length ? [new Set(waiting.updates).size === 1 ? `${waiting.updates.length} ${waiting.updates[0]}s` : `${waiting.updates.length} reports`] : [];
  const things = [...updates, ...(waiting.defects ? [count(waiting.defects, 'a defect', 'defects')] : [])];
  const many = waiting.updates.length + waiting.defects > 1;
  const shown = updatesSent.length || updateProblems.length || sent.length || problems.length || things.length;
  if (!shown) return null;
  return <div className="held-send">
    {things.length > 0 && <div className="note held-send-waiting" role="status">
      <strong>{waiting.offline ? 'Waiting for signal.' : 'Waiting for RELAY’s server.'}</strong>{' '}
      <span>{upper(things.join(' and '))} {many ? 'are' : 'is'} kept on this phone and {many ? 'go' : 'goes'} to the office by {many ? 'themselves' : 'itself'} as soon as {waiting.offline ? 'there is signal' : 'it answers'}, while RELAY is open.</span>
    </div>}
    {updatesSent.map(({ report, what }) => <div key={report.id} className="note note-ok" role="status">
      <strong>{upper(what)} sent to the office by itself once there was signal: {report.reference}.</strong>{' '}
      <Link href={`/reports/${report.id}`}>Open it</Link>
      <button type="button" className="held-send-close" onClick={() => setUpdatesSent(list => list.filter(s => s.report.id !== report.id))} aria-label="Dismiss">Dismiss</button>
    </div>)}
    {updateProblems.map(p => <div key={p.reportId} className="note note-bad" role="alert">
      <strong>{upper(p.what)} not sent to the office.</strong> {p.reason}{' '}
      <Link href={`/reports/${p.reportId}`}>Open it</Link>
      <button type="button" className="held-send-close" onClick={() => setUpdateProblems(list => list.filter(x => x.reportId !== p.reportId))} aria-label="Dismiss">Dismiss</button>
    </div>)}
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
