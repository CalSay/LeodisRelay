'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SiteNote } from '@/lib/siteNotes';

/**
 * The home screen's row for Notes for the next visit: how many notes are
 * open and the start of the latest, so an engineer arriving on site sees
 * there is word waiting without opening the page.
 */
export function SiteNotesRow({ projectId, href }: { projectId: string; href: string }) {
  const [notes, setNotes] = useState<{ open: SiteNote[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    fetch(`/api/site-notes?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ open: SiteNote[] }> : null)
      .then(body => { if (!cancelled && body && Array.isArray(body.open)) setNotes(body); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);
  const latest = notes?.open[0];
  const count = notes?.open.length ?? 0;
  // Short enough to keep the row to two lines on a phone.
  const short = (t: string) => t.length > 40 ? `${t.slice(0, 38).trimEnd()}…` : t;
  return <Link className="eng-row" href={href}><div className="main">
    <b>Notes for the next visit</b>
    <span>{latest ? `“${short(latest.text)}” · ${latest.by}${count > 1 ? ` · ${count} notes` : ''}` : 'Leave word for whoever is on site next'}</span>
  </div><span className="chev">›</span></Link>;
}
