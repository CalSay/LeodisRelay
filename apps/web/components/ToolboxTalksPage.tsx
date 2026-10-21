'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { useProjects } from './ProjectContext';
import { canManage } from '@/lib/auth/access';
import { clientId } from '@/lib/clientId';
import { ATTENDEES_MAX, NOTES_MAX, RECENT_DAYS, TOPIC_MAX, NAME_MAX, BACKDATE_DAYS, daysAgo, newestFirst, splitAttendees, talkSummary, topicStarters, type ProjectTalks, type ToolboxTalk } from '@/lib/toolboxTalks';
import { safeViewReturn, backLabel } from '@/lib/viewNavigation';
import { dayShort, whenShort } from '@/lib/dates';
import { londonDay } from '@/lib/weeklySummary';

/**
 * Toolbox talks: the safety briefings given on a project and who attended,
 * kept for audits in place of the paper sheet in the site cabin. Not part of
 * any report and never sent; a record entered by mistake is withdrawn with a
 * reason and stays listed. Rules in `lib/toolboxTalks.ts`.
 */

type Loaded = ProjectTalks & { live: boolean; starters: string[] };

/** How many talks show before "Show all". */
const FIRST = 20;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function ToolboxTalksPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const projects = useProjects();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const today = londonDay(new Date());
  const [day, setDay] = useState(today);
  const [topic, setTopic] = useState('');
  const [givenBy, setGivenBy] = useState(principal?.name ?? '');
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [requestId, setRequestId] = useState(() => clientId());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [said, setSaid] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [withdrawing, setWithdrawing] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const dayInput = useRef<HTMLInputElement>(null);
  const topicInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLInputElement>(null);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);
  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId) { setData(null); return; }
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/toolbox-talks?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as Loaded & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `The toolbox talks could not be loaded (${response.status}).`);
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The toolbox talks could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the project, so a reload or a shared link opens the same record.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/toolbox-talks${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  // Focus moves into the form when it opens, and back to the button that opened it on Cancel or after saving.
  useEffect(() => { if (formOpen) topicInput.current?.focus(); }, [formOpen]);
  useEffect(() => { if (withdrawing) reasonInput.current?.focus(); }, [withdrawing]);

  const names = splitAttendees(attendees);
  const lastTalk = data?.talks.find(t => !t.withdrawn);

  const resetForm = () => { setDay(londonDay(new Date())); setTopic(''); setGivenBy(principal?.name ?? ''); setAttendees(''); setNotes(''); setFormError(''); setRequestId(clientId()); };
  const closeForm = () => { setFormOpen(false); resetForm(); requestAnimationFrame(() => opener.current?.focus()); };

  // The saved record goes in place, and the figures are worked out again by the same rules as the server's.
  // A reply for a project no longer on screen (switched while saving) is left for that project's next load.
  const replace = (talk: ToolboxTalk) => setData(d => {
    if (!d || d.projectId !== talk.projectId) return d;
    const talks = [talk, ...d.talks.filter(t => t.id !== talk.id)].sort(newestFirst);
    return { ...d, talks, summary: talkSummary(talks, londonDay(new Date())), starters: topicStarters(talks) };
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !projectId) return;
    if (!day) { setFormError('Give the day the talk was given.'); dayInput.current?.focus(); return; }
    if (!topic.trim()) { setFormError('Say what the talk was about.'); topicInput.current?.focus(); return; }
    if (!names.length) { setFormError('Add the name of everyone who attended.'); document.getElementById('tt-attendees')?.focus(); return; }
    setSaving(true); setFormError(''); setSaid('');
    try {
      const response = await fetch('/api/toolbox-talks', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: projectId, requestId, day, topic, givenBy, attendees: names, ...(notes.trim() ? { notes } : {}) }) });
      const body = await response.json().catch(() => ({})) as ToolboxTalk & { reason?: string };
      if (response.status === 409 && body.reason?.includes('different details')) {
        // An earlier try was saved with other details and its reply was lost. Saving again keeps these as a new record.
        setRequestId(clientId());
        throw new Error('An earlier try was saved with different details. Save again to keep these as a new talk, or reload to see it.');
      }
      if (!response.ok) throw new Error(body.reason ?? `The talk could not be saved (${response.status}).`);
      replace(body);
      setSaid(`Toolbox talk recorded: ${body.topic}, ${people(body.attendees.length)} attending.`);
      closeForm();
    } catch (err) {
      setFormError(err instanceof TypeError ? 'No connection. What you typed is still here: try again when there is signal.' : err instanceof Error ? err.message : 'The talk could not be saved.');
    } finally { setSaving(false); }
  };

  const withdraw = async (talk: ToolboxTalk) => {
    if (busy) return;
    if (!reason.trim()) { setWithdrawError('Say why the record is being withdrawn.'); reasonInput.current?.focus(); return; }
    setBusy(true); setWithdrawError(''); setSaid('');
    try {
      const response = await fetch(`/api/toolbox-talks/${encodeURIComponent(talk.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) });
      const body = await response.json().catch(() => ({})) as ToolboxTalk & { reason?: string };
      if (!response.ok) throw new Error(body.reason ?? `The talk could not be withdrawn (${response.status}).`);
      replace(body);
      setWithdrawing(''); setReason('');
      setSaid('Toolbox talk withdrawn. It stays listed, marked withdrawn, and is left out of the counts.');
      // Its Withdraw button has gone, so focus goes to the talk itself.
      requestAnimationFrame(() => document.getElementById(`tt-topic-${talk.id}`)?.focus());
    } catch (err) {
      setWithdrawError(err instanceof TypeError ? 'No connection. Try again when there is signal.' : err instanceof Error ? err.message : 'The talk could not be withdrawn.');
    } finally { setBusy(false); }
  };

  const canWithdraw = (t: ToolboxTalk) => !t.withdrawn && !!principal && (t.byId === principal.id || manager);
  const s = data?.summary;
  const shown = data ? (showAll ? data.talks : data.talks.slice(0, FIRST)) : [];

  return <main className="eng-page tt-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="tt-head">
      <p className="lbl">{project ? `${project.projectNumber} · ${project.projectName}` : 'Site'}</p>
      <h1>Toolbox talks</h1>
      <p className="tt-intro">Record each safety briefing given on site, its topic and who attended, so the record is ready for an audit instead of on a sheet in the cabin. It is not part of any report and is not sent to anyone.</p>
    </div>
    {projects.length > 1 && <div className="tt-controls">
      <label htmlFor="tt-project">Project</label>
      <select id="tt-project" value={projectId} disabled={saving || busy} onChange={e => { setProjectId(e.target.value); setFormOpen(false); resetForm(); setWithdrawing(''); setSaid(''); setShowAll(false); }}>
        {!projectId && <option value="">Choose a project</option>}
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select>
    </div>}

    {!projectId ? <div className="eng-panel"><p>Choose a project to see its toolbox talks.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !data || !s ? <p role="status">Loading toolbox talks…</p>
      : <>
        <dl className="tt-stats" aria-label="This project's toolbox talks">
          <div><dt>Last talk</dt><dd className={s.daysSince === undefined || s.daysSince > 7 ? 'tt-due' : ''}>{s.latest ? <><b>{daysAgo(s.daysSince!)}</b><small>{dayShort(s.latest.day)} · {s.latest.topic}</small></> : <><b>None yet</b><small>No talk recorded on this project</small></>}</dd></div>
          <div><dt>Last {RECENT_DAYS / 7} weeks</dt><dd><b>{plural(s.recent.talks, 'talk')}</b><small>{s.recent.talks ? `${s.recent.attendances} attending in all · ${s.recent.people === 1 ? '1 person' : `${s.recent.people} different people`}` : 'none in the last four weeks'}</small></dd></div>
        </dl>

        {data.live ? (formOpen ? <form className="tt-form" onSubmit={save} aria-labelledby="tt-form-title" noValidate>
          <h2 id="tt-form-title">Record a toolbox talk</h2>
          <div className="tt-field">
            <label htmlFor="tt-topic">Topic</label>
            <input id="tt-topic" ref={topicInput} value={topic} onChange={e => { setTopic(e.target.value); setFormError(''); }} maxLength={TOPIC_MAX} autoComplete="off" placeholder="For example: Working at height on the level 3 slab edge" />
            <div className="eng-chips" role="group" aria-label="Topics to start from">{data.starters.map(t => <button key={t} type="button" className="eng-chip" aria-pressed={topic.trim().toLowerCase() === t.toLowerCase()} onClick={() => { setTopic(t); setFormError(''); }}>{t}</button>)}</div>
          </div>
          <div className="tt-row">
            <div className="tt-field">
              <label htmlFor="tt-day">Given on</label>
              <input id="tt-day" ref={dayInput} type="date" value={day} max={today} min={addDays(today, -BACKDATE_DAYS)} onChange={e => setDay(e.target.value)} aria-describedby="tt-day-help" />
              <p id="tt-day-help" className="tt-sub">Today, or up to {BACKDATE_DAYS} days ago.</p>
            </div>
            <div className="tt-field">
              <label htmlFor="tt-given">Given by</label>
              <input id="tt-given" value={givenBy} onChange={e => setGivenBy(e.target.value)} maxLength={NAME_MAX} autoComplete="name" />
            </div>
          </div>
          <div className="tt-field">
            <label htmlFor="tt-attendees">Who attended</label>
            <textarea id="tt-attendees" value={attendees} onChange={e => { setAttendees(e.target.value); setFormError(''); }} rows={5} aria-describedby="tt-attendees-help" placeholder={'One name per line, with their company if they are not ours:\nJo Bloggs\nAli Khan, Northbank Electrical'} />
            <p id="tt-attendees-help" className={`tt-sub${names.length > ATTENDEES_MAX ? ' tt-over' : ''}`}>{names.length ? `${plural(names.length, 'name')}${names.length > ATTENDEES_MAX ? `, more than the ${ATTENDEES_MAX} a talk can have` : ''}. The same name twice is kept once.` : 'One name per line.'}</p>
            {lastTalk && <button type="button" className="btn-quiet tt-same" onClick={() => { setAttendees(lastTalk.attendees.join('\n')); setFormError(''); }}>Same people as the last talk ({lastTalk.attendees.length})</button>}
          </div>
          <div className="tt-field">
            <label htmlFor="tt-notes">Notes <span className="tt-optional">optional</span></label>
            <textarea id="tt-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={NOTES_MAX} rows={3} placeholder="Questions raised, or anything agreed" />
          </div>
          {formError && <p className="note note-bad" role="alert">{formError}</p>}
          <div className="tt-buttons">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save toolbox talk'}</button>
            <button type="button" className="btn-quiet" onClick={closeForm} disabled={saving}>Cancel</button>
          </div>
        </form>
          : <div className="tt-actions">
            <button type="button" ref={opener} className="btn-primary" onClick={() => { setFormOpen(true); setSaid(''); }}>Record a toolbox talk</button>
            {data.talks.length > 0 && <a className="eng-link-button" href={`/api/toolbox-talks?${new URLSearchParams({ project: projectId, format: 'csv' })}`} download>Download spreadsheet</a>}
          </div>)
          : <div className="eng-panel"><p>This project is not active or in defects liability, so it takes no new toolbox talks.</p>
            {data.talks.length > 0 && <a className="eng-link-button" href={`/api/toolbox-talks?${new URLSearchParams({ project: projectId, format: 'csv' })}`} download>Download spreadsheet</a>}</div>}

        <section aria-labelledby="tt-list-title" className="tt-section">
          <h2 id="tt-list-title">Talks given <span className="tt-count">{data.talks.filter(t => !t.withdrawn).length}</span></h2>
          {data.talks.length ? <ul className="tt-list">{shown.map(t => <li key={t.id} className={`tt-talk${t.withdrawn ? ' tt-withdrawn' : ''}`}>
            <h3 className="tt-topic" id={`tt-topic-${t.id}`} tabIndex={-1}>{t.withdrawn && <span className="tag tag-alert">Withdrawn</span>}<span className="tt-topic-text">{t.topic}</span></h3>
            <p className="tt-meta">{dayShort(t.day)} · given by {t.givenBy} · {people(t.attendees.length)} attending</p>
            <details className="tt-names">
              <summary>Who attended ({t.attendees.length})</summary>
              <ul>{t.attendees.map(n => <li key={n}>{n}</li>)}</ul>
            </details>
            {t.notes && <p className="tt-notes">{t.notes}</p>}
            <p className="tt-meta tt-quiet">Recorded by {t.by} · {whenShort(t.at)}</p>
            {t.withdrawn && <p className="tt-meta">Withdrawn by {t.withdrawn.by} · {whenShort(t.withdrawn.at)}: {t.withdrawn.reason}</p>}
            {canWithdraw(t) && (withdrawing === t.id ? <div className="tt-withdraw" role="group" aria-label={`Withdraw ${t.topic}`}>
              <label htmlFor={`tt-reason-${t.id}`}>Why withdraw it?</label>
              <input id={`tt-reason-${t.id}`} ref={reasonInput} value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="For example: recorded twice, or on the wrong project" />
              {withdrawError && <p className="note note-bad" role="alert">{withdrawError}</p>}
              <div className="tt-buttons">
                <button type="button" className="btn-danger" onClick={() => void withdraw(t)} disabled={busy}>{busy ? 'Saving…' : 'Withdraw record'}</button>
                <button type="button" className="btn-quiet" onClick={() => { setWithdrawing(''); setReason(''); setWithdrawError(''); }} disabled={busy}>Keep it</button>
              </div>
            </div>
              : <button type="button" className="btn-quiet tt-withdraw-open" onClick={() => { setWithdrawing(t.id); setReason(''); setWithdrawError(''); }} aria-label={`Withdraw: ${t.topic}, ${dayShort(t.day)}`}>Withdraw</button>)}
          </li>)}</ul>
            : <p className="tt-none">No toolbox talks recorded on this project yet.</p>}
          {!showAll && data.talks.length > FIRST && <button type="button" className="btn-quiet tt-more" onClick={() => setShowAll(true)}>Show all {data.talks.length}</button>}
        </section>
        <p className="tt-foot">Anyone on the project can record a talk. Whoever recorded it, or the office, can withdraw one entered by mistake; it stays here, marked withdrawn, with the reason. The spreadsheet has every talk, withdrawn ones included.</p>
      </>}
    <p className="eng-sr" role="status">{said}</p>
  </main>;
}
