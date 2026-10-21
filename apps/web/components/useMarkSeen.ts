'use client';
import { useEffect, useRef } from 'react';
import type { Report } from '@/lib/types';
import { acknowledgeReport } from '@/lib/api';
import { opensAsSeen } from '@/lib/officeActions';
import { usePrincipal } from './PrincipalContext';

/**
 * Opening a sent report in the office is what marks it seen: there is no
 * button. Only a Manager or Admin who did not write it counts (`opensAsSeen`),
 * and it is asked for once per report opened. If the request fails nothing is
 * shown, and the next fresh copy of the report tries again.
 */
export function useMarkSeen(report: Report | null, onSeen: (seen: Report) => void): void {
  const principal = usePrincipal();
  const asked = useRef('');
  const seen = useRef(onSeen);
  seen.current = onSeen;
  const due = !!report && !!principal && opensAsSeen(report, principal);
  const id = report?.id ?? '';
  useEffect(() => {
    if (!due || asked.current === id) return;
    asked.current = id;
    acknowledgeReport(id).then(r => seen.current(r)).catch(() => { asked.current = ''; });
  }, [due, id, report]); // a fresh copy of the report (the desk refreshes every 15 seconds) retries a failed request
}
