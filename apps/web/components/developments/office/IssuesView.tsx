'use client';
import { useState } from 'react';
import type { Issue } from '@/lib/types';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Btn, BtnQ, ConfirmTag, WorkTag } from './bits';
import { daysLate, fmtDay, isActive, isDisputed, isNotReviewed, isOverdue, isUnassigned, isVerify, shortRef } from './model';
import { sortTableRows, type SortDirection } from '@/lib/tableSorting';

type Filter = 'open' | 'overdue' | 'verify' | 'unassigned' | 'notReviewed' | 'disputed' | 'closed';
type SortKey = 'reference' | 'issue' | 'project' | 'raised' | 'owner' | 'target' | 'work' | 'confirmation';
type SortState = { key: SortKey; direction: SortDirection } | null;
const FILTERS: [Filter, string, boolean][] = [['open', 'Open', false], ['overdue', 'Overdue', true], ['verify', 'To verify', false], ['unassigned', 'Unassigned', false], ['notReviewed', 'Not reviewed', false], ['disputed', 'Disputed', true], ['closed', 'Closed', false]];

function SortHead({ label, column, sort, change }: { label: string; column: SortKey; sort: SortState; change: (column: SortKey) => void }) {
  const active = sort?.key === column;
  return <th aria-sort={active ? sort.direction : 'none'}><button type="button" className={active ? 'sort-head on' : 'sort-head'} onClick={() => change(column)}>{label}<span aria-hidden="true">{active ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span></button></th>;
}

/** The issue register across projects. Actions live on each row; the sheet opens in its project. */
export function IssuesView({ ctx }: { ctx: Ctx }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const [owner, setOwner] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const snap = ctx.snap; const day = ctx.day;
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;
  const scoped = snap.issues.filter(i => (!project || i.projectId === project) && (!trade || i.affectedTrade === trade || (!i.affectedTrade && i.reporterTrade === trade)) && (!owner || i.owner === owner));
  const pick: Record<Filter, (i: Issue) => boolean> = { open: isActive, overdue: i => isOverdue(i, day), verify: isVerify, unassigned: isUnassigned, notReviewed: isNotReviewed, disputed: isDisputed, closed: i => !isActive(i) };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, scoped.filter(pick[k]).length])) as Record<Filter, number>;
  const rank = (i: Issue) => isOverdue(i, day) ? 0 : isDisputed(i) ? 1 : isVerify(i) ? 2 : isUnassigned(i) ? 3 : 4;
  const owners = [...new Set(snap.issues.map(i => i.owner.trim()).filter(Boolean))].sort();
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.id ?? '';
  const sortValue = (i: Issue, key: SortKey): string => ({ reference: i.reference, issue: i.description, project: name(i.projectId), raised: i.raisedAt, owner: i.owner.trim() || 'Unassigned', target: i.targetDate || '', work: i.work, confirmation: i.confirmation })[key];
  const filtered = scoped.filter(pick[filter]);
  const shown = sort
    ? sortTableRows(filtered, sort.direction, issue => sortValue(issue, sort.key), issue => issue.reference)
    : filtered.sort((a, b) => rank(a) - rank(b) || (a.targetDate || '9999').localeCompare(b.targetDate || '9999') || b.raisedAt.localeCompare(a.raisedAt));
  const changeSort = (key: SortKey) => setSort(current => current?.key === key ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  const source = (i: Issue) => { const r = i.raisedByReport ? snap.reports.find(x => x.id === i.raisedByReport) : undefined; return r ? shortRef(r.reference) : i.source === 'individual' ? 'Flagged on site' : '—'; };
  const closureMine = (i: Issue) => i.closureSubmittedById ? i.closureSubmittedById === ctx.me.id : i.closureSubmittedBy === ctx.me.name;
  return <div className="view">
    <div className="pagehead"><div><h3>Issues</h3><p>{counts.open} open across {ctx.projects.length} projects · {counts.overdue ? <span className="late">{counts.overdue} overdue</span> : 'none overdue'} · {counts.verify} awaiting verification · {counts.unassigned} unassigned · {counts.notReviewed} not reviewed · {counts.disputed} disputed</p></div>
      <div className="actions">{counts.verify > 0 && <Btn onClick={() => { const i = scoped.filter(isVerify).find(x => !closureMine(x)); if (i) ctx.setDialog({ kind: 'verify', issue: i }); }}>Verify the oldest</Btn>}</div></div>
    <div className="filters">
      {FILTERS.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <button type="button" className={`chip ${sort === null ? 'on' : ''}`} onClick={() => setSort(null)}>Sort: priority</button>
      <span className="spacer" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Owner <select value={owner} onChange={e => setOwner(e.target.value)}><option value="">Anyone</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}</select></label>
    </div>
    <div className="panel"><table className="reg"><thead><tr><SortHead label="Ref" column="reference" sort={sort} change={changeSort} /><SortHead label="Issue" column="issue" sort={sort} change={changeSort} /><SortHead label="Project" column="project" sort={sort} change={changeSort} /><SortHead label="Raised" column="raised" sort={sort} change={changeSort} /><SortHead label="Owner" column="owner" sort={sort} change={changeSort} /><SortHead label="Target" column="target" sort={sort} change={changeSort} /><SortHead label="Work" column="work" sort={sort} change={changeSort} /><SortHead label="Confirmation" column="confirmation" sort={sort} change={changeSort} /><th><span className="sr">Actions</span></th></tr></thead><tbody>
      {shown.length ? shown.map(i => { const late = isOverdue(i, day); const active = isActive(i); return <tr key={i.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(i.projectId)}/issue/${i.id}`)}>
        <td><span className="ref">{i.reference}</span></td>
        <td><div className="rowtitle" style={{ fontSize: 13 }}>{i.description}</div><div className="rowsub">{i.location || 'no location'} · {i.affectedTrade ?? (i.reporterTrade ? `reported by ${i.reporterTrade}` : 'trade not recorded')}</div></td>
        <td>{name(i.projectId)}</td>
        <td className="due">{fmtDay(i.raisedAt)}<div className="rowsub">{source(i)}</div></td>
        <td>{i.owner.trim() || <span className="late">Unassigned</span>}</td>
        <td className="due">{i.targetDate ? <><b className={late ? 'late' : ''}>{i.targetDate}</b>{late && ` · ${daysLate(i.targetDate, day)}d late`}</> : <span className="fine">—</span>}</td>
        <td><WorkTag i={i} day={day} /></td><td><ConfirmTag i={i} /></td>
        <td onClick={e => e.stopPropagation()}><div className="actions" style={{ flexWrap: 'nowrap' }}>
          {active && i.work === 'awaiting_verification' && !closureMine(i) && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'verify', issue: i })}>Verify</Btn>}
          {active && i.work === 'awaiting_verification' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Not finished</BtnQ>}
          {active && i.work !== 'awaiting_verification' && (i.owner.trim() ? <BtnQ className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Reassign</BtnQ> : <Btn className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Assign</Btn>)}
          {active && i.confirmation === 'disputed' && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'triage', issue: i })}>Triage</Btn>}
          {active && i.confirmation === 'provisional' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'confirm', issue: i })}>Confirm</BtnQ>}
          {!active && i.confirmation !== 'withdrawn' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Reopen</BtnQ>}
        </div></td></tr>; }) : <tr><td colSpan={9} className="empty">No {FILTERS.find(f => f[0] === filter)?.[1].toLowerCase()} issues{project || trade || owner ? ' in this scope' : ''}.</td></tr>}
    </tbody></table><div className="panel-foot">{sort ? `Sorted by ${sort.key}, ${sort.direction}.` : 'Priority order: overdue first, then disputed, ready to verify and unassigned; earliest targets come first.'} Work and confirmation are two columns because they are two facts: an issue can be repaired and still disputed. Verifying needs someone other than whoever submitted the closure, so that button is hidden for them. Owners are names or companies, not accounts.</div></div>
  </div>;
}
