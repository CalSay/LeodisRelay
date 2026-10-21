'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { useProjects } from './ProjectContext';
import { canManage } from '@/lib/auth/access';
import { clientId } from '@/lib/clientId';
import {
  BACKDATE_DAYS, CLOSE_NOTE_MAX, LONGEST_DAYS, NAME_MAX, NOTES_MAX, PERMIT_KINDS, REASON_MAX, RECENT_DAYS, REFERENCE_MAX, WORK_MAX,
  closeCheck, endsWords, kindLabel, londonMinute, permitOrder, permitRepeats, permitState, permitSummary,
  type Permit, type PermitKind, type ProjectPermits,
} from '@/lib/permits';
import { safeViewReturn, backLabel } from '@/lib/viewNavigation';
import { dayShort, whenShort } from '@/lib/dates';

/**
 * Permits to work: the hot works, isolation and other permits on a project,
 * open until someone closes them with the closing check confirmed, so site
 * and the office can see what is live and what was left open. Not part of
 * any report and never sent; a record entered by mistake is withdrawn with a
 * reason and stays listed. Rules in `lib/permits.ts`.
 */

type Loaded = ProjectPermits & { live: boolean; repeats: Permit[]; now: string };

/** How many closed or withdrawn permits show before "Show all". */
const FIRST = 20;
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Today at 17:00 while that is still ahead; later in the day, left for the person to fill from the permit. */
const defaultEnds = (now: string) => now.slice(11) < '17:00' ? `${now.slice(0, 10)}T17:00` : '';

export function PermitsPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const projects = useProjects();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const nowAtLoad = londonMinute(new Date());
  const today = nowAtLoad.slice(0, 10);
  const [kind, setKind] = useState<PermitKind | ''>('');
  const [work, setWork] = useState('');
  const [reference, setReference] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [heldBy, setHeldBy] = useState(principal?.name ?? '');
  const [day, setDay] = useState(today);
  const [ends, setEnds] = useState(() => defaultEnds(nowAtLoad));
  const [notes, setNotes] = useState('');
  const [requestId, setRequestId] = useState(() => clientId());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [said, setSaid] = useState('');
  const [showAll, setShowAll] = useState(false);
  // One permit at a time is being closed or withdrawn: `${'close'|'withdraw'}:${id}`.
  const [acting, setActing] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [actError, setActError] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const workInput = useRef<HTMLTextAreaElement>(null);
  const actInput = useRef<HTMLInputElement>(null);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);
  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId) { setData(null); return; }
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/permits?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as Loaded & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `The permits could not be loaded (${response.status}).`);
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The permits could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the project, so a reload or a shared link opens the same record.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/permits${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  useEffect(() => { if (formOpen) document.querySelector<HTMLInputElement>('.pt-kinds input:checked, .pt-kinds input')?.focus(); }, [formOpen]);
  useEffect(() => { if (acting) actInput.current?.focus(); }, [acting]);

  const resetForm = () => {
    const now = londonMinute(new Date());
    setKind(''); setWork(''); setReference(''); setIssuedBy(''); setHeldBy(principal?.name ?? ''); setDay(now.slice(0, 10)); setEnds(defaultEnds(now)); setNotes(''); setFormError(''); setRequestId(clientId());
  };
  const closeForm = () => { setFormOpen(false); resetForm(); requestAnimationFrame(() => opener.current?.focus()); };
  const startFrom = (p: Permit) => { setKind(p.kind); setWork(p.work); setIssuedBy(p.issuedBy); setHeldBy(p.heldBy); setFormError(''); workInput.current?.focus(); };

  // The saved record goes in place, and the figures are worked out again by the same rules as the server's.
  // A reply for a project no longer on screen (switched while saving) is left for that project's next load.
  const replace = (permit: Permit) => setData(d => {
    if (!d || d.projectId !== permit.projectId) return d;
    const now = londonMinute(new Date());
    const permits = [permit, ...d.permits.filter(p => p.id !== permit.id)].sort(permitOrder(now));
    return { ...d, now, permits, summary: permitSummary(permits, now), repeats: permitRepeats(permits) };
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !projectId) return;
    if (!kind) { setFormError('Choose the kind of permit.'); document.querySelector<HTMLInputElement>('.pt-kinds input')?.focus(); return; }
    if (!work.trim()) { setFormError('Say what the work is and where.'); workInput.current?.focus(); return; }
    if (!issuedBy.trim()) { setFormError('Say who issued the permit.'); document.getElementById('pt-issued')?.focus(); return; }
    if (!heldBy.trim()) { setFormError('Say who holds the permit.'); document.getElementById('pt-held')?.focus(); return; }
    if (!ends) { setFormError('Give the day and time the permit runs until.'); document.getElementById('pt-ends')?.focus(); return; }
    setSaving(true); setFormError(''); setSaid('');
    try {
      const response = await fetch('/api/permits', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: projectId, requestId, kind, work, issuedBy, heldBy, day, ends, ...(reference.trim() ? { reference } : {}), ...(notes.trim() ? { notes } : {}) }) });
      const body = await response.json().catch(() => ({})) as Permit & { reason?: string };
      if (response.status === 409 && body.reason?.includes('different details')) {
        // An earlier try was saved with other details and its reply was lost. Saving again keeps these as a new record.
        setRequestId(clientId());
        throw new Error('An earlier try was saved with different details. Save again to keep these as a new permit, or reload to see it.');
      }
      if (!response.ok) throw new Error(body.reason ?? `The permit could not be saved (${response.status}).`);
      replace(body);
      setSaid(`Permit recorded: ${kindLabel(body.kind)}, open until ${body.ends.slice(11)} ${dayShort(body.ends.slice(0, 10))}.`);
      closeForm();
    } catch (err) {
      setFormError(err instanceof TypeError ? 'No connection. What you typed is still here: try again when there is signal.' : err instanceof Error ? err.message : 'The permit could not be saved.');
    } finally { setSaving(false); }
  };

  const stopActing = () => { setActing(''); setConfirmed(false); setText(''); setActError(''); };
  const act = async (permit: Permit, action: 'close' | 'withdraw') => {
    if (busy) return;
    if (action === 'close' && !confirmed) { setActError('Confirm the closing check before closing the permit.'); actInput.current?.focus(); return; }
    if (action === 'withdraw' && !text.trim()) { setActError('Say why the permit record is being withdrawn.'); actInput.current?.focus(); return; }
    setBusy(true); setActError(''); setSaid('');
    try {
      const response = await fetch(`/api/permits/${encodeURIComponent(permit.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'close' ? { action, confirmed, ...(text.trim() ? { note: text } : {}) } : { action, reason: text }) });
      const body = await response.json().catch(() => ({})) as Permit & { reason?: string };
      if (!response.ok) throw new Error(body.reason ?? `The permit could not be ${action === 'close' ? 'closed' : 'withdrawn'} (${response.status}).`);
      replace(body);
      stopActing();
      setSaid(action === 'close' ? `Permit closed: ${kindLabel(body.kind)}, ${body.work}.` : 'Permit record withdrawn. It stays listed, marked withdrawn, and is left out of the counts.');
      // Its buttons have gone, so focus goes to the permit itself.
      requestAnimationFrame(() => document.getElementById(`pt-title-${permit.id}`)?.focus());
    } catch (err) {
      setActError(err instanceof TypeError ? 'No connection. Try again when there is signal.' : err instanceof Error ? err.message : 'The permit could not be changed.');
    } finally { setBusy(false); }
  };

  // The clock moves on while the page is open, so a permit turns "Past its end time" at its end without a reload.
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(londonMinute(new Date()));
    const timer = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const now = [data?.now ?? nowAtLoad, clock].sort().at(-1)!;
  const summary = data ? permitSummary(data.permits, now) : undefined;
  const s = summary;
  const open = (data?.permits.filter(p => !p.closed && !p.withdrawn) ?? []).sort(permitOrder(now));
  const done = data?.permits.filter(p => p.closed || p.withdrawn) ?? [];
  const shownDone = showAll ? done : done.slice(0, FIRST);
  const canWithdraw = (p: Permit) => !p.withdrawn && !!principal && (p.byId === principal.id || manager);
  const download = projectId ? `/api/permits?${new URLSearchParams({ project: projectId, format: 'csv' })}` : '';

  const card = (p: Permit) => {
    const state = permitState(p, now);
    const title = `${kindLabel(p.kind)}: ${p.work}`;
    return <li key={p.id} className={`pt-permit pt-${state}`}>
      <h3 className="pt-title" id={`pt-title-${p.id}`} tabIndex={-1}>
        <span className={`tag ${state === 'overdue' || state === 'withdrawn' ? 'tag-alert' : state === 'open' ? 'tag-caution' : 'tag-ok'}`}>{state === 'overdue' ? 'Past its end time' : state === 'open' ? 'Open' : state === 'closed' ? 'Closed' : 'Withdrawn'}</span>
        <span className="pt-kind">{kindLabel(p.kind)}</span>
        <span className="pt-work">{p.work}</span>
      </h3>
      <p className="pt-meta">{p.reference ? `Permit ${p.reference} · ` : ''}issued by {p.issuedBy} on {dayShort(p.day)} · held by {p.heldBy}</p>
      {!p.closed && !p.withdrawn && <p className={`pt-meta${state === 'overdue' ? ' pt-late' : ''}`}>{state === 'overdue' ? `Ended ${endsWords(p.ends, now, d => dayShort(d))}. Close it once the closing check is done.` : `Runs until ${endsWords(p.ends, now, d => dayShort(d))}`}</p>}
      {p.notes && <p className="pt-notes">{p.notes}</p>}
      {p.closed && <p className="pt-meta">Closed by {p.closed.by} · {whenShort(p.closed.at)}. Confirmed: {closeCheck(p.kind)}{p.closed.note ? ` Note: ${p.closed.note}` : ''}</p>}
      {p.withdrawn && <p className="pt-meta">Withdrawn by {p.withdrawn.by} · {whenShort(p.withdrawn.at)}: {p.withdrawn.reason}</p>}
      <p className="pt-meta pt-quiet">Recorded by {p.by} · {whenShort(p.at)}</p>
      {acting === `close:${p.id}` ? <div className="pt-act" role="group" aria-label={`Close ${title}`}>
        <label className="pt-check"><input ref={actInput} type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setActError(''); }} /><span>{closeCheck(p.kind)}</span></label>
        <label htmlFor={`pt-note-${p.id}`}>Closing note <span className="pt-optional">optional</span></label>
        <input id={`pt-note-${p.id}`} value={text} onChange={e => setText(e.target.value)} maxLength={CLOSE_NOTE_MAX} placeholder="For example: fire watch by Chris until 16:10" />
        {actError && <p className="note note-bad" role="alert">{actError}</p>}
        <div className="pt-buttons">
          <button type="button" className="btn-primary" onClick={() => void act(p, 'close')} disabled={busy}>{busy ? 'Saving…' : 'Close permit'}</button>
          <button type="button" className="btn-quiet" onClick={stopActing} disabled={busy}>Not yet</button>
        </div>
      </div>
        : acting === `withdraw:${p.id}` ? <div className="pt-act" role="group" aria-label={`Withdraw ${title}`}>
          <label htmlFor={`pt-reason-${p.id}`}>Why withdraw it?</label>
          <input id={`pt-reason-${p.id}`} ref={actInput} value={text} onChange={e => { setText(e.target.value); setActError(''); }} maxLength={REASON_MAX} placeholder="For example: recorded twice, or on the wrong project" />
          {actError && <p className="note note-bad" role="alert">{actError}</p>}
          <div className="pt-buttons">
            <button type="button" className="btn-danger" onClick={() => void act(p, 'withdraw')} disabled={busy}>{busy ? 'Saving…' : 'Withdraw record'}</button>
            <button type="button" className="btn-quiet" onClick={stopActing} disabled={busy}>Keep it</button>
          </div>
        </div>
        : <div className="pt-buttons">
          {!p.closed && !p.withdrawn && <button type="button" className="btn-primary pt-close-open" onClick={() => { stopActing(); setActing(`close:${p.id}`); setSaid(''); }} aria-label={`Close permit: ${title}`}>Close permit</button>}
          {canWithdraw(p) && <button type="button" className="btn-quiet" onClick={() => { stopActing(); setActing(`withdraw:${p.id}`); setSaid(''); }} aria-label={`Withdraw: ${title}`}>Withdraw</button>}
        </div>}
    </li>;
  };

  return <main className="eng-page pt-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="pt-head">
      <p className="lbl">{project ? `${project.projectNumber} · ${project.projectName}` : 'Site'}</p>
      <h1>Permits to work</h1>
      <p className="pt-intro">Record each hot works, isolation or other permit when it is issued, and close it when the work is finished and the area is safe. Everyone on the project can see what is open, and a permit left open past its end time is flagged until it is closed. It is not part of any report and is not sent to anyone.</p>
    </div>
    {projects.length > 1 && <div className="pt-controls">
      <label htmlFor="pt-project">Project</label>
      <select id="pt-project" value={projectId} disabled={saving || busy} onChange={e => { setProjectId(e.target.value); setFormOpen(false); resetForm(); stopActing(); setSaid(''); setShowAll(false); }}>
        {!projectId && <option value="">Choose a project</option>}
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select>
    </div>}

    {!projectId ? <div className="eng-panel"><p>Choose a project to see its permits.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !data || !s ? <p role="status">Loading permits…</p>
      : <>
        <dl className="pt-stats" aria-label="This project's permits">
          <div><dt>Open now</dt><dd className={s.overdue ? 'pt-due' : ''}><b>{s.open}</b><small>{s.overdue ? `${s.overdue} past ${s.overdue === 1 ? 'its' : 'their'} end time` : s.open ? 'all within their time' : 'no permit open'}</small></dd></div>
          <div><dt>Closed, last {RECENT_DAYS / 7} weeks</dt><dd><b>{s.recent}</b><small>{s.recent ? 'with the closing check confirmed' : 'none closed in the last four weeks'}</small></dd></div>
        </dl>

        {data.live ? (formOpen ? <form className="pt-form" onSubmit={save} aria-labelledby="pt-form-title" noValidate>
          <h2 id="pt-form-title">Record a permit</h2>
          {data.repeats.length > 0 && <div className="pt-field">
            <span className="pt-label" id="pt-repeat-label">Start from a recent one</span>
            <div className="eng-chips" role="group" aria-labelledby="pt-repeat-label">{data.repeats.map(p => <button key={p.id} type="button" className="eng-chip" onClick={() => startFrom(p)}>{kindLabel(p.kind)} · {p.work.length > 40 ? `${p.work.slice(0, 39).trimEnd()}…` : p.work}</button>)}</div>
          </div>}
          <fieldset className="pt-field pt-kinds">
            <legend className="pt-label">Kind of permit</legend>
            <div className="eng-chips">{PERMIT_KINDS.map(k => <label key={k.id} className={`eng-chip pt-kind-chip${kind === k.id ? ' on' : ''}`}><input type="radio" name="pt-kind" value={k.id} checked={kind === k.id} onChange={() => { setKind(k.id); setFormError(''); }} />{k.label}</label>)}</div>
          </fieldset>
          <div className="pt-field">
            <label htmlFor="pt-work">The work and where</label>
            <textarea id="pt-work" ref={workInput} value={work} onChange={e => { setWork(e.target.value); setFormError(''); }} maxLength={WORK_MAX} rows={2} placeholder="For example: brazing the LTHW flow and return, level 3 riser" />
          </div>
          <div className="pt-row">
            <div className="pt-field">
              <label htmlFor="pt-issued">Issued by</label>
              <input id="pt-issued" value={issuedBy} onChange={e => { setIssuedBy(e.target.value); setFormError(''); }} maxLength={NAME_MAX} autoComplete="off" placeholder="Name, and company if not ours" />
            </div>
            <div className="pt-field">
              <label htmlFor="pt-held">Held by</label>
              <input id="pt-held" value={heldBy} onChange={e => { setHeldBy(e.target.value); setFormError(''); }} maxLength={NAME_MAX} autoComplete="off" />
            </div>
          </div>
          <div className="pt-row">
            <div className="pt-field">
              <label htmlFor="pt-day">Issued on</label>
              <input id="pt-day" type="date" value={day} max={today} min={addDays(today, -BACKDATE_DAYS)} onChange={e => setDay(e.target.value)} aria-describedby="pt-day-help" />
              <p id="pt-day-help" className="pt-sub">Today, or up to {BACKDATE_DAYS} days ago.</p>
            </div>
            <div className="pt-field">
              <label htmlFor="pt-ends">Runs until</label>
              <input id="pt-ends" type="datetime-local" value={ends} min={`${day}T00:00`} max={`${addDays(day || today, LONGEST_DAYS)}T23:59`} onChange={e => { setEnds(e.target.value); setFormError(''); }} aria-describedby="pt-ends-help" />
              <p id="pt-ends-help" className="pt-sub">{ends && ends < londonMinute(new Date()) ? 'This permit has already ended. Save it, then close it with its check.' : `As written on the permit, UK time. Up to ${LONGEST_DAYS} days.`}</p>
            </div>
          </div>
          <div className="pt-field">
            <label htmlFor="pt-ref">Permit number <span className="pt-optional">optional</span></label>
            <input id="pt-ref" value={reference} onChange={e => setReference(e.target.value)} maxLength={REFERENCE_MAX} autoComplete="off" placeholder="For example: HW-0142" />
          </div>
          <div className="pt-field">
            <label htmlFor="pt-notes">Notes <span className="pt-optional">optional</span></label>
            <textarea id="pt-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={NOTES_MAX} rows={2} placeholder="Conditions on the permit, such as who keeps the fire watch" />
          </div>
          {formError && <p className="note note-bad" role="alert">{formError}</p>}
          <div className="pt-buttons">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save permit'}</button>
            <button type="button" className="btn-quiet" onClick={closeForm} disabled={saving}>Cancel</button>
          </div>
        </form>
          : <div className="pt-actions">
            <button type="button" ref={opener} className="btn-primary" onClick={() => { setFormOpen(true); stopActing(); setSaid(''); }}>Record a permit</button>
            {data.permits.length > 0 && <a className="eng-link-button" href={download} download>Download spreadsheet</a>}
          </div>)
          : <div className="eng-panel"><p>This project is not active or in defects liability, so it takes no new permits.</p>
            {data.permits.length > 0 && <a className="eng-link-button" href={download} download>Download spreadsheet</a>}</div>}

        <section aria-labelledby="pt-open-title" className="pt-section">
          <h2 id="pt-open-title">Open now <span className="pt-count">{open.length}</span></h2>
          {open.length ? <ul className="pt-list">{open.map(card)}</ul>
            : <p className="pt-none">{data.permits.length ? 'No permit is open on this project.' : 'No permits recorded on this project yet. When a hot works, isolation or other permit is issued, record it here so everyone can see it is open until it is closed.'}</p>}
        </section>
        {done.length > 0 && <section aria-labelledby="pt-done-title" className="pt-section">
          <h2 id="pt-done-title">{done.some(p => p.withdrawn) ? 'Closed and withdrawn' : 'Closed'} <span className="pt-count">{done.filter(p => p.closed && !p.withdrawn).length}</span></h2>
          <ul className="pt-list">{shownDone.map(card)}</ul>
          {!showAll && done.length > FIRST && <button type="button" className="btn-quiet pt-more" onClick={() => setShowAll(true)}>Show all {done.length}</button>}
        </section>}
        <p className="pt-foot">Anyone on the project can record or close a permit; closing one confirms the check for its kind. Whoever recorded a permit, or the office, can withdraw one entered by mistake; it stays here, marked withdrawn, with the reason. The closing checks are a first draft and have not yet been read over by a site manager. RELAY does not issue permits: the permit itself is still the one issued on site. The spreadsheet has every permit, withdrawn ones included.</p>
      </>}
    <p className="eng-sr" role="status">{said}</p>
  </main>;
}
