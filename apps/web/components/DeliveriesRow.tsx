'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { deliveryRowWords, type DeliverySummary } from '@/lib/deliveries';

/**
 * The home screen's row for Deliveries: how many came in this week and how
 * many are still to sort, so an engineer sees a short delivery waiting
 * without opening the page. Reads the figures only (`summary=1`). Says
 * nothing it does not know: before the answer, or with no signal, it keeps
 * the plain description.
 */
export function DeliveriesRow({ projectId, href }: { projectId: string; href: string }) {
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    fetch(`/api/deliveries?${new URLSearchParams({ project: projectId, summary: '1' })}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ summary: DeliverySummary }> : null)
      .then(body => { if (!cancelled && body?.summary) setSummary(body.summary); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);
  return <Link className="eng-row" href={href}><div className="main">
    <b>Deliveries</b>
    <span>{summary ? deliveryRowWords(summary) : 'Materials taken in, and any short or damaged'}</span>
  </div><span className="chev">›</span></Link>;
}
