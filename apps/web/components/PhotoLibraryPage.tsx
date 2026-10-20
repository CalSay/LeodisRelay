'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { PhotoImage } from './PhotoImage';
import { canManage } from '@/lib/auth/access';
import { mediaId } from '@/lib/media';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { matchesPhoto, PHOTO_GROUPS, type LibraryPhoto, type PhotoGroup, type PhotoLibrary } from '@/lib/photoLibrary';

/**
 * Every photograph on a project, newest first and grouped by day, so "what
 * did it look like before it was boarded?" is one page, not a dozen reports.
 * It reads what is already in RELAY and changes nothing.
 */

const PAGE = 60;
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isGroup = (v: string): v is PhotoGroup => PHOTO_GROUPS.some(g => g.value === v);
/** The PDF-sized copy for the viewer: sharp on a phone, far lighter than the original. */
const large = (src: string) => mediaId(src) ? `${src}?variant=pdf` : src;
const recordHref = (p: LibraryPhoto) => `/${p.source.kind === 'report' ? 'reports' : p.source.kind === 'issue' ? 'issues' : 'variations'}/${p.source.id}`;
const recordWord = { report: 'report', issue: 'issue', variation: 'variation' } as const;

export function PhotoLibraryPage({ initialProject, initialFind, initialShow, returnTo }: { initialProject: string; initialFind: string; initialShow: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [find, setFind] = useState(initialFind);
  const [show, setShow] = useState<PhotoGroup | ''>(isGroup(initialShow) ? initialShow : '');
  const [library, setLibrary] = useState<PhotoLibrary | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const fallback = manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}&view=reports` : ''}`;
  const back = safeViewReturn(returnTo, fallback);

  useEffect(() => {
    if (!projectId) { setLibrary(null); return; }
    let cancelled = false;
    setLibrary(null); setError('');
    fetch(`/api/photos?${new URLSearchParams({ projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as PhotoLibrary & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `The photographs could not be loaded (${response.status}).`);
        if (!cancelled) setLibrary(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The photographs could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the choices, so a record opened from here comes back
  // to the same project, words and filter. Replaced in place: typing must not
  // fill the phone's history or reload the page.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (find.trim()) q.set('q', find.trim());
  if (show) q.set('show', show);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/photos${q.size ? `?${q}` : ''}`;
  useEffect(() => { window.history.replaceState(window.history.state, '', here); }, [here]);
  useEffect(() => { setLimit(PAGE); }, [projectId, find, show]);

  const all = library?.projectId === projectId ? library.photos : null;
  const shown = useMemo(() => all?.filter(p => matchesPhoto(p, find, show)) ?? [], [all, find, show]);
  const days = useMemo(() => {
    const out: { day: string; photos: { p: LibraryPhoto; n: number }[] }[] = [];
    shown.slice(0, limit).forEach((p, n) => { const last = out.at(-1); if (last?.day === p.day) last.photos.push({ p, n }); else out.push({ day: p.day, photos: [{ p, n }] }); });
    return out;
  }, [shown, limit]);
  const current = open !== null ? shown[open] : undefined;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);
  const step = (by: number) => setOpen(n => n === null ? n : Math.min(shown.length - 1, Math.max(0, n + by)));

  return <main className="eng-page photos-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="eng-heading"><h1>Photographs{project ? ` · ${project.projectName}` : ''}</h1>
      <p>Every photograph sent from site on this project, newest first. Find a room, a riser or a reference to see how it looked on each visit.</p></div>
    <div className="photos-controls">
      <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
      </select></label>
      <label>Find<input type="text" inputMode="search" value={find} onChange={e => setFind(e.target.value)} placeholder="Location, words or reference" enterKeyHint="search" autoComplete="off" /></label>
      <div className="photos-show" role="group" aria-label="Show">
        <button type="button" aria-pressed={show === ''} onClick={() => setShow('')}>All</button>
        {PHOTO_GROUPS.map(g => <button key={g.value} type="button" aria-pressed={show === g.value} onClick={() => setShow(g.value)}>{g.label}</button>)}
      </div>
    </div>

    {!project ? <div className="eng-panel"><p className="eng-help">Choose a project to see its photographs.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !all ? <p role="status">Loading photographs…</p>
      : !all.length ? <div className="eng-panel photos-empty"><h2>No photographs yet</h2><p className="eng-help">Photographs on reports sent to the office, and those added to issues and variations, will appear here.</p></div>
      : <>
        <p className="photos-count" role="status">{shown.length === all.length ? plural(all.length, 'photograph') : `${shown.length} of ${plural(all.length, 'photograph')}`}</p>
        {!shown.length ? <div className="eng-panel photos-empty"><p className="eng-help">No photographs match. Try fewer words, or show all kinds.</p>
          <button type="button" onClick={() => { setFind(''); setShow(''); }}>Clear the find box and filter</button></div>
          : days.map(d => <section key={d.day} className="photos-day" aria-label={fmtDay(d.day)}>
            <h2>{fmtDay(d.day)}<span>{plural(shown.filter(p => p.day === d.day).length, 'photograph')}</span></h2>
            <ul className="photos-grid">{d.photos.map(({ p, n }) => <li key={p.src}>
              <button type="button" className={`photos-tile photos-tone-${p.group}`} onClick={() => setOpen(n)} aria-label={`Open photograph: ${p.label}${p.location ? `, ${p.location}` : ''}, ${p.source.reference}`}>
                <PhotoImage src={p.src} alt="" />
                <span className="photos-tile-text"><span className={`photos-kind photos-tone-${p.group}`}>{p.label}</span><span className="photos-where">{p.location || p.description || p.source.reference}</span></span>
              </button></li>)}</ul>
          </section>)}
        {shown.length > limit && <div className="photos-more"><button type="button" onClick={() => setLimit(n => n + PAGE)}>Show more photographs</button><span>{limit} of {shown.length} shown</span></div>}
      </>}

    <dialog ref={dialog} className="photos-viewer" aria-label="Photograph" onClose={() => setOpen(null)}
      onKeyDown={e => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); }}>
      {current && <>
        <div className="photos-viewer-bar">
          <span>{(open ?? 0) + 1} of {shown.length}</span>
          <button type="button" onClick={() => setOpen(null)} autoFocus>Close</button>
        </div>
        <div className="photos-viewer-image"><img src={large(current.src)} alt={current.caption || `${current.label}${current.location ? `, ${current.location}` : ''}`} /></div>
        <div className="photos-viewer-text">
          <p><span className={`photos-kind photos-tone-${current.group}`}>{current.label}</span>{current.location && <strong>{current.location}</strong>}</p>
          {current.caption && <p className="photos-caption">{current.caption}</p>}
          {current.description && <p>{current.description}</p>}
          <p className="photos-meta">{[fmtDay(current.day), current.by, current.trade].filter(Boolean).join(' · ')}</p>
          <div className="photos-viewer-actions">
            <button type="button" onClick={() => step(-1)} disabled={open === 0}>&larr; Newer</button>
            <Link className="btn-primary" href={withViewReturn(recordHref(current), here)}>Open {recordWord[current.source.kind]} {current.source.reference}</Link>
            <button type="button" onClick={() => step(1)} disabled={open === shown.length - 1}>Older &rarr;</button>
          </div>
        </div>
      </>}
    </dialog>
  </main>;
}
