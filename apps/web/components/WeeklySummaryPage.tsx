'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { londonDay, shiftWeek, weekStart, type WeekIssue, type WeekReport, type WeekVariation, type WeeklySummary } from '@/lib/weeklySummary';
import { dayShort } from '@/lib/dates';
import { failure } from '@/lib/failure';

/**
 * One project's week, for the weekly site or client meeting: who was on site,
 * what they reported, and how issues and variations moved. It reads what is
 * already in RELAY and changes nothing.
 */

const fmtDay = (ymd: string, year = false) => dayShort(ymd, year);
const fmtAt = (at: string) => fmtDay(londonDay(at));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const KIND_WORD: Record<string, [string, string]> = { update: ['progress update', 'progress updates'], defect: ['defect', 'defects'], instruction: ['variation required', 'variations required'], access: ['access problem', 'access problems'] };

/** Cards by kind. An inspection's checks are said by `inspectionLine`, not counted as cards. */
function kindLine(kinds: WeekReport['kinds']): string {
  return OBSERVATION_TYPES.filter(t => t.value !== 'check' && kinds[t.value]).map(t => { const [one, many] = KIND_WORD[t.value]!; return plural(kinds[t.value], one, many); }).join(', ') || 'no cards';
}

function inspectionLine(i: NonNullable<WeekReport['inspection']>): string {
  return `${i.name}: ${plural(i.action, 'action')}, ${i.ok} satisfactory, ${i.na} not applicable`;
}

function IssueRows({ rows, empty, here }: { rows: WeekIssue[]; empty: string; here: string }) {
  if (!rows.length) return <p className="week-none">{empty}</p>;
  return <ul className="week-rows">{rows.map(i => <li key={i.id}>
    <span className="week-when">{fmtAt(i.at)}</span>
    <div><p><Link className="ref" href={withViewReturn(`/issues/${i.id}`, here)}>{i.reference}</Link> <span className={`tag ${i.status === 'Closed' ? 'tag-sent' : 'tag-draft'}`}>{i.status}</span></p>
      <p className="week-desc">{i.description}</p>
      <p className="week-meta">{[i.location || 'No location recorded', i.owner || 'Not yet assigned', i.trade].filter(Boolean).join(' · ')}</p></div>
  </li>)}</ul>;
}

function VariationRows({ rows, empty, here }: { rows: WeekVariation[]; empty: string; here: string }) {
  if (!rows.length) return <p className="week-none">{empty}</p>;
  return <ul className="week-rows">{rows.map(v => <li key={v.id}>
    <span className="week-when">{fmtAt(v.at)}</span>
    <div><p><Link className="ref" href={withViewReturn(`/variations/${v.id}`, here)}>{v.reference}</Link> <span className={`tag ${v.status === 'Instructed' ? 'tag-sent' : 'tag-draft'}`}>{v.status}</span>
      {v.workDone && v.status !== 'Instructed' && <span className="tag tag-alert">Done, not instructed</span>}</p>
      <p className="week-desc">{v.description}</p>
      {v.location && <p className="week-meta">{v.location}</p>}</div>
  </li>)}</ul>;
}

export function WeeklySummaryPage({ initialProject, initialWeek, returnTo }: { initialProject: string; initialWeek: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const router = useRouter();
  const today = londonDay(new Date());
  const thisWeek = weekStart(undefined, today);
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [week, setWeek] = useState(weekStart(initialWeek, today));
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const fallback = manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}&view=reports` : ''}`;
  const back = safeViewReturn(returnTo, fallback);

  useEffect(() => {
    if (!projectId) { setSummary(null); return; }
    let cancelled = false;
    setSummary(null); setError('');
    fetch(`/api/weekly-summary?${new URLSearchParams({ projectId, week })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as WeeklySummary & { reason?: string };
        if (!response.ok) throw failure(response.status, body, 'The summary could not be loaded.');
        if (!cancelled) setSummary(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The summary could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, week, retry]);

  // The address carries the choices, so a week can be bookmarked or sent to someone,
  // and a record opened from the page comes back to the same week.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (week !== thisWeek) q.set('week', week);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/weekly-summary${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const s = summary?.projectId === projectId && summary.start === week ? summary : null;
  const issuesMoved = s ? s.issuesRaised.length + s.issuesFixed.length + s.issuesClosed.length : 0;
  const snagHref = `/issues/snag-list?${new URLSearchParams({ project: projectId, returnTo: here })}`;

  return <main className="eng-page week-page">
    <Link href={back} className="back week-noprint">&larr; {backLabel(back)}</Link>
    <div className="week-controls week-noprint">
      <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select></label>
      <div className="week-step" role="group" aria-label="Choose the week">
        <button type="button" onClick={() => setWeek(w => shiftWeek(w, -1))}>&larr; Previous week</button>
        <button type="button" onClick={() => setWeek(thisWeek)} disabled={week === thisWeek}>This week</button>
        <button type="button" onClick={() => setWeek(w => shiftWeek(w, 1))} disabled={week >= thisWeek}>Next week &rarr;</button>
      </div>
      <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!s}>Print or save as PDF</button>
    </div>

    {!project ? <div className="eng-panel week-noprint"><h1>Weekly summary</h1><p className="eng-help">Choose a project to see its week on one page: who was on site, what they reported, and which issues and variations moved. Ready for the weekly site meeting.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !s ? <p role="status">Loading the week…</p>
      : <article className="week-sheet" aria-labelledby="week-title">
        <header className="week-head">
          <p className="lbl">Leodis Developments · Weekly summary</p>
          <h1 id="week-title">{project.projectName}</h1>
          <p className="week-range">{fmtDay(s.start)} to {fmtDay(s.end, true)}{s.current ? ' · this week so far' : ''}</p>
          <dl className="week-facts">
            <div><dt>Project</dt><dd className="ref">{project.projectNumber}</dd></div>
            <div><dt>Client</dt><dd>{project.clientName || 'Not recorded'}</dd></div>
            <div><dt>Project manager</dt><dd>{project.projectManager || 'Not recorded'}</dd></div>
            <div><dt>Prepared</dt><dd>{fmtDay(today, true)}</dd></div>
          </dl>
        </header>

        <dl className="week-stats">
          <div><dt>Site reports</dt><dd>{s.reports.length}<small>{s.siteDays.length ? `${plural(s.siteDays.length, 'day')} on site` : 'no visits reported'}</small></dd></div>
          <div><dt>Engineers</dt><dd>{s.engineers.length}<small>{s.engineers.length ? s.engineers.join(', ') : 'none reported'}</small></dd></div>
          <div><dt>Issues raised</dt><dd>{s.issuesRaised.length}<small>{plural(s.issuesClosed.length, 'closed', 'closed')} this week</small></dd></div>
          <div><dt>Variations raised</dt><dd className={s.variationsRaised.some(v => v.workDone && v.status !== 'Instructed') ? 'late' : ''}>{s.variationsRaised.length}<small>{plural(s.variationsInstructed.length, 'instructed', 'instructed')} this week</small></dd></div>
        </dl>

        <section className="week-section">
          <h2>On site<span>{plural(s.reports.length, 'report')}</span></h2>
          {s.reports.length ? <ul className="week-rows">{s.reports.map(r => <li key={r.id}>
            <span className="week-when">{fmtDay(r.visitDate)}</span>
            <div><p><Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link>{r.revision > 1 && <span className="tag tag-draft">Rev {r.revision}</span>}
              {r.review === 'pending' && <span className="tag tag-draft">Awaiting review</span>}{r.review === 'returned' && <span className="tag tag-alert">Returned for changes</span>}</p>
              <p className="week-desc">{r.author}{r.trade ? ` · ${r.trade}` : ''}</p>
              <p className="week-meta">{r.inspection ? inspectionLine(r.inspection) : kindLine(r.kinds)}{r.photos ? ` · ${plural(r.photos, 'photograph')}` : ''}</p>
              {r.locations.length > 0 && <p className="week-meta">{r.locations.join(' · ')}</p>}</div>
          </li>)}</ul> : <p className="week-none">No site reports were sent for visits this week.</p>}
          {s.reports.length > 0 && <p className="week-total">Across the week: {[s.reports.some(r => !r.inspection) ? kindLine(s.kinds) : '', (() => { const n = s.reports.filter(r => r.inspection).length; return n ? plural(n, 'inspection') : ''; })()].filter(Boolean).join(', ')}.</p>}
        </section>

        <section className="week-section">
          <h2>Issues<span>{issuesMoved ? plural(issuesMoved, 'change') : 'no changes'}</span></h2>
          <h3>Raised</h3><IssueRows rows={s.issuesRaised} empty="No issues raised this week." here={here} />
          <h3>Put forward as fixed</h3><IssueRows rows={s.issuesFixed} empty="Nothing put forward as fixed this week." here={here} />
          <h3>Checked and closed</h3><IssueRows rows={s.issuesClosed} empty="No issues closed this week." here={here} />
          <p className="week-total">Open now: <b>{s.openNow.total}</b>{s.openNow.pastTarget > 0 && <> · <span className="late">{s.openNow.pastTarget} past target</span></>}{s.openNow.toCheck > 0 && <> · {s.openNow.toCheck} fixed and waiting to be checked</>}.
            {s.openNow.total > 0 && <> <Link className="week-noprint" href={snagHref}>Open the snag list</Link></>}</p>
        </section>

        <section className="week-section">
          <h2>Variations<span>{plural(s.variationsRaised.length + s.variationsInstructed.length, 'change')}</span></h2>
          <h3>Raised</h3><VariationRows rows={s.variationsRaised} empty="No variations raised this week." here={here} />
          <h3>Instructed by the client</h3><VariationRows rows={s.variationsInstructed} empty="No variations instructed this week." here={here} />
        </section>

        <footer className="week-foot">
          <p>Made from site reports sent to the office and the issue and variation registers in RELAY. Reports are placed by their visit day; issues and variations by the day each change was recorded. A corrected report replaces the one it corrects. Reports still awaiting review or returned for changes are marked. &ldquo;Open now&rdquo; is as of {fmtDay(today, true)}. Prices are not shown.</p>
        </footer>
      </article>}
  </main>;
}
