'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ConnectedProject } from '@/lib/projects';
import { withViewReturn } from '@/lib/viewNavigation';
import { monthName, shiftMonth, type MonthLateIssue, type MonthSummary } from '@/lib/monthSummary';
import { fmtAt, fmtDay, plural, IssueRows, VariationRows } from './summaryRows';
import { PhotoImage } from './PhotoImage';

/**
 * One project's calendar month, for the monthly progress meeting
 * (lib/monthSummary.ts). Every figure at the top opens the list it counts, on
 * this page. It prints like the weekly summary; the lists behind the figures
 * stay off paper.
 */

const range = (from: string, to: string) => from === to ? fmtDay(from) : `${fmtDay(from)} to ${fmtDay(to)}`;

/**
 * Lines shown on screen before "Show all". Print shows every place, but only
 * the longest-late issues unless "Show all" is open: on a busy project the
 * whole list ran to twenty pages, and each company's count prints below it.
 */
const PLACES_SHOWN = 12, LATE_SHOWN = 10;

type ListKey = 'days' | 'reports' | 'raised' | 'closed' | 'vraised' | 'vinstructed';
const LIST_NAME: Record<ListKey, string> = { days: 'Days on site', reports: 'Site reports', raised: 'Issues raised', closed: 'Issues closed', vraised: 'Variations raised', vinstructed: 'Variations instructed' };

function ShowAll({ total, shown, all, onToggle, what }: { total: number; shown: number; all: boolean; onToggle: () => void; what: string }) {
  if (total <= shown) return null;
  return <button type="button" className="week-noprint month-more" aria-expanded={all} onClick={onToggle}>{all ? 'Show less' : `Show all ${total} ${what}`}</button>;
}

function LateRows({ rows, here, all }: { rows: MonthLateIssue[]; here: string; all: boolean }) {
  return <ul className="week-rows">{rows.map((i, n) => <li key={i.id} className={!all && n >= LATE_SHOWN ? 'month-extra month-late-extra' : undefined}>
    <span className="week-when late">{plural(i.daysLate, 'day')} late</span>
    <div><p><Link className="ref" href={withViewReturn(`/issues/${i.id}`, here)}>{i.reference}</Link> <span className="tag tag-alert">Target {fmtDay(i.targetDate, true)}</span></p>
      <p className="week-desc">{i.description}</p>
      <p className="week-meta">{[i.location || 'No location recorded', i.owner || 'Not yet assigned', i.trade].filter(Boolean).join(' · ')}</p></div>
  </li>)}</ul>;
}

export function MonthSheet({ m, project, today, thisMonth, here, manager }: { m: MonthSummary; project: ConnectedProject; today: string; thisMonth: string; here: string; manager: boolean }) {
  const [open, setOpen] = useState<Partial<Record<ListKey, boolean>>>({});
  const [allPlaces, setAllPlaces] = useState(false);
  const [allLate, setAllLate] = useState(false);
  const p = m.period;
  const name = monthName(m.month);
  // "At the end of October", or "today" while the month is going.
  const when = m.current ? 'today' : `on ${fmtDay(m.asOf, true)}`;

  /** A figure that opens the list it counts, further down this page. */
  const figure = (list: ListKey, n: number, late = false) =>
    <a href={`#month-${list}`} className={`month-figure${late ? ' late' : ''}`} aria-label={`${LIST_NAME[list]}: ${n}, show the list`} onClick={e => {
      e.preventDefault(); setOpen(o => ({ ...o, [list]: true }));
      requestAnimationFrame(() => document.getElementById(`month-${list}`)?.scrollIntoView({ block: 'start' }));
    }}>{n}</a>;
  const list = (key: ListKey, title: string, n: number, children: React.ReactNode) =>
    <details id={`month-${key}`} open={Boolean(open[key])} onToggle={e => { const now = e.currentTarget.open; if (now !== Boolean(open[key])) setOpen(o => ({ ...o, [key]: now })); }}>
      <summary>{title}<span>{n}</span></summary>{children}
    </details>;

  const days = p.siteDays.map(day => { const rs = p.reports.filter(r => r.visitDate === day); return { day, reports: rs.length, engineers: [...new Set(rs.map(r => r.author))] }; });
  const notInstructed = p.variationsRaised.filter(v => v.workDone && v.status !== 'Instructed').length;
  const total = { days: p.siteDays.length, reports: p.reports.length, raised: p.issuesRaised.length, closed: p.issuesClosed.length, vraised: p.variationsRaised.length, vinstructed: p.variationsInstructed.length };
  const weekHref = (monday: string) => `/weekly-summary?${new URLSearchParams({ project: m.projectId, week: monday, returnTo: here })}`;
  const pastTargetTotal = m.pastTarget.length;

  return <article className="week-sheet month-sheet" aria-labelledby="week-title">
    <header className="week-head">
      <p className="lbl">Leodis Developments · Monthly summary</p>
      <h1 id="week-title">{project.projectName}</h1>
      <p className="week-range">{name}{m.current ? ' · this month so far' : m.month === shiftMonth(thisMonth, -1) ? ' · last month' : ''}</p>
      <dl className="week-facts">
        <div><dt>Project</dt><dd className="ref">{project.projectNumber}</dd></div>
        <div><dt>Client</dt><dd>{project.clientName || 'Not recorded'}</dd></div>
        <div><dt>Project manager</dt><dd>{project.projectManager || 'Not recorded'}</dd></div>
        <div><dt>Prepared</dt><dd>{fmtDay(today, true)}</dd></div>
      </dl>
    </header>

    <section className="week-section" aria-labelledby="month-figures">
      <h2 id="month-figures">Figures for the month<span>{range(m.start, m.current ? today : m.end)}</span></h2>
      <dl className="week-stats month-stats">
        <div><dt>Days on site</dt><dd>{figure("days", total.days)}<small>{p.engineers.length ? p.engineers.join(', ') : 'no visits reported'}</small></dd></div>
        <div><dt>Site reports</dt><dd>{figure("reports", total.reports)}<small>{plural(p.kinds.update, 'progress update')}</small></dd></div>
        <div><dt>Issues raised</dt><dd>{figure("raised", total.raised)}<small>this month</small></dd></div>
        <div><dt>Issues closed</dt><dd>{figure("closed", total.closed)}<small>checked and closed this month</small></dd></div>
        <div><dt>Variations raised</dt><dd>{figure("vraised", total.vraised, notInstructed > 0)}<small>{notInstructed ? `${notInstructed} done, not instructed` : 'this month'}</small></dd></div>
        <div><dt>Variations instructed</dt><dd>{figure("vinstructed", total.vinstructed)}<small>by the client this month</small></dd></div>
      </dl>

      <h3>Week by week</h3>
      <div className="month-weeks-wrap">
        <table className="month-weeks">
          <thead><tr><th scope="col">Week</th><th scope="col">Days on site</th><th scope="col">Reports</th><th scope="col">Issues raised</th><th scope="col">Issues closed</th><th scope="col">Variations raised</th><th scope="col">Variations instructed</th></tr></thead>
          <tbody>{m.weeks.map(w => <tr key={w.monday}>
            {/* A full page load: this screen keeps its week or month in state, so the week opens fresh and Back returns to the month as it was. */}
            <th scope="row"><a href={weekHref(w.monday)}>{range(w.from, w.to)}</a>{w.from !== w.monday && <small>week from {fmtDay(w.monday)}</small>}</th>
            <td>{w.daysOnSite}</td><td>{w.reports}</td><td>{w.issuesRaised}</td><td>{w.issuesClosed}</td><td>{w.variationsRaised}</td><td>{w.variationsInstructed}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">{name.split(' ')[0]}</th><td>{total.days}</td><td>{total.reports}</td><td>{total.raised}</td><td>{total.closed}</td><td>{total.vraised}</td><td>{total.vinstructed}</td></tr></tfoot>
        </table>
      </div>
      <p className="week-total">A week that runs into the next or last month counts only its days in {name.split(' ')[0]}. Open a week for its full summary.</p>
    </section>

    <section className="week-section">
      <h2>Where work moved on<span>{m.places.length ? plural(m.places.length, 'place') : 'no progress written'}</span></h2>
      {m.places.length ? <ul className="week-rows month-places" aria-label="Progress by place">{m.places.map((pl, n) => <li key={pl.place} className={!allPlaces && n >= PLACES_SHOWN ? 'month-extra' : undefined}>
        <span className="week-when">{fmtDay(pl.latest.day)}</span>
        <div><p><b className="month-place">{pl.place}</b></p>
          <p className="week-desc">{pl.latest.text || 'No words written'}</p>
          <p className="week-meta">{[pl.latest.author, pl.latest.trade].filter(Boolean).join(' · ')} · <Link href={withViewReturn(`/reports/${pl.latest.reportId}`, here)}>{pl.latest.reference}</Link>
            {pl.updates > 1 ? ` · ${plural(pl.updates, 'update')} this month, the first on ${fmtDay(pl.first)}` : ''}</p></div>
      </li>)}</ul> : <p className="week-none">No progress updates were sent for visits this month.</p>}
      <ShowAll total={m.places.length} shown={PLACES_SHOWN} all={allPlaces} onToggle={() => setAllPlaces(a => !a)} what="places" />
      {m.unplaced > 0 && <p className="week-total">{plural(m.unplaced, 'progress update')} gave no place, so {m.unplaced === 1 ? 'it is' : 'they are'} only in {m.unplaced === 1 ? 'its report' : 'their reports'}.</p>}
    </section>

    <section className="week-section">
      <h2>Behind or stuck<span>{pastTargetTotal ? `${pastTargetTotal} past target` : 'nothing past target'}</span></h2>
      <h3>Issues past their target {when}</h3>
      {pastTargetTotal ? <LateRows rows={m.pastTarget} here={here} all={allLate} /> : <p className="week-none">No open issues were past their target {when}.</p>}
      <ShowAll total={pastTargetTotal} shown={LATE_SHOWN} all={allLate} onToggle={() => setAllLate(a => !a)} what="issues" />
      {!allLate && pastTargetTotal > LATE_SHOWN && <p className="week-total month-print-only">And {pastTargetTotal - LATE_SHOWN} more past their target {when}, each no more days late than these. Each company&rsquo;s open and past-target figures are under &ldquo;Still open, with whom&rdquo;.</p>}
      <h3>Access problems on more than one day</h3>
      {m.access.length ? <ul className="week-rows">{m.access.map(a => <li key={a.place}>
        <span className="week-when">{plural(a.days.length, 'day')}</span>
        <div><p><b className="month-place">{a.place}</b></p>
          {a.latest && <p className="week-desc">{a.latest}</p>}
          <p className="week-meta">{plural(a.times, 'time')}: {a.days.map(d => fmtDay(d)).join(', ')}</p></div>
      </li>)}</ul> : <p className="week-none">No place had access problems on more than one day this month.</p>}
    </section>

    <section className="week-section">
      <h2>Still open, with whom<span>{m.openAtEnd} open {when}</span></h2>
      {m.companies.length ? <ul className="month-companies" aria-label="Open issues by company">{m.companies.map(c => <li key={c.owner || '-'}>
        <details>
          <summary><b>{c.owner || 'Not yet assigned'}</b><span>{c.open.length} open{c.pastTarget ? <> · <span className="late">{c.pastTarget} past target</span></> : ''}</span></summary>
          <ul className="week-rows">{c.open.map(i => <li key={i.id}>
            <span className="week-when">{fmtAt(i.at)}</span>
            <div><p><Link className="ref" href={withViewReturn(`/issues/${i.id}`, here)}>{i.reference}</Link> <span className={`tag ${i.status === 'Past target' ? 'tag-alert' : 'tag-draft'}`}>{i.status}</span></p>
              <p className="week-desc">{i.description}</p>
              <p className="week-meta">{[i.location || 'No location recorded', i.trade].filter(Boolean).join(' · ')}</p></div>
          </li>)}</ul>
        </details>
      </li>)}</ul> : <p className="week-none">No issues were open {when}.</p>}
      {m.current && manager && m.openAtEnd > 0 && <p className="week-total week-noprint"><a href={`/office#/issues/show/open/${encodeURIComponent(m.projectId)}`}>Open the Issues register on this project</a></p>}
    </section>

    <section className="week-section">
      <h2>A few photographs<span>{m.photos.length ? plural(m.photos.length, 'place') : 'none this month'}</span></h2>
      {m.photos.length ? <ul className="month-photos">{m.photos.map(ph => <li key={ph.src}>
        <Link href={withViewReturn(`/photos?${new URLSearchParams({ project: m.projectId, day: ph.day, q: ph.reference })}`, here)} aria-label={`${ph.place}, ${fmtDay(ph.day)}, from ${ph.reference}`}>
          <PhotoImage src={ph.src} alt={ph.caption || `Progress at ${ph.place}`} />
        </Link>
        <p><b>{ph.place}</b></p><p className="week-meta">{fmtDay(ph.day)} · {[ph.author, ph.trade].filter(Boolean).join(' · ')}</p>
      </li>)}</ul> : <p className="week-none">No progress photographs were sent for visits this month.</p>}
      <p className="week-total week-noprint"><Link href={withViewReturn(`/photos?${new URLSearchParams({ project: m.projectId, month: m.month })}`, here)}>Every photograph from {name}, by day</Link></p>
    </section>

    <section className="week-section week-noprint month-lists">
      <h2>Behind the figures<span>every record counted</span></h2>
      {list("days", "Days on site", total.days, <>
        {days.length ? <ul className="week-rows">{days.map(d => <li key={d.day}><span className="week-when">{fmtDay(d.day)}</span><div><p className="week-desc">{d.engineers.join(', ')}</p><p className="week-meta">{plural(d.reports, 'report')}</p></div></li>)}</ul> : <p className="week-none">No visits reported this month.</p>}
      </>)}
      {list("reports", "Site reports", total.reports, <>
        {p.reports.length ? <ul className="week-rows">{p.reports.map(r => <li key={r.id}><span className="week-when">{fmtDay(r.visitDate)}</span>
          <div><p><Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link>{r.revision > 1 && <span className="tag tag-draft">Rev {r.revision}</span>}</p><p className="week-meta">{r.author}{r.trade ? ` · ${r.trade}` : ''}</p></div></li>)}</ul>
          : <p className="week-none">No site reports were sent for visits this month.</p>}
      </>)}
      {list("raised", "Issues raised", total.raised, <><IssueRows rows={p.issuesRaised} empty="No issues raised this month." here={here} /></>)}
      {list("closed", "Issues checked and closed", total.closed, <><IssueRows rows={p.issuesClosed} empty="No issues closed this month." here={here} /></>)}
      {list("vraised", "Variations raised", total.vraised, <><VariationRows rows={p.variationsRaised} empty="No variations raised this month." here={here} /></>)}
      {list("vinstructed", "Variations instructed by the client", total.vinstructed, <><VariationRows rows={p.variationsInstructed} empty="No variations instructed this month." here={here} /></>)}
    </section>

    <footer className="week-foot">
      <p>Made from site reports sent to the office and the issue and variation registers. Reports are placed by their visit day; issues and variations by the day each change was recorded, counted as the Weekly summary counts them. A corrected report replaces the one it corrects. &ldquo;Still open&rdquo; and &ldquo;past target&rdquo; are as they stood {m.current ? `on ${fmtDay(today, true)}` : `at the end of ${fmtDay(m.end, true)}`}; fixed issues waiting to be checked are never counted as past target. Photographs are the newest progress photograph from each place. Health and safety records and prices are not shown.</p>
    </footer>
  </article>;
}
