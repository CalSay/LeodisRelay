'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SiteNote } from '@/lib/siteNotes';
import { offlineNotesKey, readOfflineNotes, type OfflineNote } from '@/lib/offlineNotes';
import { usePrincipal } from './PrincipalContext';

/**
 * The home screen's row for Notes for the next visit: how many notes are
 * open and the start of the latest, so an engineer arriving on site sees
 * there is word waiting without opening the page. With no signal it shows
 * the copy kept on this phone (offlineNotes.ts) and says so, rather than
 * reading as if there were no notes.
 */
export function SiteNotesRow({ projectId, href }: { projectId: string; href: string }) {
  const principal = usePrincipal();
  const [notes, setNotes] = useState<{ open: (SiteNote | OfflineNote)[]; onPhone?: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    const onPhone = () => {
      if (cancelled || !principal) return;
      let raw: string | null = null;
      try { raw = localStorage.getItem(offlineNotesKey(principal.id)); } catch {}
      const copy = readOfflineNotes(raw)?.projects.find(p => p.projectId === projectId);
      if (copy) setNotes({ open: copy.open, onPhone: true });
    };
    fetch(`/api/site-notes?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ open: SiteNote[] }> : null)
      .then(body => { if (!cancelled && body && Array.isArray(body.open)) setNotes(body); })
      .catch(onPhone);
    return () => { cancelled = true; };
  }, [projectId, principal]);
  const latest = notes?.open[0];
  const count = notes?.open.length ?? 0;
  // Short enough to keep the row to two lines on a phone.
  const short = (t: string) => t.length > 40 ? `${t.slice(0, 38).trimEnd()}…` : t;
  return <Link className="eng-row" href={href}><div className="main">
    <b>Notes for the next visit</b>
    <span>{latest ? `“${short(latest.text)}” · ${latest.by}${count > 1 ? ` · ${count} notes` : ''}${notes?.onPhone ? ' · copy on this phone' : ''}` : 'Leave word for whoever is on site next'}</span>
  </div><span className="chev">›</span></Link>;
}
