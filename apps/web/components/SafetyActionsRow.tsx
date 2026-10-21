'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SafetyActions } from '@/lib/safetyActions';

/**
 * The home screen's row for Safety actions, with what is open on this project
 * and any tower due, so an engineer sees there is something to put right or
 * inspect without opening the page. Says nothing it does not know: before the
 * answer, or with no signal, it keeps the plain description.
 */
export function SafetyActionsRow({ projectId, href }: { projectId: string; href: string }) {
  const [totals, setTotals] = useState<SafetyActions['totals'] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTotals(null);
    fetch(`/api/safety-actions?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<SafetyActions> : null)
      .then(body => { if (!cancelled && body?.totals) setTotals(body.totals); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);
  return <Link className="eng-row" href={href}><div className="main">
    <b>Safety actions</b>
    <span>{totals ? safetySummary(totals) : 'What the safety inspections found, open until put right'}</span>
  </div><span className="chev">›</span></Link>;
}

/** "2 open · 1 tower due · safety inspection due", or "Nothing open". */
export function safetySummary(t: Pick<SafetyActions['totals'], 'open' | 'due' | 'towersDue'>): string {
  const parts = [t.open ? `${t.open} open` : 'Nothing open'];
  if (t.towersDue) parts.push(`${t.towersDue} tower${t.towersDue === 1 ? '' : 's'} due`);
  if (t.due) parts.push('safety inspection due');
  return parts.join(' · ');
}
