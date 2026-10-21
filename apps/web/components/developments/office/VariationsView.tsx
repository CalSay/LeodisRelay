'use client';
import { useEffect, useState } from 'react';
import type { Variation } from '@/lib/types';
import { VARIATION_REASONS, VARIATION_TRADES, estimatedMargin, fmtMoney, fmtPct, marginPct, variationValue } from '@/lib/variations';
import type { Ctx } from './ctx';
import { exportFileName, toCsv, variationRows } from '@/lib/registerExport';
import { Btn, BtnQ, InstructionTag, Money } from './bits';
import { byRaised, fmtDay, isExposed, isPending, isUnpriced, shortRef } from './model';

type Filter = 'pending' | 'unpriced' | 'exposed' | 'instructed' | 'declined' | 'all';
const FILTERS: [Filter, string, boolean][] = [['pending', 'Awaiting instruction', false], ['unpriced', 'Needs a quote', false], ['exposed', 'Done, not instructed', true], ['instructed', 'Instructed', false], ['declined', 'Declined', false], ['all', 'All', false]];

// What an empty list means, in words, for each filter.
/** Before anything has been raised: where variations come from. */
const FIRST = 'No variations have been raised yet. Variation cards in site updates arrive here for you to price and put to the client.';
const EMPTY: Record<Filter, string> = { pending: 'Nothing is awaiting instruction', unpriced: 'Every variation awaiting instruction has a quote', exposed: 'No work has been done without an instruction', instructed: 'No variations have been instructed', declined: 'No variations have been declined', all: 'No variations have been raised' };

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
  useEffect(() => { if (linked) setFilter(linked); else if (bare) setFilter('pending'); }, [linked, bare]);
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const [reason, setReason] = useState('');
  const snap = ctx.snap;
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;
  const scoped = snap.variations.filter(v => (!project || v.projectId === project) && (!trade || v.trade === trade) && (!reason || v.reason === reason));
  const pick: Record<Filter, (v: Variation) => boolean> = { pending: isPending, unpriced: isUnpriced, exposed: isExposed, instructed: v => v.instruction === 'instructed', declined: v => v.instruction === 'declined', all: () => true };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, scoped.filter(pick[k]).length])) as Record<Filter, number>;
  const rank = (v: Variation) => isExposed(v) ? 0 : isUnpriced(v) ? 1 : isPending(v) ? 2 : v.instruction === 'instructed' ? 3 : 4;
  const shown = scoped.filter(pick[filter]).sort((a, b) => rank(a) - rank(b) || byRaised(a, b));
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
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
    a.download = exportFileName('variations', ctx.day, p?.projectNumber);
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const d = (kind: 'variation-price' | 'variation-instruct' | 'variation-decline' | 'variation-reopen' | 'variation-details', variation: Variation) => ctx.setDialog({ kind, variation });
  return <div className="view">
    <div className="pagehead"><div><h2>Variations</h2><p>{counts.pending} awaiting instruction across {ctx.projects.length} projects · {counts.unpriced ? `${counts.unpriced} without a quote` : 'all priced'} · {counts.exposed ? <span className="late">{counts.exposed} done without an instruction</span> : 'nothing done uninstructed'} · {counts.instructed ? `${counts.instructed} instructed worth ${fmtMoney(instructedTotal)}` : '0 instructed'} · {counts.declined} declined</p></div>
      <div className="actions">{shown.length > 0 && <BtnQ onClick={download} aria-label={`Download ${shown.length} ${shown.length === 1 ? 'variation' : 'variations'} as a spreadsheet (CSV)`}>Download spreadsheet</BtnQ>}{counts.unpriced > 0 && <Btn onClick={() => { const v = shown.find(isUnpriced) ?? scoped.find(isUnpriced); if (v) d('variation-price', v); }}>Price the oldest</Btn>}</div></div>
    <div className="filters">
      {FILTERS.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{VARIATION_TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Reason <select value={reason} onChange={e => setReason(e.target.value)}><option value="">Any reason</option>{VARIATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      {narrowed && <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button>}
    </div>
    <div className="panel"><table className="reg cards"><thead><tr><th>Ref</th><th>Variation</th><th>Project</th><th>Raised</th><th>Instruction</th><th className="money">Quoted</th><th className="money">Instructed</th><th className="money">Margin</th><th><span className="sr">Action</span></th></tr></thead><tbody>
      {shown.length ? shown.map(v => { const margin = estimatedMargin(v); const pct = v.instruction === 'declined' ? undefined : marginPct(v); return <tr key={v.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(v.projectId)}/variation/${v.id}`)}>
        <td className="c-ref"><span className="ref">{v.reference}</span></td>
        <td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{v.description}</div><div className="rowsub">{v.location || 'no location'} · {v.trade ?? 'trade not set'} · {v.reason ?? 'reason not set'}{v.workDone && <> · <span className="late">work already done</span></>}</div></td>
        <td data-label="Project">{name(v.projectId)}</td>
        <td className="due" data-label="Raised">{fmtDay(v.raisedAt)}<div className="rowsub">{source(v)} · {v.raisedBy}</div></td>
        <td data-label="Instruction"><InstructionTag v={v} />{v.instruction === 'instructed' && <div className="rowsub">{v.instructionReference} · {v.instructedBy} · {v.instructedOn}</div>}{v.instruction === 'declined' && <div className="rowsub">{v.events.slice().reverse().find(e => e.kind === 'declined')?.note}</div>}</td>
        <td className="money" data-label="Quoted"><Money n={v.quotedValue} /></td>
        <td className="money" data-label="Instructed"><Money n={v.instruction === 'instructed' ? variationValue(v) : undefined} /></td>
        <td className="money" data-label="Margin">{v.instruction === 'declined' ? <span className="fine">—</span> : <><Money n={margin} className={margin !== undefined && margin < 0 ? 'late' : ''} />{pct !== undefined && <div className="rowsub num">{fmtPct(pct)}</div>}</>}</td>
        <td className="c-actions" onClick={e => e.stopPropagation()}><div className="actions">
          {v.instruction === 'pending' && (v.quotedValue === undefined ? <Btn className="btn-sm" onClick={() => d('variation-price', v)}>Price</Btn> : <BtnQ className="btn-sm" onClick={() => d('variation-price', v)}>Reprice</BtnQ>)}
          {v.instruction === 'pending' && (v.quotedValue === undefined ? <BtnQ className="btn-sm" onClick={() => d('variation-instruct', v)}>Instruct</BtnQ> : <Btn className="btn-sm" onClick={() => d('variation-instruct', v)}>Instruct</Btn>)}
          {v.instruction === 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-decline', v)}>Decline</BtnQ>}
          {v.instruction !== 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-reopen', v)}>Reopen</BtnQ>}
        </div></td></tr>; }) : <tr><td colSpan={9} className="empty">{snap.variations.length === 0 && !narrowed ? FIRST : <>{EMPTY[filter]}{narrowed ? ' for these filters' : ''}.</>}{narrowed && <> <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button></>}</td></tr>}
    </tbody>{shown.length > 1 && <tfoot><tr><td colSpan={5} className="c-title">{shown.length} shown</td><td className="money" data-label="Quoted"><Money n={sum(v => v.quotedValue)} /></td><td className="money" data-label="Instructed"><Money n={sum(v => v.instruction === 'instructed' ? variationValue(v) : undefined)} /></td><td className="money" data-label="Margin"><Money n={sum(v => v.instruction === 'declined' ? undefined : estimatedMargin(v))} /></td><td /></tr></tfoot>}</table>
      <div className="panel-foot">Quoted is what was put to the client; instructed is what they agreed, and it fixes the value from then on. Margin is the value less expected cost (labour × rate, parts, plant and subcontract), so it is an estimate until the job is costed. “Done, not instructed” is work carried out on a say-so with nothing in writing; get the client’s sign-off recorded before it is invoiced. Download spreadsheet saves the variations shown here, with their figures, as a CSV file that opens in Excel.</div></div>
  </div>;
}
