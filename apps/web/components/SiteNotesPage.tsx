'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { useProjects } from './ProjectContext';
import { canManage } from '@/lib/auth/access';
import { clientId } from '@/lib/clientId';
import { DONE_DAYS, NOTE_MAX, type ProjectNotes, type SiteNote } from '@/lib/siteNotes';
import { keepProjectNotesOnDevice } from '@/lib/offlineNotes';
import { safeViewReturn, backLabel } from '@/lib/viewNavigation';
import { whenShort } from '@/lib/dates';
import { failure } from '@/lib/failure';

/**
 * Notes for the next visit: word left on a project for whoever is on site
 * next, by an engineer or the office. Not part of any report and never sent;
 * a note stays until someone marks it done with. Rules in `lib/siteNotes.ts`.
 * The open notes are kept on the phone as they are read, for the no-signal
 * page to show (`lib/offlineNotes.ts`).
 */

type Loaded = ProjectNotes & { live: boolean };

const LONDON = { timeZone: 'Europe/London' } as const;
/** "today", "yesterday", "3 days ago", so a reader can tell an old note at a glance. */
function age(iso: string): string {
  const day = (at: Date) => at.toLocaleDateString('en-CA', LONDON);
  const days = Math.round((Date.parse(`${day(new Date())}T12:00:00Z`) - Date.parse(`${day(new Date(iso))}T12:00:00Z`)) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}
const who = (n: SiteNote) => `${n.by}${n.byTrade ? ` · ${n.byTrade}` : ''}`;

export function SiteNotesPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const principalId = principal?.id;
  const projects = useProjects();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [text, setText] = useState('');
  const [requestId, setRequestId] = useState(() => clientId());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [said, setSaid] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);
  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId) { setData(null); return; }
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/site-notes?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as Loaded & { reason?: string };
        if (!response.ok) throw failure(response.status, body, 'The notes could not be loaded.');
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The notes could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // Whatever the server last said is what this phone keeps for reading with no signal.
  useEffect(() => {
    if (data && principalId) keepProjectNotesOnDevice(principalId, data.projectId, data.open);
  }, [data, principalId]);

  // The address carries the project, so a reload or a shared link opens the same notes.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/site-notes${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const replace = (note: SiteNote) => setData(d => {
    if (!d) return d;
    const rest = (list: SiteNote[]) => list.filter(n => n.id !== note.id);
    return note.done
      ? { ...d, open: rest(d.open), done: [note, ...rest(d.done)] }
      : { ...d, open: [note, ...rest(d.open)].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)), done: rest(d.done) };
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !projectId) return;
    if (!text.trim()) { setFormError('Write the note first.'); box.current?.focus(); return; }
    setSaving(true); setFormError(''); setSaid('');
    try {
      const response = await fetch('/api/site-notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: projectId, text, requestId }) });
      const body = await response.json().catch(() => ({})) as SiteNote & { reason?: string };
      if (response.status === 409 && body.reason?.includes('different words')) {
        // An earlier try was saved with other words and its reply was lost. Saving again keeps these words as a new note.
        setRequestId(clientId());
        throw new Error('An earlier try was saved with different words. Save again to keep these words as a new note, or reload to see it.');
      }
      if (!response.ok) throw failure(response.status, body, 'The note could not be saved.', 'What you typed is still here.');
      replace(body);
      setText(''); setRequestId(clientId()); setSaid('Note left for the next visit.');
      box.current?.focus();
    } catch (err) {
      setFormError(err instanceof TypeError ? 'No connection. Your note is still here: try again when there is signal.' : err instanceof Error ? err.message : 'The note could not be saved.');
    } finally { setSaving(false); }
  };

  const mark = async (note: SiteNote, done: boolean) => {
    if (busy) return;
    setBusy(note.id); setActionError(''); setSaid('');
    try {
      const response = await fetch(`/api/site-notes/${encodeURIComponent(note.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done }) });
      const body = await response.json().catch(() => ({})) as SiteNote & { reason?: string };
      if (!response.ok) throw failure(response.status, body, 'The note could not be changed.');
      replace(body);
      setSaid(done ? 'Note marked done with. It is kept below for two weeks if you need it back.' : 'Note put back.');
      // The button pressed has moved list, so focus goes to the form where the next thing usually happens.
      box.current?.focus();
    } catch (err) {
      setActionError(err instanceof TypeError ? 'No connection. Try again when there is signal.' : err instanceof Error ? err.message : 'The note could not be changed.');
    } finally { setBusy(''); }
  };

  const left = NOTE_MAX - text.trim().length;

  return <main className="eng-page sn-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="sn-head">
      <p className="lbl">{project ? `${project.projectNumber} · ${project.projectName}` : 'Site'}</p>
      <h1>Notes for the next visit</h1>
      <p className="sn-intro">Leave word for whoever is on site next: where a key is, an area that is locked, what is coming up. Notes stay here until someone marks them done with. They are not part of any report and are not sent to anyone.</p>
    </div>
    {projects.length > 1 && <div className="sn-controls">
      <label htmlFor="sn-project">Project</label>
      <select id="sn-project" value={projectId} onChange={e => { setProjectId(e.target.value); setFormError(''); setActionError(''); setSaid(''); }}>
        {!projectId && <option value="">Choose a project</option>}
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select>
    </div>}

    {!projectId ? <div className="eng-panel"><p>Choose a project to see its notes.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !data ? <p role="status">Loading notes…</p>
      : <>
        {data.live ? <form className="sn-form" onSubmit={save} aria-label="Leave a note">
          <label htmlFor="sn-text">Your note</label>
          <textarea id="sn-text" ref={box} value={text} onChange={e => setText(e.target.value)} maxLength={NOTE_MAX} rows={3}
            aria-describedby="sn-text-help" placeholder="For example: Riser 3 key is with the site manager. Ceiling grid on level 2 goes up Tuesday." />
          <p id="sn-text-help" className={`sn-sub${left < 50 ? ' sn-left' : ''}`}>{left < 50 ? `${Math.max(left, 0)} characters left` : `Up to ${NOTE_MAX} characters. Your name and the time are added.`}</p>
          {formError && <p className="note note-bad" role="alert">{formError}</p>}
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Leave note'}</button>
        </form>
          : <div className="eng-panel"><p>This project is not active or in defects liability, so it takes no new notes.</p></div>}

        {actionError && <p className="note note-bad" role="alert">{actionError}</p>}
        <section aria-labelledby="sn-open-title" className="sn-section">
          <h2 id="sn-open-title">Open notes <span className="sn-count">{data.open.length}</span></h2>
          {data.open.length ? <ul className="sn-list">{data.open.map(n => <li key={n.id} className="sn-note">
            <p className="sn-text">{n.text}</p>
            <p className="sn-meta">{who(n)} · {whenShort(n.at)} <span className="sn-age">({age(n.at)})</span></p>
            <button type="button" className="btn-quiet sn-done" onClick={() => void mark(n, true)} disabled={!!busy} aria-label={`Mark done with: ${n.text.slice(0, 60)}`}>{busy === n.id ? 'Saving…' : 'Done with'}</button>
          </li>)}</ul>
            : <p className="sn-none">No notes on this project. Anything the next person on site should know?</p>}
        </section>

        {data.done.length > 0 && <details className="sn-section sn-done-list">
          <summary>Marked done with in the last {DONE_DAYS / 7} weeks ({data.done.length})</summary>
          <ul className="sn-list">{data.done.map(n => <li key={n.id} className="sn-note sn-note-done">
            <p className="sn-text">{n.text}</p>
            <p className="sn-meta">{who(n)} · {whenShort(n.at)}</p>
            <p className="sn-meta">Marked done with by {n.done!.by} · {whenShort(n.done!.at)}</p>
            {data.live && <button type="button" className="btn-quiet sn-done" onClick={() => void mark(n, false)} disabled={!!busy} aria-label={`Put back: ${n.text.slice(0, 60)}`}>{busy === n.id ? 'Saving…' : 'Put back'}</button>}
          </li>)}</ul>
        </details>}
        <p className="sn-foot">Anyone on the project can leave a note or mark one done with, and RELAY keeps who did it and when. Something the client or project manager needs to know still goes in a site update.</p>
      </>}
    <p className="eng-sr" role="status">{said}</p>
  </main>;
}
