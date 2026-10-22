'use client';

import { useEffect, useState } from 'react';
import { fmtDay, plural, kindLine, inspectionLine, WorkDone, IssueRows, VariationRows } from './summaryRows';
import { MonthSheet } from './MonthSheet';
import { useFeatures } from './FeaturesContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { londonDay, shiftWeek, weekStart, type WeeklySummary } from '@/lib/weeklySummary';
import { monthOf, shiftMonth, type MonthSummary } from '@/lib/monthSummary';
import { failure } from '@/lib/failure';

/**
 * One project's week, for the weekly site or client meeting: who was on site,
 * what work they did in their own words, how issues and variations moved, and the toolbox talks,
 * permits and deliveries recorded. The Month choice shows one calendar month
 * instead, for the monthly progress meeting (MonthSheet). It reads what is
 * already in RELAY and changes nothing.
 */

export type SummaryPeriod = 'week' | 'month';

export function WeeklySummaryPage({ initialProject, initialWeek, initialPeriod = '', initialMonth = '', returnTo }: { initialProject: string; initialWeek: string; initialPeriod?: string; initialMonth?: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const router = useRouter();
  const today = londonDay(new Date());
  const thisWeek = weekStart(undefined, today);
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const thisMonth = monthOf(undefined, today);
  const [period, setPeriod] = useState<SummaryPeriod>(initialPeriod === 'month' ? 'month' : 'week');
  const [week, setWeek] = useState(weekStart(initialWeek, today));
  // Never a month after this one: there is nothing to show yet.
  const [month, setMonth] = useState(() => { const m = monthOf(initialMonth || undefined, today); return m > thisMonth ? thisMonth : m; });
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [monthly, setMonthly] = useState<MonthSummary | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const fallback = manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}&view=reports` : ''}`;
  const back = safeViewReturn(returnTo, fallback);

  useEffect(() => {
    if (!projectId) { setSummary(null); setMonthly(null); return; }
    let cancelled = false;
    setSummary(null); setMonthly(null); setError('');
    const address = period === 'month' ? `/api/monthly-summary?${new URLSearchParams({ projectId, month })}` : `/api/weekly-summary?${new URLSearchParams({ projectId, week })}`;
    fetch(address, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as WeeklySummary & MonthSummary & { reason?: string };
        if (!response.ok) throw failure(response.status, body, 'The summary could not be loaded.');
        if (!cancelled) { if (period === 'month') setMonthly(body); else setSummary(body); }
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The summary could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, period, week, month, retry]);

  // The address carries the choices, so a week can be bookmarked or sent to someone,
  // and a record opened from the page comes back to the same week.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (period === 'month') { q.set('period', 'month'); if (month !== thisMonth) q.set('month', month); }
  else if (week !== thisWeek) q.set('week', week);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/weekly-summary${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  // Talks, permits and deliveries only while the office has them on (lib/featureSwitch.ts).
  const { safetyRecords } = useFeatures();
  const s = period === 'week' && summary?.projectId === projectId && summary.start === week ? summary : null;
  const m = period === 'month' && monthly?.projectId === projectId && monthly.month === month ? monthly : null;
  const issuesMoved = s ? s.issuesRaised.length + s.issuesFixed.length + s.issuesClosed.length : 0;
  const siteCount = s ? s.site.talks.length + s.site.permits.length + s.site.deliveries.length : 0;
  const snagHref = `/issues/snag-list?${new URLSearchParams({ project: projectId, returnTo: here })}`;
  // The office's issue register on this project, waiting to be checked; the snag list is the engineer's way in.
  // "Past target" stays words; it is the register's Overdue (lib/officeActions.ts `isOverdueIssue`).
  const officeVerify = `/office#/issues/show/verify/${encodeURIComponent(projectId)}`;

  return <main className="eng-page week-page">
    <Link href={back} className="back week-noprint">&larr; {backLabel(back)}</Link>
    <div className="week-controls week-noprint">
      <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select></label>
      <div className="week-period" role="group" aria-label="Week or month">
        {(['week', 'month'] as const).map(p => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{p === 'week' ? 'Week' : 'Month'}</button>)}
      </div>
      {/* Beside Week and Month, so on a phone the controls take three rows and the figures reach the first screen. */}
      <button type="button" className="btn-primary week-print" onClick={() => window.print()} disabled={period === 'week' ? !s : !m}>Print or save as PDF</button>
      {period === 'week' ? <div className="week-step" role="group" aria-label="Choose the week">
        <button type="button" onClick={() => setWeek(w => shiftWeek(w, -1))}>&larr; Previous week</button>
        <button type="button" onClick={() => setWeek(thisWeek)} disabled={week === thisWeek}>This week</button>
        <button type="button" onClick={() => setWeek(w => shiftWeek(w, 1))} disabled={week >= thisWeek}>Next week &rarr;</button>
      </div> : <div className="week-step" role="group" aria-label="Choose the month">
        <button type="button" onClick={() => setMonth(v => shiftMonth(v, -1))}>&larr; Previous month</button>
        <button type="button" onClick={() => setMonth(thisMonth)} disabled={month === thisMonth}>This month</button>
        <button type="button" onClick={() => setMonth(v => shiftMonth(v, 1))} disabled={month >= thisMonth}>Next month &rarr;</button>
      </div>}
    </div>

    {!project ? <div className="eng-panel week-noprint"><h1>{period === 'month' ? 'Monthly summary' : 'Weekly summary'}</h1><p className="eng-help">{period === 'month'
        ? 'Choose a project to see one calendar month on one page: the month\'s figures week by week, where work moved on, what is behind, who still has issues open, and a few photographs. Ready for the monthly progress meeting.'
        : 'Choose a project to see its week on one page: who was on site, what work they did, and which issues and variations moved. Ready for the weekly site meeting.'}</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : period === 'month' ? (!m ? <p role="status">Loading the month…</p> : <MonthSheet m={m} project={project} today={today} thisMonth={thisMonth} here={here} manager={manager} />)
      : !s ? <p role="status">Loading the week…</p>
      : <article className="week-sheet" aria-labelledby="week-title">
        <header className="week-head">
          <p className="lbl">Leodis Developments · Weekly summary</p>
          <h1 id="week-title">{project.projectName}</h1>
          <p className="week-range">{fmtDay(s.start)} to {fmtDay(s.end, true)}{s.current ? ' · this week so far' : s.start === shiftWeek(thisWeek, -1) ? ' · last week' : ''}</p>
          <dl className="week-facts">
            <div><dt>Project</dt><dd className="ref">{project.projectNumber}</dd></div>
            <div><dt>Client</dt><dd>{project.clientName || 'Not recorded'}</dd></div>
            <div><dt>Project manager</dt><dd>{project.projectManager || 'Not recorded'}</dd></div>
            <div><dt>Prepared</dt><dd>{fmtDay(today, true)}</dd></div>
          </dl>
        </header>

        <dl className="week-stats">
          <div><dt>Site reports</dt><dd>{s.reports.length}<small>{s.siteDays.length ? `${plural(s.visits, 'visit')} over ${plural(s.siteDays.length, 'day')}` : 'no visits reported'}</small></dd></div>
          <div><dt>Engineers</dt><dd>{s.engineers.length}<small>{s.engineers.length ? s.engineers.join(', ') : 'none reported'}</small></dd></div>
          <div><dt>Issues raised</dt><dd>{s.issuesRaised.length}<small>{plural(s.issuesClosed.length, 'closed', 'closed')} this week</small></dd></div>
          <div><dt>Variations raised</dt><dd className={s.variationsRaised.some(v => v.workDone && v.status !== 'Instructed') ? 'late' : ''}>{s.variationsRaised.length}<small>{plural(s.variationsInstructed.length, 'instructed', 'instructed')} this week</small></dd></div>
        </dl>

        <section className="week-section">
          <h2>On site<span>{s.reports.length ? plural(s.reports.length, 'report') : 'no reports'}</span></h2>
          {s.reports.length ? <ul className="week-rows">{s.reports.map(r => <li key={r.id}>
            <span className="week-when">{fmtDay(r.visitDate)}</span>
            <div><p><Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link>{r.revision > 1 && <span className="tag tag-draft">Rev {r.revision}</span>}
              {r.review === 'pending' && <span className="tag tag-draft">Awaiting review</span>}{r.review === 'returned' && <span className="tag tag-alert">Returned for changes</span>}</p>
              <p className="week-desc">{r.author}{r.trade ? ` · ${r.trade}` : ''}</p>
              <p className="week-meta">{r.inspection ? inspectionLine(r.inspection) : kindLine(r.kinds)}{r.photos > 0 && <> · <Link href={withViewReturn(`/photos?${new URLSearchParams({ project: projectId, day: r.visitDate, q: r.reference })}`, here)} aria-label={`${plural(r.photos, 'photograph')} from ${r.reference}`}>{plural(r.photos, 'photograph')}</Link></>}</p>
              {/* Where the work was is in the work lines; the places list stays for a visit with no progress written. */}
              {r.work.length ? <WorkDone r={r} /> : r.locations.length > 0 && <p className="week-meta">{r.locations.join(' · ')}</p>}</div>
          </li>)}</ul> : <p className="week-none">No site reports were sent for visits this week.</p>}
          {s.reports.length > 0 && <p className="week-total">Across the week: {[s.reports.some(r => !r.inspection) ? kindLine(s.kinds) : '', (() => { const n = s.reports.filter(r => r.inspection).length; return n ? plural(n, 'inspection') : ''; })()].filter(Boolean).join(', ')}.</p>}
        </section>

        <section className="week-section">
          <h2>Issues<span>{issuesMoved ? plural(issuesMoved, 'change') : 'no changes'}</span></h2>
          <h3>Raised</h3><IssueRows rows={s.issuesRaised} empty="No issues raised this week." here={here} />
          <h3>Put forward as fixed</h3><IssueRows rows={s.issuesFixed} empty="Nothing put forward as fixed this week." here={here} />
          <h3>Checked and closed</h3><IssueRows rows={s.issuesClosed} empty="No issues closed this week." here={here} />
          <p className="week-total">Open now: <b>{s.openNow.total}</b>{s.openNow.pastTarget > 0 && <> · <span className="late">{s.openNow.pastTarget} past target</span></>}{s.openNow.toCheck > 0 && <> · {manager ? <a href={officeVerify}>{s.openNow.toCheck} fixed and waiting to be checked</a> : `${s.openNow.toCheck} fixed and waiting to be checked`}</>}.
            {s.openNow.total > 0 && <> <Link className="week-noprint" href={snagHref}>Open the snag list</Link></>}</p>
        </section>

        <section className="week-section">
          <h2>Variations<span>{s.variationsRaised.length + s.variationsInstructed.length ? plural(s.variationsRaised.length + s.variationsInstructed.length, 'change') : 'no changes'}</span></h2>
          <h3>Raised</h3><VariationRows rows={s.variationsRaised} empty="No variations raised this week." here={here} />
          <h3>Instructed by the client</h3><VariationRows rows={s.variationsInstructed} empty="No variations instructed this week." here={here} />
        </section>

        {safetyRecords && <section className="week-section">
          <h2>Toolbox talks, permits and deliveries<span>{siteCount ? plural(siteCount, 'record') : 'none recorded'}</span></h2>
          <h3>Toolbox talks</h3>
          {s.site.talks.length ? <ul className="week-rows">{s.site.talks.map(t => <li key={t.id}>
            <span className="week-when">{fmtDay(t.day)}</span>
            <div><p>Given by {t.givenBy}</p><p className="week-desc">{t.topic}</p><p className="week-meta">{plural(t.attendees, 'person', 'people')} attended</p></div>
          </li>)}</ul> : <p className="week-none">No toolbox talks recorded this week.</p>}
          <h3>Permits to work</h3>
          {s.site.permits.length ? <ul className="week-rows">{s.site.permits.map(p => <li key={p.id}>
            <span className="week-when">{fmtDay(p.day)}</span>
            <div><p>{p.title} <span className={`tag ${p.closedDay ? 'tag-sent' : 'tag-draft'}`}>{p.closedDay ? `Closed ${fmtDay(p.closedDay)}` : 'Open'}</span></p>
              <p className="week-desc">{p.work}</p><p className="week-meta">Held by {p.heldBy}{p.issued !== p.day ? ` · issued ${fmtDay(p.issued)}` : ''}</p></div>
          </li>)}</ul> : <p className="week-none">No permits issued or closed this week.</p>}
          <h3>Deliveries</h3>
          {s.site.deliveries.length ? <ul className="week-rows">{s.site.deliveries.map(d => <li key={d.id}>
            <span className="week-when">{fmtDay(d.day)}</span>
            <div><p>{d.supplier} <span className={`tag ${d.toSort ? 'tag-alert' : d.sortedDay ? 'tag-sent' : 'tag-draft'}`}>{d.toSort ? `${d.condition} · to sort` : d.sortedDay ? `${d.condition} · sorted ${fmtDay(d.sortedDay)}` : d.condition}</span></p>
              <p className="week-desc">{d.items}</p>{(d.problem || d.arrived !== d.day) && <p className="week-meta">{[d.problem, d.arrived !== d.day ? `arrived ${fmtDay(d.arrived)}` : ''].filter(Boolean).join(' · ')}</p>}</div>
          </li>)}</ul> : <p className="week-none">No deliveries recorded this week.</p>}
          {siteCount > 0 && <p className="week-total week-noprint"><Link href={withViewReturn(`/toolbox-talks?${new URLSearchParams({ project: projectId })}`, here)}>Toolbox talks</Link> · <Link href={withViewReturn(`/permits?${new URLSearchParams({ project: projectId })}`, here)}>Permits to work</Link> · <Link href={withViewReturn(`/deliveries?${new URLSearchParams({ project: projectId })}`, here)}>Deliveries</Link></p>}
        </section>}

        <footer className="week-foot">
          <p>Made from site reports sent to the office{safetyRecords ? ', the issue and variation registers, and the toolbox talks, permits and deliveries recorded in RELAY' : ' and the issue and variation registers'}. Reports are placed by their visit day; issues and variations by the day each change was recorded{safetyRecords ? '; talks by the day given, permits and deliveries by the day issued or taken in, or closed or sorted when that was this week' : ''}. A corrected report replaces the one it corrects. Reports still awaiting review or returned for changes are marked. &ldquo;Open now&rdquo; is as of {fmtDay(today, true)}. Prices are not shown.</p>
        </footer>
      </article>}
  </main>;
}
