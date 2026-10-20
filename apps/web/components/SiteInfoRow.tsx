'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadSiteInfo, type SiteInfoLoad } from '@/lib/siteInfoClient';
import { withViewReturn } from '@/lib/viewNavigation';

/**
 * The engineer home's way into site information, with the first line of the
 * address so they know it is there. Loading it here also keeps a copy on the
 * phone, so the details are there later if the signal goes.
 */
export function SiteInfoRow({ projectId, projectName, returnTo }: { projectId: string; projectName: string; returnTo: string }) {
  const [answer, setAnswer] = useState<SiteInfoLoad | null | 'failed'>(null);
  useEffect(() => {
    let cancelled = false;
    setAnswer(null);
    loadSiteInfo(projectId, projectName).then(a => { if (!cancelled) setAnswer(a); }, () => { if (!cancelled) setAnswer('failed'); });
    return () => { cancelled = true; };
  }, [projectId, projectName]);
  const info = answer && answer !== 'failed' ? answer.info : null;
  const contacts = info?.contacts.length ?? 0;
  const sub = answer === null ? 'Address, hours, access and who to ring'
    : answer === 'failed' ? 'Address, hours, access and who to ring · could not check just now'
    : !info ? 'Nothing recorded yet'
    : [info.address.split('\n')[0], contacts ? `${contacts} contact${contacts === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Hours, access and safety notes';
  return <Link className="eng-row" href={withViewReturn(`/site-info?${new URLSearchParams({ project: projectId })}`, returnTo)}>
    <div className="main"><b>Site information</b><span>{sub}</span>{answer && answer !== 'failed' && answer.offline && <div className="stat"><span className="tag tag-draft">Kept on this phone</span></div>}</div><span className="chev">›</span>
  </Link>;
}
