'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { dayLabel } from '@/lib/myWeek';
import type { IssueTrend, TrendWeek } from '@/lib/issueTrend';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { failure } from '@/lib/failure';

/**
 * Issues over time: whether a project's issue list is getting shorter, week
 * by week, for the progress meeting. It reads the issue register and changes
 * nothing.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "12 Oct": short enough to sit under a bar on a phone. */
const shortDay = (ymd: string) => dayLabel(ymd).slice(4);

function headline(t: IssueTrend): string {
  if (t.direction === 'fewer') return `Getting shorter: ${plural(t.openNow, 'issue')} open, down from ${t.openBefore} four weeks ago.`;
  if (t.direction === 'more') return `Getting longer: ${plural(t.openNow, 'issue')} open, up from ${t.openBefore} four weeks ago.`;
  return t.openNow ? `No change: ${plural(t.openNow, 'issue')} open, the same as four weeks ago.` : 'No open issues, now or four weeks ago.';
}

const weekWords = (w: TrendWeek, current: boolean) =>
  `${current ? 'This week so far' : `Week of ${dayLabel(w.monday)}`}: ${w.raised} raised, ${w.closed} closed, ${w.open} open at the end${current ? ' of today' : ''}${w.late ? `, ${w.late} past target` : ''}.`;

function Chart({ weeks }: { weeks: TrendWeek[] }) {
  const last = weeks.length - 1;
  const [picked, setPicked] = useState(last);
  // Hovering only changes what is shown; the pressed week changes on a tap, a click or keyboard focus.
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? picked;
  const top = Math.max(1, ...weeks.map(w => w.open));
  const w = weeks[shown] ?? weeks[last]!;
  return <figure className="it-chart" aria-labelledby="it-chart-title">
    <figcaption>
      <h2 id="it-chart-title">Open at the end of each week</h2>
      <p className="it-legend"><span className="it-key it-key-open" aria-hidden="true" />On time or no target<span className="it-key it-key-late" aria-hidden="true" />Past target</p>
    </figcaption>
    <p className="it-readout">{weekWords(w, shown === last)}</p>
    <div className="it-plot">
      <span className="it-top" aria-hidden="true">{top}</span>
      <div className="it-bars" onMouseLeave={() => setHovered(null)}>
        {weeks.map((week, k) => {
          const onTime = week.open - week.late;
          return <button key={week.monday} type="button" className={`it-col ${k === shown ? 'it-col-on' : ''}`}
            aria-pressed={k === picked} aria-label={weekWords(week, k === last)}
            onClick={() => setPicked(k)} onFocus={() => setPicked(k)} onMouseEnter={() => setHovered(k)} onMouseLeave={() => setHovered(null)}>
            <span className="it-stack" style={{ height: `${(week.open / top) * 100}%` }}>
              {week.late > 0 && <span className="it-late" style={{ flexGrow: week.late }} />}
              {onTime > 0 && <span className="it-open" style={{ flexGrow: onTime }} />}
              {k === last && <b className="it-value" aria-hidden="true">{week.open}</b>}
            </span>
          </button>;
        })}
      </div>
      <div className="it-axis" aria-hidden="true">
        {weeks.map((week, k) => <span key={week.monday}>{k === last ? 'Now' : k % 4 === 0 ? shortDay(week.monday) : ''}</span>)}
      </div>
    </div>
  </figure>;
}

export function IssueTrendPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [data, setData] = useState<IssueTrend | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);

  useEffect(() => {
    if (!projectId) { setData(null); setError(''); return; }
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/issue-trend?${new URLSearchParams({ projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as IssueTrend & { reason?: string };
        if (!response.ok) throw failure(response.status, body, 'The figures could not be loaded.');
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The figures could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the project, so a record opened from here comes back to it.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/issue-trend${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const d = data?.projectId === projectId ? data : null;
  const tone = d ? d.direction === 'fewer' ? 'it-verdict-good' : d.direction === 'more' ? 'it-verdict-bad' : '' : '';

  return <main className="eng-page it-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="it-controls">
      <label htmlFor="it-project">Project</label>
      <select id="it-project" value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select>
    </div>

    {!project ? <div className="eng-panel"><h1>Issues over time</h1><p className="eng-help">Choose a project to see whether its issue list is getting shorter: issues raised and closed each week over the last 12 weeks, and how many were still open at the end of each.</p></div>
      : error ? <><h1>Issues over time</h1><div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div></>
      : !d ? <><h1>Issues over time</h1><p role="status">Loading the figures…</p></>
      : <article className="it-sheet" aria-labelledby="it-title">
        <header>
          <p className="lbl">Issues over time · {project.projectNumber}</p>
          <h1 id="it-title">{project.projectName}</h1>
          <p className={`it-verdict ${tone}`} role="status">{headline(d)}</p>
        </header>

        <div className="it-stats">
          <div className={`it-stat ${d.lateNow ? 'it-stat-alert' : ''}`}><span className="it-stat-label">Open now</span><span className="it-stat-n">{d.openNow}</span><small>{d.lateNow ? `${d.lateNow} past target` : 'none past target'}</small></div>
          <div className="it-stat"><span className="it-stat-label">Last four weeks</span><span className="it-stat-n">{d.recent.raised}<span className="it-stat-of"> raised</span></span><small>{d.recent.closed} closed</small></div>
          <div className="it-stat"><span className="it-stat-label">Time to close</span><span className="it-stat-n">{d.medianDaysToClose === undefined ? '–' : plural(d.medianDaysToClose, 'day')}</span><small>{d.closedInRange ? `typical, of ${d.closedInRange} closed in 12 weeks` : 'none closed in 12 weeks'}</small></div>
          <div className="it-stat"><span className="it-stat-label">Oldest open</span>{d.oldest
            ? <><span className="it-stat-n">{plural(d.oldest.days, 'day')}</span><small><Link className="ref" href={withViewReturn(`/issues/${d.oldest.id}`, here)}>{d.oldest.reference}</Link>, raised {dayLabel(d.oldest.raisedOn)}</small></>
            : <><span className="it-stat-n">–</span><small>nothing open</small></>}</div>
        </div>

        <Chart key={d.projectId} weeks={d.weeks} />

        <section className="it-section" aria-labelledby="it-table-title">
          <h2 id="it-table-title">Week by week</h2>
          <div className="it-table-wrap">
            <table className="it-table">
              <thead><tr><th scope="col">Week of</th><th scope="col">Raised</th><th scope="col">Closed</th><th scope="col">Open at end</th><th scope="col">Past target</th></tr></thead>
              <tbody>{[...d.weeks].reverse().map((w, k) => <tr key={w.monday}>
                <th scope="row">{dayLabel(w.monday)}{k === 0 && <small> so far</small>}</th><td>{w.raised}</td><td>{w.closed}</td><td>{w.open}</td><td className={w.late ? 'it-late-n' : ''}>{w.late}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <p className="it-links"><Link href={`/issues/snag-list?${new URLSearchParams({ project: projectId, returnTo: here })}`}>Open issues on the snag list</Link><Link href={`/handover?${new URLSearchParams({ project: projectId, returnTo: here })}`}>Before handover</Link></p>

        <footer className="it-foot">
          <p>Counted from the issue register as it stands today. An issue counts as closed on the day the office checked it; one closed, reopened and still open counts as open throughout. Put forward as fixed is still open until it is checked. Past target uses each issue&rsquo;s target date as it is now. Withdrawn issues are left out{d.closedUndated ? `, and ${plural(d.closedUndated, 'closed issue')} with no record of when it was closed ${d.closedUndated === 1 ? 'counts' : 'count'} as raised but never as open or closed` : ''}. Weeks run Monday to Sunday.</p>
        </footer>
      </article>}
  </main>;
}
