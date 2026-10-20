'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { sinceLastVisit } from '@/lib/api';
import { FIRST_LOOK_DAYS, type CatchUpIssue, type CatchUpVariation, type SinceLastVisit as CatchUp } from '@/lib/sinceLastVisit';
import { withViewReturn } from '@/lib/viewNavigation';

const LONDON = { timeZone: 'Europe/London' } as const;
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short' });
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const short = (reference: string) => reference.split('-').slice(1).join('-');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Rows shown per group before "Show n more". */
const FIRST = 4;

function issueTag(i: CatchUpIssue): ReactNode {
  if (i.change === 'raised') return <span className="tag tag-draft">New issue</span>;
  if (i.change === 'fixed') return <span className="tag tag-draft">Put forward as fixed</span>;
  if (i.change === 'closed') return <span className="tag tag-sent">Checked and closed</span>;
  if (i.change === 'reopened') return <span className="tag tag-alert">Reopened</span>;
  return <span className="tag tag-draft">{i.owner ? `Assigned to ${i.owner}` : 'Assigned'}</span>;
}
const variationTag = (v: CatchUpVariation): ReactNode => v.change === 'instructed' ? <span className="tag tag-sent">Instructed</span>
  : v.change === 'declined' ? <span className="tag tag-draft">Declined</span> : <span className="tag tag-draft">New variation</span>;

function Group({ label, count, children }: { label: string; count: number; children: ReactNode[] }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;
  return <>
    <div className="eng-since-group"><span>{label}</span><span>{count}</span></div>
    {open ? children : children.slice(0, FIRST)}
    {count > FIRST && <button type="button" className="eng-since-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show fewer' : `Show ${count - FIRST} more`}</button>}
  </>;
}

/**
 * The engineer's catch-up on arriving at a site: what other people sent,
 * raised, fixed, closed and answered on this project since the engineer's own
 * last report here. Rules in `lib/sinceLastVisit.ts`.
 */
export function SinceLastVisit({ projectId, returnTo }: { projectId: string; returnTo: string }) {
  const [data, setData] = useState<CatchUp | null>(null);
  const [failed, setFailed] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed('');
    sinceLastVisit(projectId).then(d => { if (!cancelled) setData(d); }, e => { if (!cancelled) setFailed(e instanceof Error ? e.message : 'Could not check what changed.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  const total = data ? data.reports.length + data.issues.length + data.variations.length : 0;
  const from = data?.lastVisit ? `your report on ${fmtDay(data.lastVisit.visitDate)}` : '';
  return <section aria-labelledby="eng-since-title" className="eng-since">
    <div className="eng-section-title"><h2 id="eng-since-title">Since your last visit</h2><span className="r">{data ? `${total} new` : ''}</span></div>
    {data && <p className="eng-since-from">{data.lastVisit
      ? <>From others since <Link href={withViewReturn(`/reports/${data.lastVisit.reportId}`, returnTo)}>{from}</Link> ({short(data.lastVisit.reference)}).</>
      : <>You have not sent a report on this project before today, so this is the last {FIRST_LOOK_DAYS} days.</>}</p>}
    <div className="eng-list">
      {failed ? <div className="eng-empty" role="alert">{failed} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
        : !data ? <div className="eng-empty">Checking what has changed…</div>
        : !total ? <div className="eng-empty">Nothing new from anyone else{data.lastVisit ? ` since ${from}` : ` in the last ${FIRST_LOOK_DAYS} days`}. Reports, issues and variations other people record here will show up.</div>
        : <>
          <Group label="Reports from others" count={data.reports.length}>
            {data.reports.map(r => <Link key={r.id} href={withViewReturn(`/reports/${r.id}`, returnTo)} className="eng-row"><div className="main">
              <b>{r.author}{r.trade ? ` · ${r.trade}` : ''}</b>
              <span>{short(r.reference)} · visit {fmtDay(r.visitDate)} · {r.inspection ? `${r.inspection.name.toLowerCase()}, ${r.inspection.actions ? plural(r.inspection.actions, 'action') : 'no actions'}` : <>{plural(r.cards, 'card')}{r.defects ? `, ${plural(r.defects, 'defect')}` : ''}</>}</span>
              {r.correction && <div className="stat"><span className="tag tag-draft">Correction</span></div>}
            </div><span className="chev">›</span></Link>)}
          </Group>
          <Group label="Issues" count={data.issues.length}>
            {data.issues.map(i => <Link key={i.id} href={withViewReturn(`/issues/${i.id}`, returnTo)} className={`eng-row ${i.change === 'reopened' && i.yourTrade ? 'late' : ''}`}><div className="main">
              <b>{i.description}</b>
              <span>{short(i.reference)} · {i.location || 'no location'} · {i.by ? `${i.by}, ` : ''}{fmtWhen(i.at)}</span>
              <div className="stat">{issueTag(i)}{i.yourTrade && <span className="tag eng-tag-trade">Your trade</span>}</div>
            </div><span className="chev">›</span></Link>)}
          </Group>
          <Group label="Variations" count={data.variations.length}>
            {data.variations.map(v => <Link key={v.id} href={withViewReturn(`/variations/${v.id}`, returnTo)} className="eng-row"><div className="main">
              <b>{v.description}</b>
              <span>{short(v.reference)} · {v.location || 'no location'} · {v.by ? `${v.by}, ` : ''}{fmtWhen(v.at)}</span>
              <div className="stat">{variationTag(v)}</div>
            </div><span className="chev">›</span></Link>)}
          </Group>
        </>}
    </div>
  </section>;
}
