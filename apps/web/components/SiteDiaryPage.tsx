'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { PhotoImage } from './PhotoImage';
import { canManage } from '@/lib/auth/access';
import { safeViewReturn, withViewReturn } from '@/lib/viewNavigation';
import { DIARY_KINDS, isDiaryKind, type DiaryCard, type DiaryEntry, type SiteDiary } from '@/lib/siteDiary';
import type { ObservationType } from '@/lib/fixtures';

/**
 * A project's living site diary: every visit, day by day, made from the
 * reports engineers already sent. Nobody fills anything in here, and every
 * line links back to the report revision it came from.
 */

const LONDON = { timeZone: 'Europe/London' } as const;
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { ...LONDON, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { ...LONDON, day: 'numeric', month: 'short', year: 'numeric' });
const fmtSent = (at: string) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('en-GB', { ...LONDON, day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { ...LONDON, hour: '2-digit', minute: '2-digit' })}`; };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const KIND: Record<ObservationType, [string, string]> = { update: ['Progress', 'progress'], defect: ['Defect', 'defect'], access: ['Access problem', 'access'], instruction: ['Variation required', 'variation'] };
const PHOTOS_SHOWN = 4;

function Card({ c, entry, here }: { c: DiaryCard; entry: DiaryEntry; here: string }) {
  const [label, tone] = KIND[c.type] ?? ['Update', 'progress'];
  const extra = c.photos.length - PHOTOS_SHOWN;
  return <li className={`diary-card diary-tone-${tone}`}>
    <p className="diary-card-head"><span className="diary-kind">{label}</span>{c.location ? <strong>{c.location}</strong> : <span className="diary-muted">No location recorded</span>}</p>
    {c.whatHappened && <p className="diary-text">{c.whatHappened}</p>}
    {c.actionNeeded && <p className="diary-sub"><span>Action needed</span>{c.actionNeeded}</p>}
    {c.owner && <p className="diary-sub"><span>Who</span>{c.owner}</p>}
    {c.photos.length > 0 && <ul className="diary-photos" aria-label={plural(c.photos.length, 'photograph')}>
      {c.photos.slice(0, PHOTOS_SHOWN).map((p, n) => <li key={p.src}><PhotoImage src={p.src} alt={p.caption || `${label}${c.location ? `, ${c.location}` : ''}, photograph ${n + 1}`} /></li>)}
      {extra > 0 && <li><Link className="diary-more-photos" href={withViewReturn(`/reports/${entry.reportId}`, here)} aria-label={`${plural(extra, 'more photograph')} on ${entry.reference}`}>+{extra}</Link></li>}
    </ul>}
    {(c.issue || c.variation) && <p className="diary-records">
      {c.issue && <Link className="diary-record" href={withViewReturn(`/issues/${c.issue.id}`, here)}>
        <span>{c.issue.sighting ? 'Seen again' : 'Raised'}</span><b className="ref">{c.issue.reference}</b><span className={`tag ${c.issue.status === 'Closed' ? 'tag-sent' : c.issue.status === 'Withdrawn' ? '' : 'tag-draft'}`}>{c.issue.status}</span></Link>}
      {c.variation && <Link className="diary-record" href={withViewReturn(`/variations/${c.variation.id}`, here)}>
        <span>Raised</span><b className="ref">{c.variation.reference}</b><span className={`tag ${c.variation.status === 'Instructed' ? 'tag-sent' : 'tag-draft'}`}>{c.variation.status}</span></Link>}
    </p>}
  </li>;
}

function Entry({ e, here, filtered }: { e: DiaryEntry; here: string; filtered: boolean }) {
  const [current, ...earlier] = e.revisions;
  return <article className="diary-entry" aria-label={`${e.reference} revision ${e.revision}, ${e.author}`}>
    <header className="diary-entry-head">
      <p className="diary-entry-ref"><Link className="ref" href={withViewReturn(`/reports/${e.reportId}`, here)}>{e.reference}</Link>
        <span className="tag tag-sent">Rev {e.revision}</span>
        {e.review === 'pending' && <span className="tag tag-draft">Awaiting review</span>}
        {e.review === 'returned' && <span className="tag tag-alert">Returned for changes</span>}</p>
      <p className="diary-by">{[e.author, e.trade, e.sentAt ? `sent ${fmtSent(e.sentAt)}` : ''].filter(Boolean).join(' · ')}</p>
      {earlier.length > 0 && <div className="diary-revisions">
        <p>Corrects rev {earlier[0]!.revision}{current?.correctionReason ? <>: <q>{current.correctionReason}</q></> : '.'}</p>
        <p>Earlier {earlier.length === 1 ? 'revision' : 'revisions'}: {earlier.map((r, n) => <span key={r.id}>{n > 0 && ', '}<Link href={withViewReturn(`/reports/${r.id}`, here)}>rev {r.revision}{r.sentAt ? `, sent ${fmtSent(r.sentAt)}` : ''}</Link></span>)}</p>
      </div>}
    </header>
    {e.cards.length ? <ul className="diary-cards">{e.cards.map(c => <Card key={c.id} c={c} entry={e} here={here} />)}</ul>
      : <p className="diary-muted diary-empty-report">Sent with no cards.</p>}
    {filtered && e.cards.length < e.cardCount && <p className="diary-partial">Showing {e.cards.length} of {plural(e.cardCount, 'card')}. <Link href={withViewReturn(`/reports/${e.reportId}`, here)}>Open the report for all of them</Link></p>}
  </article>;
}

export function SiteDiaryPage({ initialProject, initialFind, initialShow, returnTo }: { initialProject: string; initialFind: string; initialShow: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [find, setFind] = useState(initialFind);
  const [words, setWords] = useState(initialFind.trim());
  const [show, setShow] = useState<ObservationType | ''>(isDiaryKind(initialShow) ? initialShow : '');
  const [pages, setPages] = useState<SiteDiary[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  // Bumped whenever the project, words or filter change, so an older page still on its way is dropped.
  const generation = useRef(0);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const fallback = manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`;
  const back = safeViewReturn(returnTo, fallback);

  // Typing settles before the diary is asked again, so each key press is not a request.
  useEffect(() => { const t = setTimeout(() => setWords(find.trim()), 300); return () => clearTimeout(t); }, [find]);

  const load = async (before?: string): Promise<SiteDiary> => {
    const q = new URLSearchParams({ projectId });
    if (words) q.set('q', words);
    if (show) q.set('kind', show);
    if (before) q.set('before', before);
    const response = await fetch(`/api/site-diary?${q}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({})) as SiteDiary & { reason?: string };
    if (!response.ok) throw new Error(body.reason ?? `The diary could not be loaded (${response.status}).`);
    return body;
  };
  const failure = (e: unknown) => e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The diary could not be loaded.';

  useEffect(() => {
    if (!projectId) { setPages(null); return; }
    let cancelled = false;
    generation.current += 1;
    setPages(null); setError(''); setLoadingMore(false);
    load().then(d => { if (!cancelled) setPages([d]); }).catch(e => { if (!cancelled) setError(failure(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, words, show, retry]);

  const more = async () => {
    const last = pages?.at(-1);
    if (!last?.nextBefore) return;
    const asked = generation.current;
    setLoadingMore(true); setError('');
    try { const d = await load(last.nextBefore); if (generation.current === asked) setPages(p => p ? [...p, d] : [d]); }
    catch (e) { if (generation.current === asked) setError(failure(e)); }
    finally { if (generation.current === asked) setLoadingMore(false); }
  };

  // The address carries the choices, so a record opened from here comes back to
  // the same project, words and filter. Replaced, not pushed, so typing does not fill the history.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (words) q.set('q', words);
  if (show) q.set('show', show);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/diary${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const first = pages?.[0];
  const days = pages?.flatMap(p => p.days) ?? [];
  const filtered = Boolean(words || show);
  const nextBefore = pages?.at(-1)?.nextBefore;

  return <main className="eng-page diary-page">
    <Link href={back} className="back">&larr; Back</Link>
    <div className="eng-heading"><h1>Site diary{project ? ` · ${project.projectName}` : ''}</h1>
      <p>Every visit to site, day by day, made from the reports engineers sent. Nothing extra to fill in: each entry links to the report it came from.</p></div>
    <div className="diary-controls">
      <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
      </select></label>
      <label>Find<input type="text" inputMode="search" value={find} onChange={e => setFind(e.target.value)} placeholder="Location, words, name or reference" enterKeyHint="search" autoComplete="off" /></label>
      <div className="diary-show" role="group" aria-label="Show">
        <button type="button" aria-pressed={show === ''} onClick={() => setShow('')}>Everything</button>
        {DIARY_KINDS.map(k => <button key={k.value} type="button" aria-pressed={show === k.value} onClick={() => setShow(k.value)}>{k.label}</button>)}
      </div>
    </div>

    {!project ? <div className="eng-panel"><p className="eng-help">Choose a project to read its site diary.</p></div>
      : error && !pages ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !first ? <p role="status">Loading the diary…</p>
      : !first.totalDays ? (filtered
        ? <div className="eng-panel diary-empty"><p className="eng-help">Nothing in the diary matches. Try fewer words, or show everything.</p>
          <button type="button" onClick={() => { setFind(''); setWords(''); setShow(''); }}>Clear the find box and filter</button></div>
        : <div className="eng-panel diary-empty"><h2>No site visits yet</h2><p className="eng-help">When a site report is sent to the office, its visit appears here on the day it happened, with every card and photograph.</p></div>)
      : <>
        <p className="diary-count" role="status">{filtered ? 'Matching: ' : ''}{plural(first.totalDays, 'site day')} · {plural(first.totalReports, 'report')}{first.firstDay ? ` since ${fmtShort(first.firstDay)}` : ''}</p>
        <ol className="diary-days">{days.map(d => <li key={d.day} className="diary-day">
          <section aria-labelledby={`day-${d.day}`}>
            <h2 id={`day-${d.day}`}><span>{fmtDay(d.day)}</span><small>{d.engineers.join(', ')}{d.entries.length > 1 ? ` · ${plural(d.entries.length, 'report')}` : ''}</small></h2>
            {d.entries.map(e => <Entry key={e.reportId} e={e} here={here} filtered={filtered} />)}
          </section>
        </li>)}</ol>
        {error && <div className="note note-bad" role="alert">{error}</div>}
        {nextBefore ? <div className="diary-more"><button type="button" onClick={() => void more()} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show earlier days'}</button><span>{days.length} of {plural(first.totalDays, 'site day')} shown</span></div>
          : <p className="diary-end">{first.totalDays > 1 ? 'That is the start of the diary.' : ''}</p>}
      </>}
  </main>;
}
