'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { dayLabel, myWeekText, type MyWeek, type MyWeekIssueKind, type MyWeekProject, type MyWeekRecordKind, type MyWeekReport } from '@/lib/myWeek';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { londonDay, shiftWeek, weekEnd, weekStart } from '@/lib/weeklySummary';
import { failure } from '@/lib/failure';

/**
 * The signed-in person's own week, day by day across every project: where
 * they sent reports from, defects they flagged, issue updates they made and
 * the toolbox talks, permits and deliveries they recorded.
 * Ready to copy into a timesheet. It reads what is already in RELAY and
 * changes nothing.
 */

const fmtDay = (ymd: string) => dayLabel(ymd);
const fmtLong = (ymd: string) => dayLabel(ymd, true);
const fmtTime = (at: string) => new Date(at).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isWeekend = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay() % 6 === 0;
const KIND_WORD: Record<string, [string, string]> = { update: ['progress update', 'progress updates'], defect: ['defect', 'defects'], instruction: ['variation required', 'variations required'], access: ['access problem', 'access problems'] };
const ISSUE_WORD: Record<MyWeekIssueKind, string> = { flagged: 'Flagged a defect', progress: 'Recorded an update', fixed: 'Put forward as fixed' };
const recorded = (p: MyWeekProject) => p.reports.length + p.issues.length + p.records.length > 0;
/** The project page a site record lives on. */
const RECORD_PAGE: Record<MyWeekRecordKind, string> = { talk: '/toolbox-talks', permit: '/permits', 'permit-closed': '/permits', delivery: '/deliveries', 'delivery-sorted': '/deliveries' };

function kindLine(kinds: MyWeekReport['kinds']): string {
  return OBSERVATION_TYPES.filter(t => t.value !== 'check' && kinds[t.value]).map(t => { const [one, many] = KIND_WORD[t.value]!; return plural(kinds[t.value], one, many); }).join(', ') || 'no cards';
}

export function MyWeekPage({ initialWeek, returnTo }: { initialWeek: string; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const router = useRouter();
  const today = londonDay(new Date());
  const thisWeek = weekStart(undefined, today);
  const [week, setWeek] = useState(weekStart(initialWeek, today));
  const [data, setData] = useState<MyWeek | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState<'' | 'done' | 'manual'>('');
  const back = safeViewReturn(returnTo, principal && canManage(principal) ? '/office' : '/engineer');

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(''); setCopied('');
    fetch(`/api/my-week?${new URLSearchParams({ week })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as MyWeek & { reason?: string };
        if (!response.ok) throw failure(response.status, body, 'Your week could not be loaded.');
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'Your week could not be loaded.'); });
    return () => { cancelled = true; };
  }, [week, retry]);

  // The address carries the week, so a record opened from the page comes back to it.
  const q = new URLSearchParams();
  if (week !== thisWeek) q.set('week', week);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/my-week${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const w = data?.start === week ? data : null;
  const text = w ? myWeekText(w, principal?.name ?? 'My week', today) : '';
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied('done'); }
    catch { setCopied('manual'); }
  }
  // Weekend days are shown only when something was recorded on them.
  const shown = w ? w.days.filter(d => !isWeekend(d.day) || d.projects.length) : [];

  return <main className="eng-page mw-page">
    <Link href={back} className="back mw-noprint">&larr; {backLabel(back)}</Link>
    <div className="mw-head">
      <p className="lbl">My week</p>
      <h1>{principal?.name}</h1>
      <p className="mw-range">{fmtDay(week)} to {fmtDay(weekEnd(week))} {weekEnd(week).slice(0, 4)}{w?.current ? ' · this week so far' : ''}</p>
    </div>
    <div className="mw-controls mw-noprint">
      <div className="mw-step" role="group" aria-label="Choose the week">
        <button type="button" onClick={() => setWeek(x => shiftWeek(x, -1))}>&larr; Previous week</button>
        <button type="button" onClick={() => setWeek(thisWeek)} disabled={week === thisWeek}>This week</button>
        <button type="button" onClick={() => setWeek(x => shiftWeek(x, 1))} disabled={week >= thisWeek}>Next week &rarr;</button>
      </div>
      <button type="button" className="btn-primary" onClick={() => void copy()} disabled={!w || !w.totals.days}>Copy for my timesheet</button>
    </div>
    {copied === 'done' && <p className="note note-ok mw-noprint" role="status">Copied. Paste it into your timesheet or a message.</p>}
    {copied === 'manual' && <div className="mw-copy mw-noprint"><label htmlFor="mw-text">This phone did not allow copying. Select the text below and copy it.</label><textarea id="mw-text" readOnly value={text} rows={Math.min(10, text.split('\n').length)} onFocus={e => e.currentTarget.select()} /></div>}

    {error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !w ? <p role="status">Loading your week…</p>
      : <>
        <dl className="mw-stats">
          <div><dt>Days with records</dt><dd>{w.totals.days}</dd></div>
          <div><dt>Projects</dt><dd>{w.totals.projects}</dd></div>
          <div><dt>Reports sent</dt><dd>{w.totals.reports}{w.totals.records > 0 && <small>{plural(w.totals.records, 'other site record')}</small>}</dd></div>
          <div><dt>Defects flagged</dt><dd>{w.totals.flagged}<small>{plural(w.totals.issueUpdates, 'issue update')}</small></dd></div>
        </dl>
        {!w.totals.days && !w.totals.drafts && <p className="note mw-nothing">Nothing recorded {w.current ? 'this week yet' : 'that week'}. Reports you send, defects you flag on their own, updates you add on an issue, and toolbox talks, permits and deliveries you record show here, day by day.</p>}
        {w.totals.drafts > 0 && <p className="note mw-unsent">{w.totals.drafts === 1 ? 'One report for this week is' : `${w.totals.drafts} reports for this week are`} not sent yet. {w.totals.drafts === 1 ? 'It is' : 'They are'} marked below; the office has not got {w.totals.drafts === 1 ? 'it' : 'them'}.</p>}
        <ol className="mw-days">
          {shown.map(d => <li key={d.day} className={`mw-day${d.day === today ? ' mw-today' : ''}${d.projects.length ? '' : ' mw-empty'}`}>
            <h2>{fmtLong(d.day)}{d.day === today && <span className="tag tag-draft">Today</span>}<span className="mw-count">{d.projects.some(recorded) ? plural(d.projects.filter(recorded).length, 'project') : ''}</span></h2>
            {!d.projects.length ? <p className="mw-none">{d.day > today ? 'Still to come.' : 'Nothing recorded.'}</p>
              : d.projects.map(p => <section key={p.projectId} className="mw-project" aria-label={`${p.projectName}, ${fmtLong(d.day)}`}>
                <h3><span className="ref">{p.projectNumber}</span> {p.projectName}</h3>
                <ul className="mw-rows">
                  {p.reports.map(r => <li key={r.id}>
                    <p><Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link><span className="tag tag-sent">Sent</span>{r.revision > 1 && <span className="tag tag-draft">Rev {r.revision}</span>}</p>
                    <p className="mw-meta">{r.inspection ? `${r.inspection.name}, ${r.inspection.action ? plural(r.inspection.action, 'action') : 'no actions'}` : kindLine(r.kinds)}{r.photos ? ` · ${plural(r.photos, 'photograph')}` : ''}</p>
                    {r.locations.length > 0 && <p className="mw-meta">{r.locations.join(' · ')}</p>}
                  </li>)}
                  {p.issues.map(i => <li key={`${i.id}-${i.at}`}>
                    <p><Link className="ref" href={withViewReturn(`/issues/${i.id}`, here)}>{i.reference}</Link><span className={`tag ${i.kind === 'flagged' ? 'tag-alert' : 'tag-draft'}`}>{ISSUE_WORD[i.kind]}</span><span className="mw-time">{fmtTime(i.at)}</span></p>
                    <p className="mw-desc">{i.description}</p>
                    {i.location && <p className="mw-meta">{i.location}</p>}
                  </li>)}
                  {p.records.map(r => <li key={`${r.kind}-${r.id}`}>
                    <p><Link className="mw-rec" href={withViewReturn(`${RECORD_PAGE[r.kind]}?${new URLSearchParams({ project: p.projectId })}`, here)}>{r.title}</Link><span className="mw-time">{fmtTime(r.at)}</span></p>
                    {r.detail && <p className="mw-meta">{r.detail}</p>}
                  </li>)}
                  {p.drafts.map(r => <li key={r.id} className="mw-draft">
                    <p><Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link><span className="tag tag-alert">Not sent yet</span></p>
                    <p className="mw-meta">{r.correction ? 'Correction draft' : `${r.typeName} draft`} · {plural(r.cards, r.typeName === 'Site update' ? 'card' : 'check')} · open it to sign and send</p>
                  </li>)}
                </ul>
              </section>)}
          </li>)}
        </ol>
        <p className="mw-foot">Made from what you recorded in RELAY: reports you sent, placed on the visit day you gave; defects you flagged on their own; updates you added on an issue; and toolbox talks, permits and deliveries you recorded, closed or sorted. A corrected report replaces the one it corrects. RELAY does not know your hours, so check the times before you send a timesheet.</p>
      </>}
  </main>;
}
