'use client';
import { useEffect, useState } from 'react';
import type { Variation } from '@/lib/types';
import { VARIATION_REASONS, VARIATION_TRADES, estimatedMargin, fmtMoney, fmtPct, isCharged, marginPct, variationValue } from '@/lib/variations';
import type { Ctx } from './ctx';
import { registerFileName, toCsv, variationRows } from '@/lib/registerExport';
import { Btn, BtnQ, InstructionTag, Money, SortHead } from './bits';
import type { SortDirection } from '@/lib/tableSorting';
import { byRaised, fmtDay, isExposed, isPending, isUnpriced, shortRef } from './model';

type Filter = 'pending' | 'unpriced' | 'exposed' | 'instructed' | 'declined' | 'within' | 'all';
const FILTERS: [Filter, string, boolean][] = [['pending', 'Awaiting instruction', false], ['unpriced', 'Needs a quote', false], ['exposed', 'Done, not instructed', true], ['instructed', 'Instructed', false], ['declined', 'Declined', false], ['within', 'Within contract', false], ['all', 'All', false]];

// What an empty list means, in words, for each filter.
/** Before anything has been raised: where variations come from. */
const FIRST = 'No variations have been raised yet. Variation cards in site updates arrive here for you to price and put to the client.';
const EMPTY: Record<Filter, string> = { pending: 'Nothing is awaiting instruction', unpriced: 'Every variation awaiting instruction has a quote', exposed: 'No work has been done without an instruction', instructed: 'No variations have been instructed', declined: 'No variations have been declined', within: 'No variations have been marked within contract', all: 'No variations have been raised' };

// Ordered by a column, as Issues are: the same headings to press on a desk and the same Order list on a phone.
type VariationSort = 'reference' | 'variation' | 'project' | 'raised' | 'instruction' | 'quoted' | 'instructed' | 'margin';
type SortState = { key: VariationSort; direction: SortDirection } | null;
const SORT_NAME: Record<VariationSort, string> = { reference: 'reference', variation: 'variation', project: 'project', raised: 'date raised', instruction: 'instruction', quoted: 'quoted value', instructed: 'instructed value', margin: 'margin' };
const PHONE_ORDERS: [string, string][] = [['', 'Priority'], ['raised:descending', 'Raised, newest first'], ['raised:ascending', 'Raised, oldest first'], ['quoted:descending', 'Quoted, highest first'], ['margin:ascending', 'Margin, lowest first'], ['project:ascending', 'Project, A to Z'], ['reference:ascending', 'Reference']];
const NATURAL = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });
/** Rows in the chosen order, blanks last either way, ties by reference; money compared as numbers. */
function sortVariations(rows: Variation[], sort: NonNullable<SortState>, value: (v: Variation) => string | number | undefined): Variation[] {
  return rows.sort((a, b) => {
    const x = value(a), y = value(b);
    if (x === undefined || x === '' || y === undefined || y === '') {
      const blankA = x === undefined || x === '', blankB = y === undefined || y === '';
      return blankA && blankB ? NATURAL.compare(a.reference, b.reference) : blankA ? 1 : -1;
    }
    const compared = (typeof x === 'number' && typeof y === 'number' ? x - y : NATURAL.compare(String(x), String(y))) || NATURAL.compare(a.reference, b.reference);
    return sort.direction === 'ascending' ? compared : -compared;
  });
}

/**
 * The variation register across projects: the same rows as the Variation
 * Register list on SharePoint, with the office's verbs on each. A variation
 * is priced, then instructed or declined; the money columns are the list's
 * calculated columns worked the same way, so the two never disagree.
 */
export function VariationsView({ ctx }: { ctx: Ctx }) {
  // #/variations/show/<filter> opens on that filter; the tab itself starts again from awaiting instruction, as Inbox and Issues do.
  const linked = ctx.route.a === 'show' ? FILTERS.find(([k]) => k === ctx.route.b)?.[0] : undefined;
  const [filter, setFilter] = useState<Filter>(linked ?? 'pending');
  const bare = !ctx.route.a;
  // #/variations/show/<filter>/<project> also narrows it to one project, from a project's own counts; without one it is every project.
  const linkedProject = linked && ctx.route.c && ctx.projects.some(p => p.id === ctx.route.c) ? ctx.route.c : '';
  const [project, setProject] = useState(linkedProject);
  useEffect(() => { if (linked) { setFilter(linked); setProject(linkedProject); } else if (bare) { setFilter('pending'); setProject(''); } }, [linked, linkedProject, bare]);
  const [trade, setTrade] = useState('');
  const [reason, setReason] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const snap = ctx.snap;
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;
  const scoped = snap.variations.filter(v => (!project || v.projectId === project) && (!trade || v.trade === trade) && (!reason || v.reason === reason));
  const pick: Record<Filter, (v: Variation) => boolean> = { pending: isPending, unpriced: isUnpriced, exposed: isExposed, instructed: v => v.instruction === 'instructed', declined: v => v.instruction === 'declined', within: v => v.instruction === 'within_contract', all: () => true };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, scoped.filter(pick[k]).length])) as Record<Filter, number>;
  const rank = (v: Variation) => isExposed(v) ? 0 : isUnpriced(v) ? 1 : isPending(v) ? 2 : v.instruction === 'instructed' ? 3 : 4;
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const sortValue: Record<VariationSort, (v: Variation) => string | number | undefined> = {
    reference: v => v.reference, variation: v => v.description, project: v => name(v.projectId), raised: v => v.raisedAt, instruction: v => rank(v),
    quoted: v => v.quotedValue, instructed: v => v.instruction === 'instructed' ? variationValue(v) : undefined, margin: v => isCharged(v) ? estimatedMargin(v) : undefined,
  };
  const filtered = scoped.filter(pick[filter]);
  const shown = sort ? sortVariations(filtered, sort, sortValue[sort.key]) : filtered.sort((a, b) => rank(a) - rank(b) || byRaised(a, b));
  const orderValue = sort ? `${sort.key}:${sort.direction}` : '';
  const changeSort = (key: VariationSort) => setSort(current => current?.key === key ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: 'ascending' });
  // The desk routes by project id, as every other register does.
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.id ?? '';
  const source = (v: Variation) => { const r = v.raisedByReport ? snap.reports.find(x => x.id === v.raisedByReport) : undefined; return r ? shortRef(r.reference) : v.source === 'office' ? 'Raised in the office' : '—'; };
  const narrowed = !!(project || trade || reason);
  const clear = () => { setProject(''); setTrade(''); setReason(''); };
  const sum = (pick: (v: Variation) => number | undefined) => shown.reduce((n, v) => n + (pick(v) ?? 0), 0);
  const instructedTotal = scoped.filter(v => v.instruction === 'instructed').reduce((n, v) => n + (variationValue(v) ?? 0), 0);
  // The rows on screen, in their order, as a file. Built here because the office already holds every variation it may see.
  const download = () => {
    const p = project ? ctx.projects.find(x => x.id === project) : undefined;
    const csv = toCsv(variationRows(shown, { day: ctx.day, project: id => ctx.projects.find(x => x.id === id), reportReference: id => snap.reports.find(r => r.id === id)?.reference }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = registerFileName('variations', ctx.day, p?.projectNumber);
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const d = (kind: 'variation-price' | 'variation-instruct' | 'variation-decline' | 'variation-reopen' | 'variation-details', variation: Variation) => ctx.setDialog({ kind, variation });
  return <div className="view">
    <div className="pagehead"><div><h2>Variations</h2><p>{counts.pending} awaiting instruction{narrowed ? ' in this search' : ` across ${ctx.projects.length} projects`} · {counts.unpriced ? `${counts.unpriced} without a quote` : 'all priced'} · {counts.exposed ? <span className="late">{counts.exposed} done without an instruction</span> : 'nothing done uninstructed'} · {counts.instructed ? `${counts.instructed} instructed worth ${fmtMoney(instructedTotal)}` : '0 instructed'} · {counts.declined} declined{counts.within ? ` · ${counts.within} within contract` : ''}</p></div>
      <div className="actions"><BtnQ onClick={() => ctx.setDialog({ kind: 'variation-new', projects: ctx.projects, ...(project ? { projectId: project } : {}), opened: v => ctx.go(`#/projects/${v.projectId}/variation/${v.id}`) })}>Add variation</BtnQ>{shown.length > 0 && <BtnQ onClick={download} aria-label={`Download ${shown.length} ${shown.length === 1 ? 'variation' : 'variations'} as a spreadsheet (CSV)`}>Download spreadsheet</BtnQ>}{counts.unpriced > 0 && <Btn onClick={() => { const v = shown.find(isUnpriced) ?? scoped.find(isUnpriced); if (v) d('variation-price', v); }}>Price the oldest</Btn>}</div></div>
    <div className="filters">
      {FILTERS.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <button type="button" className={`chip sort-chip ${sort === null ? 'on' : ''}`} aria-pressed={sort === null} onClick={() => setSort(null)}>Sort: priority</button>
      <label className="phone-sort">Order <select value={orderValue} onChange={e => { const [key, direction] = e.target.value.split(':'); setSort(key ? { key: key as VariationSort, direction: direction as SortDirection } : null); }}>
        {PHONE_ORDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        {!PHONE_ORDERS.some(([v]) => v === orderValue) && sort && <option value={orderValue}>{`${SORT_NAME[sort.key][0]!.toUpperCase()}${SORT_NAME[sort.key].slice(1)}, ${sort.direction}`}</option>}
      </select></label>
    </div>
    <div className="filters" role="search" aria-label="Filter the variation register">
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{VARIATION_TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Reason <select value={reason} onChange={e => setReason(e.target.value)}><option value="">Any reason</option>{VARIATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      {narrowed && <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button>}
    </div>
    <div className="panel"><table className="reg cards"><thead><tr><SortHead label="Ref" column="reference" sort={sort} change={changeSort} /><SortHead label="Variation" column="variation" sort={sort} change={changeSort} /><SortHead label="Project" column="project" sort={sort} change={changeSort} /><SortHead label="Raised" column="raised" sort={sort} change={changeSort} /><SortHead label="Instruction" column="instruction" sort={sort} change={changeSort} /><SortHead className="money" label="Quoted" column="quoted" sort={sort} change={changeSort} /><SortHead className="money" label="Instructed" column="instructed" sort={sort} change={changeSort} /><SortHead className="money" label="Margin" column="margin" sort={sort} change={changeSort} /><th><span className="sr">Action</span></th></tr></thead><tbody>
      {shown.length ? shown.map(v => { const margin = estimatedMargin(v); const pct = isCharged(v) ? marginPct(v) : undefined; return <tr key={v.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(v.projectId)}/variation/${v.id}`)}>
        <td className="c-ref"><span className="ref">{v.reference}</span></td>
        <td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{v.description}</div><div className="rowsub">{v.location || 'no location'} · {v.trade ?? 'trade not set'} · {v.reason ?? 'reason not set'}{v.workDone && <> · <span className="late">work already done</span></>}</div></td>
        <td data-label="Project">{name(v.projectId)}</td>
        <td className="due" data-label="Raised">{fmtDay(v.raisedAt)}<div className="rowsub">{source(v)} · {ctx.nameOf(v.raisedById, v.raisedBy)}</div></td>
        <td data-label="Instruction"><InstructionTag v={v} />{v.instruction === 'instructed' && <div className="rowsub">{v.instructionReference} · {v.instructedBy} · {v.instructedOn}</div>}{v.instruction === 'declined' && <div className="rowsub">{v.events.slice().reverse().find(e => e.kind === 'declined')?.note}</div>}{v.instruction === 'within_contract' && <div className="rowsub">Not charged{v.events.slice().reverse().find(e => e.kind === 'within_contract')?.note ? ` · ${v.events.slice().reverse().find(e => e.kind === 'within_contract')?.note}` : ''}</div>}</td>
        <td className="money" data-label="Quoted"><Money n={v.quotedValue} /></td>
        <td className="money" data-label="Instructed"><Money n={v.instruction === 'instructed' ? variationValue(v) : undefined} /></td>
        <td className="money" data-label="Margin">{!isCharged(v) ? <span className="fine">—</span> : <><Money n={margin} className={margin !== undefined && margin < 0 ? 'late' : ''} />{pct !== undefined && <div className="rowsub num">{fmtPct(pct)}</div>}</>}</td>
        <td className="c-actions" onClick={e => e.stopPropagation()}><div className="actions">
          {v.instruction === 'pending' && (v.quotedValue === undefined ? <Btn className="btn-sm" onClick={() => d('variation-price', v)}>Price</Btn> : <BtnQ className="btn-sm" onClick={() => d('variation-price', v)}>Reprice</BtnQ>)}
          {v.instruction === 'pending' && (v.quotedValue === undefined ? <BtnQ className="btn-sm" onClick={() => d('variation-instruct', v)}>Instruct</BtnQ> : <Btn className="btn-sm" onClick={() => d('variation-instruct', v)}>Instruct</Btn>)}
          {v.instruction === 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-decline', v)}>Decline</BtnQ>}
          {v.instruction !== 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-reopen', v)}>Reopen</BtnQ>}
        </div></td></tr>; }) : <tr><td colSpan={9} className="empty">{snap.variations.length === 0 && !narrowed ? FIRST : <>{EMPTY[filter]}{narrowed ? ' for these filters' : ''}.</>}{narrowed && <> <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button></>}</td></tr>}
    </tbody>{shown.length > 1 && <tfoot><tr><td colSpan={5} className="c-title">{shown.length} shown</td><td className="money" data-label="Quoted"><Money n={sum(v => v.instruction === 'within_contract' ? undefined : v.quotedValue)} /></td><td className="money" data-label="Instructed"><Money n={sum(v => v.instruction === 'instructed' ? variationValue(v) : undefined)} /></td><td className="money" data-label="Margin"><Money n={sum(v => isCharged(v) ? estimatedMargin(v) : undefined)} /></td><td /></tr></tfoot>}</table>
      <div className="panel-foot">{sort ? `Sorted by ${SORT_NAME[sort.key]}, ${sort.direction}.` : 'Priority order: done without an instruction first, then needing a quote, awaiting instruction, instructed and declined; newest first within each.'} Quoted is what was put to the client; instructed is what they agreed, and it fixes the value from then on. Margin is the value less expected cost (labour × rate, parts, plant and subcontract), so it is an estimate until the job is costed. “Done, not instructed” is work carried out on a say-so with nothing in writing; get the client’s sign-off recorded before it is invoiced. Download spreadsheet saves the variations shown here, in this order, with their figures, as a CSV file that opens in Excel.</div></div>
  </div>;
}
