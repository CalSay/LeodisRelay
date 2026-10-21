'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { permitRowWords, type PermitSummary } from '@/lib/permits';

/**
 * The home screen's row for Permits to work: how many are open and whether
 * any has run past its end time, so an engineer sees a permit to close
 * without opening the page. Reads the figures only (`summary=1`). Says
 * nothing it does not know: before the answer, or with no signal, it keeps
 * the plain description.
 */
export function PermitsRow({ projectId, href }: { projectId: string; href: string }) {
  const [summary, setSummary] = useState<PermitSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    fetch(`/api/permits?${new URLSearchParams({ project: projectId, summary: '1' })}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ summary: PermitSummary }> : null)
      .then(body => { if (!cancelled && body?.summary) setSummary(body.summary); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);
  // Marked like a late row while a permit is open past its end time.
  return <Link className={`eng-row ${summary?.overdue ? 'late' : ''}`} href={href}><div className="main">
    <b>Permits to work</b>
    <span>{summary ? permitRowWords(summary) : 'Hot works and isolations open on this project'}</span>
  </div><span className="chev">›</span></Link>;
}
