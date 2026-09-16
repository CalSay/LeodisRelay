'use client';
import './variations.css';
import { useEffect, useState, type ReactNode } from 'react';
import { PhotoImage } from '@/components/PhotoImage';
import type { Variation, VariationEventKind } from '@/lib/types';
import { VARIATION_REASONS, VARIATION_TRADES, estimatedMargin, expectedCost, fmtHours, fmtMoney, fmtPct, marginPct, variationValue } from '@/lib/variations';
import type { Ctx } from './ctx';
import { Btn, BtnQ } from './bits';
import { Band, CardList, Mark, StubCard, type MarkKind } from './marks';
import { byRaised, daysSince, fmtDay, fmtWhen, isExposed, isPending, isUnpriced, shortRef } from './model';

type Stage = 'quote' | 'client' | 'instructed' | 'declined';
type Flag = 'exposed' | 'chase' | 'waiting' | 'instructed' | 'declined';
type Group = 'urgency' | 'project' | 'reason';
type DialogKind = 'variation-price' | 'variation-instruct' | 'variation-decline' | 'variation-reopen' | 'variation-details';

const STAGES: { k: Stage; label: string; test: (v: Variation) => boolean }[] = [
  { k: 'quote', label: 'Needs a quote', test: isUnpriced },
  { k: 'client', label: 'With client', test: v => isPending(v) && v.quotedValue !== undefined },
  { k: 'instructed', label: 'Instructed', test: v => v.instruction === 'instructed' },
  { k: 'declined', label: 'Declined', test: v => v.instruction === 'declined' },
];
const stageOf = (v: Variation): Stage => STAGES.find(s => s.test(v))!.k;
const BANDS: [Flag, MarkKind, string][] = [['exposed', 'urgent', 'Done, not instructed'], ['chase', 'action', 'Chase the client'], ['waiting', 'none', 'Waiting'], ['instructed', 'done', 'Instructed'], ['declined', 'none', 'Declined']];
const EVENT: Record<VariationEventKind, [string, string]> = { raised: ['Raised', 'gold'], priced: ['Priced', 'gold'], instructed: ['Instructed', 'ok'], declined: ['Declined', 'bad'], reopened: ['Reopened', 'warn'], details: ['Details changed', ''], note: ['Note', ''] };
const CHASE_DAYS = 14;

/** Days since the latest quote was recorded, or undefined when no pricing event is on file. */
const quotedDays = (v: Variation): number | undefined => { const e = v.events.filter(x => x.kind === 'priced').at(-1); return e ? daysSince(e.at) : undefined; };
const isChase = (v: Variation): boolean => isPending(v) && !v.workDone && v.quotedValue !== undefined && (quotedDays(v) ?? 0) > CHASE_DAYS;
const flagOf = (v: Variation): Flag => v.instruction === 'declined' ? 'declined' : v.instruction === 'instructed' ? 'instructed' : v.workDone ? 'exposed' : isChase(v) ? 'chase' : 'waiting';
const markOf = (v: Variation): MarkKind => { const f = flagOf(v); return f === 'exposed' ? 'urgent' : f === 'chase' || (f === 'waiting' && isUnpriced(v)) ? 'action' : f === 'instructed' ? 'done' : 'none'; };
const sum = (vs: Variation[], pick: (v: Variation) => number | undefined) => vs.reduce((n, v) => n + (pick(v) ?? 0), 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const exposure = (v: Variation) => v.quotedValue ?? expectedCost(v);
const dayOf = (s?: string) => s && /^\d{4}-\d{2}-\d{2}/.test(s) ? fmtDay(s) : s || 'date not recorded';

/**
 * The variation register across projects, worked as a pipeline: needs a
 * quote, with the client, instructed, declined. The money figures are the
 * Variation Register list's calculated columns worked the same way, so the
 * two never disagree. Work done without an instruction is always on top.
 */
export function VariationsView({ ctx }: { ctx: Ctx }) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [group, setGroup] = useState<Group>('urgency');
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const [reason, setReason] = useState('');
  const snap = ctx.snap;
  const routed = snap?.variations.find(v => v.id === ctx.route.a);
  const routedStage = routed ? stageOf(routed) : null;
  // Follow the record in the hash into its stage, including after a dialog moves it on.
  useEffect(() => { if (routedStage) setStage(routedStage); }, [ctx.route.a, routedStage]);
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;

  const scoped = snap.variations.filter(v => (!project || v.projectId === project) && (!trade || v.trade === trade) && (!reason || v.reason === reason));
  const byStage = Object.fromEntries(STAGES.map(s => [s.k, scoped.filter(s.test)])) as Record<Stage, Variation[]>;
  const current: Stage = stage ?? (byStage.client.length ? 'client' : 'quote');
  const items = byStage[current];
  const selected = items.find(v => v.id === ctx.route.a) ?? items[0];
  const proj = (id: string) => ctx.projects.find(p => p.id === id);
  const pick = (s: Stage) => { setStage(s); const first = byStage[s][0]; ctx.go(first ? `#/variations/${first.id}` : '#/variations'); };

  const money = (v: Variation): ReactNode => {
    const f = flagOf(v);
    if (f === 'declined') return v.quotedValue === undefined ? <span className="ro-vo-quiet">Not priced</span> : <s className="ro-vo-quiet">{fmtMoney(v.quotedValue)}</s>;
    if (f === 'instructed') return <span className="ro-vo-in">{fmtMoney(variationValue(v))}</span>;
    if (v.quotedValue === undefined) return <span className={v.workDone ? 'ro-vo-neg' : ''}>Not priced</span>;
    return <span className={f === 'exposed' || f === 'chase' ? 'ro-vo-neg' : ''}>{fmtMoney(v.quotedValue)} quoted</span>;
  };
  const card = (v: Variation) => <StubCard key={v.id} href={`#/variations/${v.id}`} on={selected?.id === v.id} quiet={v.instruction === 'declined'}
    project={proj(v.projectId)?.projectNumber ?? ''} code={shortRef(v.reference)} title={v.description}
    sub={<>{[proj(v.projectId)?.projectName ?? v.projectId, v.reason ?? 'reason not set', v.trade ?? 'trade not set'].join(' · ')}{isExposed(v) && <> · <b className="ro-vo-neg">work done</b></>}</>}
    aside={money(v)} mark={markOf(v)} markLabel={flagOf(v) === 'chase' ? `Quoted ${quotedDays(v)} days ago` : BANDS.find(b => b[0] === flagOf(v))![2]} />;

  const exposed = items.filter(isExposed);
  let list: ReactNode;
  if (!items.length) list = <div className="ro-empty"><Mark kind="done" /><b>Nothing here</b><span>No variations {STAGES.find(s => s.k === current)!.label.toLowerCase()}{project || trade || reason ? ' for this filter' : ''}.</span></div>;
  else if (group === 'urgency') list = BANDS.map(([k, m, l]) => {
    const g = items.filter(v => flagOf(v) === k).sort((a, b) => (quotedDays(b) ?? 0) - (quotedDays(a) ?? 0) || byRaised(a, b));
    return g.length ? <div key={k}><Band kind={m} label={l} count={g.length} /><CardList>{g.map(card)}</CardList></div> : null;
  });
  else {
    const groups = new Map<string, Variation[]>();
    for (const v of items) { const key = group === 'project' ? proj(v.projectId)?.projectName ?? v.projectId : v.reason ?? 'Reason not set'; groups.set(key, [...(groups.get(key) ?? []), v]); }
    list = [...groups.entries()].map(([k, g]) => ({ k, g: g.sort(byRaised), total: sum(g, variationValue), exp: g.filter(isExposed).length }))
      .sort((a, b) => b.total - a.total || a.k.localeCompare(b.k))
      .map(({ k, g, total, exp }) => <div key={k}><div className="ro-vo-grouphead"><b>{k}</b><span>· {g.length} · {fmtMoney(total)}</span>{exp > 0 && <span className="ro-vo-neg">· {exp} done, not instructed</span>}</div><CardList>{g.map(card)}</CardList></div>);
  }
  const quoted = sum(items, v => v.quotedValue), instructed = sum(items.filter(v => v.instruction === 'instructed'), variationValue);
  const margin = sum(items.filter(v => v.instruction !== 'declined'), estimatedMargin);

  return <div className="view ro-vo">
    <div className="ro-vo-pipe" role="group" aria-label="Variation stage">{STAGES.map(s => {
      const g = byStage[s.k], exp = g.filter(isExposed).length, chase = g.filter(isChase).length;
      const line = s.k === 'quote' ? 'Not yet priced' : s.k === 'client' ? `${fmtMoney(sum(g, v => v.quotedValue))} quoted` : s.k === 'instructed' ? `${fmtMoney(sum(g, variationValue))} instructed` : `${fmtMoney(sum(g, v => v.quotedValue))} not charged`;
      return <button type="button" key={s.k} className={`ro-vo-stage ${s.k === 'declined' ? 'closed' : ''}`} aria-pressed={current === s.k} onClick={() => pick(s.k)}>
        <span className="ro-vo-sl">{s.label}</span><span className="ro-vo-sn">{g.length}</span>
        <span className="ro-vo-sm">{line}</span>
        {(exp > 0 || chase > 0) && <span className="ro-vo-sf">{exp > 0 && <span><Mark kind="urgent" size="sm" />{exp} done, not instructed</span>}{chase > 0 && <span><Mark kind="action" size="sm" />{chase} to chase</span>}</span>}
      </button>;
    })}</div>

    <div className="ro-vo-bar">
      <label>Group by <select value={group} onChange={e => setGroup(e.target.value as Group)}><option value="urgency">Urgency</option><option value="project">Project</option><option value="reason">Reason</option></select></label>
      <span className="ro-vo-grow" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{VARIATION_TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Reason <select value={reason} onChange={e => setReason(e.target.value)}><option value="">Any reason</option>{VARIATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
    </div>

    <div className="ro-vo-body">
      <section className="col focus ro-vo-col" aria-label={STAGES.find(s => s.k === current)!.label}>
        <div className="col-head"><h4>{STAGES.find(s => s.k === current)!.label}</h4><i>{plural(items.length, 'variation')}</i></div>
        <div className="ro-vo-scroll">
          {exposed.length > 0 && <div className="ro-alert" role="alert"><Mark kind="urgent" /><span><b>{fmtMoney(sum(exposed, exposure))} of work done without an instruction</b>{plural(exposed.length, 'variation')}{exposed.some(isUnpriced) ? ', some not yet priced' : ''}. Get the client&rsquo;s sign-off before invoicing.</span><span /></div>}
          {list}
        </div>
        {items.length > 0 && <div className="ro-vo-foot"><span>{items.length} shown</span><span>Quoted <b>{fmtMoney(quoted)}</b></span><span>Instructed <b>{fmtMoney(instructed)}</b></span><span>Est. margin <b className={margin < 0 ? 'ro-vo-neg' : ''}>{fmtMoney(margin)}</b></span></div>}
      </section>
      <section className="col ro-vo-col ro-vo-detailcol" aria-label="Variation detail">
        <div className="col-head"><h4>Variation detail</h4><i>{selected?.reference ?? ''}</i></div>
        <div className="ro-vo-scroll">{selected ? <Detail ctx={ctx} v={selected} /> : <div className="ro-empty"><Mark kind="none" /><b>Nothing selected</b><span>Pick a variation to see its money and history.</span></div>}</div>
      </section>
    </div>
  </div>;
}

function Detail({ ctx, v }: { ctx: Ctx; v: Variation }) {
  const d = (kind: DialogKind) => ctx.setDialog({ kind, variation: v });
  const project = ctx.projects.find(p => p.id === v.projectId);
  const report = v.raisedByReport ? ctx.snap?.reports.find(r => r.id === v.raisedByReport) : undefined;
  const stage = STAGES.find(s => s.k === stageOf(v))!;
  const days = quotedDays(v), chase = isChase(v), exposed = isExposed(v);
  const cost = expectedCost(v), value = variationValue(v), margin = v.instruction === 'declined' ? undefined : estimatedMargin(v), pct = v.instruction === 'declined' ? undefined : marginPct(v);
  const evidence = v.events.find(e => e.kind === 'raised')?.photos ?? [];
  const quotedWhen = days === undefined ? '' : days === 0 ? ' today' : ` ${plural(days, 'day')} ago`;

  let mark: MarkKind, head: string, why: ReactNode, buttons: ReactNode;
  if (v.instruction === 'declined') {
    mark = 'none'; head = 'Declined'; why = v.events.filter(e => e.kind === 'declined').at(-1)?.note || 'Not going ahead.';
    buttons = <BtnQ onClick={() => d('variation-reopen')}>Reopen</BtnQ>;
  } else if (v.instruction === 'instructed') {
    mark = 'done'; head = `Instructed · ${v.instructionReference || 'no reference'}`;
    why = `${v.instructedBy || 'Instructor not recorded'}, ${dayOf(v.instructedOn)}. The value is fixed at ${fmtMoney(value)}.`;
    buttons = <BtnQ onClick={() => d('variation-reopen')}>Reopen</BtnQ>;
  } else if (v.quotedValue === undefined) {
    mark = exposed ? 'urgent' : 'action'; head = exposed ? 'Done, not priced or instructed' : 'Needs a quote';
    why = exposed ? 'The work has been carried out. Price it and get the client to confirm in writing.' : 'Price it so it can go to the client.';
    buttons = <><Btn onClick={() => d('variation-price')}>Price it</Btn><BtnQ onClick={() => d('variation-instruct')}>Record instruction</BtnQ><BtnQ onClick={() => d('variation-decline')}>Decline</BtnQ></>;
  } else {
    mark = exposed ? 'urgent' : 'action'; head = exposed ? 'Done, not instructed' : chase ? 'Chase the client' : 'With client';
    why = `Quoted ${fmtMoney(v.quotedValue)}${quotedWhen}.${exposed ? ' Get the client’s sign-off before invoicing.' : chase ? ' Worth chasing.' : ''}`;
    buttons = <><Btn onClick={() => d('variation-instruct')}>Record instruction</Btn><BtnQ onClick={() => d('variation-price')}>Reprice</BtnQ><BtnQ onClick={() => d('variation-decline')}>Decline</BtnQ></>;
  }
  const costing = cost === undefined ? 'Not costed.' : [
    v.labourHours !== undefined || v.labourRate !== undefined ? `${fmtHours(v.labourHours)} at ${fmtMoney(v.labourRate)}/h` : '',
    v.partsCost !== undefined ? `${fmtMoney(v.partsCost)} parts` : '',
    v.plantSubcontract !== undefined ? `${fmtMoney(v.plantSubcontract)} plant or subcontract` : '',
    v.upliftPct !== undefined ? `${v.upliftPct}% uplift` : '',
  ].filter(Boolean).join(' · ') + '. Margin is an estimate until the job is costed.';
  const signed = v.signedInstruction?.trim();

  return <div className="ro-vo-detail">
    <div><div className="ro-vo-code">{v.reference}</div><h3>{v.description}</h3></div>
    <div className="ro-vo-pills">
      <span className="ro-vo-pill stage">{stage.label}</span>
      {exposed && <span className="ro-vo-pill urgent">Done, not instructed</span>}
      {chase && <span className="ro-vo-pill action">Quoted {days}d ago</span>}
      {v.workDone && !isPending(v) && <span className="ro-vo-pill">Work done</span>}
    </div>
    <div className="ro-vo-next">
      <div className="ro-vo-why"><Mark kind={mark} /><span><b>{head}</b>{why}</span></div>
      <div className="ro-vo-btns">{buttons}<BtnQ className="ro-vo-edit" onClick={() => d('variation-details')}>Edit details</BtnQ></div>
    </div>
    <div className="ro-vo-mgrid">
      <div><span>Quoted</span><b>{fmtMoney(v.quotedValue)}</b></div>
      <div><span>Instructed</span><b className={v.instruction === 'instructed' ? 'ro-vo-in' : ''}>{v.instruction === 'instructed' ? fmtMoney(value) : '—'}</b></div>
      <div><span>Expected cost</span><b>{fmtMoney(cost)}</b></div>
      <div><span>Est. margin</span><b className={margin !== undefined && margin < 0 ? 'ro-vo-neg' : ''}>{fmtMoney(margin)}{pct !== undefined && <small> {fmtPct(pct)}</small>}</b></div>
    </div>
    {cost !== undefined && value !== undefined && value > 0 && <div className={`ro-vo-mbar ${cost > value ? 'over' : ''}`} role="img" aria-label={`Expected cost is ${Math.round(100 * cost / value)}% of the value`}><i style={{ width: `${Math.min(100, Math.max(0, 100 * cost / value))}%` }} /></div>}
    <p className="ro-vo-hint">{costing}</p>
    <dl className="ro-vo-kv">
      <dt>Project</dt><dd>{project ? <a href={`#/projects/${project.id}`}>{project.projectName}</a> : v.projectId}</dd>
      <dt>Location</dt><dd>{v.location || 'Not recorded'}</dd>
      <dt>Reason</dt><dd>{v.reason ?? 'Not set'}</dd>
      <dt>Trade</dt><dd>{v.trade ?? 'Not set'}</dd>
      <dt>Asked for by</dt><dd>{v.askedBy || 'Not recorded'}</dd>
      <dt>Raised in</dt><dd>{report ? <a href={`#/projects/${v.projectId}/report/${report.id}`}>{project?.projectNumber ? `${project.projectNumber} · ` : ''}{shortRef(report.reference)}</a> : v.source === 'office' ? 'The office' : 'Report not found'} · {v.raisedBy}, {fmtDay(v.raisedAt)}</dd>
      {v.instruction === 'instructed' && <><dt>Signed copy</dt><dd>{signed ? /^https?:\/\//i.test(signed) ? <a href={signed} target="_blank" rel="noreferrer">Open signed copy<span className="sr"> (opens in a new tab)</span></a> : signed : 'Not linked yet'}</dd></>}
    </dl>
    {evidence.length > 0 && <div><h5 className="ro-vo-h5">Evidence · {evidence.length}</h5><div className="ro-vo-photos">{evidence.map((ph, i) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${i + 1}`} />{ph.caption && <figcaption>{ph.caption}</figcaption>}</figure>)}</div></div>}
    <div><h5 className="ro-vo-h5">Timeline</h5><ol className="ro-vo-tl">{v.events.map((e, i) => { const [label, cls] = EVENT[e.kind] ?? [e.kind, '']; return <li key={i}><span className={`ro-vo-dot ${cls}`} aria-hidden="true" /><span className="ro-vo-tb"><b>{label}</b>{e.note && <q>{e.note}</q>}<small>{e.actor} · {fmtWhen(e.at)}</small></span></li>; })}</ol></div>
  </div>;
}
