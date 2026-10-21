'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { MIN_QUERY, searchWords, type SearchGroup, type SearchHit, type SearchKind, type SearchResults } from '@/lib/search';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';

const HREF: Record<SearchKind, string> = { report: '/reports/', issue: '/issues/', variation: '/variations/' };
const DONE = new Set(['Sent', 'Closed', 'Instructed']);
const ALERT = new Set(['Done, not instructed']);
const tone = (status: string) => DONE.has(status) || status.startsWith('Sent') ? 'tag-sent' : ALERT.has(status) ? 'tag-alert' : 'tag-draft';

/** Marks the words that matched, so a person sees why a row is here. */
function Marked({ text, words }: { text: string; words: string[] }): ReactNode {
  if (!words.length || !text) return text;
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\-‐-―]+')).join('|')})`, 'gi');
  return text.split(pattern).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part);
}

export function SearchPage({ initialQuery, initialProject, returnTo }: { initialQuery: string; initialProject: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [project, setProject] = useState(projects.some(p => p.id === initialProject) ? initialProject : '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const principal = usePrincipal();
  // Opened on its own, Back goes to the person's own landing page: the office desk for the office team.
  const back = safeViewReturn(returnTo, principal && canManage(principal) ? '/office' : '/engineer');
  const here = `/search?q=${encodeURIComponent(query.trim())}${project ? `&project=${encodeURIComponent(project)}` : ''}${returnTo ? `&returnTo=${encodeURIComponent(back)}` : ''}`;
  const ready = query.trim().length >= MIN_QUERY;
  const words = searchWords(query);

  useEffect(() => { if (!initialQuery) input.current?.focus(); }, [initialQuery]);

  useEffect(() => {
    // The address keeps the search, so "Back" from a result lands on the same list.
    router.replace(here, { scroll: false });
    if (!ready) { setResults(null); setError(''); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}${project ? `&projectId=${encodeURIComponent(project)}` : ''}`, { cache: 'no-store' })
        .then(async r => { const body = await r.json().catch(() => ({})); if (!r.ok) throw new Error(body.reason ?? 'Search is not available right now.'); return body as SearchResults; })
        .then(body => { if (!cancelled) { setResults(body); setError(''); } })
        .catch(e => { if (!cancelled) { setResults(null); setError(e instanceof Error ? e.message : 'Search is not available right now.'); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, project, retry]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.projectName ?? 'Project';
  const total = results ? results.reports.total + results.issues.total + results.variations.total : 0;

  const section = (title: string, kind: SearchKind, group: SearchGroup) => !group.total ? null : <section aria-label={title}>
    <div className="eng-section-title"><h2>{title}</h2><span className="r">{group.total > group.hits.length ? `${group.hits.length} of ${group.total}` : group.total}</span></div>
    <div className="eng-list">{group.hits.map((hit: SearchHit) => <Link key={hit.id} href={withViewReturn(`${HREF[kind]}${hit.id}`, here)} className="eng-row search-hit">
      <div className="main">
        <b className={hit.kind === 'report' ? 'ref' : undefined}><Marked text={hit.title} words={words} /></b>
        <span>{hit.kind === 'report' ? projectName(hit.projectId) : <><span className="ref">{hit.reference}</span> · {projectName(hit.projectId)}</>} · {hit.meta}</span>
        {hit.snippet && <span className="search-snippet"><Marked text={hit.snippet} words={words} /></span>}
        <div className="stat"><span className={`tag ${tone(hit.status)}`}>{hit.status}</span></div>
      </div><span className="chev">›</span>
    </Link>)}</div>
    {group.total > group.hits.length && <p className="eng-help">Showing the {group.hits.length} best matches. Add another word to narrow the list.</p>}
  </section>;

  return <main className="eng-page search-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="eng-heading"><h1>Search</h1><p>Find a report, issue or variation by any word you remember: a location, a reference, a company or a name.</p></div>
    <form className="search-form" role="search" onSubmit={e => { e.preventDefault(); setRetry(n => n + 1); }}>
      <label htmlFor="search-query">Search for
        <input ref={input} id="search-query" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="For example: level 3 riser, VO-004, Acme" autoComplete="off" enterKeyHint="search" />
      </label>
      <label htmlFor="search-project">Project
        <select id="search-project" value={project} onChange={e => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
        </select>
      </label>
    </form>
    <div aria-live="polite">
      {error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
        : !ready ? <p className="eng-help">{query.trim() ? `Type at least ${MIN_QUERY} letters.` : 'Results show as you type. Your own drafts are included; other people’s drafts are not.'}</p>
        : loading && !results ? <p role="status">Searching…</p>
        : results && !total ? <div className="eng-list"><div className="eng-empty">Nothing matches “{query.trim()}”{project ? ` on ${projectName(project)}` : ''}. Check the spelling, try fewer words{project ? ' or search all projects' : ''}.</div></div>
        : results && <p role="status" className="search-count">{total} match{total === 1 ? '' : 'es'}{loading ? ' · updating…' : ''}</p>}
      {!error && ready && results && <>
        {section('Issues', 'issue', results.issues)}
        {section('Reports', 'report', results.reports)}
        {section('Variations', 'variation', results.variations)}
      </>}
    </div>
  </main>;
}
