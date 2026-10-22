'use client';
import { useEffect, useState } from 'react';
import type { Issue } from '@/lib/types';
import { byPutForward } from '@/lib/checkFix';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Btn, BtnQ, ConfirmTag, SortHead, WorkTag } from './bits';
import { daysLate, fmtDay, isActive, isOverdue, shortRef } from './model';
import { pastTarget } from '@/lib/dates';
import type { SortDirection } from '@/lib/tableSorting';
import { issueRegister } from '@/lib/api';
import { MAX_PAGE_SIZE, VERIFICATION, VERIFICATION_LABEL, issueQueryParams, type IssuePage, type IssueSort, type IssueView, type Verification } from '@/lib/issueQuery';
import { DownloadLink } from '@/components/DownloadLink';

type Filter = Exclude<IssueView, 'all'> | 'all';
type SortState = { key: IssueSort; direction: SortDirection } | null;
const FILTERS: [Filter, string, boolean][] = [['open', 'Open', false], ['overdue', 'Overdue', true], ['verify', 'Fixed, to check', false], ['unassigned', 'Unassigned', false], ['notReviewed', 'Not reviewed', false], ['disputed', 'Disputed', true], ['closed', 'Closed', false], ['all', 'All', false]];
// What an empty list means, in words, for each filter.
/** Before anything has been raised: where issues come from. */
const FIRST = 'No issues have been raised yet. Defect and access cards in site updates, defects flagged on their own and actions on handover and first fix inspections arrive here as issues.';
const EMPTY: Record<Filter, string> = { open: 'No open issues', overdue: 'Nothing is past its target date', verify: 'Nothing is waiting to be checked', unassigned: 'Every open issue has an owner', notReviewed: 'Every issue has been reviewed', disputed: 'No issue is disputed', closed: 'No issues have been closed', all: 'No issues have been raised' };
const TRADES = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'];
const SORT_NAME: Record<IssueSort, string> = { reference: 'reference', issue: 'issue', project: 'project', raised: 'date raised', owner: 'owner', target: 'target date', work: 'work', confirmation: 'confirmation' };
// On a phone the column headings are hidden, so the orders people use most are offered as one list.
const PHONE_ORDERS: [string, string][] = [['', 'Priority'], ['target:ascending', 'Target date, earliest first'], ['raised:descending', 'Raised, newest first'], ['raised:ascending', 'Raised, oldest first'], ['owner:ascending', 'Owner, A to Z'], ['project:ascending', 'Project, A to Z'], ['reference:ascending', 'Reference']];

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
  // #/issues/show/<filter>/<project> also narrows it to one project, from a project's own counts; without one it is every project.
  const linkedProject = linked && ctx.route.c && ctx.projects.some(p => p.id === ctx.route.c) ? ctx.route.c : '';
  const [project, setProject] = useState(linkedProject);
  useEffect(() => { if (linked) { setFilter(linked); setProject(linkedProject); } else if (bare) { setFilter('open'); setProject(''); } }, [linked, linkedProject, bare]);
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
  const orderValue = sort ? `${sort.key}:${sort.direction}` : '';
  const changeSort = (key: IssueSort) => setSort(current => current?.key === key ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.id ?? '';
  const source = (i: Issue) => { const r = i.raisedByReport ? snap?.reports.find(x => x.id === i.raisedByReport) : undefined; return r ? shortRef(r.reference) : i.source === 'individual' ? 'Flagged on site' : ''; };
  // The snag list takes one company, so it is passed on only when the text names one (ignoring case and spacing).
  const same = (a: string) => a.trim().replace(/\s+/g, ' ').toLowerCase();
  const owner = company ? result.owners.find(o => same(o) === same(company)) : undefined;
  // The snag list opens on the project, company and trade chosen here, and comes back to this register.
  const snagHref = `/issues/snag-list?${new URLSearchParams({ ...(project ? { project } : {}), ...(owner ? { owner } : {}), ...(trade ? { trade } : {}), returnTo: '/office#/issues' })}`;
  const closureMine = (i: Issue) => i.closureSubmittedById ? i.closureSubmittedById === ctx.me.id : i.closureSubmittedBy === ctx.me.name;
  // Within this search, so the button never opens an issue the register is not showing.
  const oldestToVerify = result.oldestToVerify;
  // Checking goes on through this search's fixes, every page of it, in the order on screen.
  const searched = async (view: Filter): Promise<Issue[]> => {
    const out: Issue[] = [];
    for (let n = 1; ; n++) {
      const r = await issueRegister({ view, projectId: project, trade, location, company, verification: verification || undefined, sort: sort ?? undefined, page: n, pageSize: MAX_PAGE_SIZE });
      out.push(...r.issues); if (n >= r.pages) return out;
    }
  };
  const fixesHere = () => searched(filter);
  // "Verify the oldest" goes on longest waiting first, by the register's own rule (lib/checkFix.ts), leaving out the person's own closures.
  const oldestFirst = async () => (await searched('verify')).filter(i => !closureMine(i)).sort(byPutForward);
  const narrowed = !!(project || trade || location || company || verification);
  const first = (result.page - 1) * result.pageSize + 1, last = first + shown.length - 1;
  // The file holds this search, every page of it, in the order on screen.
  const downloadHref = `/api/issues/export?${issueQueryParams({ view: filter, projectId: project, trade, location, company, verification: verification || undefined, sort: sort ?? undefined })}`;
  const clear = () => { setProject(''); setTrade(''); setLocationText(''); setCompanyText(''); setVerification(''); };
  return <div className="view issues-view">
    <div className="pagehead"><div><h2>Issues</h2><p>{counts.open} open{narrowed ? ' in this search' : ` across ${ctx.projects.length} projects`} · {counts.overdue ? <span className="late">{counts.overdue} overdue</span> : 'none overdue'} · {counts.verify} fixed, to check · {counts.unassigned} unassigned · {reviewOn && <>{counts.notReviewed} not reviewed · </>}{counts.disputed} disputed</p></div>
      <div className="actions"><a className="btn btn-q" href={`/companies?${new URLSearchParams({ returnTo: '/office#/issues' })}`}>Issues by company</a><a className="btn btn-q" href={snagHref}>Snag list</a>{result.total > 0 && <DownloadLink className="btn btn-q" href={downloadHref} what="spreadsheet" aria-label={`Download ${result.total} ${result.total === 1 ? 'issue' : 'issues'} as a spreadsheet (CSV)`}>Download spreadsheet</DownloadLink>}{oldestToVerify && <Btn onClick={() => ctx.setDialog({ kind: 'verify', issue: oldestToVerify, list: oldestFirst })}>Verify the oldest</Btn>}</div></div>
    <div className="filters">
      {filters.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <button type="button" className={`chip sort-chip ${sort === null ? 'on' : ''}`} aria-pressed={sort === null} onClick={() => setSort(null)}>Sort: priority</button>
      <label className="phone-sort">Order <select value={orderValue} onChange={e => { const [key, direction] = e.target.value.split(':'); setSort(key ? { key: key as IssueSort, direction: direction as SortDirection } : null); }}>
        {PHONE_ORDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        {!PHONE_ORDERS.some(([v]) => v === orderValue) && sort && <option value={orderValue}>{`${SORT_NAME[sort.key][0].toUpperCase()}${SORT_NAME[sort.key].slice(1)}, ${sort.direction}`}</option>}
      </select></label>
    </div>
    <div className="filters issue-search" role="search" aria-label="Filter the issue register">
      {/* Project and trade first, as on every register; then what only issues have. */}
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Location <input type="search" value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="e.g. riser 2" /></label>
      <label>Company <input type="search" value={companyText} onChange={e => setCompanyText(e.target.value)} placeholder="Who has to respond" list="issue-owners" /></label>
      <datalist id="issue-owners">{result.owners.map(o => <option key={o} value={o} />)}</datalist>
      <label>Verification <select value={verification} onChange={e => setVerification(e.target.value as Verification | '')}><option value="">Any</option>{VERIFICATION.map(v => <option key={v} value={v}>{VERIFICATION_LABEL[v]}</option>)}</select></label>
      {narrowed && <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button>}
    </div>
    {failed && <div className="note bad" role="alert"><span>{failed} Showing the last results.</span></div>}
    <div className="panel"><table className="reg cards issue-reg"><thead><tr><SortHead label="Ref" column="reference" sort={sort} change={changeSort} /><SortHead label="Issue" column="issue" sort={sort} change={changeSort} /><SortHead label="Project" column="project" sort={sort} change={changeSort} className="c-project" /><SortHead label="Raised" column="raised" sort={sort} change={changeSort} /><SortHead label="Owner" column="owner" sort={sort} change={changeSort} /><SortHead label="Target" column="target" sort={sort} change={changeSort} /><SortHead label="Work" column="work" sort={sort} change={changeSort} /><SortHead label="Confirmation" column="confirmation" sort={sort} change={changeSort} /><th><span className="sr">Actions</span></th></tr></thead><tbody>
      {shown.length ? shown.map(i => { const late = isOverdue(i, day); const active = isActive(i); return <tr key={i.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(i.projectId)}/issue/${i.id}`)}>
        <td className="c-ref"><span className="ref">{i.reference}</span><div className="rowsub ref-project">{name(i.projectId)}</div></td>
        <td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{i.description}</div><div className="rowsub">{i.location || 'no location'} · {i.affectedTrade ?? (i.reporterTrade ? `reported by ${i.reporterTrade}` : 'trade not recorded')}</div></td>
        <td className="c-project" data-label="Project">{name(i.projectId)}</td>
        <td className="due" data-label="Raised">{fmtDay(i.raisedAt)}{source(i) && <div className="rowsub">{source(i)}</div>}</td>
        <td data-label="Owner">{i.owner.trim() || <span className="late">Unassigned</span>}</td>
        <td className="due" data-label="Target">{i.targetDate ? <><b className={late ? 'late' : ''}>{fmtDay(i.targetDate)}</b>{late && <span className="late-days" style={{ whiteSpace: 'normal' }}><span className="sep"> · </span>{pastTarget(daysLate(i.targetDate, day))}</span>}</> : <span className="fine">—</span>}</td>
        <td data-label="Work"><WorkTag i={i} day={day} /></td><td data-label="Confirmation"><ConfirmTag i={i} reviewOn={!!ctx.statOf(i.projectId)?.reviewOn} /></td>
        <td className="c-actions" onClick={e => e.stopPropagation()}><div className="actions">
          {active && i.work === 'awaiting_verification' && !closureMine(i) && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'verify', issue: i, list: fixesHere })}>Verify</Btn>}
          {active && i.work === 'awaiting_verification' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue: i, list: fixesHere })}>Not finished</BtnQ>}
          {active && i.work !== 'awaiting_verification' && (i.owner.trim() ? <BtnQ className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Reassign</BtnQ> : <Btn className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Assign</Btn>)}
          {active && i.confirmation === 'disputed' && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'triage', issue: i })}>Triage</Btn>}
          {active && i.confirmation === 'provisional' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'confirm', issue: i })}>Confirm</BtnQ>}
          {!active && i.confirmation !== 'withdrawn' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Reopen</BtnQ>}
        </div></td></tr>; }) : <tr><td colSpan={9} className="empty">{counts.all === 0 && !narrowed ? FIRST : <>{EMPTY[filter]}{narrowed ? ' for these filters' : ''}.</>}{narrowed && <> <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button></>}</td></tr>}
    </tbody></table>
    {result.total > 0 && <nav className="pager" aria-label="Pages of the issue register">
      <span>Showing {first}–{last} of {result.total}</span>
      {result.pages > 1 && <><BtnQ className="btn-sm" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>← Previous</BtnQ>
      <span>Page {result.page} of {result.pages}</span>
      <BtnQ className="btn-sm" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)}>Next →</BtnQ></>}
    </nav>}
    <div className="panel-foot">{sort ? `Sorted by ${SORT_NAME[sort.key]}, ${sort.direction}.` : 'Priority order: overdue first, then disputed, fixed and waiting to be checked, and unassigned; earliest targets come first.'} Work and confirmation are two columns because they are two facts: an issue can be repaired and still disputed. Verifying needs someone other than whoever submitted the closure, so that button is hidden for them. Owners are names or companies, not accounts. Download spreadsheet saves every issue in this search, on all pages, as a CSV file that opens in Excel.</div></div>
  </div>;
}
