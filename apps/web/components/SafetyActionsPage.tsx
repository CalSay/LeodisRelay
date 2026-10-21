'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { useProjects } from './ProjectContext';
import { canManage } from '@/lib/auth/access';
import { dayLabel } from '@/lib/myWeek';
import { CLEARED_DAYS, INSPECTION_DUE_DAYS, TOWER_DUE_DAYS, type SafetyAction, type SafetyActions, type SafetyProject } from '@/lib/safetyActions';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';

/**
 * Safety actions: what the weekly safety inspections and tower inspections
 * found needing action, on every project or one, kept open until a later
 * inspection finds it put right, and which towers are due their next
 * inspection. It reads sent inspections and changes nothing.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ago = (days: number) => days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
const ANSWER: Record<'ok' | 'na', string> = { ok: 'Satisfactory', na: 'Not applicable' };

export function SafetyActionsPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const projects = useProjects();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : '');
  const [data, setData] = useState<SafetyActions | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    fetch('/api/safety-actions', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as SafetyActions & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `Safety actions could not be loaded (${response.status}).`);
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'Safety actions could not be loaded.'); });
    return () => { cancelled = true; };
  }, [retry]);

  // The address carries the project, so an inspection opened from here comes back to it.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/safety-actions${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);
  // A printed page is for the site meeting, so it carries what was put right too.
  useEffect(() => {
    const unfold = () => document.querySelectorAll<HTMLDetailsElement>('.sa-put-right').forEach(d => { d.open = true; });
    window.addEventListener('beforeprint', unfold);
    return () => window.removeEventListener('beforeprint', unfold);
  }, []);

  // Only the live sites the page covers, in project-number order.
  const options = (data?.projects ?? []).slice().sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, 'en', { numeric: true }));
  const shown = data ? data.projects.filter(p => !projectId || p.projectId === projectId) : [];
  // A project with only tower inspections still has something to show.
  const followed = (p: SafetyProject) => p.inspections > 0 || p.towers.length > 0 || p.open.length > 0 || p.cleared.length > 0;
  const inspected = shown.filter(followed);
  const never = shown.filter(p => !followed(p));
  const totals = {
    open: shown.reduce((n, p) => n + p.open.length, 0),
    projects: shown.filter(p => p.open.length).length,
    cleared: shown.reduce((n, p) => n + p.cleared.length, 0),
    due: shown.filter(p => p.due).length,
    towers: shown.reduce((n, p) => n + p.towers.length, 0),
    towersDue: shown.reduce((n, p) => n + p.towers.filter(t => t.due).length, 0),
  };
  const report = (r: { id: string; reference: string }) => <Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link>;

  const openAction = (a: SafetyAction) => <li key={a.key} className="sa-action">
    <p className="sa-tags"><span className="tag tag-alert">Open {a.days > 0 ? plural(a.days, 'day') : 'since today'}</span>{a.times > 1 && <span className="tag tag-draft">Found {plural(a.times, 'time')}</span>}{a.photos > 0 && <span className="sa-meta-inline">{plural(a.photos, 'photograph')}</span>}</p>
    {a.tower && <p className="sa-tower"><span className="lbl">Tower or podium</span> {a.tower}</p>}
    <h4>{a.question}</h4>
    {a.found && <p className="sa-found">{a.found}</p>}
    <dl className="sa-detail">
      <div><dt>To do</dt><dd>{a.actionNeeded || 'Not written'}</dd></div>
      <div><dt>Who</dt><dd>{a.who || 'Nobody named'}</dd></div>
      {a.location && <div><dt>Where</dt><dd>{a.location}</dd></div>}
    </dl>
    <p className="sa-meta">Found in {report(a.raised)} on {dayLabel(a.raised.visitDate)} by {a.raised.author}{a.times > 1 && <> · still needing action in {report(a.latest)} on {dayLabel(a.latest.visitDate)}</>}</p>
  </li>;

  const clearedAction = (a: SafetyAction) => <li key={`${a.key}-cleared`} className="sa-action sa-cleared">
    <p className="sa-tags"><span className="tag tag-sent">{ANSWER[a.cleared!.answer]}</span><span className="sa-meta-inline">{a.days > 0 ? `put right after ${plural(a.days, 'day')}` : 'put right the same day'}</span></p>
    {a.tower && <p className="sa-tower"><span className="lbl">Tower or podium</span> {a.tower}</p>}
    <h4>{a.question}</h4>
    {a.found && <p className="sa-found">Was: {a.found}</p>}
    {a.cleared!.note && <p className="sa-meta">Noted: {a.cleared!.note}</p>}
    <p className="sa-meta">Found in {report(a.raised)} on {dayLabel(a.raised.visitDate)} · cleared in {report(a.cleared!)} on {dayLabel(a.cleared!.visitDate)} by {a.cleared!.author}</p>
  </li>;

  const projectBlock = (p: SafetyProject) => <section key={p.projectId} className="sa-project" aria-labelledby={`sa-${p.projectId}`}>
    <div className="sa-project-head">
      <h2 id={`sa-${p.projectId}`}><span className="ref">{p.projectNumber}</span> {p.projectName}</h2>
      <span className={`tag ${p.open.length ? 'tag-alert' : 'tag-sent'}`}>{p.open.length ? `${plural(p.open.length, 'action')} open` : 'Nothing open'}</span>
    </div>
    {p.last ? <p className={`sa-last${p.due ? ' sa-due' : ''}`}>Last safety inspection {report(p.last)} on {dayLabel(p.last.visitDate)} by {p.last.author}, {ago(p.sinceLast ?? 0)}{p.due ? ' · another is due' : ''} · {plural(p.inspections, 'inspection')} sent</p>
      : <p className="sa-last">No weekly safety inspection sent yet.</p>}
    {p.towers.length > 0 && <div className="sa-towers">
      <h3 className="lbl">Towers and podiums</h3>
      <ul>{p.towers.map(t => <li key={t.name} className={t.due ? 'sa-due' : ''}>
        <b>{t.name}</b> <span>last inspected {report(t.last)} on {dayLabel(t.last.visitDate)} by {t.last.author}, {ago(t.sinceLast)}{t.due ? ' · another is due' : ''}{t.open ? ` · ${plural(t.open, 'action')} open` : ''}</span>
      </li>)}</ul>
    </div>}
    {p.open.length > 0
      ? <ul className="sa-list">{p.open.map(openAction)}</ul>
      : <p className="sa-none">{p.towers.length ? 'Nothing found needing action is still open.' : 'The last inspection found nothing needing action.'}</p>}
    {p.cleared.length > 0 && <details className="sa-put-right">
      <summary>Put right in the last {CLEARED_DAYS / 7} weeks ({p.cleared.length})</summary>
      <ul className="sa-list">{p.cleared.map(clearedAction)}</ul>
    </details>}
  </section>;

  return <main className="eng-page sa-page">
    <Link href={back} className="back sa-noprint">&larr; {backLabel(back)}</Link>
    <div className="sa-head">
      <p className="lbl">Safety</p>
      <h1>Safety actions</h1>
      <p className="sa-intro">What the weekly safety inspections and tower inspections found needing action. Each one stays open until a later inspection on the same project, or of the same tower, answers that check Satisfactory or Not applicable.</p>
    </div>
    {options.length > 1 && <div className="sa-controls sa-noprint">
      <label htmlFor="sa-project">Project</label>
      <select id="sa-project" value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Every project</option>
        {options.map(p => <option key={p.projectId} value={p.projectId}>{p.projectNumber} {p.projectName}</option>)}
      </select>
    </div>}

    {error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !data ? <p role="status">Loading safety actions…</p>
      : <>
        <dl className="sa-stats">
          <div className={totals.open ? 'sa-stat-alert' : ''}><dt>Open actions</dt><dd>{totals.open}</dd></div>
          <div><dt>Projects with actions</dt><dd>{totals.projects}</dd></div>
          <div><dt>Put right, last {CLEARED_DAYS / 7} weeks</dt><dd>{totals.cleared}</dd></div>
          <div className={totals.due ? 'sa-stat-due' : ''}><dt>Inspections due</dt><dd>{totals.due}<small>none for over {INSPECTION_DUE_DAYS} days</small></dd></div>
          {totals.towers > 0 && <div className={totals.towersDue ? 'sa-stat-due' : ''}><dt>Towers due</dt><dd>{totals.towersDue}<small>not inspected for over {TOWER_DUE_DAYS} days</small></dd></div>}
        </dl>
        {inspected.length > 0 && <div className="sa-projects">{inspected.map(projectBlock)}</div>}
        {never.length > 0 && (projectId
          ? <div className="eng-panel sa-empty"><p>No safety inspection has been sent from this project yet. An engineer starts one from <b>Do a safety inspection</b> on the Site page.</p></div>
          : <section className="sa-never" aria-labelledby="sa-never-title">
            <h2 id="sa-never-title">No safety inspection sent yet <span className="sa-count">{never.length}</span></h2>
            <ul>{never.map(p => <li key={p.projectId}><span className="ref">{p.projectNumber}</span> {p.projectName}</li>)}</ul>
          </section>)}
        {!shown.length && <div className="eng-panel sa-empty"><p>{projectId ? 'This project is not active or in defects liability, so it has no safety inspections to follow.' : 'No active or defects liability projects are open to you.'}</p></div>}
        <p className="sa-foot">Made from the safety and tower inspections sent in RELAY, in visit order. A tower not inspected for four weeks is taken to be down and is no longer listed, though its open actions stay. A corrected inspection replaces the one it corrects. Nothing here is typed in or changed: to clear an action, the next inspection answers its check.</p>
      </>}
  </main>;
}
