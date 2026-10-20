'use client';
import { useEffect, useState } from 'react';
import type { Issue } from '@/lib/types';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Btn, BtnQ, ConfirmTag, WorkTag } from './bits';
import { daysLate, fmtDay, isActive, isOverdue, shortRef } from './model';
import type { SortDirection } from '@/lib/tableSorting';
import { issueRegister } from '@/lib/api';
import { VERIFICATION, VERIFICATION_LABEL, type IssuePage, type IssueSort, type IssueView, type Verification } from '@/lib/issueQuery';

type Filter = Exclude<IssueView, 'all'> | 'all';
type SortState = { key: IssueSort; direction: SortDirection } | null;
const FILTERS: [Filter, string, boolean][] = [['open', 'Open', false], ['overdue', 'Overdue', true], ['verify', 'To verify', false], ['unassigned', 'Unassigned', false], ['notReviewed', 'Not reviewed', false], ['disputed', 'Disputed', true], ['closed', 'Closed', false], ['all', 'All', false]];
const TRADES = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'];
const SORT_NAME: Record<IssueSort, string> = { reference: 'reference', issue: 'issue', project: 'project', raised: 'date raised', owner: 'owner', target: 'target date', work: 'work', confirmation: 'confirmation' };

function SortHead({ label, column, sort, change }: { label: string; column: IssueSort; sort: SortState; change: (column: IssueSort) => void }) {
  const active = sort?.key === column;
  return <th aria-sort={active ? sort.direction : 'none'}><button type="button" className={active ? 'sort-head on' : 'sort-head'} onClick={() => change(column)}>{label}<span aria-hidden="true">{active ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span></button></th>;
}

/** Typed text settles for a moment before it is sent, so each key press is not a request. */
function useSettled(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const t = setTimeout(() => setSettled(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return settled;
}

/**
 * The issue register across projects. Filtering, counting, ordering and paging
 * run on the server over the whole register this person may see (FE-5a), so
 * the list and its counts never stop at what one page holds. Actions live on
 * each row; the sheet opens in its project.
 */
export function IssuesView({ ctx }: { ctx: Ctx }) {
  // #/issues/show/<filter> opens on that filter, from the office position's groups.
  const linked = ctx.route.a === 'show' ? FILTERS.find(([k]) => k === ctx.route.b)?.[0] : undefined;
  const [chosen, setFilter] = useState<Filter>(linked ?? 'open');
  // The tab itself (no record or filter in the route) starts again from open.
  const bare = !ctx.route.a;
  useEffect(() => { if (linked) setFilter(linked); else if (bare) setFilter('open'); }, [linked, bare]);
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const [locationText, setLocationText] = useState('');
  const [companyText, setCompanyText] = useState('');
  const [verification, setVerification] = useState<Verification | ''>('');
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<IssuePage | null>(null);
  const [failed, setFailed] = useState('');
  const location = useSettled(locationText.trim());
  const company = useSettled(companyText.trim());
  // "Not reviewed" counts issues waiting on report review, so it only shows where review is used, for the project in view.
  const reviewOn = project ? !!ctx.statOf(project)?.reviewOn : ctx.reviewOn;
  const filters = reviewOn ? FILTERS : FILTERS.filter(([k]) => k !== 'notReviewed');
  // A chosen filter that is no longer offered falls back to open, rather than an empty list with nothing selected.
  const filter = filters.some(([k]) => k === chosen) ? chosen : 'open';
  // Any change of filter or order starts again from the first page.
  const scope = JSON.stringify([filter, project, trade, location, company, verification, sort]);
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) { setSeenScope(scope); setPage(1); }
  // Fetch again whenever the office records reload, so an action taken in a dialog shows here.
  const loadedAt = ctx.snap?.loadedAt;
  useEffect(() => {
    let stopped = false;
    issueRegister({ view: filter, projectId: project, trade, location, company, verification: verification || undefined, sort: sort ?? undefined, page })
      .then(r => { if (!stopped) { setResult(r); setFailed(''); if (r.page !== page) setPage(r.page); } })
      .catch(e => { if (!stopped) setFailed(e instanceof Error ? e.message : 'The issue register could not be loaded.'); });
    return () => { stopped = true; };
  }, [filter, project, trade, location, company, verification, sort, page, loadedAt]);
  const snap = ctx.snap; const day = ctx.day;
  if (!result) return <div className="view">{failed ? <div className="note bad" role="alert"><span>{failed}</span></div> : <div className="loading">Loading the issue register</div>}</div>;
  const counts = result.counts;
  const shown = result.issues;
  const changeSort = (key: IssueSort) => setSort(current => current?.key === key ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.id ?? '';
  const source = (i: Issue) => { const r = i.raisedByReport ? snap?.reports.find(x => x.id === i.raisedByReport) : undefined; return r ? shortRef(r.reference) : i.source === 'individual' ? 'Flagged on site' : '—'; };
  // The snag list takes one company, so it is passed on only when the text names one (ignoring case and spacing).
  const same = (a: string) => a.trim().replace(/\s+/g, ' ').toLowerCase();
  const owner = company ? result.owners.find(o => same(o) === same(company)) : undefined;
  // The snag list opens on the project, company and trade chosen here, and comes back to this register.
  const snagHref = `/issues/snag-list?${new URLSearchParams({ ...(project ? { project } : {}), ...(owner ? { owner } : {}), ...(trade ? { trade } : {}), returnTo: '/office#/issues' })}`;
  const closureMine = (i: Issue) => i.closureSubmittedById ? i.closureSubmittedById === ctx.me.id : i.closureSubmittedBy === ctx.me.name;
  // Within this search, so the button never opens an issue the register is not showing.
  const oldestToVerify = result.oldestToVerify;
  const narrowed = !!(project || trade || location || company || verification);
  const first = (result.page - 1) * result.pageSize + 1, last = first + shown.length - 1;
  const clear = () => { setProject(''); setTrade(''); setLocationText(''); setCompanyText(''); setVerification(''); };
  return <div className="view">
    <div className="pagehead"><div><h3>Issues</h3><p>{counts.open} open{narrowed ? ' in this search' : ` across ${ctx.projects.length} projects`} · {counts.overdue ? <span className="late">{counts.overdue} overdue</span> : 'none overdue'} · {counts.verify} awaiting verification · {counts.unassigned} unassigned · {reviewOn && <>{counts.notReviewed} not reviewed · </>}{counts.disputed} disputed</p></div>
      <div className="actions"><a className="btn btn-q" href={`/companies?${new URLSearchParams({ returnTo: '/office#/issues' })}`}>By company</a><a className="btn btn-q" href={snagHref}>Snag list</a>{oldestToVerify && <Btn onClick={() => ctx.setDialog({ kind: 'verify', issue: oldestToVerify })}>Verify the oldest</Btn>}</div></div>
    <div className="filters">
      {filters.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <button type="button" className={`chip ${sort === null ? 'on' : ''}`} aria-pressed={sort === null} onClick={() => setSort(null)}>Sort: priority</button>
    </div>
    <div className="filters issue-search" role="search" aria-label="Filter the issue register">
      <label>Location <input type="search" value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="e.g. riser 2" /></label>
      <label>Company <input type="search" value={companyText} onChange={e => setCompanyText(e.target.value)} placeholder="Who has to respond" list="issue-owners" /></label>
      <datalist id="issue-owners">{result.owners.map(o => <option key={o} value={o} />)}</datalist>
      <label>Verification <select value={verification} onChange={e => setVerification(e.target.value as Verification | '')}><option value="">Any</option>{VERIFICATION.map(v => <option key={v} value={v}>{VERIFICATION_LABEL[v]}</option>)}</select></label>
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      {narrowed && <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button>}
    </div>
    {failed && <div className="note bad" role="alert"><span>{failed} Showing the last results.</span></div>}
    <div className="panel"><table className="reg"><thead><tr><SortHead label="Ref" column="reference" sort={sort} change={changeSort} /><SortHead label="Issue" column="issue" sort={sort} change={changeSort} /><SortHead label="Project" column="project" sort={sort} change={changeSort} /><SortHead label="Raised" column="raised" sort={sort} change={changeSort} /><SortHead label="Owner" column="owner" sort={sort} change={changeSort} /><SortHead label="Target" column="target" sort={sort} change={changeSort} /><SortHead label="Work" column="work" sort={sort} change={changeSort} /><SortHead label="Confirmation" column="confirmation" sort={sort} change={changeSort} /><th><span className="sr">Actions</span></th></tr></thead><tbody>
      {shown.length ? shown.map(i => { const late = isOverdue(i, day); const active = isActive(i); return <tr key={i.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(i.projectId)}/issue/${i.id}`)}>
        <td><span className="ref">{i.reference}</span></td>
        <td><div className="rowtitle" style={{ fontSize: 13 }}>{i.description}</div><div className="rowsub">{i.location || 'no location'} · {i.affectedTrade ?? (i.reporterTrade ? `reported by ${i.reporterTrade}` : 'trade not recorded')}</div></td>
        <td>{name(i.projectId)}</td>
        <td className="due">{fmtDay(i.raisedAt)}<div className="rowsub">{source(i)}</div></td>
        <td>{i.owner.trim() || <span className="late">Unassigned</span>}</td>
        <td className="due">{i.targetDate ? <><b className={late ? 'late' : ''}>{i.targetDate}</b>{late && ` · ${daysLate(i.targetDate, day)}d late`}</> : <span className="fine">—</span>}</td>
        <td><WorkTag i={i} day={day} /></td><td><ConfirmTag i={i} reviewOn={!!ctx.statOf(i.projectId)?.reviewOn} /></td>
        <td onClick={e => e.stopPropagation()}><div className="actions" style={{ flexWrap: 'nowrap' }}>
          {active && i.work === 'awaiting_verification' && !closureMine(i) && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'verify', issue: i })}>Verify</Btn>}
          {active && i.work === 'awaiting_verification' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Not finished</BtnQ>}
          {active && i.work !== 'awaiting_verification' && (i.owner.trim() ? <BtnQ className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Reassign</BtnQ> : <Btn className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Assign</Btn>)}
          {active && i.confirmation === 'disputed' && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'triage', issue: i })}>Triage</Btn>}
          {active && i.confirmation === 'provisional' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'confirm', issue: i })}>Confirm</BtnQ>}
          {!active && i.confirmation !== 'withdrawn' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Reopen</BtnQ>}
        </div></td></tr>; }) : <tr><td colSpan={9} className="empty">{filter === 'all' ? 'No issues' : `No ${FILTERS.find(f => f[0] === filter)?.[1].toLowerCase()} issues`}{narrowed ? ' match these filters' : ''}.{narrowed && <> <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button></>}</td></tr>}
    </tbody></table>
    {result.total > 0 && <nav className="pager" aria-label="Pages of the issue register">
      <span>Showing {first}–{last} of {result.total}</span>
      {result.pages > 1 && <><BtnQ className="btn-sm" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>← Previous</BtnQ>
      <span>Page {result.page} of {result.pages}</span>
      <BtnQ className="btn-sm" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)}>Next →</BtnQ></>}
    </nav>}
    <div className="panel-foot">{sort ? `Sorted by ${SORT_NAME[sort.key]}, ${sort.direction}.` : 'Priority order: overdue first, then disputed, ready to verify and unassigned; earliest targets come first.'} Work and confirmation are two columns because they are two facts: an issue can be repaired and still disputed. Verifying needs someone other than whoever submitted the closure, so that button is hidden for them. Owners are names or companies, not accounts.</div></div>
  </div>;
}
