'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { daysAgo, type ToolboxSummary } from '@/lib/toolboxTalks';

/**
 * The home screen's row for Toolbox talks: when the last one was given and
 * on what, so an engineer can see at a glance whether the gang has been
 * briefed lately. Reads the figures only (`summary=1`), not the whole record.
 */
export function ToolboxTalksRow({ projectId, href }: { projectId: string; href: string }) {
  const [summary, setSummary] = useState<ToolboxSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    fetch(`/api/toolbox-talks?${new URLSearchParams({ project: projectId, summary: '1' })}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ summary: ToolboxSummary }> : null)
      .then(body => { if (!cancelled && body?.summary) setSummary(body.summary); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);
  const latest = summary?.latest;
  // Short enough to keep the row to two lines on a phone.
  const short = (t: string) => t.length > 34 ? `${t.slice(0, 32).trimEnd()}…` : t;
  return <Link className="eng-row" href={href}><div className="main">
    <b>Toolbox talks</b>
    <span>{latest ? `Last: ${short(latest.topic)} · ${daysAgo(summary!.daysSince!)}` : summary ? 'None recorded yet · record the next one here' : 'Record a safety briefing and who attended'}</span>
  </div><span className="chev">›</span></Link>;
}
