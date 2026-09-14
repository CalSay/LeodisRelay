'use client';
import { useState } from 'react';
import type { Variation } from '@/lib/types';
import { VARIATION_REASONS, VARIATION_TRADES, estimatedMargin, fmtMoney, fmtPct, variationValue } from '@/lib/variations';
import type { Ctx } from './ctx';
import { Btn, BtnQ, InstructionTag, Money } from './bits';
import { byRaised, fmtDay, isExposed, isPending, isUnpriced, shortRef } from './model';

type Filter = 'pending' | 'unpriced' | 'exposed' | 'instructed' | 'declined' | 'all';
const FILTERS: [Filter, string, boolean][] = [['pending', 'Awaiting instruction', false], ['unpriced', 'Needs a quote', false], ['exposed', 'Done, not instructed', true], ['instructed', 'Instructed', false], ['declined', 'Declined', false], ['all', 'All', false]];

/**
 * The variation register across projects: the same rows as the Variation
 * Register list on SharePoint, with the office's verbs on each. A variation
 * is priced, then instructed or declined; the money columns are the list's
 * calculated columns worked the same way, so the two never disagree.
 */
export function VariationsView({ ctx }: { ctx: Ctx }) {
  const [filter, setFilter] = useState<Filter>('pending');
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
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.projectNumber ?? '';
  const source = (v: Variation) => { const r = v.raisedByReport ? snap.reports.find(x => x.id === v.raisedByReport) : undefined; return r ? shortRef(r.reference) : v.source === 'office' ? 'Raised in the office' : '—'; };
  const sum = (pick: (v: Variation) => number | undefined) => shown.reduce((n, v) => n + (pick(v) ?? 0), 0);
  const instructedTotal = scoped.filter(v => v.instruction === 'instructed').reduce((n, v) => n + (variationValue(v) ?? 0), 0);
  const d = (kind: 'variation-price' | 'variation-instruct' | 'variation-decline' | 'variation-reopen' | 'variation-details', variation: Variation) => ctx.setDialog({ kind, variation });
  return <div className="view">
    <div className="pagehead"><div><h3>Variations</h3><p>{counts.pending} awaiting instruction across {ctx.projects.length} projects · {counts.unpriced ? `${counts.unpriced} without a quote` : 'all priced'} · {counts.exposed ? <span className="late">{counts.exposed} done without an instruction</span> : 'nothing done uninstructed'} · {counts.instructed} instructed worth {fmtMoney(instructedTotal)} · {counts.declined} declined</p></div>
      <div className="actions">{counts.unpriced > 0 && <Btn onClick={() => { const v = shown.find(isUnpriced) ?? scoped.find(isUnpriced); if (v) d('variation-price', v); }}>Price the oldest</Btn>}</div></div>
    <div className="filters">
      {FILTERS.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{VARIATION_TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Reason <select value={reason} onChange={e => setReason(e.target.value)}><option value="">Any reason</option>{VARIATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
    </div>
    <div className="panel"><table className="reg"><thead><tr><th>Ref</th><th>Variation</th><th>Project</th><th>Raised</th><th>Instruction</th><th className="money">Quoted</th><th className="money">Instructed</th><th className="money">Margin</th><th></th></tr></thead><tbody>
      {shown.length ? shown.map(v => { const margin = estimatedMargin(v); const pct = v.instruction === 'declined' ? undefined : (margin === undefined ? undefined : margin / (variationValue(v) || 1)); return <tr key={v.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(v.projectId)}/variation/${v.id}`)}>
        <td><span className="ref">{v.reference}</span></td>
        <td><div className="rowtitle" style={{ fontSize: 13 }}>{v.description}</div><div className="rowsub">{v.location || 'no location'} · {v.trade ?? 'trade not set'} · {v.reason ?? 'reason not set'}{v.workDone && <> · <span className="late">work already done</span></>}</div></td>
        <td>{name(v.projectId)}</td>
        <td className="due">{fmtDay(v.raisedAt)}<div className="rowsub">{source(v)} · {v.raisedBy}</div></td>
        <td><InstructionTag v={v} />{v.instruction === 'instructed' && <div className="rowsub">{v.instructionReference} · {v.instructedBy} · {v.instructedOn}</div>}{v.instruction === 'declined' && <div className="rowsub">{v.events.slice().reverse().find(e => e.kind === 'declined')?.note}</div>}</td>
        <td className="money"><Money n={v.quotedValue} /></td>
        <td className="money"><Money n={v.instruction === 'instructed' ? variationValue(v) : undefined} /></td>
        <td className="money">{v.instruction === 'declined' ? <span className="fine">—</span> : <><Money n={margin} className={margin !== undefined && margin < 0 ? 'late' : ''} />{pct !== undefined && <div className="rowsub num">{fmtPct(pct)}</div>}</>}</td>
        <td onClick={e => e.stopPropagation()}><div className="actions" style={{ flexWrap: 'nowrap' }}>
          {v.instruction === 'pending' && (v.quotedValue === undefined ? <Btn className="btn-sm" onClick={() => d('variation-price', v)}>Price</Btn> : <BtnQ className="btn-sm" onClick={() => d('variation-price', v)}>Reprice</BtnQ>)}
          {v.instruction === 'pending' && (v.quotedValue === undefined ? <BtnQ className="btn-sm" onClick={() => d('variation-instruct', v)}>Instruct</BtnQ> : <Btn className="btn-sm" onClick={() => d('variation-instruct', v)}>Instruct</Btn>)}
          {v.instruction === 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-decline', v)}>Decline</BtnQ>}
          {v.instruction !== 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-reopen', v)}>Reopen</BtnQ>}
        </div></td></tr>; }) : <tr><td colSpan={9} className="empty">No variations {FILTERS.find(f => f[0] === filter)?.[1].toLowerCase()}{project || trade || reason ? ' in this scope' : ''}.</td></tr>}
    </tbody>{shown.length > 1 && <tfoot><tr><td colSpan={5}>{shown.length} shown</td><td className="money"><Money n={sum(v => v.quotedValue)} /></td><td className="money"><Money n={sum(v => v.instruction === 'instructed' ? variationValue(v) : undefined)} /></td><td className="money"><Money n={sum(v => v.instruction === 'declined' ? undefined : estimatedMargin(v))} /></td><td /></tr></tfoot>}</table>
      <div className="panel-foot">Quoted is what was put to the client; instructed is what they agreed, and it fixes the value from then on. Margin is the value less expected cost (labour × rate, parts, plant and subcontract), so it is an estimate until the job is costed. “Done, not instructed” is work carried out on a say-so with nothing in writing; get the client’s sign-off recorded before it is invoiced.</div></div>
  </div>;
}
