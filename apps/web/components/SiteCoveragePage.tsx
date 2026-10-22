'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { QUIET_WORKING_DAYS, fortnightStart, isWeekend, shiftFortnight, type CoverageProject, type CoverageVisit, type SiteCoverage } from '@/lib/siteCoverage';
import { londonDay } from '@/lib/weeklySummary';
import { dayShort } from '@/lib/dates';
import { failure } from '@/lib/failure';

/**
 * Site coverage, for the office: every reportable project against a
 * fortnight, showing which days a report was sent from site and by which
 * trade, and which active sites have gone quiet. It reads sent reports and
 * changes nothing. Rules in `lib/siteCoverage.ts`.
 */

const fmtDay = (ymd: string, year: boolean | 'auto' = 'auto') => dayShort(ymd, year);
const weekdayOf = (ymd: string) => dayShort(ymd, false).slice(0, 3);
const dateOf = (ymd: string) => Number(ymd.slice(8));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TRADE_SHORT: Record<string, string> = { Electrical: 'Elec', HVAC: 'HVAC', 'P&H': 'P&H' };
const short = (v: CoverageVisit) => (v.trade && TRADE_SHORT[v.trade]) || 'Other';
const who = (v: CoverageVisit) => `${v.author}${v.trade ? `, ${v.trade}` : ''}`;
/** The reports behind a mark: one person may send a site update and an inspection on the same day. */
const refs = (v: CoverageVisit) => [`${v.reference}${v.revision > 1 ? ` rev ${v.revision}` : ''}`, ...v.references.slice(1)].join(', ');

function sinceWords(p: CoverageProject, today: string): string {
  if (!p.last) return 'No report sent from this site yet';
  if (p.last.visitDate === today) return 'Reported today';
  const n = p.workingDaysSince ?? 0;
  return n ? `${plural(n, 'working day')} without a report` : 'Reported on the last working day';
}

function QuietTag({ p }: { p: CoverageProject }) {
  if (!p.quiet) return null;
  return <span className="tag tag-draft">{p.last ? `Quiet ${p.workingDaysSince} working days` : 'No reports yet'}</span>;
}

export function SiteCoveragePage({ initialStart, returnTo }: { initialStart: string; returnTo?: string | undefined }) {
  const router = useRouter();
  const today = londonDay(new Date());
  const thisFortnight = fortnightStart(undefined, today);
  const [start, setStart] = useState(fortnightStart(initialStart || undefined, today));
  const [data, setData] = useState<SiteCoverage | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const back = safeViewReturn(returnTo, '/office');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/site-coverage?${new URLSearchParams({ start })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as SiteCoverage & { reason?: string };
        if (!response.ok) throw failure(response.status, body, 'Site coverage could not be loaded.');
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'Site coverage could not be loaded.'); });
    return () => { cancelled = true; };
  }, [start, retry]);

  // The address carries the fortnight, so a report opened from the grid comes back to it.
  const q = new URLSearchParams();
  if (start !== thisFortnight) q.set('start', start);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/coverage${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const s = data?.start === start ? data : null;
  // On a narrow screen the grid scrolls sideways; bring today (or the latest day shown) into view rather than the oldest.
  useEffect(() => {
    const box = scroller.current;
    if (!box || box.scrollWidth <= box.clientWidth) return;
    const cell = box.querySelector<HTMLElement>('thead .cov-today') ?? box.querySelector<HTMLElement>('thead .cov-last-head');
    if (cell) box.scrollLeft = Math.max(0, cell.offsetLeft + cell.offsetWidth + 24 - box.clientWidth);
  }, [s]);
  const active = s?.projects.filter(p => p.active) ?? [];
  const dlp = s?.projects.filter(p => !p.active) ?? [];
  // Before any site has sent a report through RELAY, no site has gone quiet: none has started.
  const started = s?.projects.some(p => p.last) ?? false;
  const quiet = started ? active.filter(p => p.quiet) : [];
  const reportedToday = active.filter(p => p.last?.visitDate === s?.today).length;
  const weekOf = (p: CoverageProject, day: string) => `/weekly-summary?${new URLSearchParams({ project: p.projectId, week: day, returnTo: here })}`;

  const row = (p: CoverageProject) => <tr key={p.projectId} className={p.quiet && started ? 'cov-quiet' : ''}>
    <th scope="row">
      <Link className="cov-project" href={weekOf(p, s!.days[7]! <= s!.today ? s!.days[7]! : s!.start)}>{p.projectName}</Link>
      <span className="cov-sub"><span className="ref">{p.projectNumber}</span>{p.projectManager ? ` · ${p.projectManager}` : ''}</span>
    </th>
    {s!.days.map((d, i) => <td key={d} className={`${isWeekend(d) ? 'cov-weekend' : ''} ${d === s!.today ? 'cov-today' : ''} ${d > s!.today ? 'cov-future' : ''}`}>
      {p.days[i]!.length > 0 && <ul className="cov-visits" aria-label={`${fmtDay(d)}: ${plural(p.days[i]!.length, 'person', 'people')} on site`}>{p.days[i]!.map(v => <li key={v.reportId}>
        <Link className="cov-chip" href={withViewReturn(`/reports/${v.reportId}`, here)} title={`${who(v)} · ${refs(v)}`} aria-label={`${who(v)}, ${refs(v)}`}>{short(v)}</Link>
      </li>)}</ul>}
    </td>)}
    <td className="cov-last">
      {p.last ? <Link href={withViewReturn(`/reports/${p.last.reportId}`, here)}>{fmtDay(p.last.visitDate)}</Link> : <span className="cov-none">None</span>}
      {p.last && <span className="cov-sub">{who(p.last)}</span>}
      <span className="cov-sub">{sinceWords(p, s!.today)}</span>
      {started && <QuietTag p={p} />}
    </td>
  </tr>;

  return <main className="eng-page cov-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <header className="cov-head">
      <p className="lbl">Leodis Developments · Office</p>
      <h1>Site coverage</h1>
      <p className="eng-help">Which days each site had a report sent from it, and by which trade. Active sites with no report for {QUIET_WORKING_DAYS} or more working days are marked, so you can check in before anyone has to ask.</p>
    </header>
    <div className="cov-controls" role="group" aria-label="Choose the fortnight">
      <button type="button" onClick={() => setStart(d => shiftFortnight(d, -1))}>&larr; Previous fortnight</button>
      <button type="button" onClick={() => setStart(thisFortnight)} disabled={start === thisFortnight}>Last two weeks</button>
      <button type="button" onClick={() => setStart(d => shiftFortnight(d, 1))} disabled={start >= thisFortnight}>Next fortnight &rarr;</button>
    </div>

    {error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !s ? <p role="status">Loading site coverage…</p>
      : <>
        <p className="cov-range">{fmtDay(s.start)} to {fmtDay(s.end, true)}{s.start <= s.today && s.today <= s.end ? ' · up to today' : ''}</p>
        <dl className="cov-stats">
          <div><dt>Active sites</dt><dd>{active.length}<small>{dlp.length ? `and ${plural(dlp.length, 'site')} in defects liability` : 'none in defects liability'}</small></dd></div>
          <div><dt>Reported today</dt><dd>{reportedToday}<small>{active.length ? `of ${plural(active.length, 'active site')}` : 'no active sites'}</small></dd></div>
          <div><dt>Gone quiet</dt><dd className={quiet.length ? 'late' : ''}>{quiet.length}<small>{quiet.length ? `no report for ${QUIET_WORKING_DAYS}+ working days` : started ? 'every active site reported recently' : 'no reports sent yet'}</small></dd></div>
        </dl>

        {!started && active.length > 0 && <div className="eng-panel cov-empty" role="status"><p>No site has sent a report through RELAY yet. Each day fills in here as reports come in, and an active site with none for {QUIET_WORKING_DAYS} working days is marked as gone quiet.</p></div>}

        {quiet.length > 0 && <section className="cov-panel" aria-labelledby="cov-quiet-title">
          <h2 id="cov-quiet-title">Gone quiet</h2>
          <ul className="cov-quiet-list">{quiet.map(p => <li key={p.projectId}>
            <div><b>{p.projectName}</b> <span className="ref">{p.projectNumber}</span>
              <p className="cov-sub">{p.last ? `Last report ${fmtDay(p.last.visitDate, true)} by ${who(p.last)}` : 'No report has been sent from this site yet'}{p.projectManager ? ` · PM ${p.projectManager}` : ''}</p></div>
            <QuietTag p={p} />
          </li>)}</ul>
        </section>}

        {s.projects.length === 0 ? <div className="eng-panel"><p>No active or defects liability projects are open to you.</p></div>
          : <div className="cov-scroll" ref={scroller} tabIndex={0} role="region" aria-label="Reports by site and day">
            <table className="cov-grid">
              <caption>Reports sent from each site, {fmtDay(s.start)} to {fmtDay(s.end, true)}</caption>
              <thead><tr>
                <th scope="col" className="cov-corner">Project</th>
                {s.days.map(d => <th scope="col" key={d} className={`${isWeekend(d) ? 'cov-weekend' : ''} ${d === s.today ? 'cov-today' : ''}`} aria-label={fmtDay(d)}><span>{weekdayOf(d)}</span><b>{dateOf(d)}</b></th>)}
                <th scope="col" className="cov-last-head">Last report</th>
              </tr></thead>
              {[['Active', active], ['Defects liability period', dlp]].map(([label, rows]) => (rows as CoverageProject[]).length > 0 && <Fragment key={label as string}>
                <tbody>
                  <tr className="cov-group"><th scope="rowgroup" colSpan={s.days.length + 2}><span>{label as string}<i>{(rows as CoverageProject[]).length}</i></span></th></tr>
                  {(rows as CoverageProject[]).map(row)}
                </tbody>
              </Fragment>)}
            </table>
          </div>}

        <footer className="cov-foot">
          <p><b>Elec</b> Electrical · <b>HVAC</b> HVAC · <b>P&amp;H</b> Plumbing and heating · <b>Other</b> trade not recorded. Each mark is one person who sent a report from site that day, on the visit day the engineer gave, so two Elec marks are two electricians. Select a mark to open their report: their site update, if they also sent an inspection that day. Select a project for its weekly summary.</p>
          <p>Made from reports sent to the office; drafts and work still on an engineer&rsquo;s phone are not shown. A corrected report replaces the one it corrects. Working days are Monday to Friday; bank holidays are not known, so they count. Defects liability sites are never marked as quiet, because visits there are occasional.</p>
        </footer>
      </>}
  </main>;
}
